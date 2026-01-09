import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Analyses Convex Functions
 * PRD 7.5: Internal functions for analysis management
 */

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get analysis by repository fullName
 */
export const getByRepo = internalQuery({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();
	},
});

/**
 * Get analysis metadata only (for lightweight checks)
 */
export const getMeta = internalQuery({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) {
			return null;
		}

		return {
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
			pullCount: analysis.pullCount,
		};
	},
});

/**
 * Get push count for a repo in the last 24 hours (rate limiting)
 */
export const getPushCountToday = internalQuery({
	args: { fullName: v.string(), userId: v.id("users") },
	handler: async (ctx, args) => {
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

		const pushes = await ctx.db
			.query("pushLogs")
			.withIndex("by_repo_date", (q) =>
				q.eq("fullName", args.fullName).gte("pushedAt", oneDayAgo)
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.collect();

		return pushes.length;
	},
});

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Increment pull count for an analysis
 */
export const incrementPullCount = internalMutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) {
			return false;
		}

		await ctx.db.patch(analysis._id, {
			pullCount: analysis.pullCount + 1,
		});

		return true;
	},
});

/**
 * Create or update an analysis
 * Enforces rate limiting and conflict resolution
 */
export const upsert = internalMutation({
	args: {
		fullName: v.string(),
		provider: v.string(),
		summary: v.string(),
		architecture: v.any(), // Complex nested object
		skill: v.any(),
		fileIndex: v.any(),
		commitSha: v.string(),
		analyzedAt: v.string(),
		version: v.string(),
		userId: v.optional(v.id("users")),
	},
	handler: async (ctx, args) => {
		const { userId, ...analysisData } = args;

		// Check for existing analysis
		const existing = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		// Rate limit check (3 pushes per repo per day per user)
		if (userId) {
			const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

			const recentPushes = await ctx.db
				.query("pushLogs")
				.withIndex("by_repo_date", (q) =>
					q.eq("fullName", args.fullName).gte("pushedAt", oneDayAgo)
				)
				.filter((q) => q.eq(q.field("userId"), userId))
				.collect();

			if (recentPushes.length >= 3) {
				return {
					success: false,
					error: "rate_limit",
					message: "You can only push 3 times per repository per day",
				};
			}
		}

		// Conflict check - reject if pushing older analysis over newer
		if (existing) {
			const existingDate = new Date(existing.analyzedAt);
			const newDate = new Date(args.analyzedAt);

			if (newDate < existingDate) {
				return {
					success: false,
					error: "conflict",
					message: "A newer analysis already exists",
					remoteCommitSha: existing.commitSha,
				};
			}

			// Reject different analysis for same commit (without explicit override)
			if (existing.commitSha === args.commitSha && existing.analyzedAt !== args.analyzedAt) {
				return {
					success: false,
					error: "conflict",
					message: "A different analysis exists for this commit",
					remoteCommitSha: existing.commitSha,
				};
			}
		}

		// Perform upsert
		if (existing) {
			await ctx.db.patch(existing._id, {
				...analysisData,
				pullCount: existing.pullCount, // Preserve pull count
				isVerified: existing.isVerified, // Preserve verification
				pushedBy: userId ?? existing.pushedBy,
			});
		} else {
			await ctx.db.insert("analyses", {
				...analysisData,
				pullCount: 0,
				isVerified: false,
				pushedBy: userId,
			});
		}

		// Log the push
		if (userId) {
			await ctx.db.insert("pushLogs", {
				fullName: args.fullName,
				userId,
				pushedAt: new Date().toISOString(),
				commitSha: args.commitSha,
			});
		}

		return { success: true };
	},
});

/**
 * Delete an analysis (admin only)
 */
export const remove = internalMutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) {
			return false;
		}

		await ctx.db.delete(analysis._id);
		return true;
	},
});
