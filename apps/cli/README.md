# Offworld CLI

One skill for your whole stack.

## Installation

```bash
bun add -g offworld
# or
npm install -g offworld
```

## Quick Start

```bash
# Initialize config
ow init

# Install references for project deps
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
| `ow remove <repo>`   | Remove repo and/or reference      |

### Configuration

| Command                       | Description                 |
| ----------------------------- | --------------------------- |
| `ow init`                     | Interactive setup           |
| `ow config show`              | Show all settings           |
| `ow config set <key> <value>` | Set a config value          |
| `ow config get <key>`         | Get a config value          |
| `ow config agents`            | Select agents interactively |

### Repository Management

| Command                | Description               |
| ---------------------- | ------------------------- |
| `ow repo list`         | List managed repos        |
| `ow repo update --all` | Update all repos          |
| `ow repo prune`        | Remove stale map entries  |
| `ow repo status`       | Show repo summary         |
| `ow repo gc`           | Garbage collect old repos |
| `ow repo discover`     | Index existing repos      |

### Project

| Command           | Description                   |
| ----------------- | ----------------------------- |
| `ow project init` | Scan deps, install references |

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
--shallow         Use shallow clone (--depth 1)
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
--stale           Only show stale repos
--pattern <pat>   Filter by pattern
```

### `ow remove`

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
--generate, -g    Generate references for new deps
--dry-run, -d     Preview only
--yes, -y         Skip confirmations
```

## Config Keys

| Key              | Type    | Description                                           |
| ---------------- | ------- | ----------------------------------------------------- |
| `repoRoot`       | string  | Where to clone repos (default: `~/ow`)                |
| `defaultShallow` | boolean | Use shallow clone by default                          |
| `defaultModel`   | string  | AI model (e.g., `anthropic/claude-sonnet-4-20250514`) |
| `agents`         | list    | Comma-separated agent names                           |

## Path Discovery

`ow config show --json` returns paths used by the routing skill:

```json
{
	"paths": {
		"skillDir": "~/.local/share/offworld/skills/offworld",
		"globalMap": "~/.local/share/offworld/skills/offworld/assets/map.json",
		"referencesDir": "~/.local/share/offworld/skills/offworld/references",
		"projectMap": "/abs/path/to/repo/.offworld/map.json"
	}
}
```

## Supported Agents

Single skill symlinked to:

- **OpenCode**: `~/.config/opencode/skill/`
- **Claude Code**: `~/.claude/skills/`
- **Codex**: `~/.codex/skills/`
- **Amp**: `~/.config/agents/skills/`
- **Antigravity**: `~/.gemini/antigravity/skills/`
- **Cursor**: `~/.cursor/skills/`

## Environment Variables

| Variable            | Description                             |
| ------------------- | --------------------------------------- |
| `ANTHROPIC_API_KEY` | Required for local reference generation |
| `WORKOS_CLIENT_ID`  | Required for `ow auth login`            |

## License

MIT
