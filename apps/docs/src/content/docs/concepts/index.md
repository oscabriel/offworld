---
title: How Offworld Works
description: Understanding the clone map, references, and single-skill architecture.
---

Offworld is a context management tool for AI coding agents. It keeps a persistent clone map and right-sized references for your dependencies, so agents stop burning tokens rediscovering the same paths every session.

## The Problem

Agents can always find dependencies. They have access to `package.json`, web search, and `node_modules`. But the path is expensive:

1. **Token burn** — Rediscovering docs and source every session
2. **Hallucination** — Context degrades when it gets too deep
3. **No memory** — Forgetting what worked between sessions

## The Solution

```bash
ow project init
```

Offworld builds a persistent clone map, generates right-sized references, and installs one routing skill across all agents.

## Core Concepts

### The Clone Map

The clone map (`assets/map.json`) is a persistent registry of cloned repositories. It gives agents a stable pointer to the right source tree without re-discovering it every session.

```json
{
	"repos": {
		"tanstack/router": {
			"localPath": "/Users/you/ow/tanstack/router",
			"references": ["tanstack-router.md"],
			"primary": "tanstack-router.md",
			"keywords": ["routing", "tanstack", "react-router"],
			"updatedAt": "2026-01-25"
		}
	}
}
```

Effects:

- **Immediate jump** to `localPath` (no package.json + web search loop)
- **Right-sized context** by loading only the matching reference
- **Durable across sessions**, updateable as repos change

### References

References are AI-optimized markdown files—not too big to bloat context, not too small to be useless. They're generated from source code using AI and contain:

- Key concepts and patterns
- Common usage examples
- Important file locations
- API surface overview

References live at `~/.local/share/offworld/skills/offworld/references/`.

### The Single Skill

Offworld uses one static skill that only routes. The skill itself never changes—it just reads the map and directs agents to the right reference.

```
~/.local/share/offworld/skills/offworld/
├── SKILL.md           # Static routing skill
├── assets/
│   └── map.json       # Clone map
└── references/
    ├── tanstack-router.md
    ├── drizzle-orm.md
    └── ...
```

This is different from having many per-repo skills:

- **O(1) startup load** — Agents load one skill, not dozens
- **Less noise** — Routing happens before context fills up
- **Single update point** — Fix the skill once, all agents benefit

### Project Maps

For project-specific routing, `ow project init` creates `.offworld/map.json` in your project root. This scopes which references are relevant to your project's actual dependencies.

```json
{
	"version": 1,
	"scope": "project",
	"globalMapPath": "~/.local/share/offworld/skills/offworld/assets/map.json",
	"repos": {
		"tanstack/router": {
			"localPath": "/Users/you/ow/tanstack/router",
			"reference": "tanstack-router.md",
			"keywords": ["routing"]
		}
	}
}
```

The skill checks for a project map first, then falls back to the global map.

## The Data Flow

```
ow project init
  → Parse manifests (package.json, Cargo.toml, etc.)
  → Resolve dependencies to GitHub repositories
  → Clone repositories to ~/ow/
  → Generate AI-optimized references
  → Update assets/map.json (global)
  → Write .offworld/map.json (project)
  → Symlink single skill to all agents
```

## Source Over Docs

The best way to ensure your agent uses a library correctly is not to give it docs links—it's to give it direct access to the source code.

Well-constructed libraries are still valuable. Agents can integrate a good library in seconds, especially when you point them at the source immediately. Offworld keeps local clones so agents can:

- Read actual implementation code
- Explore test files for usage patterns
- Check recent commits for changes
- Find examples in the codebase

## Why Not Per-Repo Skills?

We started with per-repo skills. Generate a SKILL.md for each library, symlink them all to agents.

It worked, but exposed the next problem: **agents load everything in their skill directory**. More skills means more startup tokens, more noise, and less reliable routing.

The single-skill model solves this:

- One skill that routes based on the query
- Load references on demand
- Keep the clone map between sessions

## What Offworld Is Not

- **Not a Q&A bot** — It's infrastructure for agent context
- **Not a marketplace-first product** — Community sharing is a feature, not the core
- **Not a static scraper** — References are generated from source on demand

## Comparison

| Approach              | Discovery            | Memory     | Context Size   |
| --------------------- | -------------------- | ---------- | -------------- |
| Web search every time | Slow, unreliable     | None       | Unpredictable  |
| Scraped docs          | Fast but stale       | Static     | Often too much |
| **Offworld**          | Instant (map lookup) | Persistent | Right-sized    |

## Next Steps

- [Quickstart](/guides/quickstart/) — Install and pull your first reference
- [AI Agent Integration](/agents/) — Set up with your preferred agent
- [CLI Reference](/reference/cli/) — Full command documentation
