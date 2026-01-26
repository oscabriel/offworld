# Offworld Single-Skill Refactor Plan

## Goal

Replace per-repo skills with a single global routing SKILL and per-repo reference files. Keep multi-agent distribution. All maps and routing are local-only.

## Non-Goals

- No migration or backwards compatibility.
- No preservation of legacy skills or Convex data.
- No project-level SKILL.md.

## Fixed Decisions

- One global SKILL.md per user at `~/.local/share/offworld/skill/offworld/SKILL.md`.
- References are markdown files under `~/.local/share/offworld/skill/offworld/references/` (no frontmatter).
- Canonical map is local-only at `~/.local/share/offworld/skill/offworld/assets/map.json`.
- Project map is `./.offworld/map.json`.
- Reference filename is `owner-repo.md` using existing `toSkillDirName` condense logic (drop `-reference` suffix).
- Meta stored at `~/.local/share/offworld/meta/{owner-repo}/meta.json` (XDG-basedir compliant).
- Web directory shows references, not skills; pull stats remain per reference.
- Multi-agent distribution stays core: symlink the `offworld/` directory to each agent skill dir.

## Architecture Overview (Target)

```
ow project init
  -> parse manifests
  -> resolve deps to repos
  -> clone repos
  -> generate references (OpenCode Analyze agent)
  -> update assets/map.json (global)
  -> write .offworld/map.json (project)
  -> ensure global SKILL + symlinks
```

## Local Layout (Target)

```
~/.local/share/offworld/skill/offworld/
├── SKILL.md
├── assets/
│   └── map.json
└── references/
    ├── owner-repo.md
    └── ...
```

## Data Model (Target)

Global map (local-only):

```json
{
	"repos": {
		"owner/repo": {
			"localPath": "/abs/path",
			"references": ["owner-repo.md"],
			"primary": "owner-repo.md",
			"keywords": ["..."],
			"updatedAt": "2026-01-25"
		}
	}
}
```

Project map:

```json
{
	"version": 1,
	"scope": "project",
	"globalMapPath": "~/.local/share/offworld/skill/offworld/assets/map.json",
	"repos": {
		"owner/repo": {
			"localPath": "/abs/path",
			"reference": "owner-repo.md",
			"keywords": ["..."]
		}
	}
}
```

## Step 1: Types and Schemas (`packages/types`)

Update all types and zod schemas to represent references, not skills/analysis.

Work:

- Add `GlobalMap` and `ProjectMap` types for map files.
- Add `ReferenceData` for push/pull (fullName, referenceName, description, content, commitSha, generatedAt).
- Remove/rename all `Skill*` and `Analysis*` types/schemas.
- Update `RepoIndex` / `RepoIndexEntry` types to align with maps or remove if unused.

Acceptance:

- `packages/types/src/schemas.ts` exports new map/reference schemas only.
- No `skill` or `analysis` types remain in types package.
- Typecheck passes with updated imports in SDK/CLI/backend/web.

## Step 2: XDG Paths and Naming (`packages/sdk`)

Add Offworld single-skill path helpers and rename naming utilities.

Work:

- In `packages/sdk/src/paths.ts`, add:
  - `offworldSkillDir` = `join(Paths.data, "skills", "offworld")`
  - `offworldReferencesDir` = `join(offworldSkillDir, "references")`
  - `offworldAssetsDir` = `join(offworldSkillDir, "assets")`
  - `offworldGlobalMapPath` = `join(offworldAssetsDir, "map.json")`
- Replace `toSkillDirName` in `packages/sdk/src/config.ts` with `toReferenceFileName` that returns `owner-repo.md` using current condense logic.
- Keep `getMetaPath` using `Paths.data` and `toMetaDirName`.

Acceptance:

- All offworld paths derived from XDG-basedir paths.
- Reference filename is `owner-repo.md` with condensed owner/repo logic preserved.

## Step 3: Map Manager (`packages/sdk`)

Replace index.json with map.json manager.

Work:

- Replace `packages/sdk/src/index-manager.ts` with map functions:
  - `readGlobalMap`, `writeGlobalMap`, `upsertGlobalMapEntry`, `removeGlobalMapEntry`.
  - `writeProjectMap(projectRoot, entries)`.
- Remove usage of `Paths.state` for index.json.

Acceptance:

- Global map reads/writes only `assets/map.json`.
- Project map writes only `./.offworld/map.json`.

## Step 4: Reference Generation (`packages/sdk`)

Reframe skill generation to reference generation using OpenCode Analyze agent.

Work:

- Update `packages/sdk/src/generate.ts`:
  - Prompt outputs reference markdown (no frontmatter).
  - Rename `GenerateSkill*` types to `GenerateReference*`.
  - Rename extraction/validation helpers to reference equivalents.
  - Return `referenceContent` and `commitSha`.
- Ensure prompt uses custom Analyze agent with focused reference goal.

Acceptance:

- Generated output is a markdown reference file with no YAML frontmatter.
- Validation ensures minimal content length and structure (reference-specific).

## Step 5: Install Global Skill + Reference Files (`packages/sdk`)

Add global skill install and per-repo reference install.

Work:

- Add `installGlobalSkill()`:
  - Ensure `~/.local/share/offworld/skill/offworld/SKILL.md` exists (static template).
  - Symlink full `offworld/` directory into each agent skill dir.
- Replace `installSkill` with `installReference`:
  - Write reference to `references/{owner-repo}.md`.
  - Write meta to `~/.local/share/offworld/meta/{owner-repo}/meta.json`.
  - Update `assets/map.json` with refs list + primary.

Acceptance:

- Agents see single `offworld` skill directory with all references under it.
- Reference and meta files are written to XDG-compliant paths.
- Global map updated on each install.

## Step 6: Clone + Repo Ops (`packages/sdk`)

Update clone/index logic to map-based routing and single-skill model.

Work:

- Update `packages/sdk/src/clone.ts`:
  - Replace `getSkillPath` checks with reference file checks.
  - Update map entry on clone with `localPath` and reference info.
- Update `packages/sdk/src/repo-manager.ts`:
  - Replace all index.json usage with map manager.
  - Remove `hasSkill` / `analyzedAt` fields.
  - GC/prune logic removes refs and meta, not per-repo skills.

Acceptance:

- No `index.json` usage remains.
- All repo state reflected via map.json + filesystem refs.

## Step 7: Reference Matching (`packages/sdk`)

Rename skill matcher and adjust semantics.

Work:

- Rename `packages/sdk/src/skill-matcher.ts` -> `reference-matcher.ts` or update names in place.
- `isReferenceInstalled` checks `offworld/references/{owner-repo}.md`.
- Update status labels and callers to reference terminology.

Acceptance:

- Dependency resolution checks reference existence under offworld single-skill dir.

## Step 8: Sync API (`packages/sdk`)

Rename sync interfaces and align with reference API.

Work:

- Update `packages/sdk/src/sync.ts`:
  - Rename `AnalysisData` -> `ReferenceData` and fields to `referenceName`, `referenceContent`, `generatedAt`.
  - Update API calls to new Convex endpoints (`references.*`).
  - Update error messages to reference terminology.

Acceptance:

- SDK sync only speaks reference names/fields.

## Step 9: CLI Routing + Flags (`apps/cli`)

Refactor CLI surface to reference language and single-skill operations.

Work:

- Update `apps/cli/src/index.ts`:
  - Rename flags `--skill` -> `--reference`, `--skill-only` -> `--reference-only`, `--without-skill` -> `--without-reference`.
  - Update descriptions and examples.
- Update handlers in `apps/cli/src/handlers/`:
  - `pull`, `generate`, `push`, `rm`, `list`, `repo`, `project`, `config`.
  - Generate references + update maps + install global skill.
- Update `ow config show --json` output to include:
  - `paths.skillDir`, `paths.referencesDir`, `paths.globalMap`, `paths.projectMap`.

Acceptance:

- CLI commands no longer mention skills; all flags are reference-named.
- `ow config show --json` returns map and refs paths for SKILL routing.

## Step 10: Backend Schema + Functions (`packages/backend/convex`)

Rename tables, queries, and validations to reference model.

Work:

- Update `packages/backend/convex/schema.ts`:
  - Rename `skill` table to `reference`.
  - Fields: `referenceName`, `referenceDescription`, `referenceContent`, `commitSha`, `generatedAt`, `pullCount`, `isVerified`, `workosId`.
- Rename `packages/backend/convex/analyses.ts` -> `references.ts` and update all queries/actions/mutations.
- Rename validation files: `skillContent.ts` -> `referenceContent.ts`; update push validation.
- Update backend tests for references.

Acceptance:

- Convex schema contains `reference` table only (no `skill`).
- All endpoints use reference names and fields.

## Step 11: Web App (`apps/web`)

Update routes, queries, and UI copy to references.

Work:

- Rename route file `apps/web/src/routes/_github/$owner/$repo/$skill.tsx` -> `$reference.tsx`.
- Update repo page `apps/web/src/routes/_github/$owner/$repo/index.tsx` to list references.
- Update `apps/web/src/routes/explore.tsx`, `apps/web/src/routes/profile.tsx`, `apps/web/src/components/home/*`, `apps/web/src/routes/cli.tsx` for reference language.
- Regenerate `apps/web/src/routeTree.gen.ts`.

Acceptance:

- UI labels and routing reflect references everywhere.
- Route params use `reference` (no `skill`).

## Step 12: Docs (`apps/docs`)

Update public docs and prompts to match single-skill model.

Work:

- Update `apps/docs/src/content/docs/setup-prompt.md` to reference generation and single SKILL.
- Update any CLI docs referencing skills to references.

Acceptance:

- Docs describe single global SKILL and per-repo references only.

## Step 13: Cleanup

Remove legacy skill/analysis code paths.

Work:

- Delete unused modules tied to skills/analysis.
- Remove old tests/mocks referencing skills.
- Update any remaining strings, comments, and types.

Acceptance:

- No `skill`/`analysis` legacy naming remains except where required by external deps.

## Step 14: Data Reset (Operator Action)

Remove existing Convex data and local CLI data.

Work:

- Delete all existing Convex data (dev) to avoid legacy data conflicts.
- Remove local CLI data dirs under `~/.local/share/offworld/` and `~/.local/state/offworld/`.

Acceptance:

- Fresh local install has only new single-skill files and maps.

## Step 15: Verification

Run project checks and ensure routing works with maps.

Work:

- Typecheck, tests, and build.
- Verify `ow project init` writes project map and updates global map.
- Verify `ow config show --json` output is consumed by SKILL routing steps.
- Verify pull stats on web update per reference.

Acceptance:

- All checks pass.
- End-to-end workflow works: clone -> reference -> map -> routing.

## Additional Notes

- Map is local-only; never pushed to web.
- Single global SKILL is static and path-agnostic; all path discovery done via CLI output.
- Symlinking the `offworld/` directory carries deep subdirs (references) automatically.
