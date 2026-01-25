import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const listAllAnalyses = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const skills = await ctx.db.query("skill").order("desc").collect();

		// Join with repository data
		const results = await Promise.all(
			skills.map(async (skill) => {
				const repo = await ctx.db.get(skill.repositoryId);
				return {
					_id: skill._id,
					fullName: repo?.fullName ?? "unknown",
					pullCount: skill.pullCount,
					analyzedAt: skill.analyzedAt,
					commitSha: skill.commitSha,
					isVerified: skill.isVerified,
				};
			}),
		);

		return results;
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

		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) {
			throw new Error("Repository not found");
		}

		const skill = await ctx.db
			.query("skill")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.first();

		if (!skill) {
			throw new Error("Skill not found");
		}

		await ctx.db.delete(skill._id);
		return { success: true };
	},
});

export const toggleVerified = mutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) {
			throw new Error("Repository not found");
		}

		const skill = await ctx.db
			.query("skill")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.first();

		if (!skill) {
			throw new Error("Skill not found");
		}

		await ctx.db.patch(skill._id, {
			isVerified: !skill.isVerified,
		});

		return { success: true, isVerified: !skill.isVerified };
	},
});
