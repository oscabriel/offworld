# Offworld Refactor Changes Log (2026-01-30)

This document lists all current unstaged changes and the reason each change was made.

## Added

- `ARCHITECTURE_REVIEW.md` — Added an architecture review to capture problems, options, and the recommended refactor direction.
- `apps/cli/src/services/ai-service.ts` — Centralized AI generation flow (spinner/debug/log handling) so handlers stay thin.
- `apps/cli/src/services/cache-service.ts` — Wrapper around the SDK cache module for CLI-friendly access.
- `apps/cli/src/services/reference-service.ts` — Centralized remote check/download/install logic used by pull/generate.
- `apps/cli/src/services/repo-service.ts` — Centralized clone/update/path/commit helpers for repo handling.
- `apps/cli/src/utils/parse-model-flag.ts` — Shared model flag parsing for pull/generate handlers.
- `apps/cli/tsconfig.build.json` — Project-reference build config for CLI declaration-only type builds.
- `packages/sdk/scripts/copy-convex-generated.ts` — Copies SDK Convex stubs into `dist` during build.
- `packages/sdk/src/convex/_generated/api.js` — Local Convex API runtime stub for `@offworld/sdk/convex/api`.
- `packages/sdk/src/convex/_generated/api.d.ts` — Local Convex API types stub for SDK subpath exports.
- `packages/sdk/src/convex/_generated/server.js` — Local Convex server runtime stub for `@offworld/sdk/convex/server`.
- `packages/sdk/src/convex/_generated/server.d.ts` — Local Convex server types stub for SDK subpath exports.
- `packages/sdk/src/convex/_generated/dataModel.d.ts` — Minimal data model types to keep SDK typecheck self-contained.
- `packages/sdk/src/internal.ts` — New CLI-only entrypoint to separate internal utilities from the public API.
- `packages/sdk/src/public.ts` — Curated public SDK export surface.
- `packages/sdk/src/reference-cache.ts` — Centralized reference metadata read/write/validation helpers.
- `packages/sdk/src/reference-install.ts` — Extracted reference installation logic and global map updates.
- `packages/sdk/src/sync/client.ts` — Dynamic Convex client loader that throws `SyncUnavailableError` when missing.
- `packages/sdk/src/sync/errors.ts` — Dedicated sync error types.
- `packages/sdk/src/sync/github.ts` — GitHub lookup logic split from reference sync flows.
- `packages/sdk/src/sync/index.ts` — Sync re-export entrypoint.
- `packages/sdk/src/sync/references.ts` — Reference pull/push/check utilities separated from client wiring.
- `packages/sdk/src/sync/validation.ts` — Sync validation helpers (`canPushToWeb`, `validatePushAllowed`).
- `packages/sdk/tsconfig.build.json` — Project-reference build config for SDK declaration-only output.
- `packages/types/tsconfig.build.json` — Project-reference build config for types declaration-only output.
- `scripts/verify-versions.ts` — Ensures workspace package versions stay in lockstep before publish.
- `tsconfig.build.json` — Root project-reference graph for `tsc -b` builds.

## Modified

- `.github/workflows/release.yml` — Added version verification step and removed backend-api from publish/summary flow.
- `.gitignore` — Added `dist-types` to ignore declaration-only outputs.
- `README.md` — Added SDK upgrade notes for new entrypoints and backend-api removal.
- `apps/cli/README.md` — Added SDK upgrade notes for CLI consumers.
- `apps/cli/package.json` — Switched typecheck to `tsc -b` and added version verification before publish.
- `apps/cli/src/handlers/auth.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/config.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/generate.ts` — Refactored to use services + shared model parsing and sync checks.
- `apps/cli/src/handlers/init.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/map.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/project.ts` — Updated imports and clarified the large-dependency warning copy.
- `apps/cli/src/handlers/pull.ts` — Split orchestration from repo/cache/remote/AI logic using services.
- `apps/cli/src/handlers/push.ts` — Uses sync subpath + cache service and handles `SyncUnavailableError`.
- `apps/cli/src/handlers/remove.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/repo.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/shared.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/uninstall.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/src/handlers/upgrade.ts` — Updated imports to use `@offworld/sdk/internal`.
- `apps/cli/tsconfig.json` — Added SDK path mappings to dist types and aligned CLI output settings.
- `apps/web/src/components/home/hero-section.tsx` — Formatting/indentation cleanup after refactor.
- `bun.lock` — Updated workspace versions and dependency graph (backend-api removed, convex now optional peer).
- `package.json` — Added `verify:versions` and `typecheck:refs` scripts.
- `packages/sdk/README.md` — Updated entrypoint docs and usage examples for new subpaths.
- `packages/sdk/package.json` — Added subpath exports, optional convex peer, copy step, and `tsc -b` typecheck.
- `packages/sdk/src/__tests__/generate.test.ts` — Updated imports for new SDK entrypoints.
- `packages/sdk/src/__tests__/sync.test.ts` — Updated imports for new sync entrypoint.
- `packages/sdk/src/ai/index.ts` — Split AI exports behind `@offworld/sdk/ai`.
- `packages/sdk/src/generate.ts` — Updated to align with AI subpath usage and refactor boundaries.
- `packages/sdk/src/index.ts` — Now re-exports only `public.ts` for a clear public surface.
- `packages/sdk/src/reference-matcher.ts` — Updated to use the new sync module layout.
- `packages/sdk/tsconfig.json` — Pointed Convex path alias to local SDK stubs.
- `packages/sdk/tsdown.config.ts` — Added build entries for `ai`, `sync`, and `internal` outputs.
- `packages/types/package.json` — Switched typecheck to `tsc -b` for project references.
- `scripts/bump-version.ts` — Removed backend-api handling and tightened inter-package versioning.
- `scripts/ralph/plan.md` — Added the detailed refactor plan content.

## Deleted

- `packages/backend-api/package.json` — Removed backend-api package indirection.
- `packages/backend-api/scripts/copy-generated.ts` — Obsolete after backend-api removal.
- `packages/backend-api/tsconfig.json` — Obsolete after backend-api removal.
- `packages/sdk/src/sync.ts` — Replaced by the new `packages/sdk/src/sync/` module tree.
