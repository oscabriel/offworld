# CONVEX BACKEND

Convex functions, schema, auth. Reactive backend-as-a-service.

## FILES

| File             | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `schema.ts`      | Database schema (todos table)            |
| `auth.ts`        | WorkOS auth helpers + getCurrentUser query |
| `auth.config.ts` | WorkOS JWT validation config (customJwt)   |
| `http.ts`        | HTTP routes (auth endpoints)             |
| `todos.ts`       | Todo CRUD mutations/queries              |
| `_generated/`    | Auto-generated (don't edit)              |

## PATTERNS

```ts
// Query with auth
export const myQuery = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) throw new Error("Unauthorized");
		return await ctx.db.query("myTable").collect();
	},
});

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
- `safeGetAuthUser` returns null if unauthenticated
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
- `ctx.auth.getUserIdentity()` returns WorkOS claims
- Schema changes auto-push in dev mode
- `_generated/api.ts` exports typed API for frontend
