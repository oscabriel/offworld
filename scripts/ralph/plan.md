# Codebase Cleanup Plan (from CODE_AUDIT.md)

## Phase: packages/types

### packages/types/src/schemas.ts

- L100: `export const AnalysisMetaSchema` -> `export const ReferenceMetaSchema`
- L101: `analyzedAt` -> `referenceUpdatedAt`

### packages/types/src/types.ts

- L17: `AnalysisMetaSchema` import -> `ReferenceMetaSchema`
- L42: `export type AnalysisMeta` -> `export type ReferenceMeta`
- L50-54: delete deprecated `RepoIndex` and `RepoIndexEntry` types

### packages/types/src/**tests**/schemas.test.ts

- L408: `describe("AnalysisMetaSchema"` -> `describe("ReferenceMetaSchema"`
- L410-425: `analyzedAt` -> `referenceUpdatedAt`

## Phase: packages/sdk

### packages/sdk/src/config.ts

- L45-70: delete `toSkillDirName` function block
- After L112: insert helper
  ```ts
  export function toReferenceName(repoName: string): string {
  	return toReferenceFileName(repoName).replace(/\.md$/, "");
  }
  ```
- L114-116: delete `getSkillPath`
- L126-132: delete `getAnalysisPath`

### packages/sdk/src/paths.ts

- L55-59: `get skillsDir()` -> `return join(this.data, "skill", "offworld")`
- L55 comment: "Skills directory" -> "Single-skill directory (legacy alias)"

### packages/sdk/src/repo-source.ts

- L10: add import `toReferenceFileName` from `./config.js`
- L224: rename `getAnalysisPathForSource` -> `getReferenceFileNameForSource`
- L225-229: return `toReferenceFileName(source.fullName)` for remote and `toReferenceFileName(source.name)` for local

### packages/sdk/src/index-manager.ts

- L26-58: delete deprecated legacy exports block

### packages/sdk/src/index.ts

- L13-17: delete deprecated `RepoIndex` / `RepoIndexEntry` exports
- L25-35: remove `getAnalysisPath`, `getSkillPath`, `toSkillDirName` exports
- L40-44: delete `getStateRoot`
- L47-52: export `getReferenceFileNameForSource` (new name)
- L60-67: remove deprecated index-manager exports
- L70-75: remove `removeReferenceByName` export
- L100-110: remove `InvalidSkillError` export
- L116-121: remove `pullAnalysis`, `pullAnalysisByName`, `pushAnalysis`, `AnalysisData` exports
- L156-164: remove `installSkill` export, rename `InstallSkillMeta` -> `InstallReferenceMeta`
- L166-168: remove `generateSkillWithAI` alias
- L199: export `appendReferencesSection` / `InstalledReference`

### packages/sdk/src/sync.ts

- L8: `toSkillDirName` import -> `toReferenceName`
- L223: `referenceName: toSkillDirName(fullName)` -> `referenceName: toReferenceName(fullName)`
- L349: same as L223
- L90-91: delete `InvalidSkillError` alias
- L430-437: delete deprecated `pullAnalysis*` / `pushAnalysis` exports

### packages/sdk/src/generate.ts

- L19: drop `toSkillDirName` import; add `toReferenceName` if used
- L47-54: rename `InstallSkillMeta` -> `InstallReferenceMeta`; `analyzedAt` -> `referenceUpdatedAt`
- L57: "Skill Generation" -> "Reference Generation"
- L291: `const referenceName = toSkillDirName(repoName);` -> `const referenceName = toReferenceName(repoName);`
- L355-384: delete legacy `installSkill` function
- L494-499: change signature to
  ```ts
  export function installReference(
  	qualifiedName: string,
  	fullName: string,
  	localPath: string,
  	referenceContent: string,
  	meta: InstallReferenceMeta,
  	keywords?: string[],
  ): void {
  ```
- L503: `toReferenceFileName(repoName)` -> `toReferenceFileName(fullName)`
- L504: `toMetaDirName(repoName)` -> `toMetaDirName(fullName)`
- L518-519: `map.repos[repoName]` -> `map.repos[qualifiedName]`
- L527: `upsertGlobalMapEntry(repoName, {` -> `upsertGlobalMapEntry(qualifiedName, {`
- L532: `new Date().toISOString().split("T")[0] ?? ""` -> `new Date().toISOString()`

### packages/sdk/src/clone.ts

- L200: delete unused `getCommitSha(repoPath);`
- L205-214: replace conditional map update with unconditional upsert using `source.qualifiedName`, empty refs when missing:
  ```ts
  upsertGlobalMapEntry(source.qualifiedName, {
  	localPath: repoPath,
  	references: hasReference ? [referenceFileName] : [],
  	primary: hasReference ? referenceFileName : "",
  	keywords: [],
  	updatedAt: new Date().toISOString(),
  });
  ```
- L406-409: remove `toReferenceFileName(qualifiedName)` removal; loop over `entry.references`
- L412-415: derive meta dir from `entry.primary` (strip `.md`) and remove only if non-empty

### packages/sdk/src/repo-manager.ts

- L8-13: remove `stale` from `RepoStatusSummary`
- L32-35: remove `stale` counter
- L61-67: remove `stale` from return object
- L20-23: remove `staleOnly?: boolean` from `UpdateAllOptions`
- L170: `const { staleOnly = false, pattern, dryRun = false, unshallow = false, onProgress } = options;` -> `const { pattern, dryRun = false, unshallow = false, onProgress } = options;`
- L193-197: delete the `if (staleOnly) { ... }` block

### packages/sdk/src/agents-md.ts

- L10: `InstalledSkill` -> `InstalledReference`
- L13-15: `skill` field -> `reference` and update comments
- L25-44: `generateSkillsTable` -> `generateReferencesTable`; update strings to "References" terminology
- L54-69: `appendSkillsSection` -> `appendReferencesSection`; regex header -> `## Project References`
- L75-91: update comments and param names to references; call `appendReferencesSection`

### packages/sdk/src/ai/errors.ts

- L4-13: rename `OpenCodeAnalysisError` -> `OpenCodeReferenceError`; update `_tag` and `this.name`
- L20,31,52,73,95,116,138: update `extends OpenCodeAnalysisError` -> `extends OpenCodeReferenceError`

### packages/sdk/src/ai/opencode.ts

- L4-25: import/re-export `OpenCodeReferenceError` (replace `OpenCodeAnalysisError`)
- L57: description "skill files" -> "reference files"
- L401-404: `debug("Writing skill...")` -> `debug("Writing reference...")`

### packages/sdk/src/ai/index.ts

- L5: export `OpenCodeReferenceError` instead of `OpenCodeAnalysisError`

### packages/sdk/src/constants.ts

- L87: comment "not useful for analysis" -> "not useful for reference generation"

### packages/sdk/src/installation.ts

- L294: replace `require("node:fs")` with top-level `writeFileSync` import

### packages/sdk/src/**tests**/generate.test.ts

- L11-19: mock `toReferenceFileName` returning `.md` names
- L53: import `installReference` (drop `installSkill`)
- L150-165: rename describe to `installReference`; update call signature + meta field `referenceUpdatedAt`

### packages/sdk/src/**tests**/config.test.ts

- L121: replace `toSkillDirName` import with `toReferenceFileName`
- L508-539: rename describe to `toReferenceFileName`; update expected strings to `.md`

### packages/sdk/src/**tests**/repo-source.test.ts

- L273-295: rename to `getReferenceFileNameForSource`; expect `owner-repo.md` and `name.md`

### packages/sdk/src/**tests**/mocks/fetch.ts

- L129-145: rename params/fields to `reference*`; update endpoint to `/api/references/pull`
- L151-163: update endpoint to `/api/references/check`; `analyzedAt` -> `generatedAt`

## Phase: apps/cli

### apps/cli/src/handlers/pull.ts

- L10-11: `pullAnalysis*` imports -> `pullReference*`
- L38-43: `analysisSource` -> `referenceSource`, `skillInstalled` -> `referenceInstalled`
- L84-92: `saveRemoteReference` args/meta -> use `referenceUpdatedAt` and new `installReference(qualifiedName, referenceRepoName, ...)`
- L71-72: `qualifiedName` -> `source.qualifiedName`; add `referenceRepoName` for `owner/repo`
- L190,283,366,386: `analysisSource`/`skillInstalled` -> `referenceSource`/`referenceInstalled`
- L259-262: `pullAnalysis*` calls -> `pullReference*`
- L340-342: `analysisCommitSha` -> `referenceCommitSha`; `analyzedAt` -> `referenceUpdatedAt`

### apps/cli/src/handlers/generate.ts

- L22-26: `analysisPath` -> `referencePath`
- L52-64: "analysis" wording -> "reference" wording
- L87: `const qualifiedName = source.type === "remote" ? source.fullName : source.name;` -> `const qualifiedName = source.qualifiedName;`
- L86-90: add `const referenceRepoName = source.type === "remote" ? source.fullName : source.name;`
- L89: `generateReferenceWithAI(repoPath, qualifiedName, ...)` -> use `referenceRepoName`
- L96-99: `analyzedAt` -> `referenceUpdatedAt`
- L100: `getReferencePath(qualifiedName)` -> `getReferencePath(referenceRepoName)`
- L102: `installReference(qualifiedName, repoPath, ...)` -> `installReference(qualifiedName, referenceRepoName, repoPath, ...)`
- L108-109: return `referencePath` instead of `analysisPath`

### apps/cli/src/handlers/shared.ts

- L8-17: rename fields `analyzed` -> `hasReference`, `analyzedAt` -> `referenceUpdatedAt`, `hasSkill` -> `hasReference`; remove `isStale`
- L26-32: `[analyzed]`/`[skill]` -> `[reference]` and `[no-reference]`
- L43-45: drop `checkStale` param from `entryToListItem`
- L66-77: remove stale-check block
- L79-88: update returned fields to `hasReference`/`referenceUpdatedAt`

### apps/cli/src/handlers/list.ts

- L9-12: remove `stale?: boolean` from options
- L25: drop `stale` from destructure
- L33: "clone and analyze" -> "clone and generate a reference"
- L38-49: remove stale filtering; call `entryToListItem(entry)`
- L56-60: remove stale-specific messaging

### apps/cli/src/handlers/repo.ts

- L16-20: remove `stale?: boolean` from `RepoListOptions`
- L31-35: remove `stale?: boolean` from `RepoUpdateOptions`
- L61-66: remove `stale` from `RepoStatusResult`
- L117: "clone and analyze" -> "clone and generate a reference"
- L129: remove `isStale` assignment
- L135-136: `analyzed/hasSkill` -> `hasReference`
- L143-157: remove stale filtering + stale messaging
- L168-171: remove `stale` gate and update error message to "Specify --all or a pattern"
- L194: remove `staleOnly: stale` from `updateAllRepos` call
- L323-333: remove stale output from status display
- L487: "marked as not analyzed" -> "marked as not referenced"

### apps/cli/src/handlers/project.ts

- L2-13: add `readGlobalMap` and `writeProjectMap` imports from `@offworld/sdk`
- L11: `InstalledSkill` -> `InstalledReference`
- L26: "Generate skills" -> "Generate references"
- L37: `skillsInstalled` -> `referencesInstalled`
- L142: "Install skills" -> "Install references"
- L153: "install skills" -> "install references"
- L163: `InstalledSkill[]` -> `InstalledReference[]`
- L179: `pullResult.skillInstalled` -> `pullResult.referenceInstalled`
- L181-185: `skill:` -> `reference:` (use `toReferenceFileName`)
- Before L197: insert project map write using global map data
  ```ts
  const map = readGlobalMap();
  const projectEntries = Object.fromEntries(
  	selected
  		.filter((m) => m.repo)
  		.map((m) => {
  			const qualifiedName = `github:${m.repo}`;
  			const entry = map.repos[qualifiedName];
  			return [
  				qualifiedName,
  				{
  					localPath: entry?.localPath ?? "",
  					reference: toReferenceFileName(m.repo!),
  					keywords: entry?.keywords ?? [],
  				},
  			];
  		}),
  );
  writeProjectMap(projectRoot, projectEntries);
  ```
- L209-211: "skills" -> "references"
- L216: return `referencesInstalled`

### apps/cli/src/handlers/init.ts

- L10: remove `getStateRoot` import; add `Paths`
- L277: "install skills" -> "install references"
- L306: `getStateRoot()` -> `Paths.state`
- L327: "not analyzed" -> "not referenced"

### apps/cli/src/handlers/config.ts

- L254: "install skills" -> "install references"

### apps/cli/src/handlers/push.ts

- L11: `toSkillDirName` -> `toReferenceName`
- L15: `pushAnalysis` -> `pushReference`
- L22: `InvalidSkillError` -> `InvalidReferenceError`
- L87: rename `loadLocalAnalysis` -> `loadLocalReference`
- L101-105: `analyzedAt` -> `referenceUpdatedAt`; `referenceName` -> `toReferenceName(fullName)`
- L170: "clone and analyze" -> "clone and generate a reference"
- L186-196: rename `localAnalysis` -> `localReference`
- L216: `pushAnalysis(...)` -> `pushReference(...)`
- L238-249: "skills" -> "references"
- L258-262: `InvalidSkillError` handling -> `InvalidReferenceError` + "reference" wording

### apps/cli/src/handlers/remove.ts

- L9: drop `removeReferenceByName` import; add `toReferenceFileName`
- L14: `import { existsSync } from "node:fs";` -> `import { existsSync, rmSync } from "node:fs";`
- L28-31: `skillPath` -> `referencePath`
- L36-55: rename `skillPath` usages -> `referencePath`
- L73-74: `${repoName.replace(/\//g, "-")}.md` -> `toReferenceFileName(repoName)`
- L221: replace `removeReferenceByName(repoName)` with local delete block
  ```ts
  if (existsSync(referencePath)) rmSync(referencePath, { force: true });
  if (existsSync(metaPath)) rmSync(metaPath, { recursive: true, force: true });
  ```
- L200/L228: `skillPath` -> `referencePath` in return payloads

### apps/cli/src/index.ts

- L83/L335: remove `stale` flags from list/repo list inputs
- L95/L348: remove `stale: input.stale` in handler calls
- L357/L371: remove `stale` from repo update inputs and handler calls

### apps/cli/src/**tests**/handlers.test.ts

- L52-53: `pullAnalysis*` -> `pullReference*` mocks
- L61: `pushAnalysis` -> `pushReference` mock
- L64-70: `toSkillDirName` mock -> `toReferenceFileName`/`toReferenceName`
- L175: `hasSkill` -> `hasReference`
- L272/L298/L328/L358: `analysisSource` -> `referenceSource`
- L503: `hasSkill` -> `hasReference`

### apps/cli/package.json

- L4: description -> "reference" wording
- L7/L13: keywords remove "analysis/skills"; add "reference"

### apps/cli/README.md

- L131-138: update `~/.local/share/offworld/skills/offworld/` -> `~/.local/share/offworld/skill/offworld/`

## Phase: apps/web

### apps/web/src/routes/\_github/$owner/$repo/route.tsx

- L5: `repoSkillsQuery` -> `repoReferencesQuery`
- L21: update `ensureQueryData(repoReferencesQuery(...))`

### apps/web/src/routes/\_github/$owner/$repo/index.tsx

- L11: `repoSkillsQuery` import -> `repoReferencesQuery`
- L71-82: `analysisData` -> `referenceData`
- L91-110: `analysisData` prop -> `referenceData`

### apps/web/src/components/repo/repo-header.tsx

- L12-19: `analysisData` -> `referenceData`
- L35: `hasAnalysis` -> `hasReference`
- L54-63: `analysisData` -> `referenceData`
- L66: `!hasAnalysis` -> `!hasReference`

### apps/web/src/components/admin/analysis-table.tsx

- L22: `AnalysisTable` -> `ReferenceTable`
- L61: column label "Analyzed" -> "Generated"

### apps/web/src/routes/admin.tsx

- L5: import `AnalysisTable` -> `ReferenceTable`
- L58: `<AnalysisTable />` -> `<ReferenceTable />`

### apps/web/src/routes/cli.tsx

- L54: "Force re-analysis" -> "Force re-generation"
- L60: "Generate analysis locally" -> "Generate reference locally"
- L70: "Push local analysis" -> "Push local reference"
- L334-352: replace "skills"/"analysis" wording with "references"

### apps/web/src/routes/explore.tsx

- L27: "Shared skills" -> "Shared references"
- L29: "Explore skills" -> "Explore references"
- L46: "No skills" -> "No references"

### apps/web/src/components/layout/breadcrumbs.tsx

- L27: breadcrumb label "skills" -> "references"

### apps/web/e2e/analysis.spec.ts

- L3-41: replace "analysis" wording with "reference" in test names/selectors

## Phase: apps/docs

### AGENTS.md

- L11-18, L143-148, L190-194: `~/.local/share/offworld/skills/offworld/` -> `~/.local/share/offworld/skill/offworld/`

### README.md

- L75-82: `~/.local/share/offworld/skills/offworld/` -> `~/.local/share/offworld/skill/offworld/`

### packages/sdk/README.md

- L23: "AGENTS.md skill table generation" -> "AGENTS.md reference table generation"

### .github/workflows/release.yml

- L209: description "analysis/skill" -> "reference"
