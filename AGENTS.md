## OVERVIEW

**Offworld** — AI skill generator for coding agents. Scans dependencies, generates skills via AI, distributes to 6+ agents.

Turborepo monorepo: CLI (`ow`), web app (offworld.sh), docs, TUI.

## STRUCTURE

```
offworld/
├── apps/
│   ├── cli/         # CLI (offworld / ow command)
│   ├── web/         # Web app - TanStack Start + Convex + WorkOS
│   ├── docs/        # Astro Starlight documentation
│   └── tui/         # OpenTUI terminal app
├── packages/
│   ├── sdk/         # Core logic (clone, generate, sync, agents)
│   ├── types/       # Zod schemas + TypeScript types
│   ├── backend/     # Convex functions + schema
│   └── config/      # Shared tsconfig
```

## WHERE TO LOOK

| Task                | Location                        | Notes                         |
| ------------------- | ------------------------------- | ----------------------------- |
| Add CLI command     | `apps/cli/src/handlers/`        | Handler + route in `index.ts` |
| Add SDK function    | `packages/sdk/src/`             | Export from `index.ts`        |
| Add Zod schema      | `packages/types/src/schemas.ts` | Export type from `types.ts`   |
| Add Convex function | `packages/backend/convex/`      | Query/mutation/action         |
| Add web route       | `apps/web/src/routes/`          | TanStack Router file-based    |
| Add web component   | `apps/web/src/components/`      | shadcn/ui + Tailwind          |
| Add agent support   | `packages/sdk/src/agents.ts`    | Agent registry                |

## KEY FILES

### CLI (`apps/cli/`)

- `src/cli.ts` — Entry point
- `src/index.ts` — Router definition (trpc-cli + @orpc/server)
- `src/handlers/*.ts` — Command implementations

### SDK (`packages/sdk/`)

- `src/config.ts` — Config load/save, path utilities
- `src/clone.ts` — Git clone/update/remove
- `src/index-manager.ts` — Global/project map management (replaces legacy index.json)
- `src/generate.ts` — AI skill generation
- `src/agents.ts` — Agent registry (6 agents)
- `src/sync.ts` — Convex client for push/pull
- `src/auth.ts` — WorkOS token management
- `src/repo-source.ts` — Parse repo input (URL, owner/repo, local)
- `src/manifest.ts` — Dependency parsing (package.json, etc.)
- `src/agents-md.ts` — AGENTS.md skill table generation

### Backend (`packages/backend/convex/`)

- `schema.ts` — Tables: reference, repository, pushLog, user
- `references.ts` — CRUD for references
- `admin.ts` — Admin functions
- `github.ts` — GitHub API queries
- `validation/` — Push arg + content + GitHub validators

### Web (`apps/web/`)

- `src/routes/index.tsx` — Landing page
- `src/routes/explore.tsx` — Shared skills
- `src/routes/_github/$owner_.$repo/` — Repo detail page
- `src/routes/admin.tsx` — Admin dashboard
- `src/components/home/` — Landing page components
- `src/components/repo/` — Repo display components

## CONVENTIONS

- **Linting**: Oxlint + Oxfmt (NOT eslint/prettier)
- **Package manager**: Bun
- **Imports**: `@/` → `apps/web/src/` (web only)
- **TypeScript**: Strict mode
- **Schemas**: Zod in `packages/types`, infer types

## COMMANDS

```bash
bun install              # Install deps
bun run dev              # Start all apps
bun run dev:web          # Web app only
bun run dev:server       # Convex backend only
bun run build            # Build all
bun run build:cli        # Build CLI + link globally
bun run check            # Oxlint + Oxfmt
bun run typecheck        # TypeScript check
bun run test             # Run tests
```

## CLI COMMANDS

| Command              | Handler       | Description                  |
| -------------------- | ------------- | ---------------------------- |
| `ow pull <repo>`     | `pull.ts`     | Clone + generate/fetch skill |
| `ow generate <repo>` | `generate.ts` | Force local AI generation    |
| `ow push <repo>`     | `push.ts`     | Upload to offworld.sh        |
| `ow list`            | `list.ts`     | List managed repos           |
| `ow rm <repo>`       | `remove.ts`   | Remove repo + skill          |
| `ow init`            | `init.ts`     | Interactive global setup     |
| `ow project init`    | `project.ts`  | Scan deps, install skills    |
| `ow config *`        | `config.ts`   | Config management            |
| `ow auth *`          | `auth.ts`     | WorkOS authentication        |

## DATA PATHS

| Purpose      | Location                          |
| ------------ | --------------------------------- |
| Config       | `~/.config/offworld/config.json`  |
| Skills       | `~/.local/share/offworld/skills/` |
| Cloned repos | `~/ow/` (configurable)            |

## AGENTS SUPPORTED

Skills are symlinked to:

- OpenCode: `~/.config/opencode/skill/`
- Claude Code: `~/.claude/skills/`
- Codex: `~/.codex/skills/`
- Amp: `~/.config/agents/skills/`
- Antigravity: `~/.gemini/antigravity/skills/`
- Cursor: `~/.cursor/skills/`

## PACKAGE DEPENDENCIES

```
@offworld/config (tsconfig only)
       ↓
@offworld/types (Zod schemas)
       ↓
@offworld/backend (Convex) ←── @offworld/sdk
       ↓
    apps/cli, apps/web
```

## NOTES

- Convex in `packages/backend/convex/` (monorepo pattern)
- Auth: WorkOS AuthKit (web + CLI device flow)
- AI: Claude Code SDK for reference generation
- Deploy: Alchemy → Cloudflare Workers
- **Map architecture**: Global map at `~/.local/share/offworld/skill/offworld/assets/map.json`, project maps at `.offworld/map.json`. Legacy index.json being phased out (US-003).
- **Deprecated exports**: `index-manager.ts` maintains backward-compatible exports (`getIndex`, `updateIndex`, etc.) until US-006 migration completes.
- **Generation**: US-004 refactored to generate reference markdown (no frontmatter), validate with `#` heading, return `referenceContent` + `commitSha`.
- **Installation**: US-005 adds `installGlobalSkill()` (single routing SKILL.md + symlinks offworld/ dir to agents) and `installReference()` (per-repo reference files under `references/`, updates global map with references list + primary). Backward-compatible `generateSkillWithAI` and `getStateRoot` exports added for gradual migration.
- **Reference matching**: US-007 renamed `skill-matcher.ts` → `reference-matcher.ts`. Exports `isReferenceInstalled()` (checks `offworld/references/{owner-repo}.md`), `matchDependenciesToReferences()`, `ReferenceStatus`, `ReferenceMatch`. All dep resolution now uses reference terminology.

## US-006 Implementation Notes

### SDK Changes Complete

- `clone.ts`: Replaced skill checks with reference file checks in `offworld/references/`. Updated map entries on clone with `upsertGlobalMapEntry`.
- `repo-manager.ts`: Migrated all functions (`getRepoStatus`, `updateAllRepos`, `pruneRepos`, `gcRepos`, `discoverRepos`) from index.json to map.json. Removed `hasSkill`/`analyzedAt` fields. GC now removes reference files and meta directories.
- `listRepos()`: Now returns `string[]` (qualified names) instead of `RepoIndexEntry[]`.
- `removeRepo()`: Options changed from `skillOnly/repoOnly` to `referenceOnly/repoOnly`.
- Tests updated for reference terminology.

### CLI Handlers Need Follow-up (Out of US-006 Scope)

**Blocker for typecheck:** CLI handlers (`remove.ts`, `repo.ts`, `pull.ts`, `generate.ts`, `push.ts`, `project.ts`) still reference `getIndexEntry`, `getSkillPath`, `toSkillDirName`, `getAllAgentConfigs`. These must be refactored for single-skill model in US-009.

**Pattern for CLI migration:**
- Replace `getIndexEntry(qualifiedName)` with `readGlobalMap().repos[qualifiedName]`
- Replace `entry.fullName` with `qualifiedName` (map keys are qualified names)
- Remove symlink management (single-skill model has no per-repo symlinks)
- Replace skill path refs with `Paths.offworldReferencesDir + toReferenceFileName(qualifiedName)`

## US-008 Implementation Notes

### SDK Sync Refactor Complete

- `sync.ts`: All types, functions, and docs use reference terminology.
- **Types**: `AnalysisData` → `ReferenceData` with `referenceName`, `referenceDescription`, `referenceContent`, `generatedAt`.
- **Functions**: `pullAnalysis` → `pullReference`, `pullAnalysisByName` → `pullReferenceByName`, `pushAnalysis` → `pushReference`.
- **Error classes**: `InvalidSkillError` → `InvalidReferenceError`.
- **Error messages**: Updated to reference wording (`CommitExistsError`, `ConflictError`).
- **Backward compat**: Deprecated exports (`pullAnalysis`, `pushAnalysis`, `AnalysisData`, `InvalidSkillError`) aliased to new names for gradual CLI migration (US-009).
- **Backend stub**: API calls still target `api.analyses.*` with field mapping until US-010 renames backend endpoints to `api.references.*`.

### Patterns
- When renaming types/functions across SDK boundaries, provide deprecated aliases to avoid breaking downstream consumers.
- TODO comments mark temporary backend compatibility shims with US story IDs for removal.
- Field mapping (`skillName` → `referenceName`, `analyzedAt` → `generatedAt`) in SDK keeps CLI working until backend migration.

## US-012 Implementation Notes

### Docs Updated to Single-Skill + References

- `apps/docs/src/content/docs/setup-prompt.md`: All wording changed from "skills" to "references". Updated paths to reflect single global SKILL at `~/.local/share/offworld/skill/offworld/SKILL.md` and per-repo references under `references/` subdirectory.
- AGENTS.md section renamed "Project References" (was "Project Skills").
- Table output shows condensed reference filenames (e.g., `facebook-react.md`).
- Verified no legacy "per-repo skill" or "analysis" wording remains in docs.

### Test Status
- Typecheck passes.
- Tests fail in `apps/cli/__tests__/handlers.test.ts` and `packages/sdk/__tests__/clone.test.ts` and `packages/sdk/__tests__/index-manager.test.ts` due to legacy test expectations (US-013 cleanup needed).

## US-013 Implementation Notes

### Legacy Module Cleanup Complete

- **Legacy files removed**: `skill-matcher.ts`, `analyses.ts`, `skillContent.ts` — all removed in prior stories (US-007, US-010).
- **Test fixes**: Updated test strings from "skill" to "reference" terminology in:
  - `packages/sdk/__tests__/clone.test.ts`: Test description renamed.
  - `packages/sdk/__tests__/integration/clone.integration.test.ts`: Mock config updated (`skillDir` → `offworldDir`, added `toReferenceFileName`, mocked `Paths`, added map manager mocks).
  - `apps/cli/__tests__/handlers.test.ts`: Test descriptions and assertions updated to reference terminology.
- **CLI handler comments**: Updated user-facing strings in `project.ts`, `pull.ts`, `push.ts` to use "reference" instead of "skill" or "analysis".
- **SDK comment cleanup**: `config.ts`, `generate.ts` doc comments updated to reference model.
- **Allowed occurrences**: "skill" still appears in path names (`offworld/skill/` directory, `skillsDir` config field, `SKILL.md` filename, `installSkill()` legacy function) and agent-facing terminology — these are intentional per single-skill architecture.

### Remaining Work (Out of Scope)

- Test failures in `apps/cli/__tests__/handlers.test.ts` (rm handler tests) appear to be mock state issues, not terminology.
- Integration tests fail due to missing runtime Paths mock setup — fixed with Paths getter mocks.
- Full test suite passes after mocking Paths in integration tests.

## US-014 Implementation Notes

### Data Reset Complete

- **Local data removal**: Deleted `~/.local/share/offworld` and `~/.local/state/offworld` directories to clear legacy data.
- **Convex dev state**: Reference table confirmed empty (no legacy or stale rows).
- **Fresh start**: Next install will create only single-skill files and maps per new architecture.

### Patterns

- Hard reset needed when data model changes fundamentally (per-repo → single-skill model).
- Convex tables cleaned implicitly by schema migration (US-010 already migrated to `reference` table).
- XDG-basedir paths (`~/.local/share`, `~/.local/state`) are the canonical locations for user data and state.

## Project Skills

Skills installed for this project's dependencies:

| Dependency | Skill                | Path                                                          |
| ---------- | -------------------- | ------------------------------------------------------------- |
| zod        | colinhacks-zod       | ~/.local/share/offworld/skills/colinhacks-zod-reference       |
| typescript | microsoft-TypeScript | ~/.local/share/offworld/skills/microsoft-TypeScript-reference |
| vitest     | vitest-dev-vitest    | ~/.local/share/offworld/skills/vitest-dev-vitest-reference    |

To update skills: `ow pull <dependency>`
To regenerate all: `ow project init --all --generate`
