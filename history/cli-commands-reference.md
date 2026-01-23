# CLI Commands Reference

## Framework

Uses **trpc-cli** with **@orpc/server** router + **Zod** schemas.

## Commands & Aliases

| Command         | Alias                   | Description                            |
| --------------- | ----------------------- | -------------------------------------- |
| `pull`          | _(default cmd)_         | Clone repo and fetch/generate analysis |
| `list`          | `ls`                    | List cloned repos                      |
| `generate`      | `gen`                   | Generate analysis locally              |
| `push`          | —                       | Push analysis to offworld.sh           |
| `remove`        | `rm`                    | Remove repo and analysis               |
| `auth login`    | —                       | Login to offworld.sh                   |
| `auth logout`   | —                       | Logout                                 |
| `auth status`   | —                       | Show auth status                       |
| `config show`   | _(default for config)_  | Show all settings                      |
| `config set`    | —                       | Set config value                       |
| `config get`    | —                       | Get config value                       |
| `config reset`  | —                       | Reset to defaults                      |
| `config path`   | —                       | Show config file location              |
| `config agents` | —                       | Interactive agent selection            |
| `init`          | —                       | Initialize configuration               |
| `project init`  | _(default for project)_ | Scan manifest, install skills          |

## Flags by Command

### `pull` (default)

| Flag        | Alias               | Type    | Default    | Description                                 |
| ----------- | ------------------- | ------- | ---------- | ------------------------------------------- |
| `--repo`    | `-r`                | string  | _required_ | Repository (owner/repo, URL, or local path) |
| `--shallow` | `--no-full-history` | boolean | `true`     | Use shallow clone                           |
| `--sparse`  | —                   | boolean | `false`    | Sparse checkout                             |
| `--branch`  | —                   | string  | —          | Branch to clone                             |
| `--force`   | `-f`                | boolean | `false`    | Force re-analysis                           |
| `--verbose` | `-v`                | boolean | `false`    | Detailed output                             |
| `--model`   | `-m`                | string  | —          | Model override (takes provider/mode as arg) |

### `list` / `ls`

| Flag      | Type    | Default | Description           |
| --------- | ------- | ------- | --------------------- |
| `--json`  | boolean | `false` | Output as JSON        |
| `--paths` | boolean | `false` | Show full paths       |
| `--stale` | boolean | `false` | Only show stale repos |

### `generate` / `gen`

| Flag      | Alias | Type    | Default    | Description                                 |
| --------- | ----- | ------- | ---------- | ------------------------------------------- |
| `--repo`  | `-r`  | string  | _required_ | Repository                                  |
| `--force` | `-f`  | boolean | `false`    | Force even if remote exists                 |
| `--model` | `-m`  | string  | —          | Model override (takes provider/mode as arg) |

### `push`

| Flag     | Alias | Type   | Default    | Description             |
| -------- | ----- | ------ | ---------- | ----------------------- |
| `--repo` | `-r`  | string | _required_ | Repository (owner/repo) |

### `remove` / `rm`

| Flag           | Alias | Type    | Default    | Description             |
| -------------- | ----- | ------- | ---------- | ----------------------- |
| `--repo`       | `-r`  | string  | _required_ | Repository to remove    |
| `--yes`        | `-y`  | boolean | `false`    | Skip confirmation       |
| `--skill-only` | —     | boolean | `false`    | Only remove skill files |
| `--repo-only`  | —     | boolean | `false`    | Only remove cloned repo |
| `--dry-run`    | `-d`  | boolean | `false`    | Show what would be done |

### `config show`

| Flag     | Type    | Default | Description    |
| -------- | ------- | ------- | -------------- |
| `--json` | boolean | `false` | Output as JSON |

### `config set`

```bash
ow config set <key> <value>
```

| Argument | Type   | Description  |
| -------- | ------ | ------------ |
| `key`    | string | Config key   |
| `value`  | string | Config value |

### `config get`

```bash
ow config get <key>
```

| Argument | Type   | Description |
| -------- | ------ | ----------- |
| `key`    | string | Config key  |

### Valid Config Keys

| Key              | Type                 | Example                                             |
| ---------------- | -------------------- | --------------------------------------------------- |
| `repoRoot`       | string               | `config set repoRoot ~/repos`                       |
| `defaultShallow` | boolean              | `config set defaultShallow true`                    |
| `agents`         | comma-separated list | `config set agents opencode,claude-code`            |
| `defaultModel`   | string               | `config set defaultModel anthropic/claude-opus-4-5` |

### `init`

| Flag          | Alias | Type    | Default | Description               |
| ------------- | ----- | ------- | ------- | ------------------------- |
| `--yes`       | `-y`  | boolean | `false` | Skip confirmation prompts |
| `--force`     | `-f`  | boolean | `false` | Reconfigure if exists     |
| `--model`     | `-m`  | string  | —       | AI provider/model         |
| `--repo-root` | —     | string  | —       | Where to clone repos      |
| `--agents`    | `-a`  | string  | —       | Comma-separated agents    |

### `project init`

| Flag         | Alias | Type    | Default | Description                  |
| ------------ | ----- | ------- | ------- | ---------------------------- |
| `--all`      | —     | boolean | `false` | Select all deps              |
| `--deps`     | —     | string  | —       | Comma-separated deps         |
| `--skip`     | —     | string  | —       | Deps to exclude              |
| `--generate` | `-g`  | boolean | `false` | Generate skills for new deps |
| `--dry-run`  | `-d`  | boolean | `false` | Preview only                 |
| `--yes`      | `-y`  | boolean | `false` | Skip confirmations           |

## Special Behaviors

- **`negateBooleans: true`** on `pull`: enables `--no-shallow` via `--no-full-history` negative alias
- **`default: true`** on `pull`, `config show`, `project init`: these are default subcommands for their routes
