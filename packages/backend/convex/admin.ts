import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const listAllReferences = query({
	args: {},
	handler: async (ctx) => {
		await requireAdmin(ctx);

		const references = await ctx.db.query("reference").order("desc").collect();

		// Join with repository data
		const results = await Promise.all(
			references.map(async (ref) => {
				const repo = await ctx.db.get(ref.repositoryId);
				return {
					_id: ref._id,
					fullName: repo?.fullName ?? "unknown",
					pullCount: ref.pullCount,
					generatedAt: ref.generatedAt,
					commitSha: ref.commitSha,
					isVerified: ref.isVerified,
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

export const deleteReference = mutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullNameLower", (q) => q.eq("fullNameLower", args.fullName.toLowerCase()))
			.first();

		if (!repo) {
			throw new Error("Repository not found");
		}

		const ref = await ctx.db
			.query("reference")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.first();

		if (!ref) {
			throw new Error("Reference not found");
		}

		await ctx.db.delete(ref._id);
		return { success: true };
	},
});

export const toggleVerified = mutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullNameLower", (q) => q.eq("fullNameLower", args.fullName.toLowerCase()))
			.first();

		if (!repo) {
			throw new Error("Repository not found");
		}

		const ref = await ctx.db
			.query("reference")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.first();

		if (!ref) {
			throw new Error("Reference not found");
		}

		await ctx.db.patch(ref._id, {
			isVerified: !ref.isVerified,
		});

		return { success: true, isVerified: !ref.isVerified };
	},
});
