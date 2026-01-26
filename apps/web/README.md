# Offworld Web App

[offworld.sh](https://offworld.sh) — Browse and share references for coding agents.

## Stack

- **Framework**: TanStack Start (React, TanStack Router, React Query)
- **Backend**: Convex
- **Auth**: WorkOS AuthKit
- **Styling**: Tailwind v4 + shadcn/ui + Base UI
- **Deploy**: Alchemy → Cloudflare Workers

## Features

- Browse shared references from the community
- View reference content with syntax highlighting
- Search references by repo name
- Download/install references via CLI
- User profiles with push history
- Admin dashboard

## Development

```bash
# From monorepo root
bun run dev:web

# Or from this directory
bun run dev
```

Requires Convex backend running (`bun run dev:server` from root).

## Routes

| Route                            | Description              |
| -------------------------------- | ------------------------ |
| `/`                              | Landing page             |
| `/explore`                       | Browse all references    |
| `/:owner/:repo`                  | Repository page          |
| `/:owner/:repo/:reference`       | Reference detail page    |
| `/profile`                       | User profile             |
| `/admin`                         | Admin dashboard          |
| `/sign-in`                       | Auth flow                |

## Environment Variables

```bash
CONVEX_URL=               # Convex deployment URL
WORKOS_CLIENT_ID=         # WorkOS OAuth client ID
WORKOS_API_KEY=           # WorkOS API key
```

## Build & Deploy

```bash
bun run build            # Build for production
bun run deploy           # Deploy via Alchemy
```

## Project Structure

```
src/
├── routes/              # TanStack Router file-based routes
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── home/            # Landing page components
│   ├── repo/            # Repository/reference components
│   ├── layout/          # Header, footer, page containers
│   └── admin/           # Admin dashboard components
├── lib/                 # Utilities, helpers
└── hooks/               # Custom React hooks
```
