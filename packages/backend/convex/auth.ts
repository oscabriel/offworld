import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * User object validator for Convex return types.
 * Matches the user table schema defined in schema.ts.
 */
const userValidator = v.object({
	_id: v.id("user"),
	_creationTime: v.number(),
	workosId: v.string(),
	email: v.string(),
	name: v.optional(v.string()),
	image: v.optional(v.string()),
	createdAt: v.string(),
});

export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) return null;

	const workosId = identity.subject;

	const user = await ctx.db
		.query("user")
		.withIndex("by_workosId", (q) => q.eq("workosId", workosId))
		.first();

	return user ?? null;
}

export const ensureUser = mutation({
	args: {},
	async handler(ctx) {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");

		const workosId = identity.subject;
		const existing = await ctx.db
			.query("user")
			.withIndex("by_workosId", (q) => q.eq("workosId", workosId))
			.first();

		if (existing) return existing._id;

		return await ctx.db.insert("user", {
			workosId,
			email: identity.email ?? "",
			name: identity.name ?? undefined,
			image: identity.pictureUrl ?? undefined,
			createdAt: new Date().toISOString(),
		});
	},
});

export const getCurrentUser = query({
	args: {},
	returns: v.union(userValidator, v.null()),
	async handler(ctx) {
		return await getAuthUser(ctx);
	},
});

export const getCurrentUserSafe = query({
	args: {},
	returns: v.union(userValidator, v.null()),
	async handler(ctx) {
		return await getAuthUser(ctx);
	},
});

function getAdminEmails(): string[] {
	const emails = process.env.ADMIN_EMAILS;
	if (!emails) return [];
	return emails.split(",").map((e) => e.trim().toLowerCase());
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const user = await getAuthUser(ctx);
	if (!user) throw new Error("Unauthorized");
	if (!("email" in user) || typeof user.email !== "string") {
		throw new Error("Unauthorized");
	}
	const adminEmails = getAdminEmails();
	if (!adminEmails.includes(user.email.toLowerCase())) {
		throw new Error("Admin access required");
	}
	return user;
}

export const isAdmin = query({
	args: {},
	returns: v.boolean(),
	async handler(ctx) {
		const user = await getAuthUser(ctx);
		if (!user) return false;
		if (!("email" in user) || typeof user.email !== "string") return false;
		return getAdminEmails().includes(user.email.toLowerCase());
	},
});
