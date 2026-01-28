# Offworld

**One skill for your whole stack.**

CLI tool that gives your coding agents instant, up-to-date context on any open source repo.

## The Problem

Your agent is good at searching the web and using the pre-written skills you've downloaded, but every time it needs to understand a new thing, it has to go through the same motions again. It figures it out eventually, but the path is expensive and fragile.

- Token burn to rediscover docs and source
- Hallucination from deep context
- No memory between sessions

## The Solution

```bash
ow project init
```

Offworld is a single skill file and a robust CLI tool dedicated to empowering your agent with instant context on any open source repo. The skill directory keeps a persistent git clone map and reference files for each dependency in your stack. And one CLI command scans your deps, creates git clones, and generates reference files for each dependency (or pulls them from our web directory), to be used by the skill to quickly understand and navigate at the source.

## What Makes Offworld Different

- **On-demand generation** — References created from the latest commit. Keep them updated by running the command again.
- **Scan your whole stack** — One command resolves your manifest and installs references for every dependency.
- **One skill everywhere** — A single routing skill is symlinked to all your agents.
- **Focused context** — The `ow` CLI tool ensures agents only read files relevant to your current question.

## Installation

```bash
# curl (recommended)
curl -fsSL https://offworld.sh/install | bash

# npm
npm install -g offworld

# bun
bun add -g offworld

# Homebrew
brew install oscabriel/tap/offworld
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

1. **One Skill for All Agents** — Install a single SKILL.md file that is symlinked to all your coding agents automatically.

2. **Clone the Repo** — CLI creates managed git clones on your machine that you and your agents can read at any time.

3. **Generate Reference from Source** — Agent explores the cloned repo and creates a reference file with common patterns, API details, and best practices.

4. **Query Your Clones** — Ask your agent about one of your clones and watch it read the reference, search the code, and answer questions fast.

## CLI Commands

| Command                | Description                                   |
| ---------------------- | --------------------------------------------- |
| `ow project init`      | Scan deps, generate references, update map    |
| `ow pull <repo>`       | Clone + generate reference for specific repo  |
| `ow list`              | List managed repos                            |
| `ow generate <repo>`   | Force local AI generation                     |
| `ow push <repo>`       | Share reference to offworld.sh                |
| `ow rm <repo>`         | Remove repo and reference files               |
| `ow init`              | Interactive global setup                      |
| `ow config show`       | View configuration                            |
| `ow repo update --all` | Pull latest for all cloned repos              |
| `ow repo status`       | Summary: total repos, disk usage, stale count |

## Local Layout

```
/skill/offworld/
├── SKILL.md           # Static routing skill
├── assets/
│   └── map.json       # Canonical clone map
└── references/
    ├── tanstack-router.md
    └── ...
```

The clone map gives agents a stable pointer to the right source tree without rediscovering it every session.

## Supported Agents

The single skill is symlinked to all detected agents:

- OpenCode (`~/.config/opencode/skill/`)
- Claude Code (`~/.claude/skills/`)
- Codex (`~/.codex/skills/`)
- Amp (`~/.config/agents/skills/`)
- Antigravity (`~/.gemini/antigravity/skills/`)
- Cursor (`~/.cursor/skills/`)
- More soon!

## Web App

Browse and search community references at [offworld.sh](https://offworld.sh). Download pre-generated references or share your own.

## Project Structure

```
offworld/
├── apps/
│   ├── cli/         # CLI (offworld / ow)
│   ├── web/         # Web app (offworld.sh)
│   ├── docs/        # Documentation (Astro Starlight)
│   └── tui/         # Terminal UI (OpenTUI)
├── packages/
│   ├── sdk/         # Core logic
│   ├── types/       # Zod schemas + TypeScript types
│   ├── backend/     # Convex serverless functions
│   └── config/      # Shared tsconfig
```

## Development

```bash
bun install              # Install deps
bun run dev              # Start all apps
bun run build:cli        # Build CLI + link globally
bun run check            # Oxlint + Oxfmt
bun run typecheck        # TypeScript
bun run test             # Vitest
```

## Links

- **Web**: [offworld.sh](https://offworld.sh)
- **Docs**: [docs.offworld.sh](https://docs.offworld.sh)

## License

MIT
