import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * List all issues for a repository
 */
export const listByRepository = query({
	args: {
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		return issues;
	},
});

/**
 * Get a single issue by ID
 */
export const getById = query({
	args: {
		issueId: v.id("issues"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.issueId);
	},
});

/**
 * List issues by state
 */
export const listByState = query({
	args: {
		repositoryId: v.id("repositories"),
		state: v.string(), // "open" or "closed"
	},
	handler: async (ctx, args) => {
		const allIssues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		return allIssues.filter((issue) => issue.state === args.state);
	},
});

/**
 * List issues by difficulty
 */
export const listByDifficulty = query({
	args: {
		repositoryId: v.id("repositories"),
		difficulty: v.number(),
	},
	handler: async (ctx, args) => {
		const allIssues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		return allIssues.filter((issue) => issue.difficulty === args.difficulty);
	},
});

/**
 * Get a specific issue by number for a repository
 */
export const getByNumber = query({
	args: {
		repositoryId: v.id("repositories"),
		number: v.number(),
	},
	handler: async (ctx, args) => {
		const allIssues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		return allIssues.find((issue) => issue.number === args.number);
	},
});
