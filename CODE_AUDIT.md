# Code Audit Report: Offworld CLI & SDK

**Date:** 2026-01-26  
**Scope:** `apps/cli/` and `packages/sdk/`  
**Context:** Post-refactor audit following single-skill model migration (see `scripts/ralph/plan.md`)

---

## 1. Dead Code / Legacy Remnants

### High Priority

| Location | Issue |
|----------|-------|
| `sync.ts:8,223,349` | Uses `toSkillDirName()` for API reference names, but new model uses `toReferenceFileName()`. This causes naming mismatch - API expects `owner-repo-reference` but filesystem stores `owner-repo.md` |
| `generate.ts:291` | Uses `toSkillDirName()` for `referenceName` in prompt tracking |
| `generate.ts:355-384` | `installSkill()` function is legacy per-repo skill installer - superseded by `installReference()` |
| `config.ts:52-70` | `toSkillDirName()` produces `-reference` suffix names, no longer needed for new model |
| `config.ts:114-131` | `getSkillPath()` and `getAnalysisPath()` point to old `~/.local/share/offworld/skills/` path |
| `repo-source.ts:224-229` | `getAnalysisPathForSource()` still produces `-reference` suffix |
| `paths.ts:57-59` | `Paths.skillsDir` points to old multi-skill location (`skills/`) vs single-skill (`skill/offworld/`) |
| `apps/cli/src/handlers/push.ts:11,105` | Uses `toSkillDirName()` to build `referenceName`, same mismatch as `sync.ts` |

### Deprecated Exports (Still Exported)

**index-manager.ts:27-58:**
- `getIndex`, `saveIndex`, `updateIndex`, `removeFromIndex`, `getIndexEntry`, `listIndexedRepos`, `getIndexPath`
- All return no-ops/empty values

**sync.ts:431-437:**
- `pullAnalysis`, `pullAnalysisByName`, `pushAnalysis`, `AnalysisData` aliases

**index.ts:**
- Still exports `InvalidSkillError`, `generateSkillWithAI`, deprecated type aliases
- Still exports `toSkillDirName`, `getSkillPath`, `getAnalysisPath`
- Exports deprecated `RepoIndex`, `RepoIndexEntry` types (lines 14-17)
- Exports deprecated `getStateRoot()` (lines 42-44) - still used in `init.ts:306-307`

---

## 2. Broken / Incomplete Implementations

### Critical

| Location | Issue |
|----------|-------|
| `sync.ts:223,349` | `checkRemote()` and `pullReference()` query API with `toSkillDirName(fullName)` which returns `owner-repo-reference`, but new reference files are named `owner-repo.md`. **This will fail to match references on the API.** |
| `project.ts` | Never calls `writeProjectMap()` - per plan.md, `ow project init` should write `.offworld/map.json` |
| `clone.ts:205-214` | `cloneRepo()` only adds to global map if reference already exists - should always add cloned repos to map |

### Incomplete

- `shared.ts:66-77`, `repo.ts:129`: Stale checking is disabled - `isStale` always returns `undefined` or `false`
- `repo-manager.ts:62,156,193-197`: Multiple comments confirm "Stale check removed" - feature incomplete

### Map Key Inconsistency

| Location | Key Format | Expected |
|----------|-----------|----------|
| `clone.ts` | `source.fullName` (e.g., `owner/repo`) | `qualifiedName` |
| `repo-manager.ts:418,424` | `qualifiedName` (e.g., `github:owner/repo`) | - |
| `isRepoCloned()` callers | Sometimes `fullName`, sometimes `qualifiedName` | Inconsistent |
| `apps/cli/src/handlers/pull.ts` | `fullName` passed into `installReference()` for remotes | `qualifiedName` |
| `apps/cli/src/handlers/generate.ts` | `fullName` passed into `installReference()` for remotes | `qualifiedName` |
| `packages/sdk/src/generate.ts` | `installReference()` stores map key from `repoName` argument | `qualifiedName` |

---

## 3. Terminology Inconsistencies

| Location | Old Term | Should Be |
|----------|----------|-----------|
| `shared.ts:12-15` | `analyzed`, `hasSkill`, `analyzedAt` | `hasReference`, `referenceUpdatedAt` |
| `shared.ts:27-28` | `[analyzed]`, `[skill]` labels | `[reference]` |
| `pull.ts:41-42` | `analysisSource`, `skillInstalled` | `referenceSource`, `referenceInstalled` |
| `pull.ts` | `analysisSource`/`skillInstalled` fields used throughout response type and logic | `referenceSource`/`referenceInstalled` |
| `agents-md.ts:10-17` | `InstalledSkill` interface | `InstalledReference` |
| `agents-md.ts:25-44` | "Project Skills" section header | "Project References" |
| `types/schemas.ts:100-105` | `AnalysisMetaSchema` | `ReferenceMetaSchema` |
| `project.ts:26,37,142,151,161,209` | Multiple "skill" references in messages/comments | Should say "reference" |
| `handlers/shared.ts:12-28` | `hasSkill`, `analyzedAt`, `[skill]` label | `hasReference`, `referenceUpdatedAt`, `[reference]` |
| `repo.ts:135-136` | `analyzed`/`hasSkill` fields set together | `hasReference` only |
| `packages/types/src/schemas.ts:101` | `analyzedAt` field | `referenceUpdatedAt` (rename for consistency) |
| `apps/cli/src/handlers/generate.ts` | `analysis`/`remote analysis` wording | `reference` wording |
| `apps/cli/src/handlers/list.ts` | "clone and analyze" messaging | "clone and generate reference" (or similar) |
| `apps/cli/src/handlers/push.ts` | "skill" wording; `loadLocalAnalysis` naming | `reference` wording; rename to `loadLocalReference` |
| `apps/cli/src/handlers/init.ts` | Prompt text says "install skills" | "install references" |
| `apps/cli/src/handlers/config.ts` | Agent selection prompt says "install skills" | "install references" |
| `packages/sdk/src/ai/opencode.ts` | Prompts/logs mention "analysis" and "skill files" | "reference" wording |

---

## 4. Duplicate / Redundant Code

| Issue | Files |
|-------|-------|
| `listHandler` vs `repoListHandler` | `list.ts` and `repo.ts` do essentially the same thing with minor differences |
| `formatRepoForDisplay()` | Used by both handlers but lives in `shared.ts` |
| `RepoListItem` interface | Exported from both `list.ts` and `repo.ts` via `handlers/index.ts` |

---

## 5. Wiring Issues

| Location | Issue |
|----------|-------|
| `project.ts` | Doesn't write project map (`.offworld/map.json`) as specified in plan |
| `project.ts:179` | Checks `pullResult.skillInstalled` - should check for reference |
| `init.ts:10` | Imports `getStateRoot` (deprecated) |
| `pull.ts:10-11` | Imports deprecated `pullAnalysis`, `pullAnalysisByName` instead of `pullReference`, `pullReferenceByName` |
| `push.ts:15` | Imports deprecated `pushAnalysis` instead of `pushReference` |
| `apps/cli/src/__tests__/handlers.test.ts` | Tests mock `pullAnalysis`, `pushAnalysis`, use `hasSkill`, `analyzedAt` |
| `packages/sdk/src/__tests__/*.test.ts` | Tests mock/expect `toSkillDirName` and `-reference` names |

---

## 6. Potential Bugs

| Location | Issue |
|----------|-------|
| `generate.ts:532` | `updatedAt` date formatting uses optional chaining on split result: `new Date().toISOString().split("T")[0] ?? ""` - always safe but unnecessary |
| `installation.ts:294` | Uses `require()` inside function instead of import |
| `clone.ts:200` | Calls `getCommitSha()` but doesn't use return value |
| `repo.ts:135-136` | Sets both `analyzed: !!entry.primary` and `hasSkill: !!entry.primary` to the same value - redundant |

---

## 7. Missing Issues / Risks

| Location | Issue |
|----------|-------|
| `clone.ts`, `repo-manager.ts` | Remove/delete paths use `qualifiedName` (provider-prefixed) when computing filenames/paths; can delete wrong paths or leave files behind |
| `apps/cli/src/handlers/remove.ts` | `--reference-only` uses manual `owner/repo` → `owner-repo` mapping and bypasses `toReferenceFileName()` rules (edge cases like `honojs/hono`) |
| `clone.ts`, `generate.ts` | `updatedAt` format inconsistent (date-only vs full ISO) across map updates; will complicate staleness comparisons |
| `apps/cli/src/handlers/list.ts`, `apps/cli/src/handlers/generate.ts` | Stale flow still wired to disabled stale checks (`isStale` always false/undefined); user messaging implies staleness handling |
| `apps/cli/src/handlers/remove.ts` | Imports `removeReferenceByName` which is marked `@deprecated` in `packages/sdk/src/clone.ts` |
| `packages/sdk/src/index-manager.ts` | JSDoc says `qualifiedName` = `owner/repo`, but actual usage is provider-prefixed (e.g., `github:owner/repo`) |

---

## 8. Additional Findings (Web / Types / Docs / Tests)

| Location | Issue |
|----------|-------|
| `apps/web/src/routes/cli.tsx:54-71,331-357` | CLI docs still say "analysis" and "skills" (re-analysis, generate analysis, push analysis, create/list skills); update to reference terminology |
| `apps/web/src/routes/_github/$owner/$repo/route.tsx:5-6` | `repoSkillsQuery` name still uses skills terminology |
| `apps/web/src/routes/_github/$owner/$repo/index.tsx:11,75-110` | `repoSkillsQuery` import and `analysisData` naming; legacy analysis terminology in reference flow |
| `apps/web/src/components/repo/repo-header.tsx:12-66` | `analysisData`/`hasAnalysis` prop names; should be reference naming |
| `apps/web/src/components/admin/analysis-table.tsx:22,60-62` | `AnalysisTable` name and "Analyzed" column label; should be reference terminology |
| `apps/web/src/routes/admin.tsx:5,58` | Imports/uses `AnalysisTable`; mismatch with reference model |
| `apps/web/e2e/analysis.spec.ts:3-42` | E2E asserts analysis copy/labels; outdated wording |
| `packages/types/src/types.ts:17-43` | Still exports `AnalysisMeta` type, re-exposing deprecated analysis schema |
| `packages/types/src/__tests__/schemas.test.ts:408-435` | Tests for `AnalysisMetaSchema`/`analyzedAt` still present |
| `AGENTS.md:11-18,143-148,190-194` | Old `~/.local/share/offworld/skills/offworld/` path (should be `skill/offworld/`) |
| `README.md:75-82` | Old `~/.local/share/offworld/skills/offworld/` path |
| `apps/web/src/components/layout/breadcrumbs.tsx:27` | Breadcrumb label uses "skills" |
| `apps/web/src/routes/explore.tsx:27,29,46` | Explore page text says "skills" (title, description, empty state) |
| `apps/cli/package.json:4,7,13` | Package description/keywords still reference analysis/skill |
| `apps/cli/README.md:131-138` | Path discovery example uses old `skills/offworld` paths |
| `.github/workflows/release.yml:209` | Homebrew formula description mentions analysis/skill generation |
| `packages/sdk/README.md:23` | Module table says "AGENTS.md skill table generation" |
| `packages/sdk/src/constants.ts:87` | Comment references analysis (should be reference phrasing) |
| `packages/sdk/src/ai/errors.ts:4,13` | Error base class name uses "Analysis" terminology |
| `packages/sdk/src/__tests__/mocks/fetch.ts:129-151` | Mock response uses analysis/skill fields + `/api/analyses/*` endpoints |

## 9. Notes / Clarifications

- `generate.ts:532` optional chaining on `split("T")[0]` is redundant, not a bug (safe but unnecessary)

## 10. Additional Issues Found (Audit Extension)

### Missed in Original Audit

| Location | Issue |
|----------|-------|
| `packages/sdk/src/index.ts:158-159` | Exports `installSkill` (legacy per-repo skill installer) but should only export `installReference` |
| `packages/sdk/src/index.ts:199` | Exports `InstalledSkill` type from `agents-md.ts` - should rename to `InstalledReference` |
| `packages/sdk/src/generate.ts:47-53` | `InstallSkillMeta` interface uses `analyzedAt` field - should be `referenceGeneratedAt` for consistency |
| `packages/sdk/src/generate.ts:355-384` | `installSkill()` function still exported (legacy) but marked @deprecated missing |
| `packages/sdk/src/util.ts` | File not referenced in audit - exports utilities that appear unused (`isBinaryBuffer`, `hashBuffer`) |
| `packages/sdk/src/models.ts` | File not reviewed in audit - no issues found, but should be listed in Files Reviewed |
| `apps/cli/src/handlers/uninstall.ts` | Not reviewed in audit - no terminology issues found |
| `apps/cli/src/handlers/upgrade.ts` | Not reviewed in audit - no terminology issues found |
| `apps/cli/src/handlers/pull.ts:41-43` | `analysisSource` field in `PullResult` should be `referenceSource` |
| `apps/cli/src/handlers/remove.ts:173` | Manual `owner/repo` → `owner-repo.md` mapping bypasses `toReferenceFileName()` - duplicates logic from `config.ts` and misses edge cases |
| `apps/cli/src/handlers/remove.ts:55` | Variable named `skillPath` should be `referencePath` |
| `apps/cli/src/handlers/remove.ts:200-201` | Result object uses `skillPath` key instead of `referencePath` |
| `packages/sdk/src/paths.ts:57-59` | `skillsDir` getter points to old multi-skill location - ONLY used by legacy `installSkill()` but confusing |
| `packages/sdk/src/clone.ts:406` | `toReferenceFileName(qualifiedName)` called with `qualifiedName` (e.g., `github:owner/repo`) which contains `:` - will produce malformed filename |
| `packages/sdk/src/repo-manager.ts:350` | `getMetaPath(qualifiedName)` called with provider-prefixed name - may produce wrong path |
| `packages/sdk/src/repo-manager.ts:418,424` | `discoverRepos()` uses `github:owner/repo` format for qualifiedName but other code uses `owner/repo` |
| `packages/sdk/src/index-manager.ts:107` | JSDoc says `qualifiedName` is `owner/repo` but actual usage is inconsistent |
| `apps/cli/src/handlers/init.ts:306-307` | Uses deprecated `getStateRoot()` - audit mentions import but not the usage |
| `apps/cli/src/handlers/project.ts:11` | Imports `InstalledSkill` type - should be renamed to `InstalledReference` |
| `apps/cli/src/handlers/project.ts:37` | Result type uses `skillsInstalled` field - should be `referencesInstalled` |
| `apps/cli/src/handlers/project.ts:163` | Variable named `installed` holds `InstalledSkill[]` - terminology mismatch |
| `apps/cli/src/handlers/project.ts:182-183` | Uses `skill` as variable name when it's a reference |
| `apps/cli/src/handlers/shared.ts:71` | Calls `getCommitSha()` but doesn't use return value - just for validation |
| `packages/types/src/schemas.ts:100-105` | `AnalysisMetaSchema` still uses `analyzedAt` - should be `referenceGeneratedAt` or similar |

### Inconsistent Date Formatting

| Location | Format | Expected |
|----------|--------|----------|
| `packages/sdk/src/generate.ts:532` | `new Date().toISOString().split("T")[0]` (date-only: `2026-01-26`) | Full ISO |
| `packages/sdk/src/clone.ts:212` | `new Date().toISOString()` (full: `2026-01-26T12:00:00.000Z`) | Full ISO |
| `packages/sdk/src/repo-manager.ts:356,429` | `new Date().toISOString()` (full) | Full ISO |
| `apps/cli/src/handlers/pull.ts:341` | `new Date().toISOString()` (full) | Full ISO |

The date-only format in `generate.ts:532` is inconsistent with other timestamps.

### Missing `@deprecated` Annotations

| Location | Export | Issue |
|----------|--------|-------|
| `packages/sdk/src/generate.ts:355` | `installSkill()` | No `@deprecated` JSDoc despite being legacy |
| `packages/sdk/src/config.ts:114-116` | `getSkillPath()` | No `@deprecated` JSDoc |
| `packages/sdk/src/paths.ts:57-59` | `Paths.skillsDir` | No `@deprecated` JSDoc, points to old multi-skill location |

### Unused/Dead Code

| Location | Issue |
|----------|-------|
| `packages/sdk/src/util.ts:26-52` | `isBinaryBuffer()` - search shows no usages in codebase |
| `packages/sdk/src/util.ts:60-62` | `hashBuffer()` - search shows no usages in codebase |
| `packages/sdk/src/util.ts:86-135` | `loadGitignorePatterns()` - only used by `loadGitignorePatternsSimple()` internally |

### Terminology in Comments/Logs

| Location | Issue |
|----------|-------|
| `packages/sdk/src/generate.ts:344-349` | Comment mentions "Skill directory (agent-facing)" - legacy terminology |
| `packages/sdk/src/generate.ts:367-369` | Comment says "Write SKILL.md" - legacy |
| `packages/sdk/src/generate.ts:460-461` | Comment references "global SKILL.md" |
| `apps/cli/src/handlers/project.ts:198` | Log says "Updating AGENTS.md..." but section is "Project Skills" |
| `apps/cli/src/handlers/repo.ts:487` | Log says "marked as not analyzed" - should say "no reference generated" |

---

## Summary

### Most Critical Issues to Address

1. **`sync.ts` reference name mismatch** - will break remote pull/push (has fallback but inefficient)
2. **`project.ts` missing `writeProjectMap()` call** - project-scoped routing broken
3. **`clone.ts` only adding to map when reference exists** - new clones untracked until reference generated
4. **Map key inconsistency** - `fullName` vs `qualifiedName` causes lookup failures
5. **`clone.ts:406` / `repo-manager.ts:350`** - passing provider-prefixed `qualifiedName` to functions expecting `owner/repo` format

### Technical Debt to Clean Up

1. Remove deprecated exports and functions
2. Rename terminology from skill/analysis to reference
3. Consolidate duplicate `list` handlers
4. Remove `toSkillDirName`, `getSkillPath`, `getAnalysisPath`
5. Update CLI handler imports to use non-deprecated sync functions
6. Update test files to use current APIs
7. Add missing `@deprecated` annotations
8. Remove unused utility functions (`isBinaryBuffer`, `hashBuffer`)
9. Normalize date formatting across codebase

### Patterns Identified

1. **Incomplete Migration** - SDK refactored but CLI handlers still use old terminology/imports
2. **Fallback Over Fix** - `sync.ts` added fallback queries instead of fixing naming
3. **Tests Lag Behind** - Test files not updated alongside implementation
4. **qualifiedName Format Confusion** - Some code uses `owner/repo`, some uses `github:owner/repo`

---

## Files Reviewed

### apps/cli/src/
- `index.ts`
- `handlers/*.ts` (all handlers including uninstall.ts, upgrade.ts)
- `utils/spinner.ts`

### packages/sdk/src/
- `index.ts`
- `config.ts`
- `paths.ts`
- `clone.ts`
- `generate.ts`
- `sync.ts`
- `index-manager.ts`
- `repo-manager.ts`
- `repo-source.ts`
- `reference-matcher.ts`
- `agents.ts`
- `agents-md.ts`
- `manifest.ts`
- `dep-mappings.ts`
- `installation.ts`
- `models.ts`
- `util.ts`
- `constants.ts`
- `ai/opencode.ts`
- `ai/errors.ts`

### apps/web/src/
- `routes/cli.tsx`
- `routes/_github/$owner/$repo/route.tsx`
- `routes/_github/$owner/$repo/index.tsx`
- `components/repo/repo-header.tsx`
- `components/admin/analysis-table.tsx`
- `routes/admin.tsx`

### apps/web/e2e/
- `analysis.spec.ts`

### packages/types/src/
- `types.ts`
- `__tests__/schemas.test.ts`

### Root Docs
- `AGENTS.md`
- `README.md`
