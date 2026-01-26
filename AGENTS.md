## OVERVIEW

**Offworld** — One skill for your whole stack. Builds a persistent clone map, generates right-sized references, installs one routing skill across all agents.

Turborepo monorepo: CLI (`ow`), web app (offworld.sh), docs, TUI.

## ARCHITECTURE

### Single-Skill Model

```
~/.local/share/offworld/skill/offworld/
├── SKILL.md           # Static routing skill
├── assets/
│   └── map.json       # Canonical clone map
└── references/
    ├── tanstack-router.md
    └── ...
```

- **One global skill** (static, never changes)
- **Canonical map** at `assets/map.json`
- **Per-repo references** under `references/`
- **Project map** at `.offworld/map.json` for scoped routing

### Data Flow

```
ow project init
  -> parse manifests
  -> resolve deps to repos
  -> clone repos
  -> generate references
  -> update assets/map.json
  -> write .offworld/map.json
  -> symlink single offworld skill
```

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
- `src/index-manager.ts` — Global/project map management
- `src/generate.ts` — AI reference generation
- `src/agents.ts` — Agent registry (6 agents)
- `src/sync.ts` — Convex client for push/pull
- `src/auth.ts` — WorkOS token management
- `src/repo-source.ts` — Parse repo input (URL, owner/repo, local)
- `src/manifest.ts` — Dependency parsing (package.json, etc.)
- `src/reference-matcher.ts` — Match deps to installed references

### Backend (`packages/backend/convex/`)

- `schema.ts` — Tables: reference, repository, pushLog, user
- `references.ts` — CRUD for references
- `admin.ts` — Admin functions
- `github.ts` — GitHub API queries
- `validation/` — Push arg + content + GitHub validators

### Web (`apps/web/`)

- `src/routes/index.tsx` — Landing page
- `src/routes/explore.tsx` — Browse shared references
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

| Command              | Handler       | Description                   |
| -------------------- | ------------- | ----------------------------- |
| `ow pull <repo>`     | `pull.ts`     | Clone + generate reference    |
| `ow generate <repo>` | `generate.ts` | Force local AI generation     |
| `ow push <repo>`     | `push.ts`     | Upload to offworld.sh         |
| `ow list`            | `list.ts`     | List managed repos            |
| `ow rm <repo>`       | `remove.ts`   | Remove repo + reference       |
| `ow init`            | `init.ts`     | Interactive global setup      |
| `ow project init`    | `project.ts`  | Scan deps, install references |
| `ow config *`        | `config.ts`   | Config management             |
| `ow auth *`          | `auth.ts`     | WorkOS authentication         |

## DATA PATHS

| Purpose      | Location                                                 |
| ------------ | -------------------------------------------------------- |
| Config       | `~/.config/offworld/config.json`                         |
| Global skill | `~/.local/share/offworld/skill/offworld/`                |
| Global map   | `~/.local/share/offworld/skill/offworld/assets/map.json` |
| References   | `~/.local/share/offworld/skill/offworld/references/`     |
| Project map  | `./.offworld/map.json`                                   |
| Cloned repos | `~/ow/` (configurable)                                   |

## AGENTS SUPPORTED

Single skill symlinked to:

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
- AI: Claude SDK for reference generation
- Deploy: Alchemy → Cloudflare Workers
- **Map architecture**: Global map at `assets/map.json`, project maps at `.offworld/map.json`
- **SKILL.md**: Static routing skill; all paths discovered via `ow config show --json`
- **References**: Markdown files without frontmatter, one per repo
- **Generation**: Returns `referenceContent` + `commitSha`

## Project References

References installed for this project's dependencies:

| Dependency | Reference               | Path                                                                      |
| ---------- | ----------------------- | ------------------------------------------------------------------------- |
| zod        | colinhacks-zod.md       | ~/.local/share/offworld/skill/offworld/references/colinhacks-zod.md       |
| typescript | microsoft-TypeScript.md | ~/.local/share/offworld/skill/offworld/references/microsoft-TypeScript.md |
| vitest     | vitest-dev-vitest.md    | ~/.local/share/offworld/skill/offworld/references/vitest-dev-vitest.md    |

To update references: `ow pull <dependency>`
To regenerate all: `ow project init --all --generate`
