---
title: Amp
description: Set up Offworld with Amp for reference-powered coding assistance.
---

Amp supports skills for enhanced AI assistance. Offworld provides reference knowledge that Amp can access autonomously.

## Setup

### 1. Install Offworld

```bash
curl -fsSL https://offworld.sh/install | bash
```

### 2. Initialize the Skill

```bash
ow init
```

This symlinks the Offworld skill to `~/.config/agents/skills/offworld`.

### 3. Verify Installation

```bash
ls -la ~/.config/agents/skills/
```

You should see `offworld -> ~/.local/share/offworld/skills/offworld`.

## Usage

### Loading the Skill

Amp loads available skills from `~/.config/agents/skills/`. The Offworld skill appears in Amp's available skills list.

To explicitly load it:

```
Load the offworld skill to access reference documentation for this project's dependencies.
```

### Example Prompts

**Discover available references:**

```
What Offworld references are available for this project?
```

**Implement with reference guidance:**

```
Using the Zod reference from Offworld, create a validation schema for user registration with:
- Email validation
- Password strength requirements
- Optional profile fields
```

**Pull and use a reference:**

```
Pull the convex reference using Offworld, then help me set up real-time subscriptions.
```

### Task-Based Workflows

Amp's task system works well with Offworld:

```
Create a task to implement authentication:
1. Load Offworld references for this project
2. Use the appropriate auth library reference
3. Implement login/logout flows
4. Add session management
```

### Parallel Subagents

For complex implementations:

```
Using subagents and Offworld references, implement in parallel:
- API routes with Hono (use hono reference)
- Database schema with Drizzle (use drizzle-orm reference)  
- Type-safe client with tRPC (use trpc reference)
```

## Configuration

### Project Integration

In your project root:

```bash
ow project init
```

This creates `.offworld/map.json` and updates your `AGENTS.md` with a reference table.

### Amp's AGENTS.md

Offworld automatically adds a reference table to your project's `AGENTS.md`:

```markdown
## Project References

| Dependency | Reference | Path |
|------------|-----------|------|
| zod | colinhacks-zod.md | ~/.local/share/offworld/skills/offworld/references/colinhacks-zod.md |
| hono | honojs-hono.md | ~/.local/share/offworld/skills/offworld/references/honojs-hono.md |
```

This helps Amp understand which references are available without loading the full skill.

## Troubleshooting

### Skill not appearing

1. Check the symlink:
   ```bash
   ls -la ~/.config/agents/skills/offworld
   ```

2. Verify the target exists:
   ```bash
   ls ~/.local/share/offworld/skills/offworld/SKILL.md
   ```

3. Re-initialize:
   ```bash
   ow init
   ```

### References not matching project

Ensure `.offworld/map.json` is current:

```bash
ow project init
```

### Regenerate outdated reference

```bash
ow pull owner/repo --generate
```
