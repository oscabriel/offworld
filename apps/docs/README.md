# Offworld Docs

[docs.offworld.sh](https://docs.offworld.sh) — Documentation for Offworld.

One skill for your whole stack. Learn how to use the CLI and manage references for your coding agents.

Built with [Astro Starlight](https://starlight.astro.build).

## Development

```bash
# From monorepo root
bun run dev:docs

# Or from this directory
bun run dev
```

Runs at `localhost:4321`.

## Structure

```
src/
├── content/
│   └── docs/           # Markdown/MDX documentation
├── assets/             # Images, logos
└── content.config.ts   # Content collections config
```

## Adding Pages

Add `.md` or `.mdx` files to `src/content/docs/`. Each file becomes a route based on its filename.

## Commands

| Command           | Action                |
| ----------------- | --------------------- |
| `bun run dev`     | Start dev server      |
| `bun run build`   | Build to `./dist/`    |
| `bun run preview` | Preview build locally |

## Deploy

Deployed via Cloudflare Pages on push to main.
