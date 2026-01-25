# Offworld CLI

Repository analysis and skill generation for AI coding agents.

## Installation

```bash
npm install -g offworld
# or
bun add -g offworld
```

## Quick Start

```bash
# Initialize config (interactive)
ow init

# Clone and analyze a repo
ow pull tanstack/router

# List managed repos
ow list

# Generate skill locally (ignores remote)
ow generate owner/repo --force
```

## Commands

### Core

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `ow pull <repo>`     | Clone repo and fetch/generate skill |
| `ow generate <repo>` | Generate skill locally              |
| `ow push <repo>`     | Upload skill to offworld.sh         |
| `ow list`            | List managed repos                  |
| `ow remove <repo>`   | Remove repo and/or skill            |

### Configuration

| Command                       | Description                 |
| ----------------------------- | --------------------------- |
| `ow init`                     | Interactive setup           |
| `ow config show`              | Show all settings           |
| `ow config set <key> <value>` | Set a config value          |
| `ow config get <key>`         | Get a config value          |
| `ow config agents`            | Select agents interactively |

### Repository Management

| Command                | Description                |
| ---------------------- | -------------------------- |
| `ow repo list`         | List managed repos         |
| `ow repo update --all` | Update all repos           |
| `ow repo prune`        | Remove stale index entries |
| `ow repo status`       | Show repo summary          |
| `ow repo gc`           | Garbage collect old repos  |
| `ow repo discover`     | Index existing repos       |

### Project

| Command           | Description               |
| ----------------- | ------------------------- |
| `ow project init` | Scan deps, install skills |

### Authentication

| Command          | Description          |
| ---------------- | -------------------- |
| `ow auth login`  | Login to offworld.sh |
| `ow auth logout` | Logout               |
| `ow auth status` | Show auth status     |

## Options

### `ow pull`

```
--shallow         Use shallow clone (--depth 1)
--sparse          Sparse checkout (src/, lib/, packages/, docs/)
--branch <name>   Branch to clone
--force, -f       Force re-analysis
--verbose         Detailed output
--model, -m       Model override (provider/model)
--skill, -s       Skill name to pull
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
--yes, -y         Skip confirmation
--skill-only      Only remove skill files
--repo-only       Only remove cloned repo
--dry-run, -d     Show what would be done
```

## Config Keys

| Key              | Type    | Description                                           |
| ---------------- | ------- | ----------------------------------------------------- |
| `repoRoot`       | string  | Where to clone repos (default: `~/ow`)                |
| `defaultShallow` | boolean | Use shallow clone by default                          |
| `defaultModel`   | string  | AI model (e.g., `anthropic/claude-sonnet-4-20250514`) |
| `agents`         | list    | Comma-separated agent names                           |

## Supported Agents

Skills are installed to:

- **Claude Code**: `~/.config/Claude/skill/`
- **Opencode**: `~/.claude/skills/`
- **Codex**: `~/.codex/skills/`
- **Amp**: `~/.config/agents/skills/`
- **Antigravity**: `~/.gemini/antigravity/skills/`
- **Cursor**: `~/.cursor/skills/`

## Environment Variables

| Variable            | Description                         |
| ------------------- | ----------------------------------- |
| `ANTHROPIC_API_KEY` | Required for local skill generation |
| `WORKOS_CLIENT_ID`  | Required for `ow auth login`        |

## License

MIT
