import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUser } from "./auth";
import { pushArgs, validatePushArgs } from "./validation/push";
import { validateSkillContent } from "./validation/skillContent";
import { validateRepo, validateCommit } from "./validation/github";

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

// ============================================================================
// Push Error Types
// ============================================================================

export type PushError =
	| "auth_required"
	| "invalid_input"
	| "invalid_skill"
	| "repo_not_found"
	| "low_stars"
	| "private_repo"
	| "commit_not_found"
	| "commit_already_exists"
	| "rate_limit"
	| "github_error";

export type PushResult = { success: true } | { success: false; error: PushError; message?: string };

// ============================================================================
// Push Action (public - validates everything)
// ============================================================================

/**
 * Push skill - public action with full validation
 */
export const push = action({
	args: pushArgs,
	handler: async (ctx, args): Promise<PushResult> => {
		// 1. Auth check
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "auth_required" };
		}
		const workosId = identity.subject;

		// 2. Input validation (runtime checks)
		const validation = validatePushArgs(args);
		if (!validation.valid) {
			return {
				success: false,
				error: "invalid_input",
				message: validation.error,
			};
		}

		// 3. Content validation (lightweight)
		const contentResult = validateSkillContent(args.skillContent);
		if (!contentResult.valid) {
			return {
				success: false,
				error: "invalid_skill",
				message: contentResult.error,
			};
		}

		// 4. GitHub: repo exists + stars + public
		const repoResult = await validateRepo(args.fullName);
		if (!repoResult.valid) {
			let error: PushError = "github_error";
			if (repoResult.error?.includes("not found")) {
				error = "repo_not_found";
			} else if (repoResult.error?.includes("stars")) {
				error = "low_stars";
			} else if (repoResult.error?.includes("Private")) {
				error = "private_repo";
			}
			return { success: false, error, message: repoResult.error };
		}

		// 5. GitHub: commit exists
		const commitResult = await validateCommit(args.fullName, args.commitSha);
		if (!commitResult.valid) {
			return {
				success: false,
				error: "commit_not_found",
				message: commitResult.error,
			};
		}

		// 6. Delegate to internal mutation for DB operations
		return await ctx.runMutation(internal.analyses.pushInternal, {
			...args,
			workosId,
			repoStars: repoResult.stars,
			repoDescription: repoResult.description,
		});
	},
});

// ============================================================================
// Push Internal Mutation (not directly callable)
// ============================================================================

/**
 * Internal mutation - DB operations only, not directly callable
 */
export const pushInternal = internalMutation({
	args: {
		fullName: v.string(),
		skillName: v.string(),
		skillDescription: v.string(),
		skillContent: v.string(),
		commitSha: v.string(),
		analyzedAt: v.string(),
		workosId: v.string(),
		repoStars: v.optional(v.number()),
		repoDescription: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<PushResult> => {
		const { workosId, repoStars, repoDescription, ...skillData } = args;
		const now = new Date().toISOString();

		// 1. Global rate limit: 20 pushes/day/user
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const recentPushes = await ctx.db
			.query("pushLog")
			.withIndex("by_workos_date", (q) => q.eq("workosId", workosId).gte("pushedAt", oneDayAgo))
			.take(21);

		if (recentPushes.length >= 20) {
			return { success: false, error: "rate_limit" };
		}

		// 2. Ensure user exists
		const existingUser = await ctx.db
			.query("user")
			.withIndex("by_workosId", (q) => q.eq("workosId", workosId))
			.first();

		if (!existingUser) {
			await ctx.db.insert("user", {
				workosId,
				email: "",
				createdAt: now,
			});
		}

		// 3. Upsert repository (need repo._id for immutability check)
		const parts = args.fullName.split("/");
		const owner = parts[0] ?? "";
		const name = parts[1] ?? "";

		let repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (repo) {
			await ctx.db.patch(repo._id, {
				stars: repoStars ?? repo.stars,
				description: repoDescription ?? repo.description,
				fetchedAt: now,
			});
		} else {
			const repoId = await ctx.db.insert("repository", {
				fullName: args.fullName,
				owner,
				name,
				description: repoDescription,
				stars: repoStars ?? 0,
				defaultBranch: "main",
				githubUrl: `https://github.com/${args.fullName}`,
				fetchedAt: now,
			});
			repo = await ctx.db.get(repoId);
		}

		if (!repo) {
			return { success: false, error: "github_error", message: "Failed to create repository" };
		}

		// 4. Immutability check: reject if (repositoryId, commitSha) exists
		const existing = await ctx.db
			.query("skill")
			.withIndex("by_repositoryId_commitSha", (q) =>
				q.eq("repositoryId", repo._id).eq("commitSha", args.commitSha),
			)
			.first();

		if (existing) {
			return {
				success: false,
				error: "commit_already_exists",
				message: "A skill already exists for this commit",
			};
		}

		// 5. Insert new skill (no updates, immutable by commit)
		await ctx.db.insert("skill", {
			repositoryId: repo._id,
			skillName: skillData.skillName,
			skillDescription: skillData.skillDescription,
			skillContent: skillData.skillContent,
			commitSha: skillData.commitSha,
			analyzedAt: skillData.analyzedAt,
			pullCount: 0,
			isVerified: false,
			workosId,
		});

		// 6. Log push for rate limiting
		await ctx.db.insert("pushLog", {
			fullName: args.fullName,
			workosId,
			pushedAt: now,
			commitSha: args.commitSha,
		});

		return { success: true };
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
