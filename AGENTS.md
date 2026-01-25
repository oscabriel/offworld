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
- `src/generate.ts` — AI skill generation
- `src/agents.ts` — Agent registry (6 agents)
- `src/sync.ts` — Convex client for push/pull
- `src/auth.ts` — WorkOS token management
- `src/repo-source.ts` — Parse repo input (URL, owner/repo, local)
- `src/manifest.ts` — Dependency parsing (package.json, etc.)
- `src/agents-md.ts` — AGENTS.md skill table generation

### Backend (`packages/backend/convex/`)

- `schema.ts` — Tables: analyses, pushLog, user
- `analyses.ts` — CRUD for skill analyses
- `admin.ts` — Admin functions
- `github.ts` — GitHub API queries

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
- AI: OpenCode SDK for skill generation
- Deploy: Alchemy → Cloudflare Workers

## Project Skills

Skills installed for this project's dependencies:

| Dependency | Skill                | Path                                                          |
| ---------- | -------------------- | ------------------------------------------------------------- |
| zod        | colinhacks-zod       | ~/.local/share/offworld/skills/colinhacks-zod-reference       |
| typescript | microsoft-TypeScript | ~/.local/share/offworld/skills/microsoft-TypeScript-reference |
| vitest     | vitest-dev-vitest    | ~/.local/share/offworld/skills/vitest-dev-vitest-reference    |

To update skills: `ow pull <dependency>`
To regenerate all: `ow project init --all --generate`
