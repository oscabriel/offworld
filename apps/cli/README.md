# Offworld CLI

**One skill for your whole stack.**

A single skill file and a CLI tool dedicated to empowering your agent with instant context on any open source repo.

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

# Pull a specific repo
ow pull tanstack/router

# List managed repos
ow list
```

## Commands

### Core

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `ow pull <repo>`     | Clone repo and generate reference |
| `ow generate <repo>` | Generate reference locally        |
| `ow push <repo>`     | Upload reference to offworld.sh   |
| `ow list`            | List managed repos                |
| `ow rm <repo>`       | Remove repo and/or reference      |

### Configuration

| Command                       | Description                 |
| ----------------------------- | --------------------------- |
| `ow init`                     | Interactive setup           |
| `ow config show`              | Show all settings           |
| `ow config set <key> <value>` | Set a config value          |
| `ow config get <key>`         | Get a config value          |
| `ow config agents`            | Select agents interactively |

### Project

| Command           | Description                   |
| ----------------- | ----------------------------- |
| `ow project init` | Scan deps, install references |

### Map (Repo Routing)

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `ow map show <repo>`   | Show map entry for a repo (path, ref, keywords) |
| `ow map search <term>` | Search map for repos matching a term or keyword |

### Repository Management

| Command                | Description               |
| ---------------------- | ------------------------- |
| `ow repo list`         | List managed repos        |
| `ow repo update --all` | Update all repos          |
| `ow repo status`       | Show repo summary         |
| `ow repo prune`        | Remove stale map entries  |
| `ow repo gc`           | Garbage collect old repos |
| `ow repo discover`     | Index existing repos      |

### Authentication

| Command          | Description          |
| ---------------- | -------------------- |
| `ow auth login`  | Login to offworld.sh |
| `ow auth logout` | Logout               |
| `ow auth status` | Show auth status     |

## Options

### `ow pull`

```
--reference, -r   Reference filename override
--sparse          Sparse checkout (src/, lib/, packages/, docs/)
--branch <name>   Branch to clone
--force, -f       Force regeneration
--verbose         Detailed output
--model, -m       Model override (provider/model)
```

### `ow list`

```
--json            Output as JSON
--paths           Show full paths
--pattern <pat>   Filter by pattern
```

### `ow rm`

```
--yes, -y           Skip confirmation
--reference-only    Only remove reference files
--repo-only         Only remove cloned repo
--dry-run, -d       Show what would be done
```

### `ow project init`

```
--all             Select all deps
--deps            Comma-separated deps
--skip            Deps to exclude
--generate, -g    Force local generation for new deps
--dry-run, -d     Preview only
--yes, -y         Skip confirmations
```

### `ow map show`

```
--json            Output as JSON
--path            Print only the local path
--ref             Print only the reference file path
```

### `ow map search`

```
--limit, -n       Max results (default: 10)
--json            Output as JSON
```

## Config Keys

| Key                     | Type    | Description                                                           |
| ----------------------- | ------- | --------------------------------------------------------------------- |
| `repoRoot`              | string  | Where to clone repos (default: `~/ow`)                                |
| `defaultModel`          | string  | AI model (e.g., `anthropic/claude-sonnet-4-20250514`)                 |
| `maxCommitDistance`     | number  | Max commit distance to accept remote references (default: `20`)       |
| `acceptUnknownDistance` | boolean | Accept remote refs when commit distance is unknown (default: `false`) |
| `agents`                | list    | Comma-separated agent names                                           |

## Path Discovery

`ow config show --json` returns paths used by the routing skill:

```json
{
	"paths": {
		"skillDir": "~/.local/share/offworld/skill/offworld",
		"globalMap": "~/.local/share/offworld/skill/offworld/assets/map.json",
		"referencesDir": "~/.local/share/offworld/skill/offworld/references",
		"projectMap": "/abs/path/to/repo/.offworld/map.json"
	}
}
```

## Supported Agents

Single skill symlinked to:

- OpenCode (`~/.config/opencode/skill/`)
- Claude Code (`~/.claude/skills/`)
- Codex (`~/.codex/skills/`)
- Amp (`~/.config/agents/skills/`)
- Antigravity (`~/.gemini/antigravity/skills/`)
- Cursor (`~/.cursor/skills/`)

## Environment Variables

| Variable           | Description                                         |
| ------------------ | --------------------------------------------------- |
| `CONVEX_URL`       | Optional: override production Convex URL (dev only) |
| `WORKOS_CLIENT_ID` | Optional: override production WorkOS ID (dev only)  |

## SDK Notes (dev)

- CLI uses SDK subpaths: `@offworld/sdk/internal`, `@offworld/sdk/sync`, `@offworld/sdk/ai`
- Sync requires `convex`; AI requires `@opencode-ai/sdk`

## License

MIT
