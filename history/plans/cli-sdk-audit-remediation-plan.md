# CLI + SDK Audit Remediation Plan

> Status: Complete
> Date: 2026-01-21
> Scope: `apps/cli`, `packages/sdk`, `packages/types`

## Context

The CLI and SDK have accumulated configuration drift, dead code, and a few correctness/performance issues. The SDK is internal-only (consumed by the CLI), so we can safely prune unused exports and simplify configuration. Only `repoRoot` should remain user-configurable. This plan removes unused fields, normalizes path handling, consolidates skill path helpers, and updates CLI behavior accordingly.

## Goals

- Fix correctness issues (tilde expansion, init cancel flow, stale checks).
- Reduce config surface to `repoRoot` only.
- Align all meta/skill paths with XDG defaults (single source of truth).
- Remove dead code and unused exports in the SDK.
- Consolidate duplicated path and agent directory logic.

## Non-goals

- No new CLI features or UX redesigns.
- No changes to auth flow behavior beyond cancel handling.
- No API contract changes with backend beyond already simplified schema usage.

## Decisions

- SDK is internal-only. Unused exports and modules can be removed.
- Remove `metaRoot`, `skillDir`, and `autoAnalyze` from config. Only `repoRoot` remains user-configurable.

## Reference Points

- `apps/cli/src/handlers/init.ts:205-216` (cancel is treated as yes for login)
- `apps/cli/src/handlers/list.ts:116-121` (staleness check always enabled)
- `apps/cli/src/handlers/config.ts:17-26` (VALID_KEYS includes metaRoot/skillDir/autoAnalyze)
- `apps/cli/src/handlers/config.ts:94-101` (autoAnalyze boolean parsing)
- `apps/cli/src/handlers/rm.ts:15-19` (hard-coded agent skill dirs)
- `packages/sdk/src/config.ts:15-26` (meta root always Paths.data)
- `packages/sdk/src/generate.ts:317-335` (uses config.metaRoot for skill/meta)
- `packages/sdk/src/repo-source.ts:176-179` (tilde treated as local but not expanded)
- `packages/sdk/src/clone.ts:70-90` (execSync-based git invocation)
- `packages/sdk/src/clone.ts:314-329` (legacy skillDir removal)
- `packages/sdk/src/ai/claude-code.ts` (unused module)
- `packages/types/src/schemas.ts:21-29` (config schema includes metaRoot/skillDir/autoAnalyze)
- `packages/sdk/src/__tests__/config.test.ts` (tests reference removed config fields)
- `packages/types/src/__tests__/schemas.test.ts` (tests reference removed config fields)
- `apps/cli/src/__tests__/handlers.test.ts` (tests reference removed config fields)

## Plan Overview

### Phase 1: Correctness fixes

1. **Expand tilde for local paths**
   - Update `packages/sdk/src/repo-source.ts` to expand `~` before `resolve()`.
   - Implementation detail: import `expandTilde` from `packages/sdk/src/paths.ts` and apply it in `parseLocalPath()`.

2. **Respect cancel in init login prompt**
   - Update `apps/cli/src/handlers/init.ts` to treat cancel as abort or explicit skip.
   - Proposed behavior: if user cancels at login prompt, abort init with `p.outro("Setup cancelled")` for consistency with other prompts.

3. **Avoid unnecessary stale checks**
   - Update `apps/cli/src/handlers/list.ts` to pass `stale` to `entryToListItem()` instead of `true`.
   - This prevents git calls when `--stale` is not requested.

### Phase 2: Config surface cleanup

4. **Remove `metaRoot`, `skillDir`, and `autoAnalyze`**
   - `packages/types/src/schemas.ts`: remove fields from `ConfigSchema`.
   - `apps/cli/src/handlers/config.ts`: remove keys from `VALID_KEYS` and parsing logic.
   - `apps/cli/src/handlers/init.ts`: adjust any config output messaging if needed.
   - Update tests in:
     - `packages/sdk/src/__tests__/config.test.ts`
     - `packages/types/src/__tests__/schemas.test.ts`
     - `apps/cli/src/__tests__/handlers.test.ts`

5. **Ensure meta/skill path consistency**
   - Make all skill/meta paths use XDG defaults via SDK helpers only.
   - Update `packages/sdk/src/generate.ts` to use SDK path helpers rather than `config.metaRoot`.

### Phase 3: Path and agent helper consolidation

6. **Centralize skill/meta path naming**
   - Create a single helper in `packages/sdk/src/paths.ts` or a new `packages/sdk/src/skill-paths.ts` to provide:
     - `toSkillDirName(fullNameOrLocal)`
     - `toMetaDirName(fullNameOrLocal)`
     - `getSkillPath(fullName)` / `getMetaPath(fullName)` (reuse existing SDK exports)
   - Replace duplicates in:
     - `packages/sdk/src/generate.ts`
     - `packages/sdk/src/clone.ts`
     - `apps/cli/src/handlers/rm.ts`

7. **Use SDK agent registry for cleanup**
   - Replace hard-coded `AGENT_SKILL_DIRS` in `apps/cli/src/handlers/rm.ts`.
   - Use `getAllAgentConfigs()` from the SDK to derive agent skill directories.
   - Ensure removal logic considers all supported agents (opencode, claude-code, codex, amp, antigravity, cursor).

### Phase 4: SDK robustness

8. **Safer git execution**
   - Replace `execSync("git ...")` in `packages/sdk/src/clone.ts` with `spawnSync` or `execFileSync`.
   - Preserve error handling and return trimmed stdout for SHA retrieval.
   - This fixes path issues with spaces and reduces command injection risk.

### Phase 5: Dead code removal

9. **Remove unused module**
   - Delete `packages/sdk/src/ai/claude-code.ts` if still unused.

10. **Prune unused exports**

- Remove unused exports from `packages/sdk/src/index.ts`, `packages/sdk/src/constants.ts`, and `packages/sdk/src/util.ts` if only referenced in tests.
- Update tests accordingly or remove tests that only cover deleted utilities.

### Phase 6: Validation

11. **Tests and typechecks**

- `apps/cli`: `bun run test`, `bun run typecheck`.
- `packages/sdk`: `bun run test`, `bun run typecheck`.

12. **CLI smoke checks**

- `ow init` (cancel, continue, and save flows).
- `ow list` with and without `--stale`.
- `ow rm` for a repo with symlinked skills.

## Sequencing Notes

- Do config/schema cleanup before path refactors to avoid editing files twice.
- Update SDK helpers before CLI uses them to prevent broken imports.
- Remove dead code after tests are updated so failures are attributable.

## Risks and Mitigations

- **Config migration**: users with existing config files may still have removed keys.
  - Mitigation: `loadConfig()` should ignore unknown keys; provide a note in CLI output if needed.
- **Path refactor mistakes**: skill/meta directories may change if helpers are incorrect.
  - Mitigation: add targeted unit tests for helper functions before removal of old code.

## Deliverables

- Simplified config schema (repoRoot only).
- Consistent path handling and agent cleanup logic.
- Removed unused SDK modules and exports.
- Updated tests and documented behavior.
