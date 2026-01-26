# Offworld

> **WORK IN PROGRESS** — Not yet published. Expect breaking changes.

**One skill for your whole stack.**

```bash
ow project init
```

Offworld builds a persistent clone map, generates right-sized references, and installs one routing skill across all your coding agents.

## The Problem

Agents can find your deps (package.json, web search, node_modules), but the path is expensive and fragile:

- Token burn every session to rediscover docs and source
- Hallucination after the context gets too deep
- No memory between sessions

## The Solution

One global skill + per-repo references.

Offworld:

1. **Generates references** on demand (competitors only load or scrape)
2. **Scans your entire dependency stack** in one command
3. **Installs one routing skill** everywhere (O(1) startup load)
4. **Maintains a persistent clone map** that survives sessions

## Installation

```bash
# bun (recommended)
bun add -g offworld

# Homebrew
brew install oscabriel/tap/offworld

# curl
curl -fsSL https://offworld.sh/install | bash
```

## Quick Start

```bash
# One-time setup
ow init

# Install references for your project's dependencies
cd your-project
ow project init
```

## How It Works

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

### The Clone Map

`assets/map.json` is a persistent clone map. It gives agents a stable pointer to the right source tree without re-discovering it every session.

### Local Layout

```
~/.local/share/offworld/skills/offworld/
├── SKILL.md           # Static routing skill
├── assets/
│   └── map.json       # Canonical clone map
└── references/
    ├── tanstack-router.md
    └── ...
```

## CLI Commands

| Command              | Description                                   |
| -------------------- | --------------------------------------------- |
| `ow project init`    | Scan deps, generate references, update map    |
| `ow pull <repo>`     | Clone + generate reference for specific repo  |
| `ow list`            | List managed repos                            |
| `ow generate <repo>` | Force local AI generation                     |
| `ow push <repo>`     | Share reference to offworld.sh                |
| `ow rm <repo>`       | Remove repo and reference files               |
| `ow init`            | Interactive global setup                      |
| `ow config show`     | View configuration (includes path discovery)  |
| `ow auth login`      | Authenticate with offworld.sh                 |

## Git Clone Management

Offworld manages git clones at `~/ow/{provider}/{owner}/{repo}` (configurable).

These clones serve two purposes:

- **Agent reads them** to generate accurate references
- **You can browse them** anytime for reference or to contribute

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `ow repo list`     | List all managed repos                                |
| `ow repo update`   | Pull latest changes (`--all`, `--stale`, `--pattern`) |
| `ow repo status`   | Show summary: total repos, disk usage, stale count    |
| `ow repo prune`    | Clean up stale map entries and orphaned dirs          |
| `ow repo gc`       | Garbage collect old/unused repos                      |
| `ow repo discover` | Find and index existing repos in your repoRoot        |

## Supported Agents

The single skill is symlinked to all detected agents:

- OpenCode (`~/.config/opencode/skill/`)
- Claude Code (`~/.claude/skills/`)
- Codex (`~/.codex/skills/`)
- Amp (`~/.config/agents/skills/`)
- Antigravity (`~/.gemini/antigravity/skills/`)
- Cursor (`~/.cursor/skills/`)

## Project Structure

```
offworld/
├── apps/
│   ├── cli/         # CLI application (offworld / ow)
│   ├── web/         # Web app (offworld.sh)
│   ├── docs/        # Documentation (Astro Starlight)
│   └── tui/         # Terminal UI (OpenTUI)
├── packages/
│   ├── sdk/         # Core business logic
│   ├── types/       # Zod schemas + TypeScript types
│   ├── backend/     # Convex serverless functions
│   └── config/      # Shared tsconfig
```

## Development

```bash
bun install              # Install deps
bun run dev              # Start all apps
bun run dev:web          # Web app only
bun run dev:server       # Convex backend only
bun run build:cli        # Build CLI + link globally
bun run check            # Oxlint + Oxfmt
bun run typecheck        # TypeScript
bun run test             # Vitest
```

## Web App (offworld.sh)

Browse and search community references, download pre-generated references, share your own.

**Stack**: TanStack Start + Convex + WorkOS Auth + Cloudflare Workers

## Tech Stack

- **CLI**: trpc-cli + @orpc/server + @clack/prompts
- **AI**: Claude SDK for reference generation
- **Backend**: Convex
- **Web**: TanStack Start, TanStack Router, React Query
- **Auth**: WorkOS AuthKit
- **Deploy**: Alchemy (Cloudflare Workers)
- **Tooling**: Bun, Turborepo, Oxlint, tsdown

## Links

- **Web App**: [offworld.sh](https://offworld.sh)
- **CLI Docs**: [docs.offworld.sh/cli](https://docs.offworld.sh/cli)

## License

MIT
