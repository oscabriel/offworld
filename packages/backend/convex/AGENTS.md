# CONVEX BACKEND

Convex functions, schema, auth. Reactive backend-as-a-service.

## FILES

| File             | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `schema.ts`      | Database schema (todos table)              |
| `auth.ts`        | WorkOS auth helpers + getCurrentUser query |
| `auth.config.ts` | WorkOS JWT validation config (customJwt)   |
| `http.ts`        | HTTP routes (auth endpoints)               |
| `todos.ts`       | Todo CRUD mutations/queries                |
| `_generated/`    | Auto-generated (don't edit)                |

## PATTERNS

```ts
// Query with auth (WorkOS)
export const myQuery = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");
		return await ctx.db.query("myTable").collect();
	},
});

// Get user from WorkOS identity
import { getAuthUser } from "./auth";
const user = await getAuthUser(ctx);

// Mutation
export const create = mutation({
	args: { text: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.insert("todos", { text: args.text, completed: false });
	},
});
```

## CONVENTIONS

- Use `v.id("tableName")` for ID references
- `getAuthUser()` returns user from DB or null
- `ctx.auth.getUserIdentity()` returns raw WorkOS claims
- Export queries/mutations from individual files, not index

## COMMANDS

```bash
bun run dev          # Start Convex dev server
bun run dev:setup    # Initial setup + deploy
npx convex dashboard # Open Convex dashboard
```

## NOTES

- Auth via WorkOS JWT validation (not Better Auth)
- WorkOS requires two JWT issuers: SSO and User Management
- `ctx.auth.getUserIdentity()` returns WorkOS claims, `subject` = user ID
- Schema changes auto-push in dev mode
- `_generated/api.ts` exports typed API for frontend
- User table has `workosId` field (indexed) for linking to WorkOS identity
- deviceCode table removed - WorkOS handles device auth flow directly
