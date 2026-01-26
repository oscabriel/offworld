---
title: Quickstart
description: Install Offworld and pull your first reference in under 2 minutes.
---

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

After installation, verify everything is set up:

```bash
ow --version
```

## Three Ways to Use Offworld

import { Card, CardGrid } from "@astrojs/starlight/components";

<Tabs>
<TabItem label="CLI for Humans">
Run commands directly with human-readable terminal output:

```bash
ow pull tanstack/router
```

Output:

```
✓ Cloned tanstack/router to ~/ow/tanstack/router
✓ Generated reference: tanstack-router.md
✓ Updated map: ~/.local/share/offworld/skills/offworld/assets/map.json
```

</TabItem>
<TabItem label="Skill for Agents">
Install the skill for autonomous AI workflows:

```bash
ow init
```

Then prompt your AI agent:

```
Use the Offworld skill to check what references are available
for this project, then help me implement routing.
```

For best results, use your agent's **plan mode** if available. This lets the agent analyze references and create an implementation plan before making changes.
</TabItem>
<TabItem label="Project Integration">
Scan dependencies and install matching references:

```bash
cd my-project
ow project init
```

Creates `.offworld/map.json` and updates `AGENTS.md` with a reference table.
</TabItem>
</Tabs>

## Quick Setup

### 1. Initialize Offworld

Run the interactive setup to configure paths and symlink the skill to all supported agents:

```bash
ow init
```

This will:

- Create config at `~/.config/offworld/config.json`
- Set up the skill at `~/.local/share/offworld/skills/offworld/`
- Symlink to Claude Code, Cursor, Amp, OpenCode, Codex, and Gemini

### 2. Pull Your First Reference

```bash
ow pull tanstack/router
```

This:

1. Clones the repository to `~/ow/tanstack/router`
2. Generates an AI-optimized reference
3. Adds an entry to the global map

### 3. Set Up Your Project

In your project root:

```bash
ow project init
```

This:

1. Scans `package.json`, `Cargo.toml`, `go.mod`, etc.
2. Matches dependencies to available references
3. Pulls missing references
4. Creates `.offworld/map.json`
5. Updates `AGENTS.md` with a reference table

## Common Commands

| Command              | Description                               |
| -------------------- | ----------------------------------------- |
| `ow pull <repo>`     | Clone repo and generate reference         |
| `ow project init`    | Scan deps, install references for project |
| `ow list`            | List managed repos and references         |
| `ow generate <repo>` | Force regenerate a reference              |
| `ow push <repo>`     | Share reference on offworld.sh            |
| `ow rm <repo>`       | Remove repo and reference                 |

## Example Workflows

**Pull specific references:**

```bash
ow pull tanstack/router
ow pull drizzle-team/drizzle-orm
ow pull colinhacks/zod
```

**Set up a new project:**

```bash
cd my-project
ow project init --all --generate
```

**Force regenerate an outdated reference:**

```bash
ow pull tanstack/router --force
```

**Preview what project init would do:**

```bash
ow project init --dry-run
```

## Using with AI Agents

After running `ow init`, the Offworld skill is available to all supported agents.

### Example Prompts

**Check available references:**

```
What Offworld references are installed for this project?
```

**Implement with reference:**

```
Using the TanStack Router reference, implement file-based routing for this app.
```

**Pull and use:**

```
Pull the drizzle-orm reference using Offworld, then help me set up the database schema.
```

See [AI Agent Integration](/agents/) for detailed guidance on using Offworld with Claude Code, Cursor, Amp, and other coding assistants.

## Next Steps

- [AI Agent Integration](/agents/) — Set up with your preferred agent
- [CLI Reference](/reference/cli/) — Full command documentation
- [Browse References](https://offworld.sh/explore) — Explore community references
