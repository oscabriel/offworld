# WEB APP

React + TanStack Start + Vite. SSR with Cloudflare Workers.

## STRUCTURE

```
src/
├── routes/          # TanStack Router pages
├── components/      # App components
│   └── ui/          # shadcn/ui primitives
├── lib/             # Utilities + auth clients
└── router.tsx       # Router + Convex setup
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Add page | `src/routes/{name}.tsx` |
| Root layout | `src/routes/__root.tsx` |
| Auth client | `src/lib/auth-client.ts` |
| Auth server | `src/lib/auth-server.ts` |
| Router config | `src/router.tsx` |

## CONVENTIONS

- Route files auto-generate `routeTree.gen.ts`
- shadcn/ui components in `components/ui/`
- Tailwind v4 (no tailwind.config, uses CSS)
- `@/` alias → `src/`

## PATTERNS

```tsx
// Query pattern (Convex + TanStack Query)
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
const { data } = useSuspenseQuery(convexQuery(api.todos.getAll, {}));

// Auth check in route
beforeLoad: async (ctx) => {
  const token = await getAuth();
  ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
}
```

## NOTES

- SSR auth via `getToken()` server function
- Convex client initialized in `router.tsx`, not component
- Dark mode hardcoded in `__root.tsx` (`className="dark"`)
