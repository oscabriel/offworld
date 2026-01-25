import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./auth";

/**
 * Skill Convex Functions
 * Public queries/mutations for CLI and web app
 */

// ============================================================================
// Public Query Functions (for web app)
// ============================================================================

/**
 * Get skill by repository fullName (public)
 * Display skill on web
 */
export const get = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return null;

		return await ctx.db
			.query("skill")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.first();
	},
});

/**
 * Get skill by repository fullName + skillName (public)
 * Display specific skill on web
 */
export const getByName = query({
	args: { fullName: v.string(), skillName: v.string() },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return null;

		return await ctx.db
			.query("skill")
			.withIndex("by_repositoryId_skillName", (q) =>
				q.eq("repositoryId", repo._id).eq("skillName", args.skillName),
			)
			.first();
	},
});

/**
 * List all skills for a repository (public)
 */
export const listByRepo = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return [];

		const skills = await ctx.db
			.query("skill")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();

		return skills.map((skill) => ({
			skillName: skill.skillName,
			skillDescription: skill.skillDescription,
			analyzedAt: skill.analyzedAt,
			commitSha: skill.commitSha,
			pullCount: skill.pullCount,
			isVerified: skill.isVerified,
		}));
	},
});

/**
 * List all skills sorted by pull count (public)
 * Repo directory/explore page
 */
export const list = query({
	args: {
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		const skills = await ctx.db.query("skill").withIndex("by_pullCount").order("desc").take(limit);

		// Join with repository data
		const results = await Promise.all(
			skills.map(async (skill) => {
				const repo = await ctx.db.get(skill.repositoryId);
				return {
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

/**
 * List skills pushed by the current user
 */
export const listByCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await getAuthUser(ctx);
		if (!user) return [];

		const skills = await ctx.db
			.query("skill")
			.withIndex("by_workosId", (q) => q.eq("workosId", user.workosId))
			.order("desc")
			.collect();

		// Join with repository data
		const results = await Promise.all(
			skills.map(async (skill) => {
				const repo = await ctx.db.get(skill.repositoryId);
				return {
					fullName: repo?.fullName ?? "unknown",
					owner: repo?.owner ?? "unknown",
					name: repo?.name ?? "unknown",
					skillName: skill.skillName,
					skillDescription: skill.skillDescription,
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

// ============================================================================
// Public CLI Functions
// ============================================================================

/**
 * Fetch skill for CLI pull (no pull count tracking)
 */
export const pull = query({
	args: { fullName: v.string(), skillName: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return null;

		const skillName = args.skillName;
		const skill = skillName
			? await ctx.db
					.query("skill")
					.withIndex("by_repositoryId_skillName", (q) =>
						q.eq("repositoryId", repo._id).eq("skillName", skillName),
					)
					.first()
			: await ctx.db
					.query("skill")
					.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
					.first();

		if (!skill) return null;

		return {
			fullName: repo.fullName,
			skillName: skill.skillName,
			skillDescription: skill.skillDescription,
			skillContent: skill.skillContent,
			commitSha: skill.commitSha,
			analyzedAt: skill.analyzedAt,
		};
	},
});

/**
 * Lightweight existence check for CLI
 */
export const check = query({
	args: { fullName: v.string(), skillName: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return { exists: false as const };

		const skillName = args.skillName;
		const skill = skillName
			? await ctx.db
					.query("skill")
					.withIndex("by_repositoryId_skillName", (q) =>
						q.eq("repositoryId", repo._id).eq("skillName", skillName),
					)
					.first()
			: await ctx.db
					.query("skill")
					.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
					.first();

		if (!skill) return { exists: false as const };

		return {
			exists: true as const,
			commitSha: skill.commitSha,
			analyzedAt: skill.analyzedAt,
		};
	},
});

/**
 * Push analysis from CLI - auth required, returns structured result
 */
export const push = mutation({
	args: {
		fullName: v.string(),
		skillName: v.string(),
		skillDescription: v.string(),
		skillContent: v.string(),
		commitSha: v.string(),
		analyzedAt: v.string(),
		// GitHub metadata for repository upsert
		repoDescription: v.optional(v.string()),
		repoStars: v.optional(v.number()),
		repoLanguage: v.optional(v.string()),
		repoDefaultBranch: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Auth check
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "auth_required" } as const;
		}
		const workosId = identity.subject;

		// Ensure user exists
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
			.query("pushLog")
			.withIndex("by_repo_date", (q) => q.eq("fullName", args.fullName).gte("pushedAt", oneDayAgo))
			.filter((q) => q.eq(q.field("workosId"), workosId))
			.collect();

		if (recentPushes.length >= 3) {
			return { success: false, error: "rate_limit" } as const;
		}

		// Parse owner/name from fullName
		const parts = args.fullName.split("/");
		const owner = parts[0] ?? "";
		const name = parts[1] ?? "";

		// Upsert repository
		let repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		const now = new Date().toISOString();

		if (repo) {
			await ctx.db.patch(repo._id, {
				description: args.repoDescription,
				stars: args.repoStars ?? repo.stars,
				language: args.repoLanguage,
				defaultBranch: args.repoDefaultBranch ?? repo.defaultBranch,
				fetchedAt: now,
			});
		} else {
			const repoId = await ctx.db.insert("repository", {
				fullName: args.fullName,
				owner,
				name,
				description: args.repoDescription,
				stars: args.repoStars ?? 0,
				language: args.repoLanguage,
				defaultBranch: args.repoDefaultBranch ?? "main",
				githubUrl: `https://github.com/${args.fullName}`,
				fetchedAt: now,
			});
			repo = await ctx.db.get(repoId);
		}

		if (!repo) {
			return { success: false, error: "repository_creation_failed" } as const;
		}

		// Conflict check
		const existing = await ctx.db
			.query("skill")
			.withIndex("by_repositoryId_skillName", (q) =>
				q.eq("repositoryId", repo._id).eq("skillName", args.skillName),
			)
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

		// Upsert skill
		if (existing) {
			await ctx.db.patch(existing._id, {
				skillName: args.skillName,
				skillDescription: args.skillDescription,
				skillContent: args.skillContent,
				commitSha: args.commitSha,
				analyzedAt: args.analyzedAt,
				workosId,
			});
		} else {
			await ctx.db.insert("skill", {
				repositoryId: repo._id,
				skillName: args.skillName,
				skillDescription: args.skillDescription,
				skillContent: args.skillContent,
				commitSha: args.commitSha,
				analyzedAt: args.analyzedAt,
				pullCount: 0,
				isVerified: false,
				workosId,
			});
		}

		// Log push
		await ctx.db.insert("pushLog", {
			fullName: args.fullName,
			workosId,
			pushedAt: now,
			commitSha: args.commitSha,
		});

		return { success: true } as const;
	},
});

/**
 * Record a pull event - increments pullCount for display on repo pages
 */
export const recordPull = mutation({
	args: { fullName: v.string(), skillName: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return;

		const skillName = args.skillName;
		const skill = skillName
			? await ctx.db
					.query("skill")
					.withIndex("by_repositoryId_skillName", (q) =>
						q.eq("repositoryId", repo._id).eq("skillName", skillName),
					)
					.first()
			: await ctx.db
					.query("skill")
					.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
					.first();

		if (skill) {
			await ctx.db.patch(skill._id, {
				pullCount: skill.pullCount + 1,
			});
		}
	},
});
