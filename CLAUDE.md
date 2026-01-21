# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start all apps (Turborepo)
bun run dev:web          # Web app only
bun run dev:server       # Convex backend only
bun run dev:setup        # Initial Convex project setup
bun run build            # Build all apps
bun run check            # Run oxlint + oxfmt
bun run typecheck        # TypeScript type checking
bun run test             # Run all tests via vitest (NOT `bun test`)

# Deployment (from packages/infra)
cd packages/infra && bun run deploy   # Deploy web + docs to Cloudflare
cd packages/infra && bun run destroy  # Tear down deployment
```

## Architecture

Turborepo monorepo with Bun package manager:

- **apps/web** - React + TanStack Start (SSR framework with TanStack Router), Vite, shadcn/ui, Tailwind CSS v4
- **apps/docs** - Astro Starlight documentation site
- **apps/tui** - OpenTUI terminal application
- **packages/backend** - Convex backend (functions, schema, auth)
- **packages/env** - T3 env validation (`@offworld/env/web` for client, `@offworld/env/server` for server)
- **packages/infra** - Alchemy deployment config for Cloudflare Workers
- **packages/config** - Shared TypeScript configuration

### Key Patterns

**Routing**: TanStack Router file-based routing in `apps/web/src/routes/`. Routes use `createFileRoute` or `createRootRouteWithContext`.

**Backend**: Convex functions in `packages/backend/convex/`. Use `query()` and `mutation()` from generated server. Schema defined in `schema.ts`.

**Auth**: Better Auth with Convex adapter. Auth configured in `packages/backend/convex/auth.ts`. Client-side auth via `@/lib/auth-client.ts`. SSR auth token fetched in `__root.tsx` beforeLoad and passed to `ConvexBetterAuthProvider`.

**Data Fetching**: Convex + TanStack Query integration via `@convex-dev/react-query`. The `ConvexQueryClient` is set up in `router.tsx` and passed through router context.

**Env Vars**: Client-side vars need `VITE_` prefix. Import from `@offworld/env/web` (client) or `@offworld/env/server` (server). Add new vars to the corresponding schema in `packages/env/src/`.

**Path Alias**: `@/` maps to `apps/web/src/`

## Conventions

- **Linting/Formatting**: Oxlint + Oxfmt (NOT ESLint/Prettier). Run `bun run check`.
- **TypeScript**: Strict mode. No unused variables or parameters.
- **Components**: shadcn/ui components in `apps/web/src/components/ui/`. Custom components in `apps/web/src/components/`.

## Project Skills

Skills installed for this project's dependencies:

| Dependency | Skill                | Path                                                                            |
| ---------- | -------------------- | ------------------------------------------------------------------------------- |
| zod        | colinhacks-zod       | /Users/oscargabriel/.local/share/offworld/skills/colinhacks-zod-reference       |
| typescript | microsoft-TypeScript | /Users/oscargabriel/.local/share/offworld/skills/microsoft-TypeScript-reference |
| vitest     | vitest-dev-vitest    | /Users/oscargabriel/.local/share/offworld/skills/vitest-dev-vitest-reference    |

To update skills, run: `ow pull <dependency>`
To regenerate all: `ow project init --all --generate`
