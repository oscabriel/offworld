---
title: Quickstart
description: Install Offworld and pull your first reference in under 2 minutes.
---

Get started with Offworld in three steps.

## 1. Install the CLI

**macOS / Linux:**

```bash
curl -fsSL https://offworld.sh/install | bash
```

**npm (all platforms):**

```bash
npm install -g offworld
```

**Verify installation:**

```bash
ow --version
```

## 2. Initialize Offworld

Run the interactive setup to configure paths and symlink the skill to your agents:

```bash
ow init
```

This will:
- Create the config at `~/.config/offworld/config.json`
- Set up the skill directory at `~/.local/share/offworld/skills/offworld/`
- Symlink the skill to Claude Code, Cursor, Amp, OpenCode, and other supported agents

## 3. Pull Your First Reference

```bash
ow pull tanstack/router
```

This clones the repository, generates an AI-optimized reference, and adds it to your skill's references directory.

## Project Integration

For project-specific references, run this in your project root:

```bash
ow project init
```

This will:
1. Scan your `package.json`, `Cargo.toml`, `go.mod`, etc.
2. Match dependencies to available references
3. Install missing references
4. Update your `AGENTS.md` with a reference table

## What's Next?

- [AI Agent Integration](/agents/) — Set up with Claude Code, Cursor, and more
- [CLI Reference](/reference/cli/) — Full command documentation
- [Browse References](https://offworld.sh/explore) — Find references for your stack
