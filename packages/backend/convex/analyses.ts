import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Analyses Convex Functions
 * Public queries/mutations for CLI and web app
 */

// ============================================================================
// Public Query Functions (for web app)
// ============================================================================

/**
 * Get analysis by repository fullName (public)
 * Display analysis on web
 */
export const get = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();
	},
});

/**
 * List all analyses sorted by pull count (public)
 * Repo directory/explore page
 */
export const list = query({
	args: {
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		const analyses = await ctx.db
			.query("analyses")
			.withIndex("by_pullCount")
			.order("desc")
			.take(limit);

		return analyses.map((a) => ({
			fullName: a.fullName,
			provider: a.provider,
			pullCount: a.pullCount,
			analyzedAt: a.analyzedAt,
			commitSha: a.commitSha,
			isVerified: a.isVerified,
		}));
	},
});

// ============================================================================
// Public CLI Functions
// ============================================================================

/**
 * Fetch analysis for CLI pull (no pull count tracking)
 */
export const pull = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) return null;

		return {
			fullName: analysis.fullName,
			summary: analysis.summary,
			architecture: analysis.architecture,
			skill: analysis.skill,
			fileIndex: analysis.fileIndex,
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
		};
	},
});

/**
 * Lightweight existence check for CLI
 */
export const check = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!analysis) return { exists: false as const };

		return {
			exists: true as const,
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
		};
	},
});

/**
 * Push analysis from CLI - auth required, returns structured result
 */
export const push = mutation({
	args: {
		fullName: v.string(),
		summary: v.string(),
		architecture: v.any(),
		skill: v.any(),
		fileIndex: v.any(),
		commitSha: v.string(),
		analyzedAt: v.string(),
	},
	handler: async (ctx, args) => {
		// Auth check
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "auth_required" } as const;
		}
		const workosId = identity.subject;

		// Ensure user exists (inline from auth.ts ensureUser)
		const existingUser = await ctx.db
			.query("user")
			.withIndex("by_workosId", (q) => q.eq("workosId", workosId))
			.first();

		if (!existingUser) {
			await ctx.db.insert("user", {
				workosId,
				email: identity.email ?? "",
				name: identity.name ?? undefined,
				image: identity.pictureUrl ?? undefined,
				createdAt: new Date().toISOString(),
			});
		}

		// Rate limit check (3 pushes per repo per day per user)
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const recentPushes = await ctx.db
			.query("pushLogs")
			.withIndex("by_repo_date", (q) => q.eq("fullName", args.fullName).gte("pushedAt", oneDayAgo))
			.filter((q) => q.eq(q.field("workosId"), workosId))
			.collect();

		if (recentPushes.length >= 3) {
			return { success: false, error: "rate_limit" } as const;
		}

		// Conflict check
		const existing = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (existing) {
			const existingDate = new Date(existing.analyzedAt);
			const newDate = new Date(args.analyzedAt);

			if (newDate < existingDate) {
				return {
					success: false,
					error: "conflict",
					remoteCommitSha: existing.commitSha,
				} as const;
			}
		}

		// Upsert
		if (existing) {
			await ctx.db.patch(existing._id, {
				...args,
				provider: "github",
				version: "0.1.0",
				workosId,
			});
		} else {
			await ctx.db.insert("analyses", {
				...args,
				provider: "github",
				version: "0.1.0",
				pullCount: 0,
				isVerified: false,
				workosId,
			});
		}

		// Log push
		await ctx.db.insert("pushLogs", {
			fullName: args.fullName,
			workosId,
			pushedAt: new Date().toISOString(),
			commitSha: args.commitSha,
		});

		return { success: true } as const;
	},
});
