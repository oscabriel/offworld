---
title: Agent Setup Prompt
description: Copy-paste instructions for AI agents to set up offworld
---

## Quick Copy-Paste Prompt

For users to paste into their AI agent:

```
Set up offworld for this project:

1. Check if offworld CLI is installed: `ow --version`
   - If not installed: `bun install -g offworld` (or npm/pnpm)

2. Check if global config exists: `ow config get`
   - If "No config found": run `ow init --model opencode/claude-sonnet-4-5 --yes`

3. Run project setup: `ow project init --all --generate --yes`

4. Verify: Check that AGENTS.md now has a "## Project Skills" section

Report what was installed and any errors encountered.
```

## Detailed Agent Instructions

When a user asks to "set up offworld" or "add skills for this project":

### Prerequisites Check

1. Verify CLI installed: `ow --version`
   - Install if missing: `bun install -g offworld`

2. Verify global config: `ow config get`
   - If missing, run global init (see below)

### Global Init (one-time)

If no global config exists:

```bash
ow init --model opencode/claude-sonnet-4-5 --yes
```

Or interactive for user control:

```bash
ow init
```

### Project Init (per-project)

For autonomous setup (all deps, generate missing skills):

```bash
ow project init --all --generate --yes
```

For selective setup (let user choose):

```bash
ow project init
```

For specific deps only:

```bash
ow project init --deps react,convex,tanstack-router --generate --yes
```

### Dry Run

To preview without changes:

```bash
ow project init --dry-run
```

### What Gets Created

- Skills installed to: `~/.local/share/offworld/skills/`
- Symlinks created in agent dirs: `~/.claude/skills/`, `~/.config/opencode/skill/`, etc.
- AGENTS.md updated with "## Project Skills" section
- Agent-specific files updated if they exist (CLAUDE.md, etc.)

### No Project Files Created

offworld does NOT create config files in your project. Skills are global; project awareness is captured in AGENTS.md only.

## Example: Full Autonomous Setup

User pastes this prompt:

```
Set up offworld for this project. Install the CLI if needed, configure it with
OpenCode as the provider, scan my dependencies, and install skills for everything
you find. Use autonomous flags to avoid prompts.
```

Agent executes:

```bash
# 1. Check/install CLI
which ow || bun install -g offworld

# 2. Global init if needed
ow config get 2>/dev/null || ow init --model opencode/claude-sonnet-4-5 --yes

# 3. Project init
ow project init --all --generate --yes
```

Agent reports:

```
offworld setup complete:
- Installed CLI via bun
- Configured with OpenCode provider
- Found 12 dependencies in package.json
- Installed 8 skills (4 already existed, 4 generated)
- Updated AGENTS.md with skill references

Installed skills:
  - react (facebook/react)
  - convex (get-convex/convex)
  - tanstack-router (tanstack/router)
  - ... etc
```

## AGENTS.md Output Format

After running `ow project init`, AGENTS.md will have a section like this:

```markdown
## Project Skills

Skills installed for this project's dependencies:

| Dependency      | Skill           | Path                                                       |
| --------------- | --------------- | ---------------------------------------------------------- |
| react           | react           | ~/.local/share/offworld/skills/facebook-react-reference    |
| convex          | convex          | ~/.local/share/offworld/skills/get-convex-convex-reference |
| tanstack-router | tanstack-router | ~/.local/share/offworld/skills/tanstack-router-reference   |

To update skills, run: `ow pull <dependency>`
To regenerate all: `ow project init --all --generate`
```
