import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

/**
 * Repository Convex Functions
 * Queries for GitHub repository metadata
 */

/**
 * Get repository by fullName
 */
export const get = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();
	},
});

/**
 * List repositories by owner
 */
export const listByOwner = query({
	args: { owner: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("repository")
			.withIndex("by_owner", (q) => q.eq("owner", args.owner))
			.collect();
	},
});

/**
 * List repositories sorted by stars (for explore page)
 */
export const list = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		return await ctx.db.query("repository").withIndex("by_stars").order("desc").take(limit);
	},
});

/**
 * List recently indexed repositories (for homepage carousel)
 */
export const listRecent = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 10;

		return await ctx.db.query("repository").withIndex("by_fetchedAt").order("desc").take(limit);
	},
});

/**
 * Upsert repository (internal - called after fetching from GitHub)
 */
export const upsert = internalMutation({
	args: {
		fullName: v.string(),
		owner: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		stars: v.number(),
		language: v.optional(v.string()),
		defaultBranch: v.string(),
		githubUrl: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		const now = new Date().toISOString();

		if (existing) {
			await ctx.db.patch(existing._id, {
				...args,
				fetchedAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("repository", {
			...args,
			fetchedAt: now,
		});
	},
});
