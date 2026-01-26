---
title: Claude Code
description: Set up Offworld with Claude Code for autonomous reference access.
---

Claude Code supports skills natively. After installing Offworld, Claude Code can access reference knowledge for your dependencies automatically.

## Setup

### 1. Install Offworld

```bash
curl -fsSL https://offworld.sh/install | bash
```

### 2. Initialize the Skill

```bash
ow init
```

This symlinks the Offworld skill to `~/.claude/skills/offworld`.

### 3. Verify Installation

Check that the skill is available:

```bash
ls -la ~/.claude/skills/
```

You should see `offworld -> ~/.local/share/offworld/skills/offworld`.

## Usage

### Loading the Skill

Claude Code loads skills automatically when they're in the skills directory. You can also explicitly load it:

```
Load the offworld skill and check what references are available for this project.
```

### Example Prompts

**Check available references:**

```
What Offworld references are installed for this project?
```

**Use a reference for implementation:**

```
Using the TanStack Router reference, implement a file-based routing setup for this app.
```

**Pull a new reference:**

```
Pull the drizzle-orm reference using Offworld, then help me set up the database schema.
```

### Plan Mode for Complex Tasks

For larger implementations, use Claude's plan mode:

```
Enter plan mode. Using the Offworld references for this project, create a plan to:
1. Set up TanStack Router with file-based routing
2. Add authentication with protected routes
3. Implement data fetching with TanStack Query
```

Claude will:
- Load relevant references
- Create an ordered implementation plan
- Execute each step systematically

### Using Subagents

For parallel work across independent areas:

```
Using subagents, implement the following in parallel:
- Set up the router (use tanstack-router reference)
- Configure the database (use drizzle-orm reference)
- Add authentication middleware
```

## Configuration

### Project-Specific References

Run `ow project init` in your project to create `.offworld/map.json`:

```bash
cd my-project
ow project init
```

This ensures Claude Code uses the right references for your specific dependencies.

### Custom Skill Location

If Claude Code uses a non-standard skills directory:

```bash
ow config set agents.claude-code.skillPath /custom/path/skills
ow init  # Re-symlink
```

## Troubleshooting

### Skill not recognized

1. Check the symlink exists:
   ```bash
   ls -la ~/.claude/skills/offworld
   ```

2. Verify it points to the correct location:
   ```bash
   readlink ~/.claude/skills/offworld
   # Should show: ~/.local/share/offworld/skills/offworld
   ```

3. Re-run init if needed:
   ```bash
   ow init
   ```

### References not loading

Ensure `.offworld/map.json` exists in your project:

```bash
cat .offworld/map.json
```

If missing, run:

```bash
ow project init
```

### Outdated reference content

Regenerate the reference:

```bash
ow pull owner/repo --generate
```
