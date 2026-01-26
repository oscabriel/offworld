---
title: Cursor
description: Set up Offworld with Cursor for AI-powered development with reference knowledge.
---

Cursor supports skills for enhanced AI assistance. Offworld integrates seamlessly to provide reference knowledge for your dependencies.

## Setup

### 1. Install Offworld

```bash
curl -fsSL https://offworld.sh/install | bash
```

### 2. Initialize the Skill

```bash
ow init
```

This symlinks the Offworld skill to `~/.cursor/skills/offworld`.

### 3. Verify Installation

```bash
ls -la ~/.cursor/skills/
```

You should see `offworld -> ~/.local/share/offworld/skills/offworld`.

## Usage

### Composer Mode

Cursor's Composer mode works well with Offworld for multi-file implementations:

```
@offworld Using the TanStack Router reference, set up file-based routing for this Next.js app with:
- Authenticated routes under /dashboard
- Public routes for /login and /signup
- A root layout with navigation
```

### Chat Mode

In Cursor's chat, reference the skill directly:

```
Check what Offworld references are available for this project and suggest which ones I should pull for a full-stack TypeScript app.
```

### Example Workflows

**Scaffold with references:**

```
Using Offworld references, scaffold a new API route that:
1. Uses Drizzle ORM for database access
2. Validates input with Zod
3. Returns typed responses
```

**Debug with context:**

```
This TanStack Query mutation isn't invalidating correctly. Check the Offworld reference for the correct invalidation pattern.
```

**Learn a library:**

```
Using the Offworld reference for Hono, explain the middleware pattern and show me how to add authentication.
```

## Configuration

### Project Setup

Run in your project root:

```bash
ow project init
```

This scans your dependencies and creates `.offworld/map.json` so Cursor knows which references apply.

### Cursor Settings

Cursor should automatically detect skills in `~/.cursor/skills/`. If not, check Cursor's settings for the skills directory path.

## Troubleshooting

### Skill not loading

1. Verify the symlink:

   ```bash
   ls -la ~/.cursor/skills/offworld
   ```

2. Restart Cursor to reload skills

3. Check Cursor's skill settings in preferences

### "Reference not found" errors

Run `ow project init` to ensure your project's map is up to date:

```bash
cd my-project
ow project init
```

### Cursor using outdated reference

References are cached. To update:

```bash
ow pull owner/repo --generate
```
