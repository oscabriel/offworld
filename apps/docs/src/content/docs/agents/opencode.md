---
title: OpenCode
description: Set up Offworld with OpenCode for reference-powered terminal AI.
---

OpenCode is a terminal-based AI coding assistant that supports skills. Offworld integrates to provide reference knowledge directly in your terminal workflow.

## Setup

### 1. Install Offworld

```bash
curl -fsSL https://offworld.sh/install | bash
```

### 2. Initialize the Skill

```bash
ow init
```

This symlinks the Offworld skill to `~/.config/opencode/skill/offworld`.

### 3. Verify Installation

```bash
ls -la ~/.config/opencode/skill/
```

You should see `offworld -> ~/.local/share/offworld/skills/offworld`.

## Usage

### In OpenCode Sessions

OpenCode loads skills from its skill directory. Once Offworld is symlinked, you can:

```
Check what Offworld references are installed for this project.
```

### Example Prompts

**Use a reference:**

```
Using the Offworld reference for Vitest, help me write tests for this utility function.
```

**Pull and apply:**

```
Pull the Effect reference using Offworld, then refactor this error handling to use Effect's error types.
```

**Project setup:**

```
Run ow project init, then use the installed references to help me understand the libraries in this codebase.
```

### Terminal Workflow

OpenCode's terminal-native approach pairs well with Offworld's CLI:

```bash
# In your terminal
ow pull tanstack/query

# Then in OpenCode
Using the TanStack Query reference, implement data fetching for the user list.
```

## Configuration

### Project Integration

```bash
cd my-project
ow project init
```

This creates `.offworld/map.json` for project-scoped references.

### OpenCode Skill Path

If OpenCode uses a custom skill path:

```bash
ow config set agents.opencode.skillPath /custom/path
ow init
```

## Troubleshooting

### Skill not loading

1. Verify symlink:

   ```bash
   ls -la ~/.config/opencode/skill/offworld
   ```

2. Check OpenCode's configuration for the skill directory setting

3. Re-run `ow init`

### References not found

Ensure project map exists:

```bash
cat .offworld/map.json
```

If missing:

```bash
ow project init
```
