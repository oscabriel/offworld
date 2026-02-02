# Offworld Architecture Review

**Date:** 2026-01-29  
**Scope:** `@apps/cli/`, `@packages/sdk/`, `@packages/types/`, `@packages/backend-api/`  
**Status:** Open for discussion

---

## Executive Summary

The current architecture is solid for a V1 with excellent type safety and clear package boundaries. However, several issues create unnecessary complexity for maintenance and distribution. The highest-impact fixes are merging `backend-api` into the SDK, splitting complex handlers, and making Convex an optional dependency.

---

## Identified Issues & Solutions

### 1. backend-api Package Indirection

**Issue:** An entire package exists solely to copy 5 generated files from `backend/convex/_generated/`. This adds versioning overhead, build complexity, and cognitive load for developers.

**Impact:**

- 3-step build chain: `backend` → `backend-api` → `sdk`
- Must version/publish `backend-api` even though it's just generated types
- Confusing for new developers ("Why does this package exist?")

**Solutions (pick one):**

| Approach                                  | Effort | Pros                       | Cons                                   |
| ----------------------------------------- | ------ | -------------------------- | -------------------------------------- |
| **A. Merge into SDK**                     | Low    | Single package to maintain | Slwightly larger SDK                   |
| **B. Rename to `@offworld/convex-types`** | Low    | Clearer intent             | Still separate package                 |
| **C. TypeScript path mapping**            | Medium | No copy needed             | Requires tsconfig changes in consumers |

**Recommendation:** Option A - Add a build step to SDK that copies `../backend/convex/_generated/` into SDK's `dist/convex-types/`. Export as `@offworld/sdk/convex`.

---

### 2. Handler Complexity

**Issue:** `pull.ts` is 419 lines handling git operations, remote API checks, local caching, AI generation, and user prompts all mixed together. Violates Single Responsibility Principle.

**Impact:**

- Difficult to test (too many dependencies)
- Risky to modify (many code paths)
- Hard to understand for contributors

**Solution:** Split into service layers

```
apps/cli/src/
├── handlers/
│   └── pull.ts           # ~100 lines, orchestration only
├── services/
│   ├── repo-service.ts   # Git operations
│   ├── reference-service.ts  # Fetch/generate
│   └── cache-service.ts  # Local cache management
```

**Implementation:**

1. Extract `ensureRepoCloned()` → `repo-service.ts`
2. Extract reference fetching/generation logic → `reference-service.ts`
3. Extract cache checking → `cache-service.ts`
4. Handler only coordinates services and handles UX

---

### 3. Tightly Coupled Packages

**Issue:** `@offworld/sdk` and `@offworld/types` are versioned separately but change together. Risk of version mismatch in published packages.

**Impact:**

- `workspace:*` resolves to specific versions on publish
- Must bump both packages for every types change
- Users may get `sdk@0.2.1` depending on `types@0.2.0` if not careful

**Solution:** Keep separate (correct decision), add safeguards

**Implementation:**

1. Use exact versions in published packages (not `^` ranges)
2. Add pre-publish check: verify all workspace packages have same version
3. Consider changesets or Lerna for coordinated releases

---

### 4. Naming Clarity

**Issue:** `backend-api` name implies it's an API implementation, but it's just type definitions.

**Solution:** Rename to `@offworld/convex-types` or merge into SDK (see Issue #1).

---

### 5. Convex Hard Dependency

**Issue:** SDK requires `convex` package (~90KB) and Convex cloud connection for all operations, even offline-only usage.

**Impact:**

- Large bundle size
- Can't use CLI offline for local-only operations
- Dependency on third-party service availability

**Solution:** Make Convex optional peer dependency

**Implementation:**

```json
// packages/sdk/package.json
{
	"peerDependencies": {
		"convex": "^1.0.0"
	},
	"peerDependenciesMeta": {
		"convex": { "optional": true }
	}
}
```

```typescript
// sync.ts
let ConvexHttpClient: typeof import("convex/browser").ConvexHttpClient | undefined;

try {
	const convex = await import("convex/browser");
	ConvexHttpClient = convex.ConvexHttpClient;
} catch {
	// Offline mode - only local operations available
}
```

---

### 6. Scattered Caching Logic

**Issue:** Caching logic spread across `pull.ts`, `sync.ts`, `config.ts` with no unified interface.

**Impact:**

- Inconsistent cache behavior
- Hard to add new cache features
- Cache invalidation logic duplicated

**Solution:** Unified caching abstraction

```typescript
// packages/sdk/src/cache.ts
export interface CacheEntry {
	commitSha: string;
	referenceContent: string;
	generatedAt: string;
}

export class ReferenceCache {
	async get(source: RepoSource): Promise<CacheEntry | null>;
	async set(source: RepoSource, entry: CacheEntry): Promise<void>;
	async isValid(source: RepoSource, commitSha: string): Promise<boolean>;
	async invalidate(source: RepoSource): Promise<void>;
	async clear(): Promise<void>;
}
```

---

### 7. Build Complexity

**Issue:** 5 build steps required for CLI: `types` → `backend` → `backend-api` → `sdk` → `cli`, each using `tsdown` (Rollup-based).

**Impact:**

- Slow development builds
- Complex CI/CD pipeline
- Hard to debug cross-package issues

**Solution:** Simplify build pipeline

**Implementation:**

1. Merge `backend-api` into SDK (eliminates one build)
2. Consider `tsc` only for types package (it's just types)
3. Keep `tsdown` for SDK and CLI (need bundling)
4. Add `turborebo` pipelines for parallel builds where possible

---

### 8. Large Bundle Size

**Issue:** SDK pulls in `@opencode-ai/sdk` (~500KB) and `convex` (~90KB). Users pay for AI generation even if they only use `ow list`.

**Solutions:**

**Option A: SDK-lite package**

```
@offworld/sdk-lite    # Clone, config, map, list only
@offworld/sdk         # Full SDK with AI + Convex
```

**Option B: Dynamic imports**

```typescript
// Only load AI SDK when needed
async function generateWithAI() {
	const { streamPrompt } = await import("./ai/index.js");
	// ...
}
```

**Recommendation:** Start with Option B (dynamic imports), evaluate Option A if bundle size remains an issue.

---

### 9. Unclear Public API

**Issue:** SDK exports 216 lines of re-exports from 20+ modules. No clear boundary between public API and internal utilities.

**Solution:** Explicit public API

```typescript
// packages/sdk/src/index.ts (public API)
export { cloneRepo, updateRepo, removeRepo } from "./clone.js";
export { loadConfig, saveConfig } from "./config.js";
// ... only intended public exports

// packages/sdk/src/internal.ts (for CLI use only)
export { internalUtils } from "./util.js";
export { debugHelpers } from "./debug.js";
```

---

### 10. Mixed Sync Concerns

**Issue:** `sync.ts` mixes Convex client setup, API calls, GitHub API calls, and business logic.

**Solution:** Separate concerns

```
packages/sdk/src/
├── api/
│   ├── client.ts          # Convex client setup
│   ├── references.ts      # Reference API calls
│   └── github.ts          # GitHub API calls
├── sync/
│   ├── validation.ts      # canPushToWeb(), validatePushAllowed()
│   └── staleness.ts       # checkStaleness()
└── sync.ts                # Re-exports only
```

---

## Priority Matrix

| Priority  | Issue                         | Effort | Impact                     |
| --------- | ----------------------------- | ------ | -------------------------- |
| 🔴 High   | Merge backend-api into SDK    | Low    | Reduces maintenance burden |
| 🔴 High   | Make Convex optional          | Medium | Enables offline usage      |
| 🔴 High   | Split pull.ts handler         | Medium | Improves testability       |
| 🟡 Medium | Unified caching layer         | Medium | Reduces bugs               |
| 🟡 Medium | Dynamic imports for AI SDK    | Low    | Reduces bundle size        |
| 🟢 Low    | Separate sync concerns        | Medium | Code organization          |
| 🟢 Low    | Explicit public API           | Low    | Better DX                  |
| 🟢 Low    | Build pipeline simplification | High   | Faster builds              |

---

## Recommended Action Plan

### Phase 1: Foundation (Week 1)

1. [ ] Merge `backend-api` into SDK (`@offworld/sdk/convex`)
2. [ ] Make `convex` optional peer dependency
3. [ ] Add dynamic import for `@opencode-ai/sdk`

### Phase 2: Code Quality (Week 2)

4. [ ] Split `pull.ts` into service layers
5. [ ] Create unified `ReferenceCache` class
6. [ ] Separate sync/storage concerns

### Phase 3: Polish (Week 3)

7. [ ] Define explicit public API surface
8. [ ] Add version synchronization check to publish script
9. [ ] Evaluate SDK-lite package need

---

## Open Questions

1. Should we keep `types` as a separate package or merge into SDK?
2. Do we need an SDK-lite package, or are dynamic imports sufficient?
3. Should we support CJS or go ESM-only?
4. What's the offline UX when Convex is not available?

---

## Appendix: Current Dependency Graph

```
apps/cli/
├── @offworld/sdk (workspace:*)
├── @offworld/types (workspace:*)
├── @orpc/server
└── trpc-cli

packages/sdk/
├── @offworld/backend-api (workspace:*)
├── @offworld/types (workspace:*)
├── @opencode-ai/sdk
├── convex
└── zod

packages/types/
└── zod

packages/backend-api/
└── convex
```

**Proposed Simplified Graph:**

```
apps/cli/
├── @offworld/sdk
├── @orpc/server
└── trpc-cli

packages/sdk/
├── @offworld/types (peer dependency, optional)
├── @opencode-ai/sdk (dynamic import)
├── convex (peer dependency, optional)
└── zod

packages/types/
└── zod
```
