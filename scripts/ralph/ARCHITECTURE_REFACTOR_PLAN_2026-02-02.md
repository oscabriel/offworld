# Offworld Architecture Refactor Plan (2026-02-02)

Goal: Reduce package indirection, make heavy dependencies optional, clarify SDK API boundaries, and harden release safety without changing CLI behavior.

## Phase 1: Merge `@offworld/backend-api` Into the SDK

### 1. Add SDK copy step for Convex generated outputs

- Create `packages/sdk/scripts/copy-convex-generated.ts`.
- Copy from `packages/backend/convex/_generated` to `packages/sdk/dist/convex/_generated`.
- Copy these files: `api.js`, `api.d.ts`, `server.js`, `server.d.ts`, `dataModel.d.ts`.
- Wire into SDK build: update [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json) to run `tsdown && bun run ./scripts/copy-convex-generated.ts`.

### 2. Add Convex subpath exports to SDK

- Update [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json) exports:
  - `"./convex/api": { "types": "./dist/convex/_generated/api.d.ts", "import": "./dist/convex/_generated/api.js" }`
  - `"./convex/server": { "types": "./dist/convex/_generated/server.d.ts", "import": "./dist/convex/_generated/server.js" }`

### 3. Update SDK sync imports

- Replace `@offworld/backend-api/api` with `@offworld/sdk/convex/api` in [packages/sdk/src/sync.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/sync.ts).
- If sync is moved into `sync/` modules later, apply the change there instead.

### 4. Remove backend-api package

- Delete `packages/backend-api` directory.
- Remove references in [scripts/bump-version.ts](file:///Users/oscargabriel/Developer/projects/offworld/scripts/bump-version.ts).
- Remove from publish order in [release.yml](file:///Users/oscargabriel/Developer/projects/offworld/.github/workflows/release.yml).
- Remove from SDK dependencies in [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json).

### Acceptance

- `@offworld/sdk/convex/api` and `@offworld/sdk/convex/server` resolve in built output.
- No code imports `@offworld/backend-api`.

## Phase 2: Optional Convex + AI via Subpath Exports

### 1. Split sync into subpath entrypoint

- Create `packages/sdk/src/sync/index.ts` that re-exports current sync API.
- Update [packages/sdk/tsdown.config.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/tsdown.config.ts) to include `src/sync/index.ts` entry.
- Add `"./sync"` export in [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json) pointing to `dist/sync/index.mjs` and `dist/sync/index.d.mts`.
- Remove sync exports from [packages/sdk/src/index.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/index.ts).

### 2. Make Convex an optional peer dependency

- Move `convex` from `dependencies` to `peerDependencies` in [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json).
- Add `peerDependenciesMeta: { "convex": { "optional": true } }`.

### 3. Dynamic import Convex client

- Add `packages/sdk/src/sync/client.ts` with `getConvexClient()` using dynamic `import("convex/browser")`.
- Throw `SyncUnavailableError` with a clear message when the import fails.
- Update sync functions to use `getConvexClient()` instead of directly importing Convex.

### 4. Move AI behind `@offworld/sdk/ai`

- Keep `packages/sdk/src/ai/index.ts` as-is but export it under `"./ai"` in [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json).
- Add `src/ai/index.ts` entry to [packages/sdk/tsdown.config.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/tsdown.config.ts).
- Remove AI exports from [packages/sdk/src/index.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/index.ts).

### Acceptance

- Installing `@offworld/sdk` does not require `convex` unless `@offworld/sdk/sync` is used.
- Default SDK entrypoint does not include AI exports.

## Phase 3: Public vs Internal SDK API

### 1. Define public surface

- Create `packages/sdk/src/public.ts` with curated, stable exports.
- Update [packages/sdk/src/index.ts](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/src/index.ts) to re-export only `public.ts`.

### 2. Add internal entrypoint

- Create `packages/sdk/src/internal.ts` to expose CLI-only helpers.
- Add `"./internal"` export mapping in [packages/sdk/package.json](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/package.json).

### Acceptance

- Public entrypoint is small and documented.
- CLI relies only on `@offworld/sdk/internal`, `@offworld/sdk/sync`, and `@offworld/sdk/ai`.

## Phase 4: Update CLI Imports

### 1. Handlers

- Update handlers importing sync and AI to use subpaths:
  - `@offworld/sdk/sync` for sync API.
  - `@offworld/sdk/ai` for AI generation.
  - `@offworld/sdk/internal` for CLI-only helpers.
- Start with [apps/cli/src/handlers/pull.ts](file:///Users/oscargabriel/Developer/projects/offworld/apps/cli/src/handlers/pull.ts) and [apps/cli/src/handlers/push.ts](file:///Users/oscargabriel/Developer/projects/offworld/apps/cli/src/handlers/push.ts).

### 2. Tests

- Update SDK tests importing sync/AI to use new subpaths.

### Acceptance

- CLI builds and runs without importing sync/AI from the SDK root.

## Phase 5: Release Safeguards

### 1. Version verification

- Add `scripts/verify-versions.ts` to ensure `apps/cli`, `packages/sdk`, and `packages/types` versions match.
- Add a `verify:versions` script at workspace root and run in CI pre-publish.

### 2. Update publish flow

- Remove backend-api from publish order in [release.yml](file:///Users/oscargabriel/Developer/projects/offworld/.github/workflows/release.yml).
- Ensure build order still runs Convex codegen before SDK build.

### Acceptance

- CI fails on version mismatch before publishing.
- Publishing does not rely on backend-api.

## Documentation Updates

- Update [packages/sdk/README.md](file:///Users/oscargabriel/Developer/projects/offworld/packages/sdk/README.md) with new subpath usage.
- Update [apps/cli/README.md](file:///Users/oscargabriel/Developer/projects/offworld/apps/cli/README.md) with SDK migration notes.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- Manual CLI smoke checks: `ow --version`, `ow pull <repo>`, `ow generate <repo>`, `ow push <repo>`

## Definition of Done

- `@offworld/backend-api` removed with no functional regressions.
- `@offworld/sdk` default entrypoint avoids Convex and AI.
- CLI distribution (npm + binaries + installer) unchanged in behavior.
- Version drift is prevented before publish.
