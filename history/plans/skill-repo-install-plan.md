# Skill Repo Install Plan

## Summary

Add `ow install` to fetch skills from public repos or local paths, discover SKILL.md files, and install them using the skill name from frontmatter. Installation copies the full skill directory into Offworld’s skill store and symlinks into configured agent skill dirs, matching generated-skill behavior.

## Goals

- Install skill directories from GitHub URLs, GitHub shorthand, or local paths.
- Use SKILL.md frontmatter `name` as the installed directory name.
- Same symlink targets as generated skills (config-driven agent registry).
- Overwrite prompt on name collisions, auto-overwrite with `--yes`.

## Non-goals

- No analysis or AI generation.
- No repo indexing in `index.json`.
- No skill renaming or `-reference` suffixing.

## CLI UX

Command:

```
ow install <source> [options]
```

Options:

- `--skill <name...>`: install only named skills (case-insensitive)
- `--list`: list available skills and exit
- `--ref <branch|tag|sha>`: checkout ref for remote sources
- `--subpath <path>`: override parsed subpath
- `-y, --yes`: non-interactive, auto-install all, auto-overwrite

Source formats (same as add-skill):

- `owner/repo`
- `owner/repo/path/to/skills`
- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/<ref>/path/to/skills`
- local path (`./skills`, `/abs/path`, `../dir`)

Collision behavior:

- If `~/.local/share/offworld/skills/<name>` exists, prompt: `overwrite` or `cancel`.
- With `--yes`, auto-overwrite without prompt.

Non-TTY:

- If prompts would be required and `--yes` not set, return a clear error telling the user to pass `--yes` or `--skill`.

## Skill Discovery Rules

Port discovery logic from add-skill:

- If `searchPath` contains `SKILL.md`, treat it as a single skill.
- Else scan priority directories (same list as add-skill):
  - `searchPath`
  - `skills/`, `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
  - `.agent/skills/`, `.agents/skills/`, `.claude/skills/`, `.codex/skills/`, `.cursor/skills/`
  - `.github/skills/`, `.goose/skills/`, `.kilocode/skills/`, `.kiro/skills/`
  - `.opencode/skills/`, `.roo/skills/`, `.trae/skills/`
- If still empty, recursive search (depth-limited) for any `SKILL.md`.
- Parse frontmatter with `gray-matter`, require `name` and `description`.
- Deduplicate by `name` (first win), keep `path` for install.

## Installation Behavior

Install path (no rename):

- Skill dir: `~/.local/share/offworld/skills/<sanitized-skill-name>`
- Meta dir: `~/.local/share/offworld/meta/skills/<sanitized-skill-name>/meta.json`

Copying:

- Copy the full skill directory (all files and subdirs).
- No filtering (keep README.md, references/, etc).

Meta payload (example):

```json
{
	"name": "react",
	"description": "React framework skill",
	"installedAt": "2026-01-20T12:34:56.789Z",
	"source": {
		"type": "github",
		"url": "https://github.com/vercel-labs/agent-skills.git",
		"ref": "main",
		"subpath": "skills/frontend",
		"skillPath": "skills/frontend/react",
		"commitSha": "abc1234"
	}
}
```

Symlinks:

- Use the existing agent registry in `packages/sdk/src/agents.ts`.
- Use `loadConfig().agents` (no new agent prompts).
- For each agent: `ensureSymlink(skillDir, <agent.globalSkillsDir>/<sanitized-name>)`.

## SDK Changes

New modules (ported from add-skill at `/Users/oscargabriel/Developer/clones/github/vercel-labs/add-skill`):

- `packages/sdk/src/skills/source.ts`
  - `parseSkillSource(input: string)`
  - `SkillSource` type (local vs remote, url/ref/subpath)
- `packages/sdk/src/skills/discover.ts`
  - `discoverSkills(basePath, subpath?)`
  - `SkillInfo` type: `{ name, description, path, metadata? }`
- `packages/sdk/src/skills/install.ts`
  - `installExternalSkill(skill, meta, { overwrite })`
  - `isExternalSkillInstalled(name)`
  - `getExternalSkillPath(name)`
- `packages/sdk/src/skills/git.ts`
  - `cloneSkillSource(source, { ref })` → temp dir
  - `cleanupTempClone(path)`

Refactors:

- Extract `ensureSymlink` from `packages/sdk/src/generate.ts` to a shared helper so both generated and external installs use identical symlink logic.
- Keep generated install naming (`-reference`) unchanged.

Dependencies:

- Add `gray-matter` to `packages/sdk/package.json` for frontmatter parsing.

Exports:

- Re-export new functions in `packages/sdk/src/index.ts`.

## CLI Changes

New handler:

- `apps/cli/src/handlers/install.ts`
  - parse source
  - clone remote to temp (or use local path)
  - discover skills
  - handle `--list` / `--skill`
  - prompt for overwrite if needed
  - install and symlink
  - cleanup temp clone

Router wiring:

- Add `install` command in `apps/cli/src/index.ts` with options described above.
- Export handler in `apps/cli/src/handlers/index.ts`.

Prompt rules:

- If multiple skills and no `--skill` + no `--yes`, prompt multiselect.
- If collision and no `--yes`, prompt overwrite/cancel per skill.

## Tests

- Port add-skill tests:
  - `parseSkillSource` URL + subpath cases.
  - `discoverSkills` priority dirs + recursive fallback.
- New tests:
  - `installExternalSkill` copies directories and writes meta.
  - Collision handling (overwrite vs cancel).
  - Name sanitization prevents path traversal.

## References

- add-skill codebase: `/Users/oscargabriel/Developer/clones/github/vercel-labs/add-skill`
- Example repos:
  - https://github.com/dmmulroy/cloudflare-skill
  - https://github.com/waynesutton/convexskills
  - https://github.com/vercel-labs/agent-skills
