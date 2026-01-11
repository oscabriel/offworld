# Offworld CLI: Command Set

> Condensed from cli-commands-spec.md. Removes redundancy, maximizes impact.

---

## Problem: Command Overlap

Current proposed commands have significant overlap:

```
clone   = git clone + (pull OR analyze) + install skill
analyze = analyze + install skill  
pull    = download analysis + install skill
update  = git pull + analyze + install skill
```

**Observation:** `clone` already does everything. Other commands are fragments.

---

## Prior Art: ghq Pattern

Research shows **ghq** has the most minimal pattern:

```bash
ghq get <repo>   # Clone if new, update if exists
ghq list         # Show repos
```

That's it. Two commands cover 90% of workflows.

---

## Proposal: Core Commands

| Command | Purpose |
|---------|---------|
| `ow pull <repo>` | Get repo ready (clone + analysis), or sync if exists |
| `ow push <repo>` | Share analysis to offworld.sh |
| `ow generate <repo>` | Force local AI generation (never pulls remote) |
| `ow list` | Show what you have |
| `ow rm <repo>` | Remove repo |
| `ow auth login/logout/status` | GitHub OAuth for push |
| `ow config` | View/change settings |

**Aliases:**
- `ow clone` → `ow pull` (git-style)
- `ow get` → `ow pull` (ghq-style)

**Global Flags:**
- `-v/--verbose` — Debug output (git operations, API calls, file writes)
- `-q/--quiet` — Suppress all output except errors
- `-V/--version` — Print version and exit
- `-h/--help` — Show help (TTY-aware: human text or JSON)

**Key insight:** `pull`/`push` are explicit opposites. `clone` for git users, `get` for ghq users—all three do the same smart clone-or-sync.

---

## Command Details

### `ow pull <repo>`

**What it does:** Get or refresh a repo. Clone if needed, sync if exists.

**Behavior:**

```
1. Is repo already cloned?
   - No → Clone it, then continue
   - Yes → Git fetch, pull if behind
2. Is analysis fresh?
   - No analysis → Check remote, pull if exists, else generate locally
   - Stale (different commit) → Check remote, pull if newer, else regenerate
   - Fresh → No-op, print status
3. Install/update SKILL.md
```

**Flags:**

| Flag | Effect |
|------|--------|
| `--shallow` | Shallow clone (depth=1) |

**Examples:**

```bash
ow pull tanstack/router     # First time: clone + get analysis
ow pull tanstack/router     # Second time: sync if needed
ow pull .                   # Current directory (registers in-place if outside ~/ow/)
```

---

### `ow generate <repo>`

**What it does:** Force local AI analysis. Never pulls from remote.

**Behavior:**

```
1. Is repo cloned?
   - No → Clone it first
   - Yes → Git fetch, pull if behind
2. Check if remote analysis exists on offworld.sh
   - Yes → Warn and exit (use --force to override)
   - No → Continue
3. Run local analysis pipeline
4. Install/update SKILL.md
```

**Flags:**

| Flag | Effect |
|------|--------|
| `--shallow` | Shallow clone if needed |
| `--force` | Skip remote-exists warning, regenerate anyway |

**Examples:**

```bash
ow generate tanstack/router          # Warns if remote exists, exits
ow generate tanstack/router --force  # Regenerate locally regardless
ow generate .                        # Generate for current directory
```

**When to use:** 
- You want your own analysis, not community's
- Remote analysis is stale/wrong
- Testing analysis quality

**Why warn?** Prevents accidental AI token waste when a community analysis already exists. Use `--force` when you intentionally want a fresh local generation.

---

### `ow push <repo>`

**What it does:** Share your analysis with the community.

**Behavior:**

```
1. Require auth (prompt login if needed)
2. Upload local analysis to offworld.sh
3. Server enforces: rate limits, conflict resolution
```

**No changes from original spec.**

---

### `ow list [query]`

**What it does:** Show cloned repos with status.

**Output:**

```
tanstack/router    ✓ analyzed 2h ago
vercel/ai          ✓ analyzed 1d ago  (47 commits behind)
sst/opencode       ○ not analyzed
```

**Flags:**

| Flag | Effect |
|------|--------|
| `-p` | Show full paths |
| `--stale` | Only show repos needing sync |
| `--json` | Machine-readable JSON output |

**JSON output (`ow list --json`):**

```json
[
  { "fullName": "tanstack/router", "path": "~/ow/tanstack/router", "analyzed": true, "stale": false },
  { "fullName": "vercel/ai", "path": "~/ow/vercel/ai", "analyzed": true, "stale": true, "commitsBehind": 47 },
  { "fullName": "sst/opencode", "path": "~/ow/sst/opencode", "analyzed": false, "stale": false }
]
```

---

### `ow rm <repo>`

**What it does:** Remove repo and analysis.

**Flags:**

| Flag | Effect |
|------|--------|
| `-y` | Skip confirmation |
| `--keep-skill` | Keep installed skill files |
| `--dry-run` | Preview what would be deleted without deleting |

**Dry run output (`ow rm tanstack/router --dry-run`):**

```
Would remove:
  ~/ow/tanstack/router/                    (repository)
  ~/.ow/analyses/tanstack--router/         (analysis)
  ~/.config/opencode/skill/tanstack-router/ (skill)
```

---

### `ow auth login` / `ow auth logout` / `ow auth status`

**What it does:** GitHub auth for push capability.

**Subcommands:**

| Command | Description |
|---------|-------------|
| `ow auth login` | Authenticate via GitHub OAuth |
| `ow auth logout` | Clear stored auth session |
| `ow auth status` | Show current login state |

**Status output (`ow auth status`):**

```
✓ Logged in as @oscargabriel via GitHub OAuth
  Token expires: 2026-02-05
```

Or if not logged in:

```
✗ Not logged in
  Run `ow auth login` to authenticate
```

---

### `ow config`

**What it does:** View or change ow settings.

**Subcommands:**

| Command | Description |
|---------|-------------|
| `ow config` | Show current config |
| `ow config set <key> <value>` | Set a config value |
| `ow config get <key>` | Get a specific value |
| `ow config reset` | Reset to defaults |
| `ow config path` | Show config file location |

**Config keys:**

| Key | Default | Description |
|-----|---------|-------------|
| `root` | `~/ow` | Where repos are cloned |
| `skill-dir` | `~/.config/opencode/skill` | Where skills are installed |
| `default-shallow` | `false` | Always use shallow clone |
| `auto-analyze` | `true` | Run analysis on pull |
| `skill-install-path` | (computed) | Override skill install location |

**Flags:**

| Flag | Effect |
|------|--------|
| `--json` | Machine-readable JSON output |

**Examples:**

```bash
ow config                        # Show all settings
ow config set root ~/repos       # Change clone directory
ow config get root               # Print current root
ow config reset                  # Reset to defaults
ow config path                   # Print: ~/.ow/config.json
ow config --json                 # Output as JSON
```

**Output (`ow config`):**

```
root:              ~/ow
skill-dir:         ~/.config/opencode/skill
default-shallow:   false
auto-analyze:      true
skill-install-path: (default)
```

---

### `ow --help` (TTY-aware)

**What it does:** Shows help in human-readable OR agent-friendly format based on context.

**Behavior:**

```
1. Detect if running in interactive terminal (process.stdout.isTTY)
2. If TTY (human): Print formatted help text
3. If not TTY (agent/piped): Print JSON schema
```

**Human output (`ow --help` in terminal):**

```
ow - Clone and analyze OSS repositories for AI agents

Usage:
  ow <command> [repo] [options]

Commands:
  pull <repo>      Get repo ready (clone + analysis), or sync if exists
  clone <repo>     Alias for pull
  get <repo>       Alias for pull
  push <repo>      Share analysis to offworld.sh
  generate <repo>  Force local AI generation (use --force if remote exists)
  list             Show cloned repos
  rm <repo>        Remove repo and analysis
  auth login       GitHub OAuth for push
  auth logout      Clear auth session
  auth status      Show login state
  config           View/change settings

Global Options:
  -h, --help       Show this help
  -V, --version    Show version
  -v, --verbose    Debug output
  -q, --quiet      Suppress output (errors only)

Command Options:
  --shallow        Shallow clone (pull/generate only)
  --force          Skip warnings (generate only)
  --json           JSON output (list/config only)
  --dry-run        Preview without action (rm only)

Examples:
  ow pull tanstack/router
  ow generate vercel/ai --force
  ow list --json
  ow config set root ~/repos
```

**Agent output (`ow --help | cat` or when piped):**

```json
{
  "name": "ow",
  "version": "0.1.0",
  "description": "Clone and analyze OSS repositories for AI agents",
  "globalOptions": [
    { "name": "-h, --help", "description": "Show help", "type": "boolean" },
    { "name": "-V, --version", "description": "Show version", "type": "boolean" },
    { "name": "-v, --verbose", "description": "Debug output", "type": "boolean" },
    { "name": "-q, --quiet", "description": "Suppress output (errors only)", "type": "boolean" }
  ],
  "commands": [
    {
      "name": "pull",
      "aliases": ["clone", "get"],
      "description": "Get repo ready (clone + analysis), or sync if exists",
      "arguments": [
        { "name": "repo", "description": "Repository (owner/repo) or '.' for cwd", "required": true }
      ],
      "options": [
        { "name": "--shallow", "description": "Shallow clone (depth=1)", "type": "boolean" }
      ],
      "examples": ["ow pull tanstack/router", "ow clone vercel/ai --shallow", "ow pull ."]
    },
    {
      "name": "push",
      "description": "Share analysis to offworld.sh (requires auth)",
      "arguments": [
        { "name": "repo", "description": "Repository (owner/repo)", "required": true }
      ]
    },
    {
      "name": "generate",
      "description": "Force local AI generation (warns if remote exists)",
      "arguments": [
        { "name": "repo", "description": "Repository (owner/repo) or '.' for cwd", "required": true }
      ],
      "options": [
        { "name": "--shallow", "description": "Shallow clone if needed", "type": "boolean" },
        { "name": "--force", "description": "Skip remote-exists warning", "type": "boolean" }
      ],
      "examples": ["ow generate tanstack/router --force", "ow generate ."]
    },
    {
      "name": "list",
      "description": "Show cloned repos with analysis status",
      "options": [
        { "name": "-p", "description": "Show full paths", "type": "boolean" },
        { "name": "--stale", "description": "Only show repos needing sync", "type": "boolean" },
        { "name": "--json", "description": "Machine-readable JSON output", "type": "boolean" }
      ]
    },
    {
      "name": "rm",
      "description": "Remove repo and analysis",
      "arguments": [
        { "name": "repo", "description": "Repository (owner/repo)", "required": true }
      ],
      "options": [
        { "name": "-y", "description": "Skip confirmation", "type": "boolean" },
        { "name": "--keep-skill", "description": "Keep installed skill files", "type": "boolean" },
        { "name": "--dry-run", "description": "Preview without deleting", "type": "boolean" }
      ]
    },
    {
      "name": "auth",
      "description": "Authentication commands",
      "subcommands": [
        { "name": "login", "description": "GitHub OAuth for push capability" },
        { "name": "logout", "description": "Clear stored auth session" },
        { "name": "status", "description": "Show current login state" }
      ]
    },
    {
      "name": "config",
      "description": "View or change settings",
      "subcommands": [
        { "name": "set", "description": "Set a config value", "arguments": [
          { "name": "key", "required": true },
          { "name": "value", "required": true }
        ]},
        { "name": "get", "description": "Get a config value", "arguments": [
          { "name": "key", "required": true }
        ]},
        { "name": "reset", "description": "Reset to defaults" },
        { "name": "path", "description": "Show config file location" }
      ],
      "options": [
        { "name": "--json", "description": "Machine-readable JSON output", "type": "boolean" }
      ],
      "config_keys": ["root", "skill-dir", "default-shallow", "auto-analyze", "skill-install-path"]
    }
  ]
}
```

**Implementation:**

```typescript
// apps/cli/src/help.ts
const CLI_SCHEMA = { /* schema above */ };

export function printHelp(): void {
  if (process.stdout.isTTY) {
    // Human-readable
    console.log(formatHumanHelp(CLI_SCHEMA));
  } else {
    // Agent-friendly JSON
    console.log(JSON.stringify(CLI_SCHEMA, null, 2));
  }
}
```

**Why this matters:**
- Agents can discover `ow` capabilities without hardcoded knowledge
- Self-documenting — schema is single source of truth
- Works with any agent, not just OpenCode plugin

---

## Removed Commands & Flags

| Item | Reason |
|------|--------|
| `ow update` | Merged into `pull` (sync is implicit) |
| `ow summary` | Use `cat ~/.ow/analyses/*/summary.md` |
| `ow arch` | Use `cat ~/.ow/analyses/*/architecture.md` |
| `ow root` | Use `ow config get root` |
| `ow analyze` | Renamed to `ow generate` for clarity |
| `--no-skill` flag | Removed—skill installation is the core value prop |

---

## Mental Model

```
ow pull      → "Give me this repo, ready to use"
ow clone     → (same as pull, git-style)
ow get       → (same as pull, ghq-style)
ow push      → "Share my work"
ow generate  → "Generate my own analysis"
ow list      → "What do I have"
ow rm        → "I'm done with this"
ow auth      → "Login/logout/status for push"
ow config    → "Change my settings"
```

`pull`/`push` are opposites. `clone` for git users, `get` for ghq users. `generate` for power users who want their own analysis.

---

## Edge Cases

### User wants to force local analysis

```bash
ow generate tanstack/router          # Warns if remote exists, exits
ow generate tanstack/router --force  # Generates locally regardless
```

### User already has repo cloned elsewhere

```bash
cd ~/my-repos/router
ow pull .                     # Sync in-place, register with offworld
ow generate .                 # Generate fresh analysis for this repo
```

### User runs `ow pull .` in non-git directory

```bash
cd ~/Documents
ow pull .
# Error: Not a git repository. Use `ow pull owner/repo` instead.
```

### User wants to re-pull remote analysis

```bash
ow pull tanstack/router       # Checks remote, pulls if newer exists
```

### User wants to generate and immediately share

```bash
ow generate tanstack/router --force && ow push tanstack/router
```

---

## Comparison

| Task | Before | After |
|------|--------|-------|
| Get new repo ready | `ow clone` | `ow pull <repo>` |
| Pull community analysis | `ow clone` (auto) or `ow pull` | `ow pull <repo>` |
| Generate fresh analysis | `ow analyze` | `ow generate <repo> --force` |
| Update repo + analysis | `ow update` | `ow pull <repo>` (auto if stale) |
| Re-pull remote analysis | `ow pull` | `ow pull <repo>` |
| Force re-analyze | `ow analyze --force` | `ow generate <repo> --force` |

**Result:** 7 commands → 5 commands. Clearer semantics. `generate` makes intent explicit.

---

## Open Questions

1. **Should `ow` without args do anything?**
   - Option A: Error, show help ✅ CHOSEN
   - Option B: Launch TUI (V2) → Moved to `ow explore`
   - Option C: `ow list` shortcut
   - **Decision:** `ow` shows help. TUI is `ow explore` (V2).

2. **Should `pull` without args work in a repo directory?**
   - `ow pull` in `~/ow/tanstack/router` → sync that repo
   - **Recommendation:** Yes, like `ow pull .`

---

## CLI Audit: Gaps & Proposed Additions

> Audit conducted January 2026 based on research of gh, npm, docker, git, ghq, cargo, kubectl, repomix, gitleaks, tokei, semgrep, and other CLI tools.

---

### 1. Missing Global Flags

Most CLIs have standard global flags. Current spec only documents `--shallow` and `--no-skill`.

#### 1.1 Add `-v/--verbose` flag? **[RESOLVED: ADD]**

| Option | Behavior |
|--------|----------|
| **Add (recommended)** | Debug output for git operations, API calls, file operations |
| Skip | Users troubleshoot blindly |

**Use case:** `ow pull tanstack/router -v` shows git clone progress, API responses, file writes.

**ANSWER:** ADD.

---

#### 1.2 Add `-q/--quiet` flag? **[RESOLVED: ADD]**

| Option | Behavior |
|--------|----------|
| **Add (recommended)** | Suppress all output except errors |
| Skip | Scripts parse noisy output |

**Use case:** `ow pull tanstack/router -q` for CI/scripts.

**ANSWER:** ADD.

---

#### 1.3 Add `--version` / `-V` flag? **[RESOLVED: ADD]**

| Option | Behavior |
|--------|----------|
| **Add (recommended)** | Print version and exit |
| Skip | Non-standard, users check package.json |

**Note:** Your JSON help schema includes `version` but no explicit CLI flag is documented.

**ANSWER:** ADD.

---

### 2. Missing Command-Specific Flags

#### 2.1 Add `--json` to `list`? **[RESOLVED: ADD]**

Current `list` flags: `-p` (paths), `--stale`

| Option | Behavior |
|--------|----------|
| **Add (recommended)** | Machine-readable output for agents/scripts |
| Skip | Agents parse human-readable output |

**Example output:**
```json
[
  { "fullName": "tanstack/router", "path": "~/ow/tanstack/router", "analyzed": true, "stale": false },
  { "fullName": "vercel/ai", "path": "~/ow/vercel/ai", "analyzed": true, "stale": true, "commitsBehind": 47 }
]
```

**ANSWER:** ADD.

---

#### 2.2 Add `--dry-run` to `rm`? **[RESOLVED: ADD]**

| Option | Behavior |
|--------|----------|
| **Add (recommended)** | Preview what would be deleted without deleting |
| Skip | Users rely on confirmation prompt |

**Example:** `ow rm tanstack/router --dry-run` prints files that would be removed.

**ANSWER:** ADD.

---

#### 2.3 Add `--force` to `generate`? **[RESOLVED: ADD with warn-and-exit behavior]**

Current behavior: `generate` always regenerates locally, ignoring remote.

**Problem:** What if user accidentally runs `generate` when they meant `pull`? They'd waste AI tokens regenerating when a community analysis exists.

| Option | Behavior |
|--------|----------|
| A | Keep as-is: always regenerates, no warning |
| **B (chosen)** | `generate` warns if remote exists and **exits**; `--force` skips warning |
| C | Rename to `ow generate` to make intent clearer (also done) |

**ANSWER:** B. Warn and exit (non-interactive). User must add `--force` to proceed.

---

#### 2.4 Add more filter flags to `list`? **[RESOLVED: SKIP]**

Current: `-p`, `--stale`

Potential additions:

| Flag | Effect |
|------|--------|
| `--analyzed` | Only repos with analysis |
| `--not-analyzed` | Only repos without analysis |
| `--sort=<field>` | Sort by name/date/commits-behind |

| Option | Behavior |
|--------|----------|
| **Add `--analyzed`/`--not-analyzed` (recommended)** | Filter by analysis status |
| Add all | More flexibility but more complexity |
| Skip | Users grep output |

**ANSWER:** SKIP FOR NOW. TUI WILL BE USED FOR LOCAL EXPLORATION.

---

### 3. Missing Auth Subcommand

#### 3.1 Add `ow auth status`? **[RESOLVED: ADD]**

Current auth: `login`, `logout` only.

Standard pattern (gh, npm):
- `gh auth status` → shows logged-in user
- `npm whoami` → shows logged-in user

| Option | Behavior |
|--------|----------|
| **Add (recommended)** | Show login status, username, token expiry |
| Skip | Users run `ow push` to find out if logged in |

**Example output:**
```
✓ Logged in as @oscargabriel via GitHub OAuth
  Token expires: 2026-02-05
```

**ANSWER:** ADD.

---

### 4. Missing Config Subcommand

#### 4.1 Add `ow config path`? **[RESOLVED: ADD]**

| Option | Behavior |
|--------|----------|
| Add | Print config file location (`~/.ow/config.json`) |
| **Skip (recommended)** | Users know it's `~/.ow/` |

**ANSWER:** ADD.

---

#### 4.2 Add more config keys? **[RESOLVED: ADD ALL]**

Current keys: `root`, `skill-dir`

Potential additions:

| Key | Default | Description |
|-----|---------|-------------|
| `default-shallow` | `false` | Always shallow clone |
| `auto-analyze` | `true` | Run analysis on clone |
| `skill-install-path` | (computed) | Override skill location |

| Option | Behavior |
|--------|----------|
| Add all | More user control |
| **Add selectively** | Which ones? |
| Skip | Keep minimal |

**ANSWER:** ADD ALL.

---

### 5. Skill Installation Gap

#### 5.1 How to install skill after `--no-skill`? **[RESOLVED: REMOVE FLAG]**

If user runs `ow pull tanstack/router --no-skill`, how do they later install the skill?

| Option | Behavior |
|--------|----------|
| A | Run `ow pull` again (wasteful if unchanged) |
| B | Run `ow analyze` (regenerates everything) |
| **C (V2)** | Add `ow skill install <repo>` subcommand |
| D | Document workaround: copy SKILL.md manually |

**For V1, which workaround to document?**

**ANSWER:** REMOVE `--no-skill` FLAG.

---

### 6. Clarity Issues

#### 6.1 Is `pull` vs `generate` distinction clear enough? **[RESOLVED: RENAME to `generate`]**

Current distinction:
- `pull` = check remote first, generate locally if missing
- `generate` = always generate locally, never check remote

The rename from `analyze` to `generate` makes intent clearer: "generate my own analysis."

| Option | Behavior |
|--------|----------|
| Keep as-is | Document clearly in help text |
| **Rename `analyze` → `generate`** | Clearer intent ("generate my own") ✅ CHOSEN |
| Add `pull --local` | Single command with flag |

**ANSWER:** RENAME `analyze` TO `generate`.

---

#### 6.2 Current directory edge cases? **[RESOLVED: Error if not git repo; Register in-place if outside ~/ow/]**

`ow pull .` and `ow analyze .` work for current directory. But:

**Scenario A:** User runs `ow pull .` in a directory that's not a git repo.
- Error with instructions?
- Clone into cwd? (dangerous)

**Scenario B:** User runs `ow pull .` in a repo not in `~/ow/`.
- Register it with offworld and analyze in-place?
- Error with instructions to use `ow pull <url>` instead?

| Option | Behavior |
|--------|----------|
| **A: Error + instruct** | "Not a git repo. Use `ow pull owner/repo`" |
| B: Register in-place | Analyze wherever it is, add to index |

| Option | Behavior |
|--------|----------|
| **A: Register in-place (recommended)** | Works with existing clones (ghq users, etc.) |
| B: Error + instruct | Force all repos into `~/ow/` |

**ANSWER:** A.

---

### 7. Push Command Gaps

#### 7.1 Add `--message` to `push`? **[RESOLVED: SKIP]**

Allow optional description with push:

```bash
ow push tanstack/router --message "Updated for v2.0 release"
```

| Option | Behavior |
|--------|----------|
| Add | Stored on offworld.sh, shown in web UI |
| **Skip (recommended)** | Keep push simple, commit SHA is context enough |

**ANSWER:** SKIP.

---

### 8. Output Format Consistency

#### 8.1 Global `--json` flag for all commands? **[RESOLVED: PER-COMMAND]**

Some CLIs (gh, kubectl) support `--json` globally.

| Option | Behavior |
|--------|----------|
| Global `--json` | All commands output JSON |
| **Per-command (recommended)** | Only `list` and `config` get `--json` |
| Skip | Only TTY-aware help is JSON |

**ANSWER:** PER-COMMAND.

---

## Audit Summary: Resolved Decisions

### V1 Scope (All Confirmed)

| Item | Decision | Notes |
|------|----------|-------|
| Add `-v/--verbose` | ✅ ADD | Global flag |
| Add `-q/--quiet` | ✅ ADD | Global flag |
| Add `-V/--version` | ✅ ADD | Global flag |
| Add `--json` to `list` | ✅ ADD | Machine-readable output |
| Add `--dry-run` to `rm` | ✅ ADD | Safety preview |
| Add `ow auth status` | ✅ ADD | Show login state |
| Add `ow config path` | ✅ ADD | Debugging aid |
| Add config keys | ✅ ADD ALL | `default-shallow`, `auto-analyze`, `skill-install-path` |
| Rename `analyze` → `generate` | ✅ RENAME | Clearer intent |
| Add `--force` to `generate` | ✅ ADD | Warn if remote exists, `--force` skips (exit without --force) |
| Remove `--no-skill` | ✅ REMOVE | Skill is the point |
| CWD edge case (not git) | ✅ ERROR | "Not a git repo" message |
| CWD edge case (outside ~/ow/) | ✅ REGISTER | Works with existing clones |

### Deferred to TUI/V2

| Item | Decision | Notes |
|------|----------|-------|
| `--analyzed`/`--not-analyzed` filters | SKIP | TUI handles local exploration |
| `ow skill install` subcommand | SKIP | Removed `--no-skill`, not needed |
| `--message` for push | SKIP | Commit SHA is context enough |

### Output Format

| Item | Decision |
|------|----------|
| `--json` scope | Per-command (`list`, `config`) not global |

---

## Summary

**Before:** 7+ commands with overlapping behavior  
**After:** 5 core commands + 2 aliases + config/auth

```bash
# Core commands
ow pull <repo>      # Get or refresh (clone + remote-first analysis)
ow clone <repo>     # Alias for pull (git-style)
ow get <repo>       # Alias for pull (ghq-style)
ow push <repo>      # Share to community
ow generate <repo>  # Force local generation (warns if remote exists)
ow list             # See what you have  
ow rm <repo>        # Clean up

# Auth
ow auth login       # GitHub OAuth
ow auth logout      # Clear session
ow auth status      # Show login state

# Config
ow config           # View/change settings
ow config path      # Show config file location

# No args
ow                  # Shows help (same as ow --help)

# Global flags
-v, --verbose       # Debug output
-q, --quiet         # Suppress output
-V, --version       # Print version
-h, --help          # Human-readable OR JSON (TTY-aware)

# V2: TUI
ow explore          # Interactive TUI for browsing local repos/analyses (V2)
```

**Zero friction:** git users use `clone`, ghq users use `get`, power users use `pull`. All do the same thing.

**Agent-friendly:** `--help` outputs JSON when piped, so any agent can discover capabilities without hardcoded knowledge.

**Explicit intent:** `generate` clearly means "make my own analysis" vs `pull` which fetches community analysis first.

---

*Draft: January 2026*
*Audit added: January 8, 2026*
*All decisions resolved: January 8, 2026*
