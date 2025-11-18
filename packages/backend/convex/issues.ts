import { v } from "convex/values";
import { query } from "./_generated/server";

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

export const getById = query({
	args: {
		issueId: v.id("issues"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.issueId);
	},
});

export const listByState = query({
	args: {
		repositoryId: v.id("repositories"),
		state: v.string(),
	},
	handler: async (ctx, args) => {
		const allIssues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		return allIssues.filter((issue) => issue.state === args.state);
	},
});

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
