# Offworld

> **WORK IN PROGRESS** — Not yet published to npm. Expect breaking changes.

**Generate AI agent skills for your entire dependency stack with one command.**

```bash
ow project init
```

Offworld scans your `package.json`, resolves each dependency to its source repo, generates skill files via AI, and distributes them to every coding agent you use.

## The Problem

Your AI coding assistant doesn't understand your dependencies. You're building with TanStack Query, Zod, and 40 other packages. Every time you ask "how do I use X?", it hallucinates patterns from 2 years ago or asks you to paste documentation.

## The Solution

Skills are markdown files that teach AI agents about a codebase. Instead of reading 10,000 lines of source code, the agent reads a 200-line skill file.

Offworld:
1. **Generates skills** that don't exist (competitors only install pre-made ones)
2. **Scans your dependencies** automatically (no manual per-package commands)
3. **Distributes everywhere** (one skill, symlinked to 6 agents)

## Installation

```bash
# bun (recommended)
bun add -g offworld

# npm
npm install -g offworld

# pnpm
pnpm add -g offworld
```

## Quick Start

```bash
# One-time setup
ow init

# Skill your project's dependencies
cd your-project
ow project init
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `ow project init` | Scan deps, generate skills, update AGENTS.md |
| `ow pull <repo>` | Clone + generate skill for specific repo |
| `ow list` | List managed repos and skill status |
| `ow generate <repo>` | Force local AI generation |
| `ow push <repo>` | Share skill to offworld.sh |
| `ow rm <repo>` | Remove repo and skill files |
| `ow init` | Interactive global setup |
| `ow config show` | View configuration |
| `ow auth login` | Authenticate with offworld.sh |

## Supported Agents

Skills are symlinked to all detected agents:

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
# Install dependencies
bun install

# Start all apps
bun run dev

# Start specific apps
bun run dev:web      # Web app only
bun run dev:server   # Convex backend only

# Build CLI and link globally
bun run build:cli

# Run checks
bun run check        # Oxlint + Oxfmt
bun run typecheck    # TypeScript
bun run test         # Vitest
```

## Web App (offworld.sh)

Browse and search community skills, download pre-generated skills, share your own.

**Stack**: TanStack Start + Convex + WorkOS Auth + Cloudflare Workers

## Tech Stack

- **CLI**: trpc-cli + @orpc/server + @clack/prompts
- **AI**: OpenCode SDK, Claude Agent SDK
- **Backend**: Convex
- **Web**: TanStack Start, TanStack Router, React Query
- **Auth**: WorkOS AuthKit
- **Deploy**: Alchemy (Cloudflare Workers)
- **Tooling**: Bun, Turborepo, Oxlint, tsdown

## Links

- **Website**: [offworld.sh](https://offworld.sh)
- **CLI Docs**: [offworld.sh/cli](https://offworld.sh/cli)
- **GitHub**: [github.com/oscabriel/offworld](https://github.com/oscabriel/offworld)

## License

MIT
