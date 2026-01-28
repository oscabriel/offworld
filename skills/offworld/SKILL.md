---
name: offworld
description: Routes queries to Offworld reference files. Find and read per-repo references for dependency knowledge.
allowed-tools: Bash(ow:*) Read
---

# Offworld Reference Router

Use `ow` to locate and read Offworld reference files for dependencies.

## What This Does

- Finds references for libraries and repos
- Returns paths for reference files and local clones
- Helps you read the right context fast

## When to Use

- You need docs or patterns for a dependency
- You want the verified reference instead of web search
- You are about to work inside a repo clone

## Prerequisites

Check that the CLI is available:

```bash
ow --version
```

If `ow` is not available, install it:

```bash
curl -fsSL https://offworld.sh/install | bash
```

## Setup

Initialize Offworld once per machine:

```bash
ow init
```

For a specific project, build a project map:

```bash
ow project init
```

## Usage

**Find a reference:**

```bash
ow map search <term>     # search by name or keyword
ow map show <repo>       # get info for specific repo
```

**Get paths for tools:**

```bash
ow map show <repo> --ref   # reference file path (use with Read)
ow map show <repo> --path  # clone directory path
```

**Example workflow:**

```bash
# 1. Find the repo
ow map search zod

# 2. Get reference path
ow map show colinhacks/zod --ref
# Output: /Users/.../.local/share/offworld/skill/offworld/references/colinhacks-zod.md

# 3. Read the reference with the path from step 2
```

## If Reference Not Found

```bash
ow pull <owner/repo>    # clone + generate reference
ow project init         # scan project deps, install references
```

## All Commands

| Command                     | Description                |
| --------------------------- | -------------------------- |
| `ow map search <term>`      | Find repos by name/keyword |
| `ow map show <repo>`        | Show repo info             |
| `ow map show <repo> --ref`  | Print reference file path  |
| `ow map show <repo> --path` | Print clone directory path |
| `ow list`                   | List all installed repos   |
| `ow pull <repo>`            | Clone + generate reference |

## Notes

- Project map (`.offworld/map.json`) takes precedence over global map when present
- Reference files are markdown with API docs, patterns, best practices
- Clone paths useful for exploring source code after reading reference

## Additional Resources

- Docs: https://offworld.sh/cli
