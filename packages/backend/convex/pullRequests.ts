import { v } from "convex/values";
import { query } from "./_generated/server";

export const listByRepository = query({
	args: {
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const prs = await ctx.db
			.query("pullRequests")
			.withIndex("by_repository", (q) =>
				q.eq("repositoryId", args.repositoryId),
			)
			.collect();

		return prs;
	},
});

export const getById = query({
	args: {
		prId: v.id("pullRequests"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.prId);
	},
});

export const listByState = query({
	args: {
		repositoryId: v.id("repositories"),
		state: v.string(),
	},
	handler: async (ctx, args) => {
		const allPRs = await ctx.db
			.query("pullRequests")
			.withIndex("by_repository_state", (q) =>
				q.eq("repositoryId", args.repositoryId).eq("state", args.state),
			)
			.collect();

		return allPRs;
	},
});

export const getByNumber = query({
	args: {
		repositoryId: v.id("repositories"),
		number: v.number(),
	},
	handler: async (ctx, args) => {
		const allPRs = await ctx.db
			.query("pullRequests")
			.withIndex("by_repository", (q) =>
				q.eq("repositoryId", args.repositoryId),
			)
			.collect();

		return allPRs.find((pr) => pr.number === args.number);
	},
});
