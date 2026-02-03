# Offworld Architecture Review (2026-02-02)

Scope: CLI build/distribution, SDK packaging, Convex type flow, workspace release pipeline.

## Executive Summary

The core architecture is strong, but the current build and distribution path still has avoidable indirection and reliability hazards. The most impactful simplifications are: (1) remove `@offworld/backend-api` by moving Convex generated outputs into the SDK build pipeline, (2) split optional-heavy features (Convex sync + AI) into subpath exports and dynamic imports, and (3) tighten release safeguards (version lockstep + publish order) so the CLI and SDK never drift. These changes are structural and preserve existing CLI UX.

## Current State (Verified)

### CLI Build & Distribution

- The CLI is bundled with `tsdown` into ESM output with two entrypoints: `src/cli.ts` (bin) and `src/index.ts` (library). See [apps/cli/tsdown.config.ts](file:///Users/oscargabriel/Developer/projects/offworld/apps/cli/tsdown.config.ts).
- The published npm package exposes `dist/cli.mjs` as the executable and `dist/index.mjs` for library exports. See [apps/cli/package.json](file:///Users/oscargabriel/Developer/projects/offworld/apps/cli/package.json).
- Release binaries are compiled from the ESM bundle using `bun build --compile` in GitHub Actions. See the build job in [release.yml](file:///Users/oscargabriel/Developer/projects/offworld/.github/workflows/release.yml).
- The installer downloads prebuilt binaries, verifies checksums, and installs a single `ow` binary. See [install](file:///Users/oscargabriel/Developer/projects/offworld/install).

### SDK Build & API Surface

- The SDK currently builds a single entrypoint (`src/index.ts`) with `tsdown` to `dist/index.mjs`. See [packages/sdk/tsdown.config.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/tsdown.config.ts).
- The SDK default export surface includes sync and AI exports directly, meaning `convex` and `@opencode-ai/sdk` are pulled via the main entrypoint. See [packages/sdk/src/index.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/index.ts).
- AI access already uses dynamic import internally (`@opencode-ai/sdk`). See [packages/sdk/src/ai/opencode.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/ai/opencode.ts).

### Convex Generated Types

- Convex generates API stubs under `packages/backend/convex/_generated`. See [packages/backend/convex/\_generated/api.d.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/backend/convex/_generated/api.d.ts).
- `@offworld/backend-api` is a packaging shim that copies those generated files into `dist/_generated` and exposes `./api` and `./server`. See [packages/backend-api/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/backend-api/package.json) and [packages/backend-api/scripts/copy-generated.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/backend-api/scripts/copy-generated.ts).
- SDK sync code imports the Convex API from that shim, creating a build and publish dependency chain. See [packages/sdk/src/sync.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/sync.ts).

### Release Pipeline and Publishing

- Release builds generate Convex code, run `turbo build`, compile binaries, then publish packages in a fixed order: `@offworld/types`, `@offworld/backend-api`, `@offworld/sdk`, `offworld`. See [release.yml](file:///Users/oscargabriel/Developer/projects/offworld/.github/workflows/release.yml).
- The version bump script enforces a lockstep version across CLI, SDK, types, and backend-api, and regenerates build output. See [scripts/bump-version.ts](file:///Users/oscargabriel/Developer/projects/offworld/scripts/bump-version.ts).
- There is no `scripts/verify-versions.ts` in the current tree, despite being referenced in prior change logs.

## Pain Points

1. **Backend API indirection**: The `@offworld/backend-api` package exists only to copy Convex generated files. This adds a build step and a release dependency without adding behavior.
2. **Heavy dependencies in the default SDK entrypoint**: `convex` and AI-related code are available on the main entrypoint, which means consumers pay for them even if they only use local repo management.
3. **Release fragility**: The release pipeline depends on build/publish order and the presence of the backend-api shim. Any mismatch between versions or missing codegen output breaks publishing.
4. **Public vs internal API**: The SDK entrypoint currently acts as a catch-all export surface, which makes it hard to draw a stable boundary between “public API” and “CLI internals.”
5. **CLI root SDK usage is broad**: CLI imports the SDK root in many handlers, so splitting sync/AI/internal requires a broader migration than just pull/push.
6. **Subpath builds need explicit entries**: Adding `@offworld/sdk/internal` (and other subpaths) requires tsdown entries or the export will point to missing build output.
7. **AI dependency still installs by default**: Moving AI to a subpath export does not make `@opencode-ai/sdk` optional unless the dependency itself is optional/peer.
8. **Convex peer impact on CLI**: If `convex` becomes an optional peer for the SDK, the CLI still needs it in its own deps for sync.
9. **Convex codegen dependency stays**: Copying generated Convex types into the SDK still requires codegen to run before SDK build in CI.

## Recommended Approach (Simplify + Improve Reliability)

### 1) Merge Convex Type Surface Into the SDK

**Goal:** Remove `@offworld/backend-api` and expose generated Convex types directly from `@offworld/sdk`.

**Approach:**

- Add an SDK build step to copy `packages/backend/convex/_generated` into `packages/sdk/dist/convex/_generated` after `tsdown` completes.
- Add explicit subpath exports for Convex types under the SDK package:

```json
"./convex/api": { "types": "./dist/convex/_generated/api.d.ts", "import": "./dist/convex/_generated/api.js" },
"./convex/server": { "types": "./dist/convex/_generated/server.d.ts", "import": "./dist/convex/_generated/server.js" }
```

- Update SDK sync modules to import from `@offworld/sdk/convex/api` instead of `@offworld/backend-api`.
- Remove `packages/backend-api` and eliminate it from publish workflows and version scripts.

This directly removes a full build stage and package, while keeping Convex types accessible in a standard, explicit location.

### 2) Split Optional Dependencies Behind Subpath Exports

**Goal:** Avoid loading Convex + AI in the default SDK entrypoint.

**Approach:**

- Move sync exports under `@offworld/sdk/sync` and AI exports under `@offworld/sdk/ai`.
- Keep the main SDK entrypoint (`@offworld/sdk`) limited to core local functionality: config, clone, map, repo management, reference install, etc.
- Make `convex` an optional peer dependency and dynamically import it in sync client creation, throwing a clear `SyncUnavailableError` when missing.

This reduces default bundle size and makes SDK behavior more predictable for offline/local-only users.

### 3) Define Public vs Internal SDK API

**Goal:** Separate stable public API from CLI-internal utilities.

**Approach:**

- Introduce `public.ts` (curated export list) and make `src/index.ts` re-export only that.
- Add `internal.ts` and a `@offworld/sdk/internal` export for CLI-only helpers.

This reduces accidental dependency on internal APIs and gives room to evolve CLI internals without breaking external consumers.

### 4) Harden Release Safeguards

**Goal:** Prevent version drift and reduce publishing breakage.

**Approach:**

- Add a `scripts/verify-versions.ts` that checks versions across `apps/cli`, `packages/sdk`, and `packages/types` and fail CI if mismatched.
- Run it before publish in CI and/or as `prepublishOnly` for packages.
- Remove backend-api from the publish order once it is deleted.

## Impact on CLI Bundling & Distribution

- The CLI will continue to build as a single ESM bundle via `tsdown` and get compiled to a static binary via Bun in CI. This remains unchanged and reliable.
- After the SDK split, the CLI should import sync and AI functionality from `@offworld/sdk/sync` and `@offworld/sdk/ai` (or `@offworld/sdk/internal`), preventing unwanted dependency loading on `@offworld/sdk` consumers.
- The installer and release binary pipeline are already robust; the primary risk is ensuring the SDK build produces Convex stubs before CLI builds in CI. With an SDK copy step in its `build` script, the `turbo` build graph will handle ordering.
- CLI updates must touch all handlers that currently import `@offworld/sdk`, not just pull/push.

## Suggested Implementation Order

1. Merge backend-api into SDK with Convex subpath exports.
2. Move sync + AI behind subpath exports; optional Convex peer dependency.
3. Create `public.ts` + `internal.ts` and narrow the default SDK entrypoint.
4. Add `verify-versions` to CI and prepublish tasks.

## Definition of Done

- `@offworld/backend-api` is removed without breaking sync functionality.
- SDK default entrypoint no longer requires Convex or AI dependencies.
- CLI builds and release binaries remain unchanged and succeed in CI.
- Package version drift is caught before publish.
