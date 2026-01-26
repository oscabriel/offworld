---
title: AI Agent Integration
description: Use Offworld with Claude Code, Cursor, Amp, and other AI coding assistants.
---

Offworld is built for autonomous AI workflows. This guide shows you how to integrate Offworld with AI coding agents to access reference knowledge automatically.

## How It Works

Offworld provides a **single skill** that routes agents to the right reference documentation for your dependencies. When an agent needs to understand how to use a library:

1. Agent loads the Offworld skill
2. Skill checks the project's `.offworld/map.json` for installed references
3. Agent reads the relevant reference file
4. Agent has accurate, up-to-date knowledge for that dependency

## Three Ways to Use Offworld

### CLI for Humans

Run commands directly in your terminal:

```bash
ow pull tanstack/router    # Clone + generate reference
ow project init            # Scan deps, install references
ow list                    # Show installed references
```

### Skill for Agents

After running `ow init`, the Offworld skill is symlinked to all supported agents. Agents can then:

- Load the skill when working with your codebase
- Query for references by dependency name
- Read reference content for accurate library knowledge

### Project Integration

Run `ow project init` in your project root to:

1. Scan your manifest files (package.json, Cargo.toml, etc.)
2. Match dependencies to available references
3. Generate a `.offworld/map.json` for the project
4. Update `AGENTS.md` with a reference table

## Supported Agents

| Agent | Skill Location | Status |
|-------|---------------|--------|
| **Claude Code** | `~/.claude/skills/` | ✅ Supported |
| **Cursor** | `~/.cursor/skills/` | ✅ Supported |
| **Amp** | `~/.config/agents/skills/` | ✅ Supported |
| **OpenCode** | `~/.config/opencode/skill/` | ✅ Supported |
| **Codex** | `~/.codex/skills/` | ✅ Supported |
| **Gemini (Antigravity)** | `~/.gemini/antigravity/skills/` | ✅ Supported |

All agents share the same skill via symlinks, so updates apply everywhere.

## Quick Setup

```bash
# 1. Install CLI
curl -fsSL https://offworld.sh/install | bash

# 2. Initialize (symlinks skill to all agents)
ow init

# 3. Pull references for your stack
ow pull tanstack/router
ow pull drizzle-team/drizzle-orm

# 4. In your project, scan dependencies
cd my-project
ow project init
```

## Agent-Specific Guides

- [Claude Code](/agents/claude-code/)
- [Cursor](/agents/cursor/)
- [Amp](/agents/amp/)
- [OpenCode](/agents/opencode/)

## Skill vs Manual References

**Use the Offworld skill when:**
- You want agents to discover references autonomously
- Working across multiple projects with different dependencies
- You want consistent, community-maintained references

**Use manual AGENTS.md when:**
- You have project-specific conventions not covered by references
- You need custom instructions beyond library documentation
- You're working in a monorepo with complex internal dependencies

The two approaches complement each other — Offworld manages library references while your AGENTS.md handles project-specific guidance.

## Troubleshooting

### Skill not loading

Verify the skill is symlinked:

```bash
ow config show
```

Check that your agent's skill directory contains the `offworld` symlink.

### Agent can't find references

Ensure you've run `ow project init` in your project root. This creates `.offworld/map.json` which the skill uses to locate references.

### Reference is outdated

Update the reference:

```bash
ow pull owner/repo --generate
```

Or regenerate all project references:

```bash
ow project init --all --generate
```
