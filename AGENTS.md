# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-07  
**Commit:** 05d5554  
**Branch:** main

## OVERVIEW

Turborepo monorepo: React web app (TanStack Start + Convex + Better Auth), TUI app, Astro docs. Cloudflare deployment via Alchemy.

Production code. Must be maintainable.

This codebase will outlive you. Every shortcut you take becomes
someone else's burden. Every hack compounds into technical debt
that slows the whole team down.

You are not just writing code. You are shaping the future of this
project. The patterns you establish will be copied. The corners
you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

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

| Task             | Location                          | Notes                              |
| ---------------- | --------------------------------- | ---------------------------------- |
| Add route        | `apps/web/src/routes/`            | TanStack Router file-based routing |
| Add API endpoint | `packages/backend/convex/`        | Convex query/mutation              |
| Add UI component | `apps/web/src/components/`        | shadcn/ui + Tailwind               |
| Add shared UI    | `apps/web/src/components/ui/`     | shadcn primitives                  |
| Auth config      | `packages/backend/convex/auth.ts` | Better Auth + Convex               |
| Env vars         | `packages/env/src/`               | server.ts or web.ts                |
| Deploy config    | `packages/infra/alchemy.run.ts`   | Cloudflare Workers                 |

## CONVENTIONS

- **Linting**: Oxlint + Oxfmt (NOT eslint/prettier)
- **Package manager**: Bun
- **Imports**: Path alias `@/` → `apps/web/src/`
- **TypeScript**: Strict, no unused vars/params
- **Env vars**: T3 env validation, VITE\_ prefix for client

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
bun run typecheck        # TypeScript check
```

## NOTES

- Convex in `packages/backend/convex/` not root (monorepo pattern)
- Web app uses Convex + TanStack Query integration via `@convex-dev/react-query`
- Auth SSR: token fetched in `__root.tsx` beforeLoad, passed to ConvexBetterAuthProvider
- Deploy: `cd apps/web && bun run deploy` (uses Alchemy)

## TYPES PACKAGE (`@offworld/types`)

### Schema Design (US-009 - Strip Pipeline)

**SkillSchema Simplification**: For AI-only approach, most SkillSchema fields are now optional. Only required fields:
- `name: string` - Skill identifier
- `description: string` - One-line description

All other fields (whenToUse, bestPractices, commonPatterns, quickPaths, searchPatterns, etc.) are optional for backward compatibility with legacy API responses.

**Architecture & FileIndex**: Still used by sync.ts, plugin, push handler, and backend schema. Cannot be removed as they're part of the remote API contract. New AI-only approach creates placeholder objects when needed.

**Gotchas**:
- Types used by sync/push handlers must remain for API compatibility even if local generation doesn't use them
- Backend (Convex) has its own schema definitions that mirror types - changes to one don't automatically apply to the other
- Test fixtures in handlers.test.ts use full skill objects with quickPaths/searchPatterns - these still work since fields are optional
