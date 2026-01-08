# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-07  
**Commit:** 05d5554  
**Branch:** main

## OVERVIEW

Turborepo monorepo: React web app (TanStack Start + Convex + Better Auth), TUI app, Astro docs. Cloudflare deployment via Alchemy.

## STRUCTURE

```
offworld/
├── apps/
│   ├── web/         # React + TanStack Start + Vite (main app)
│   ├── docs/        # Astro Starlight documentation
│   └── tui/         # OpenTUI terminal app
├── packages/
│   ├── backend/     # Convex functions + schema + auth
│   ├── config/      # Shared tsconfig
│   ├── env/         # T3 env validation (server + web)
│   └── infra/       # Alchemy Cloudflare deployment
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add route | `apps/web/src/routes/` | TanStack Router file-based routing |
| Add API endpoint | `packages/backend/convex/` | Convex query/mutation |
| Add UI component | `apps/web/src/components/` | shadcn/ui + Tailwind |
| Add shared UI | `apps/web/src/components/ui/` | shadcn primitives |
| Auth config | `packages/backend/convex/auth.ts` | Better Auth + Convex |
| Env vars | `packages/env/src/` | server.ts or web.ts |
| Deploy config | `packages/infra/alchemy.run.ts` | Cloudflare Workers |

## CONVENTIONS

- **Linting**: Oxlint + Oxfmt (NOT eslint/prettier)
- **Package manager**: Bun
- **Imports**: Path alias `@/` → `apps/web/src/`
- **TypeScript**: Strict, no unused vars/params
- **Env vars**: T3 env validation, VITE_ prefix for client

## ANTI-PATTERNS

- No tests exist yet
- Missing TanStack Start entry-client.tsx/entry-server.tsx (uses router.tsx pattern instead)

## COMMANDS

```bash
bun install              # Install deps
bun run dev              # Start all apps
bun run dev:web          # Web app only
bun run dev:server       # Convex backend only
bun run dev:setup        # Initial Convex setup
bun run build            # Build all
bun run check            # Oxlint + Oxfmt
bun run check-types      # TypeScript check
```

## NOTES

- Convex in `packages/backend/convex/` not root (monorepo pattern)
- Web app uses Convex + TanStack Query integration via `@convex-dev/react-query`
- Auth SSR: token fetched in `__root.tsx` beforeLoad, passed to ConvexBetterAuthProvider
- Deploy: `cd apps/web && bun run deploy` (uses Alchemy)
