---
title: CLI Reference
description: Complete reference for the ow command-line interface.
---

The `ow` CLI is the primary interface for managing Offworld references and the clone map.

## Installation

import { Tabs, TabItem } from "@astrojs/starlight/components";

<Tabs>
<TabItem label="macOS / Linux">
```bash
curl -fsSL https://offworld.sh/install | bash
```
</TabItem>
<TabItem label="npm">
```bash
npm install -g offworld
```
</TabItem>
<TabItem label="bun">
```bash
bun install -g offworld
```
</TabItem>
</Tabs>

### Environment Variables

| Variable     | Description                         | Default        |
| ------------ | ----------------------------------- | -------------- |
| `OW_VERSION` | Pin to specific version             | Latest         |
| `OW_CHANNEL` | Release channel: `stable` or `beta` | `stable`       |
| `OW_BIN_DIR` | Override installation directory     | `~/.local/bin` |

## Global Flags

| Flag        | Alias | Description  |
| ----------- | ----- | ------------ |
| `--help`    | `-h`  | Show help    |
| `--version` | `-v`  | Show version |

## Core Commands

### ow init

Interactive setup for Offworld. Configures paths and symlinks the skill to all supported agents.

```bash
ow init [options]
```

**Options:**

| Option        | Alias | Description               |
| ------------- | ----- | ------------------------- |
| `--yes`       | `-y`  | Skip confirmation prompts |
| `--force`     | `-f`  | Reconfigure if exists     |
| `--model`     | `-m`  | AI provider/model         |
| `--repo-root` |       | Where to clone repos      |
| `--agents`    | `-a`  | Comma-separated agents    |

**What it does:**

- Creates `~/.config/offworld/config.json`
- Sets up `~/.local/share/offworld/skills/offworld/`
- Symlinks skill to Claude Code, Cursor, Amp, OpenCode, Codex, Gemini

**Examples:**

```bash
ow init                                    # Interactive setup
ow init -y                                 # Accept all defaults
ow init --repo-root ~/repos --agents claude-code,cursor
```

### ow pull

Clone a repository and generate a reference.

```bash
ow pull <repo> [options]
```

**Arguments:**

| Argument | Description                                           |
| -------- | ----------------------------------------------------- |
| `repo`   | Repository to pull (`owner/repo`, URL, or local path) |

**Options:**

| Option        | Alias | Description                                    |
| ------------- | ----- | ---------------------------------------------- |
| `--reference` | `-r`  | Reference filename override                    |
| `--shallow`   |       | Use shallow clone (--depth 1)                  |
| `--sparse`    |       | Sparse checkout (src/, lib/, packages/, docs/) |
| `--branch`    |       | Branch to clone                                |
| `--force`     | `-f`  | Force regeneration                             |
| `--verbose`   |       | Show detailed output                           |
| `--model`     | `-m`  | Model override (provider/model)                |

**Examples:**

```bash
ow pull tanstack/router                    # Clone and generate
ow pull https://github.com/facebook/react  # From URL
ow pull ./my-lib                           # From local directory
ow pull tanstack/router -f                 # Force regenerate
ow pull tanstack/router --shallow          # Shallow clone
ow pull tanstack/router -m anthropic/claude-sonnet-4-20250514
```

### ow generate

Force regenerate a reference for an already-cloned repository.

```bash
ow generate <repo> [options]
```

Alias: `ow gen`

**Options:**

| Option    | Alias | Description                 |
| --------- | ----- | --------------------------- |
| `--force` | `-f`  | Force even if remote exists |
| `--model` | `-m`  | Model override              |

**Examples:**

```bash
ow generate tanstack/router
ow gen tanstack/router -f
```

### ow push

Upload a reference to offworld.sh for sharing.

```bash
ow push <repo>
```

Requires authentication. Run `ow auth login` first.

### ow list

List all managed repositories and their references.

```bash
ow list [options]
```

Alias: `ow ls`

**Options:**

| Option      | Description                         |
| ----------- | ----------------------------------- |
| `--json`    | Output as JSON                      |
| `--paths`   | Show full paths                     |
| `--stale`   | Only show stale repos               |
| `--pattern` | Filter by pattern (e.g., `react-*`) |

**Examples:**

```bash
ow list
ow ls --json
ow ls --pattern "tanstack-*"
```

### ow rm

Remove a repository and its reference.

```bash
ow rm <repo> [options]
```

Alias: `ow remove`

**Options:**

| Option             | Alias | Description                 |
| ------------------ | ----- | --------------------------- |
| `--yes`            | `-y`  | Skip confirmation           |
| `--reference-only` |       | Only remove reference files |
| `--repo-only`      |       | Only remove cloned repo     |
| `--dry-run`        | `-d`  | Show what would be done     |

**Examples:**

```bash
ow rm tanstack/router
ow rm tanstack/router -y
ow rm tanstack/router --reference-only
ow rm tanstack/router --dry-run
```

## Project Commands

### ow project init

Scan project dependencies and install matching references.

```bash
ow project init [options]
```

**Options:**

| Option       | Alias | Description                         |
| ------------ | ----- | ----------------------------------- |
| `--all`      |       | Process all dependencies            |
| `--deps`     |       | Comma-separated deps to include     |
| `--skip`     |       | Deps to exclude                     |
| `--generate` | `-g`  | Generate missing references locally |
| `--dry-run`  | `-d`  | Preview only                        |
| `--yes`      | `-y`  | Skip confirmations                  |

**What it does:**

1. Scans `package.json`, `Cargo.toml`, `go.mod`, etc.
2. Matches dependencies to available references
3. Pulls missing references from offworld.sh or generates locally
4. Creates `.offworld/map.json`
5. Updates `AGENTS.md` with reference table

**Examples:**

```bash
ow project init                           # Interactive
ow project init --all -g                  # All deps, generate missing
ow project init --deps zod,react          # Specific deps only
ow project init --dry-run                 # Preview
```

## Repository Management

### ow repo list

List managed repositories.

```bash
ow repo list [options]
```

Alias: `ow repo ls`

**Options:**

| Option      | Description           |
| ----------- | --------------------- |
| `--json`    | Output as JSON        |
| `--paths`   | Show full paths       |
| `--stale`   | Only show stale repos |
| `--pattern` | Filter by pattern     |

### ow repo update

Update cloned repositories (git fetch + pull).

```bash
ow repo update [options]
```

Requires at least one of: `--all`, `--stale`, `--pattern`.

**Options:**

| Option        | Alias | Description                    |
| ------------- | ----- | ------------------------------ |
| `--all`       |       | Update all repos               |
| `--stale`     |       | Only update stale repos        |
| `--pattern`   |       | Filter by pattern              |
| `--dry-run`   | `-d`  | Show what would be updated     |
| `--unshallow` |       | Convert shallow clones to full |

**Examples:**

```bash
ow repo update --all
ow repo update --stale
ow repo update --pattern "tanstack-*"
```

### ow repo prune

Remove stale map entries.

```bash
ow repo prune [options]
```

**Options:**

| Option             | Alias | Description                      |
| ------------------ | ----- | -------------------------------- |
| `--dry-run`        | `-d`  | Show what would be pruned        |
| `--yes`            | `-y`  | Skip confirmation                |
| `--remove-orphans` |       | Also remove orphaned directories |

### ow repo status

Show summary of managed repos.

```bash
ow repo status [options]
```

**Options:**

| Option   | Description    |
| -------- | -------------- |
| `--json` | Output as JSON |

### ow repo gc

Garbage collect old or unused repos.

```bash
ow repo gc [options]
```

Requires at least one of: `--older-than`, `--without-reference`, `--without-repo`.

**Options:**

| Option                | Alias | Description                                       |
| --------------------- | ----- | ------------------------------------------------- |
| `--older-than`        |       | Remove repos not accessed in N days (e.g., `30d`) |
| `--without-reference` |       | Remove repos without references                   |
| `--without-repo`      |       | Remove orphaned references                        |
| `--dry-run`           | `-d`  | Show what would be removed                        |
| `--yes`               | `-y`  | Skip confirmation                                 |

**Examples:**

```bash
ow repo gc --older-than 30d
ow repo gc --without-reference -y
ow repo gc --without-repo -d
```

### ow repo discover

Discover and map existing repos in repoRoot.

```bash
ow repo discover [options]
```

**Options:**

| Option      | Alias | Description              |
| ----------- | ----- | ------------------------ |
| `--dry-run` | `-d`  | Show what would be added |
| `--yes`     | `-y`  | Skip confirmation        |

## Configuration

### ow config show

Show current configuration.

```bash
ow config show [options]
```

**Options:**

| Option   | Description                                        |
| -------- | -------------------------------------------------- |
| `--json` | Output as JSON (includes path hints for the skill) |

**JSON output includes:**

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

### ow config set

Set a configuration value.

```bash
ow config set <key> <value>
```

**Valid keys:**

| Key              | Type    | Example                                                         |
| ---------------- | ------- | --------------------------------------------------------------- |
| `repoRoot`       | string  | `ow config set repoRoot ~/repos`                                |
| `defaultShallow` | boolean | `ow config set defaultShallow true`                             |
| `defaultModel`   | string  | `ow config set defaultModel anthropic/claude-sonnet-4-20250514` |
| `agents`         | list    | `ow config set agents opencode,claude-code`                     |

### ow config get

Get a configuration value.

```bash
ow config get <key>
```

### ow config reset

Reset configuration to defaults.

```bash
ow config reset
```

### ow config path

Show config file location.

```bash
ow config path
```

### ow config agents

Interactive agent selection.

```bash
ow config agents
```

Opens a multiselect prompt for choosing which agents to symlink.

## Authentication

### ow auth login

Start device flow login for offworld.sh.

```bash
ow auth login
```

### ow auth logout

Clear stored credentials.

```bash
ow auth logout
```

### ow auth status

Check authentication status.

```bash
ow auth status
```

## System Commands

### ow upgrade

Upgrade the CLI to the latest version.

```bash
ow upgrade [target] [options]
```

**Options:**

| Option     | Alias | Description                                        |
| ---------- | ----- | -------------------------------------------------- |
| `[target]` |       | Version to upgrade to (optional)                   |
| `--method` | `-m`  | Force method: `curl`, `npm`, `pnpm`, `bun`, `brew` |

**Examples:**

```bash
ow upgrade                    # Latest version
ow upgrade 0.2.0              # Specific version
ow upgrade -m npm             # Force npm method
```

### ow uninstall

Uninstall Offworld and remove related files.

```bash
ow uninstall [options]
```

**Options:**

| Option          | Alias | Description                              |
| --------------- | ----- | ---------------------------------------- |
| `--keep-config` | `-c`  | Keep configuration files                 |
| `--keep-data`   | `-d`  | Keep data files (skill, map, references) |
| `--dry-run`     |       | Show what would be removed               |
| `--force`       | `-f`  | Skip confirmation                        |

**Examples:**

```bash
ow uninstall                  # Full removal
ow uninstall --dry-run        # Preview
ow uninstall -c -d            # Keep config and data
```

## Data Locations

| Purpose      | Location                                                  |
| ------------ | --------------------------------------------------------- |
| Config       | `~/.config/offworld/config.json`                          |
| Auth         | `~/.local/share/offworld/auth.json`                       |
| Global skill | `~/.local/share/offworld/skills/offworld/`                |
| Global map   | `~/.local/share/offworld/skills/offworld/assets/map.json` |
| References   | `~/.local/share/offworld/skills/offworld/references/`     |
| Project map  | `./.offworld/map.json`                                    |
| Cloned repos | `~/ow/` (configurable)                                    |

## Exit Codes

| Code | Meaning           |
| ---- | ----------------- |
| `0`  | Success           |
| `1`  | General error     |
| `2`  | Invalid arguments |
