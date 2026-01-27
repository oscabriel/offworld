# Map Routing Plan

## Goals

- Make agent routing fast without reading map.json.
- Keep only one new CLI namespace: `ow map`.
- Make `ow config show --json` context-aware for project maps.

## Scope

- Add `ow map show` and `ow map search`.
- Update SKILL.md template to prefer new commands.
- Adjust config output to omit projectMap when missing.

## Step 1: Config output (context-aware project map)

File: `apps/cli/src/handlers/config.ts`

- Compute `projectMapPath = resolve(process.cwd(), ".offworld/map.json")`.
- If `existsSync(projectMapPath)`:
  - include `paths.projectMap` in JSON and text output (absolute path).
- If not:
  - omit `paths.projectMap` entirely.
- Update `ConfigShowResult` type so `paths.projectMap` is optional.

## Step 2: SDK map helpers

File: `packages/sdk/src/map.ts` (new) or `packages/sdk/src/index-manager.ts` (existing)

Add helpers that return tiny results without dumping map.json:

- `resolveRepoKey(input, map)`
  - Accepts `github.com:owner/repo` or `owner/repo`.
  - Match by qualified name, then by fullName (suffix after `:`).
- `getMapEntry(input, { preferProject })`
  - If `.offworld/map.json` exists in cwd, prefer it, else global map.
  - Return `{ scope: "project" | "global", qualifiedName, entry }` or null.
- `searchMap(term, { limit })`
  - Normalize term to tokens (lowercase, strip @, split on /_-).
  - Score matches: exact fullName > keyword hit > partial contains.
  - Return sorted list with `{ qualifiedName, fullName, localPath, primary, keywords, score }`.

Export new helpers from `packages/sdk/src/index.ts`.

## Step 3: CLI `ow map` namespace

Files:
- `apps/cli/src/handlers/map.ts` (new)
- `apps/cli/src/handlers/index.ts` (export)
- `apps/cli/src/index.ts` (router wiring)

Commands:

- `ow map show <repo>`
  - Input: `repo` (positional), flags: `--json`, `--path`, `--ref`.
  - Output: localPath, primary reference file, keywords, scope.
  - `--path` prints only localPath, `--ref` prints only reference file path.

- `ow map search <term>`
  - Input: `term` (positional), flags: `--limit`, `--json`.
  - Output: top matches (qualifiedName, fullName, primary, localPath).

## Step 4: SKILL template update

File: `packages/sdk/src/generate.ts`

- Replace map.json instructions with:
  - `ow map search <term>`
  - `ow map show <repo> --ref` for reference path
  - `ow map show <repo> --path` for clone path
- Keep map.json as fallback only.

## Step 5: Docs

File: `apps/cli/README.md`

- Add `ow map show` and `ow map search` to command list.
- Include examples for `--ref` and `--path` flags.

## Step 6: Tests

- Add SDK tests for `resolveRepoKey` and `searchMap`.
- Add CLI handler tests if existing test harness covers handlers.

## Step 7: Manual verification

- Run `ow config show --json` in:
  - a repo without `.offworld/map.json` (no projectMap)
  - a repo with `.offworld/map.json` (projectMap shown)
- Run `ow map search tanstack` and verify top hits.
- Run `ow map show tanstack/db --ref` and `--path`.
