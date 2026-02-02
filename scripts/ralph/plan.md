# Offworld Architecture Refactor Plan

Date: 2026-01-29
Scope: apps/cli, packages/sdk, packages/types, packages/backend, packages/backend-api
Goal: Reduce package indirection, make heavy deps optional, clarify API boundaries, and simplify handlers without changing core behavior.

---

## Guiding Principles

- Preserve CLI UX and current behavior; changes should be structural, not functional.
- Keep ESM; avoid breaking public APIs unless clearly versioned.
- Prefer additive entrypoints for compatibility; remove deprecated paths in a later major.

---

## Phase 0: Decisions (1 day)

1. ESM-only remains supported.
2. Remove @offworld/backend-api (no transition period).
3. Offline UX when Convex is unavailable: throw a clear SyncUnavailableError when sync is invoked.

---

## Phase 1: Remove backend-api Indirection (Issue 1, 4, 7)

### Outcome

SDK owns Convex generated types; backend-api is removed.

### Steps

1. Add SDK build step to copy Convex generated files
   - New script: `packages/sdk/scripts/copy-convex-generated.ts`
   - Copy from `packages/backend/convex/_generated` to `packages/sdk/dist/convex/_generated`

2. Update SDK build script to run copy after tsdown
   - `packages/sdk/package.json` -> `"build": "tsdown && bun run ./scripts/copy-convex-generated.ts"`

3. Add explicit subpath exports for Convex types
   - `packages/sdk/package.json` -> add `"./convex/api"` and `"./convex/server"` with `types` + `import` paths
   - Example export mapping:
     - `"./convex/api": { "types": "./dist/convex/_generated/api.d.ts", "import": "./dist/convex/_generated/api.js" }`
     - `"./convex/server": { "types": "./dist/convex/_generated/server.d.ts", "import": "./dist/convex/_generated/server.js" }`

4. Replace internal imports
   - `packages/sdk/src/sync.ts`: replace `@offworld/backend-api/api` with `@offworld/sdk/convex/api` (or local path to dist output for build-time only)

5. Remove backend-api
   - Delete `packages/backend-api`
   - Remove from workspaces and from `scripts/bump-version.ts`
   - Remove dependency references in SDK and CLI

### Acceptance

- SDK builds with Convex API types available at `@offworld/sdk/convex/api`.
- No code imports `@offworld/backend-api`.

---

## Phase 2: Optional Convex + Optional AI (Issue 5, 8)

### Outcome

Default SDK entrypoint avoids heavy deps; sync/AI only load when used.

### Steps

1. Move sync API behind a subpath entrypoint
   - Create `packages/sdk/src/sync/index.ts` (re-exports)
   - Update `packages/sdk/src/index.ts` to stop re-exporting sync
   - Add export mapping in `packages/sdk/package.json`:
     - `"./sync": { "types": "./dist/sync/index.d.mts", "import": "./dist/sync/index.mjs" }`

2. Make Convex optional peer dependency
   - `packages/sdk/package.json`:
     - `peerDependencies`: `{ "convex": "^1" }`
     - `peerDependenciesMeta`: `{ "convex": { "optional": true } }`
   - Remove `convex` from `dependencies`

3. Dynamic import Convex in sync client
   - New helper `packages/sdk/src/sync/client.ts`:
     - `async function getConvexClient()` which tries `import("convex/browser")`
     - If unavailable, throw `SyncUnavailableError` with clear message

4. Move AI entrypoint behind a subpath entrypoint
   - `packages/sdk/src/ai/index.ts` stays; re-export via `"./ai"` subpath
   - Remove AI exports from `packages/sdk/src/index.ts`
   - Keep `@opencode-ai/sdk` dynamic import (already in `packages/sdk/src/ai/opencode.ts`)

5. Update CLI imports
   - CLI should import sync/AI from subpaths `@offworld/sdk/sync` and `@offworld/sdk/ai` (or `@offworld/sdk/internal`)

### Acceptance

- Installing `@offworld/sdk` does not require `convex` unless sync is used.
- AI code is not pulled by default entrypoint.

---

## Phase 3: Public API Boundary (Issue 9)

### Outcome

Clear SDK public API vs internal utilities used by CLI only.

### Steps

1. Define public surface
   - Create `packages/sdk/src/public.ts` with curated exports
   - Map `packages/sdk/src/index.ts` to re-export only `public.ts`

2. Create internal entrypoint
   - `packages/sdk/src/internal.ts` re-exports CLI-only utilities (sync helpers, installation helpers, internal config, etc.)
   - Add subpath export `"./internal"` in `packages/sdk/package.json`

3. Update CLI imports
   - Use `@offworld/sdk/internal` for CLI-specific utilities
   - Avoid importing from deep paths

### Acceptance

- Public entrypoint is small and documented.
- CLI uses only internal subpath or public exports.

---

## Phase 4: Handler Decomposition (Issue 2)

### Outcome

Pull/generate handlers are orchestrators; logic lives in reusable services.

### Steps

1. Introduce services
   - `apps/cli/src/services/repo-service.ts`
     - clone/update, path resolution, commit sha retrieval
   - `apps/cli/src/services/reference-service.ts`
     - remote check/download, local install, prompt decisions
   - `apps/cli/src/services/ai-service.ts`
     - wraps `generateReferenceWithAI` and debug streaming
   - `apps/cli/src/services/cache-service.ts`
     - wrapper around SDK cache module (Phase 5)

2. Refactor `pull.ts`
   - Keep CLI prompts and orchestration in handler
   - Move cache check, remote download logic, AI generation into services

3. Refactor `generate.ts`
   - Reuse services; extract shared `parseModelFlag` into a util

### Acceptance

- `apps/cli/src/handlers/pull.ts` under ~150 lines.
- Service modules are unit-testable with minimal prompt logic.

---

## Phase 5: Unified Reference Cache (Issue 6)

### Outcome

Reference metadata read/write and validation centralized in SDK.

### Steps

1. Add cache module in SDK
   - `packages/sdk/src/reference-cache.ts`
   - API:
     - `getMeta(source)`
     - `writeMeta(source, meta)`
     - `hasValidMeta(source, commitSha)`
     - `getReferencePath(fullName)` (existing helper reuse)

2. Update CLI to use SDK cache
   - `apps/cli/src/handlers/pull.ts` uses `hasValidMeta`
   - `apps/cli/src/handlers/push.ts` uses `getMeta` to validate

### Acceptance

- No direct JSON parsing of `meta.json` in CLI handlers.

---

## Phase 6: Sync Decomposition (Issue 10)

### Outcome

Sync concerns are separated and easier to test.

### Steps

1. Split sync into modules
   - `packages/sdk/src/sync/client.ts` (Convex client + dynamic import)
   - `packages/sdk/src/sync/references.ts` (pull/push/check)
   - `packages/sdk/src/sync/github.ts` (GitHub fetches)
   - `packages/sdk/src/sync/validation.ts` (canPushToWeb, validatePushAllowed)
   - `packages/sdk/src/sync/errors.ts` (errors)

2. Re-export from `packages/sdk/src/sync/index.ts`
   - Keep existing function names

### Acceptance

- `packages/sdk/src/sync.ts` replaced by `sync/` module tree.
- Each module has a focused responsibility.

---

## Phase 7: Build + Release Safeguards (Issue 3, 7)

### Outcome

Version mismatch prevented; build steps reduced.

### Steps

1. Version guard script
   - New `scripts/verify-versions.ts` checks `apps/cli`, `packages/sdk`, `packages/types` (and backend-api if present)
   - Run in CI before publish and in `prepublishOnly` for packages

2. Exact version policy on publish
   - Update `scripts/bump-version.ts` to set exact versions in inter-package deps (not `workspace:*`) for published artifacts
   - Alternative: introduce changesets for coordinated releases

3. Optional: simplify types build
   - Switch `packages/types` to `tsc --emitDeclarationOnly` if bundling is unnecessary

### Acceptance

- CI fails on version mismatch.
- Build graph no longer includes backend-api.

---

## Migration Notes

- New entrypoints: `@offworld/sdk/sync`, `@offworld/sdk/ai`, `@offworld/sdk/internal`, `@offworld/sdk/convex/api`.
- Remove `@offworld/backend-api` and update any imports to the new SDK convex entrypoints.
- Add upgrade notes in `README.md` and `apps/cli/README.md` for consumers using SDK directly.

---

## Suggested Ordering Summary

1. Merge backend-api into SDK + exports
2. Move sync/ai behind subpath exports + optional convex
3. Public/internal API split
4. Cache module + CLI handler refactor
5. Sync module decomposition
6. Version guard + build simplifications

---

## Definition of Done

- CLI passes existing tests and manual flows: `ow pull`, `ow generate`, `ow push`.
- SDK default entrypoint does not require Convex or AI.
- Package exports are explicit and documented.
- No references to `@offworld/backend-api` remain (or deprecated with warning).
- Handler logic is modular and testable.
