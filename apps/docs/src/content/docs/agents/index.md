---
title: AI Agent Integration
description: Use Offworld with Claude Code, Cursor, Amp, and other AI coding assistants.
---

Offworld is built for autonomous AI workflows. This guide shows you how to integrate Offworld with AI coding agents to access reference knowledge automatically.

## Three Ways to Use Offworld

import { Card, CardGrid, Tabs, TabItem } from "@astrojs/starlight/components";

<CardGrid>
	<Card title="CLI for Humans" icon="terminal">
		Run commands directly from your terminal with human-readable output.
	</Card>
	<Card title="Skill for Agents" icon="rocket">
		Install the skill so agents can discover and use references autonomously.
	</Card>
	<Card title="Project Integration" icon="document">
		Scan dependencies and inject relevant references into your project.
	</Card>
</CardGrid>

## Install the Skill

The Offworld skill enables AI agents to access references without manual intervention.

### Installation

```bash
# Install CLI
curl -fsSL https://offworld.sh/install | bash

# Initialize skill (symlinks to all agents)
ow init
```

This installs the skill for:

- **Claude Code** — Desktop and CLI
- **Cursor** — AI-first code editor
- **Amp** — Sourcegraph's coding agent
- **OpenCode** — Terminal-native AI
- **Codex** — OpenAI's coding assistant
- **Gemini (Antigravity)** — Google's AI

### Verify Installation

Check that the skill is symlinked:

```bash
ow config show
```

You should see paths for each supported agent.

## How It Works

1. **Agent loads the Offworld skill** from its skills directory
2. **Skill runs `ow config show --json`** to discover paths
3. **Skill reads the project map** (`.offworld/map.json`) or global map
4. **Agent routes to the right reference** based on the query
5. **Agent reads the reference file** for accurate library knowledge

The skill is a thin routing layer. All the knowledge lives in the references and cloned repositories.

## Using with Claude Code

Claude Code supports skills natively. After `ow init`, the skill is available at `~/.claude/skills/offworld`.

### Basic Usage

```
Load the offworld skill and check what references are available for this project.
```

Or use specific references:

```
Using the TanStack Router reference, implement file-based routing for this app.
```

### Plan Mode for Complex Tasks

For larger implementations, use plan mode:

```
Enter plan mode. Using Offworld references, create a plan to:
1. Set up TanStack Router with file-based routing
2. Add authentication with protected routes
3. Implement data fetching with TanStack Query
```

Claude will load references, create an ordered plan, and execute systematically.

### Using Subagents

For parallel work:

```
Using subagents and Offworld references, implement in parallel:
- Set up routing (use tanstack-router reference)
- Configure database (use drizzle-orm reference)
- Add authentication middleware
```

## Using with Cursor

Cursor supports skills for enhanced AI assistance. The skill symlinks to `~/.cursor/skills/offworld`.

### Composer Mode

Works well for multi-file implementations:

```
@offworld Using the TanStack Router reference, set up file-based routing with:
- Authenticated routes under /dashboard
- Public routes for /login and /signup
- A root layout with navigation
```

### Chat Mode

Reference the skill directly:

```
Check what Offworld references are available and suggest which ones
I should pull for a full-stack TypeScript app.
```

## Using with Amp

Amp loads skills from `~/.config/agents/skills/`. The skill appears in Amp's available skills.

### Example Prompts

```
What Offworld references are available for this project?
```

```
Using the Zod reference from Offworld, create a validation schema for user registration.
```

### Task-Based Workflows

```
Create a task to implement authentication:
1. Load Offworld references for this project
2. Use the appropriate auth library reference
3. Implement login/logout flows
```

## Using with OpenCode

OpenCode is terminal-native and loads skills from `~/.config/opencode/skill/`.

### Terminal Workflow

```bash
# In terminal
ow pull tanstack/query

# In OpenCode
Using the TanStack Query reference, implement data fetching for the user list.
```

## Using with Other Agents

For agents without native skill support, you can:

**1. Point to references directly:**

```
Read the file at ~/.local/share/offworld/skills/offworld/references/tanstack-router.md
and use it to implement routing.
```

**2. Use the clone map:**

```
Check ~/.local/share/offworld/skills/offworld/assets/map.json for available
references, then read the relevant one.
```

**3. Access source directly:**

```
The TanStack Router source is at ~/ow/tanstack/router. Explore it to understand
the routing patterns.
```

## Project Configuration

### Project-Scoped References

Run `ow project init` in your project root to create a project map:

```bash
cd my-project
ow project init
```

This creates `.offworld/map.json` which scopes references to your project's actual dependencies.

### AGENTS.md Integration

`ow project init` adds a reference table to your `AGENTS.md`:

```markdown
## Project References

| Dependency | Reference         | Path                                                                 |
| ---------- | ----------------- | -------------------------------------------------------------------- |
| zod        | colinhacks-zod.md | ~/.local/share/offworld/skills/offworld/references/colinhacks-zod.md |
| hono       | honojs-hono.md    | ~/.local/share/offworld/skills/offworld/references/honojs-hono.md    |
```

This helps agents find references without loading the full skill.

## Advanced Patterns

### Pre-Implementation Reference Check

Before starting work:

```
Check Offworld for references matching this project's dependencies.
List any that might help with implementing the new feature.
```

### Reference-Guided Debugging

When stuck:

```
This TanStack Query mutation isn't invalidating correctly.
Check the Offworld reference for the correct invalidation pattern.
```

### Learn a Library

```
Using the Offworld reference for Hono, explain the middleware pattern
and show me how to add authentication.
```

## Skill vs Manual References

**Use the Offworld skill when:**

- You want agents to discover references autonomously
- Working across multiple projects with different dependencies
- You want consistent, community-maintained references

**Use manual AGENTS.md when:**

- You have project-specific conventions not covered by references
- You need custom instructions beyond library documentation
- You're working in a monorepo with complex internal dependencies

The two approaches complement each other.

## Troubleshooting

### Skill not loading

1. Verify the symlink exists:

   ```bash
   ls -la ~/.claude/skills/offworld  # or your agent's path
   ```

2. Check it points to the right location:

   ```bash
   readlink ~/.claude/skills/offworld
   # Should show: ~/.local/share/offworld/skills/offworld
   ```

3. Re-run init:
   ```bash
   ow init
   ```

### Agent can't find references

Ensure `.offworld/map.json` exists in your project:

```bash
cat .offworld/map.json
```

If missing:

```bash
ow project init
```

### Reference is outdated

Regenerate:

```bash
ow pull owner/repo --force
```

Or regenerate all project references:

```bash
ow project init --all --generate
```

## Supported Agents

| Agent                | Skill Location                  | Status       |
| -------------------- | ------------------------------- | ------------ |
| Claude Code          | `~/.claude/skills/`             | ✅ Supported |
| Cursor               | `~/.cursor/skills/`             | ✅ Supported |
| Amp                  | `~/.config/agents/skills/`      | ✅ Supported |
| OpenCode             | `~/.config/opencode/skill/`     | ✅ Supported |
| Codex                | `~/.codex/skills/`              | ✅ Supported |
| Gemini (Antigravity) | `~/.gemini/antigravity/skills/` | ✅ Supported |

All agents share the same skill via symlinks. Update once, apply everywhere.
