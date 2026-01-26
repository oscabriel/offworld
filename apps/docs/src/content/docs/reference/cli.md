---
title: CLI Reference
description: Complete reference for the ow command-line interface.
---

The `ow` CLI is the primary interface for managing Offworld references and skills.

## Installation

**macOS / Linux:**

```bash
curl -fsSL https://offworld.sh/install | bash
```

**npm:**

```bash
npm install -g offworld
```

**Environment variables:**

| Variable     | Description                         | Default        |
| ------------ | ----------------------------------- | -------------- |
| `OW_VERSION` | Pin to specific version             | Latest         |
| `OW_CHANNEL` | Release channel: `stable` or `beta` | `stable`       |
| `OW_BIN_DIR` | Override installation directory     | `~/.local/bin` |

## Commands

### ow init

Interactive setup for Offworld. Configures paths and symlinks the skill to all supported agents.

```bash
ow init
```

**What it does:**

- Creates `~/.config/offworld/config.json`
- Sets up `~/.local/share/offworld/skills/offworld/`
- Symlinks skill to Claude Code, Cursor, Amp, OpenCode, Codex, Gemini

### ow pull

Clone a repository and generate a reference.

```bash
ow pull <repo> [options]
```

**Arguments:**

| Argument | Description                                                                   |
| -------- | ----------------------------------------------------------------------------- |
| `repo`   | Repository to pull (e.g., `tanstack/router`, `https://github.com/owner/repo`) |

**Options:**

| Option             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `--generate`, `-g` | Force regenerate the reference even if it exists |
| `--local <path>`   | Use a local directory instead of cloning         |

**Examples:**

```bash
ow pull tanstack/router           # Clone and generate
ow pull tanstack/router -g        # Force regenerate
ow pull --local ./my-lib          # Generate from local directory
```

### ow generate

Force regenerate a reference for an already-cloned repository.

```bash
ow generate <repo>
```

**Example:**

```bash
ow generate tanstack/router
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

**Options:**

| Option   | Description    |
| -------- | -------------- |
| `--json` | Output as JSON |

### ow rm

Remove a repository and its reference.

```bash
ow rm <repo>
```

**Example:**

```bash
ow rm tanstack/router
```

### ow project init

Scan project dependencies and install matching references.

```bash
ow project init [options]
```

**Options:**

| Option       | Description                                         |
| ------------ | --------------------------------------------------- |
| `--all`      | Process all dependencies, not just direct           |
| `--generate` | Generate missing references locally                 |
| `--dry-run`  | Show what would be installed without making changes |

**What it does:**

1. Scans `package.json`, `Cargo.toml`, `go.mod`, etc.
2. Matches dependencies to available references
3. Pulls missing references from offworld.sh or generates locally
4. Creates `.offworld/map.json`
5. Updates `AGENTS.md` with reference table

### ow config

Manage configuration.

```bash
ow config show              # Show current config
ow config show --json       # Output as JSON
ow config set <key> <value> # Set a config value
ow config get <key>         # Get a config value
```

**Config keys:**

| Key         | Description                 | Default                          |
| ----------- | --------------------------- | -------------------------------- |
| `reposDir`  | Where to clone repositories | `~/ow`                           |
| `skillsDir` | Where to store the skill    | `~/.local/share/offworld/skills` |

### ow auth

Manage authentication for offworld.sh.

```bash
ow auth login    # Start device flow login
ow auth logout   # Clear stored credentials
ow auth status   # Check authentication status
```

### ow upgrade

Upgrade the CLI to the latest version.

```bash
ow upgrade [options]
```

**Options:**

| Option               | Description                                |
| -------------------- | ------------------------------------------ |
| `--target <version>` | Upgrade to specific version                |
| `--method <method>`  | Force upgrade method: `npm`, `curl`, `bun` |

### ow repo update

Update cloned repositories.

```bash
ow repo update [options]
```

**Options:**

| Option      | Description                    |
| ----------- | ------------------------------ |
| `--all`     | Update all repositories        |
| `--stale`   | Only update stale repositories |
| `--dry-run` | Show what would be updated     |

## Data Locations

| Purpose      | Location                                                  |
| ------------ | --------------------------------------------------------- |
| Config       | `~/.config/offworld/config.json`                          |
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
