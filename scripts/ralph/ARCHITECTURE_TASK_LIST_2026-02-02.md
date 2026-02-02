# Offworld Architecture Task List (2026-02-02)

Goal: Remove backend-api indirection, make heavy deps optional, clarify SDK public vs internal API, and harden release safety without changing CLI behavior.

## Phase 1: Remove backend-api indirection

- [ ] Add `packages/sdk/scripts/copy-convex-generated.ts` to copy `_generated` into `packages/sdk/dist/convex/_generated`.
- [ ] Update `packages/sdk/package.json` build script to run `tsdown` then the copy script.
- [ ] Add Convex subpath exports to `packages/sdk/package.json`:
  - `./convex/api` -> `./dist/convex/_generated/api.{js,d.ts}`
  - `./convex/server` -> `./dist/convex/_generated/server.{js,d.ts}`
- [ ] Update `packages/sdk/src/sync.ts` to import `api` from `@offworld/sdk/convex/api`.
- [ ] Delete `packages/backend-api/`.
- [ ] Remove `@offworld/backend-api` from `packages/sdk/package.json` dependencies.
- [ ] Remove backend-api references from `scripts/bump-version.ts`.
- [ ] Remove backend-api from publish order and summary in `.github/workflows/release.yml`.
- [ ] Ensure CI still runs Convex codegen before SDK build (codegen output still required).

## Phase 2: Split optional deps (sync + AI)

- [ ] Create `packages/sdk/src/sync/index.ts` to re-export current sync API.
- [ ] Add `src/sync/index.ts` entry to `packages/sdk/tsdown.config.ts`.
- [ ] Add `./sync` export to `packages/sdk/package.json` (point to `dist/sync/index.mjs` + `dist/sync/index.d.mts`).
- [ ] Remove sync exports from `packages/sdk/src/index.ts`.
- [ ] Move `convex` to `peerDependencies` in `packages/sdk/package.json` and mark optional in `peerDependenciesMeta`.
- [ ] Keep `convex` in `apps/cli/package.json` dependencies (CLI uses sync).
- [ ] Add `packages/sdk/src/sync/client.ts` with dynamic `import("convex/browser")` and a `SyncUnavailableError` fallback.
- [ ] Update sync functions to use `getConvexClient()` instead of direct `convex` import.
- [ ] Add `src/ai/index.ts` entry to `packages/sdk/tsdown.config.ts`.
- [ ] Add `./ai` export to `packages/sdk/package.json`.
- [ ] Remove AI exports from `packages/sdk/src/index.ts`.
- [ ] Make `@opencode-ai/sdk` optional (peer or optionalDependency) in `packages/sdk/package.json`.

## Phase 3: Public vs internal SDK API

- [ ] Create `packages/sdk/src/public.ts` with the curated public surface.
- [ ] Update `packages/sdk/src/index.ts` to re-export only `public.ts`.
- [ ] Create `packages/sdk/src/internal.ts` for CLI-only helpers.
- [ ] Add `src/internal.ts` entry to `packages/sdk/tsdown.config.ts`.
- [ ] Add `./internal` export mapping in `packages/sdk/package.json`.

## Phase 4: Update CLI imports and tests

- [ ] Update every handler that imports `@offworld/sdk` to use subpaths:
  - `@offworld/sdk/sync` for sync API.
  - `@offworld/sdk/ai` for AI generation.
  - `@offworld/sdk/internal` for CLI-only helpers.
- [ ] Update SDK tests to import sync/AI from subpaths.
- [ ] Update any internal CLI helpers that still import the SDK root.

## Phase 5: Release safeguards

- [ ] Add `scripts/verify-versions.ts` to check version lockstep across `apps/cli`, `packages/sdk`, `packages/types`.
- [ ] Add root `verify:versions` script in `package.json` and run it pre-publish in CI.
- [ ] Remove backend-api from any remaining release automation and docs.

## Phase 6: Documentation updates

- [ ] Update `packages/sdk/README.md` for new subpath exports and optional deps.
- [ ] Update `apps/cli/README.md` for SDK migration notes and dependency expectations.

## Verification

- [ ] `bun run check`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] Manual CLI checks: `ow --version`, `ow pull <repo>`, `ow generate <repo>`, `ow push <repo>`
