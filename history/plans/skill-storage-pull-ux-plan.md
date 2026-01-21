# Skill Storage + Pull UX + Web UI Plan

**Date:** 2026-01-20
**Context:** Simplify skill storage, support multiple skills per repo, add repo path to SKILL.md, improve `ow pull` UX, remove stale SKILL refs, and update the web UI to list and render skills.

## Goals

- Store pushed skills as a single blob while keeping frontmatter fields searchable.
- Allow multiple skills per repo, each with its own pull count.
- Track total pulls per repo across all skills.
- Add local repo path to SKILL.md for fast grep usage.
- Make `ow pull` prompt-driven; no hard stop for existing clone.
- Remove stale `references/*` mentions in generated skills.
- Show a list of skills per repo with name/description metadata.
- Render the latest skill and show the full skill content.
- Display per-skill pull counts, total pull counts, and who pushed each skill.

## Non-Goals

- Fix `ow pull` upload error (handled elsewhere).
- Cleanup existing local skill files (manual deletion).
- Styling overhaul or visual redesign beyond necessary layout.
- Client-side editing or skill upload UI.

## Data Model (Convex)

### Table: `analyses` (one row per skill push)

Fields

- `provider`: string
- `repoOwner`: string
- `repoName`: string
- `qualifiedName`: string (`provider:owner/repo`)
- `commitSha`: string
- `pushedAt`: number (epoch ms)
- `pushedByUserId`: string
- `skill`: string (raw `SKILL.md`)
- `skillName`: string (frontmatter)
- `skillDescription`: string (frontmatter)
- `pullCount`: number

Indexes

- `by_qualifiedName` (`qualifiedName`)
- `by_qualifiedName_pushedAt` (`qualifiedName`, `pushedAt`)

### Table: `repoStats`

Fields

- `qualifiedName`: string
- `totalPullCount`: number

Index

- `by_qualifiedName` (`qualifiedName`)

## Backend API Changes

### Mutations

- `pushSkill`
  - Input: `qualifiedName`, `provider`, `repoOwner`, `repoName`, `commitSha`, `skill`
  - Parse frontmatter server-side to set `skillName` + `skillDescription`.
  - Insert new `analyses` row, `pullCount = 0`.
  - Ensure `repoStats` row exists.
- `incrementSkillPull`
  - Input: `analysisId` (or `qualifiedName` + `pushedAt` if preferred)
  - Increment `analyses.pullCount`.
  - Increment `repoStats.totalPullCount` for `qualifiedName`.

### Queries

- `listSkillsByRepo(qualifiedName)`
  - Returns summary list: `analysisId`, `skillName`, `skillDescription`, `pushedAt`, `pushedByUserId`, `pullCount`, `commitSha`.
- `getLatestSkillByRepo(qualifiedName)`
  - Returns most recent analysis row.
- `getSkill(analysisId)`
  - Returns full `skill` blob + metadata for display.

### Code Targets

- `packages/backend/convex/schema.ts`
- `packages/backend/convex/analyses.ts`
- `packages/sdk/src/sync.ts`
- `@offworld/types` schema alignment

## CLI Changes

### `ow push`

- Read `SKILL.md` and `meta.json` as today.
- Replace local repo path with placeholder before upload.
- Send only `skill` blob + repo metadata + `commitSha` to `pushSkill`.
- Remove legacy `summary/architecture/fileIndex/skill` payload.

Targets

- `apps/cli/src/handlers/push.ts`
- `packages/sdk/src/sync.ts`

### `ow pull`

- If clone exists: always `git pull` then continue.
- Prompts (unless `--force`):
  - Reuse cached analysis vs regenerate.
  - Use matching remote analysis vs regenerate.
  - Overwrite existing `SKILL.md` vs keep.
- On remote download: replace placeholder with local repo path, then write `SKILL.md`.
- After remote install: call `incrementSkillPull`.

Targets

- `apps/cli/src/handlers/pull.ts`
- `packages/sdk/src/clone.ts`

## SKILL.md Content Changes

- Add a `Repo path:` line in generated SKILL.md.
- Use placeholder token for push (ex: `{{REPO_PATH}}`).
- Replace placeholder with computed local path on pull.

Targets

- `packages/sdk/src/generate.ts`
- `apps/cli/src/handlers/pull.ts`
- `apps/cli/src/handlers/push.ts`

## Remove Stale Skill References

- Remove `references/summary.md` and `references/architecture.md` from prompt template.
- Stop plugin from loading missing `references/summary.md`.

Targets

- `packages/sdk/src/generate.ts`
- `packages/plugin/src/index.ts`

## Web UI Changes

### Data Dependencies

- `listSkillsByRepo(qualifiedName)` returns list rows.
- `getLatestSkillByRepo(qualifiedName)` returns full skill row.
- `getSkill(analysisId)` for detail view if needed.
- `repoStats.totalPullCount` for repo header.

### Repo Page

- Add skills list panel:
  - Rows: `skillName`, `skillDescription`, `pushedByUserId` (or display name if available), `pushedAt`, `pullCount`.
  - Link to skill detail view (analysisId).
- Add repo totals:
  - `totalPullCount` in header or stats row.
- Latest skill section:
  - Render full `SKILL.md` from `getLatestSkillByRepo`.

### Skill Detail View (optional but recommended)

- New route (ex: `/repo/:owner/:repo/skills/:analysisId`).
- Render full `skill` blob + metadata.
- Provide navigation back to repo skills list.

### Markdown Rendering

- Ensure the SKILL markdown renderer handles frontmatter (strip before render).
- Preserve code blocks and headings.

### Edge Cases

- Repo has no skills: show empty state with guidance.
- Missing user profile info: show userId fallback.
- Large SKILL.md: keep renderer performant; defer non-visible sections if needed.

### Targets

- `apps/web/src/routes/` (repo route + optional skill route)
- `apps/web/src/components/` (skills list, stats row)
- `apps/web/src/lib/` (Convex queries/hooks)

## Implementation Order

1. Update Convex schema + backend mutations/queries.
2. Update SDK sync client to new API surface.
3. Update CLI `ow push` to send new payload + placeholder swap.
4. Update CLI `ow pull` flow + prompts + pull count increment.
5. Update SKILL prompt + plugin refs removal.
6. Update web UI queries + rendering for multiple skills.
7. Update types + any docs as needed.
