import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const listAllAnalyses = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const skills = await ctx.db.query("skill").order("desc").collect();

		return skills.map((skill) => ({
			_id: skill._id,
			fullName: skill.fullName,
			pullCount: skill.pullCount,
			analyzedAt: skill.analyzedAt,
			commitSha: skill.commitSha,
			isVerified: skill.isVerified,
		}));
	},
});

export const listAllUsers = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const users = await ctx.db.query("user").order("desc").collect();

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
			.query("skill")
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
			.query("skill")
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
