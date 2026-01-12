import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const listAllAnalyses = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const analyses = await ctx.db.query("analyses").order("desc").collect();

		return analyses.map((a) => ({
			_id: a._id,
			fullName: a.fullName,
			provider: a.provider,
			pullCount: a.pullCount,
			analyzedAt: a.analyzedAt,
			commitSha: a.commitSha,
			isVerified: a.isVerified,
			version: a.version,
		}));
	},
});

export const listAllUsers = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const users = await ctx.db.query("users").order("desc").collect();

		return users.map((u) => ({
			_id: u._id,
			email: u.email,
			name: u.name,
			image: u.image,
			createdAt: u.createdAt,
		}));
	},
});

export const deleteAnalysis = mutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) {
			throw new Error("Analysis not found");
		}

		await ctx.db.delete(analysis._id);
		return { success: true };
	},
});

export const toggleVerified = mutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) {
			throw new Error("Analysis not found");
		}

		await ctx.db.patch(analysis._id, {
			isVerified: !analysis.isVerified,
		});

		return { success: true, isVerified: !analysis.isVerified };
	},
});
