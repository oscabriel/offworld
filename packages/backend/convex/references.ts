import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUser } from "./auth";
import { pushArgs, validatePushArgs } from "./validation/push";
import { validateReferenceContent } from "./validation/referenceContent";
import { validateRepo, validateCommit } from "./validation/github";

/**
 * Reference Convex Functions
 * Public queries/mutations for CLI and web app
 */

// ============================================================================
// Public Query Functions (for web app)
// ============================================================================

/**
 * Get reference by repository fullName (public)
 * Display reference on web
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
			.query("reference")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.first();
	},
});

/**
 * Get reference by repository fullName + referenceName (public)
 * Display specific reference on web
 */
export const getByName = query({
	args: { fullName: v.string(), referenceName: v.string() },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return null;

		return await ctx.db
			.query("reference")
			.withIndex("by_repositoryId_referenceName", (q) =>
				q.eq("repositoryId", repo._id).eq("referenceName", args.referenceName),
			)
			.first();
	},
});

/**
 * List all references for a repository (public)
 */
export const listByRepo = query({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return [];

		const references = await ctx.db
			.query("reference")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();

		return references.map((ref) => ({
			referenceName: ref.referenceName,
			referenceDescription: ref.referenceDescription,
			generatedAt: ref.generatedAt,
			commitSha: ref.commitSha,
			pullCount: ref.pullCount,
			isVerified: ref.isVerified,
		}));
	},
});

/**
 * List all references sorted by pull count (public)
 * Repo directory/explore page
 */
export const list = query({
	args: {
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		const references = await ctx.db
			.query("reference")
			.withIndex("by_pullCount")
			.order("desc")
			.take(limit);

		// Join with repository data
		const results = await Promise.all(
			references.map(async (ref) => {
				const repo = await ctx.db.get(ref.repositoryId);
				return {
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

/**
 * List references pushed by the current user
 */
export const listByCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await getAuthUser(ctx);
		if (!user) return [];

		const references = await ctx.db
			.query("reference")
			.withIndex("by_workosId", (q) => q.eq("workosId", user.workosId))
			.order("desc")
			.collect();

		// Join with repository data
		const results = await Promise.all(
			references.map(async (ref) => {
				const repo = await ctx.db.get(ref.repositoryId);
				return {
					fullName: repo?.fullName ?? "unknown",
					owner: repo?.owner ?? "unknown",
					name: repo?.name ?? "unknown",
					referenceName: ref.referenceName,
					referenceDescription: ref.referenceDescription,
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

// ============================================================================
// Public CLI Functions
// ============================================================================

/**
 * Fetch reference for CLI pull (no pull count tracking)
 */
export const pull = query({
	args: { fullName: v.string(), referenceName: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return null;

		const referenceName = args.referenceName;
		const ref = referenceName
			? await ctx.db
					.query("reference")
					.withIndex("by_repositoryId_referenceName", (q) =>
						q.eq("repositoryId", repo._id).eq("referenceName", referenceName),
					)
					.first()
			: await ctx.db
					.query("reference")
					.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
					.first();

		if (!ref) return null;

		return {
			fullName: repo.fullName,
			referenceName: ref.referenceName,
			referenceDescription: ref.referenceDescription,
			referenceContent: ref.referenceContent,
			commitSha: ref.commitSha,
			generatedAt: ref.generatedAt,
		};
	},
});

/**
 * Lightweight existence check for CLI
 */
export const check = query({
	args: { fullName: v.string(), referenceName: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return { exists: false as const };

		const referenceName = args.referenceName;
		const ref = referenceName
			? await ctx.db
					.query("reference")
					.withIndex("by_repositoryId_referenceName", (q) =>
						q.eq("repositoryId", repo._id).eq("referenceName", referenceName),
					)
					.first()
			: await ctx.db
					.query("reference")
					.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
					.first();

		if (!ref) return { exists: false as const };

		return {
			exists: true as const,
			commitSha: ref.commitSha,
			generatedAt: ref.generatedAt,
		};
	},
});

// ============================================================================
// Push Error Types
// ============================================================================

export type PushError =
	| "auth_required"
	| "invalid_input"
	| "invalid_reference"
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
 * Push reference - public action with full validation
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
		const contentResult = validateReferenceContent(args.referenceContent);
		if (!contentResult.valid) {
			return {
				success: false,
				error: "invalid_reference",
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
		return await ctx.runMutation(internal.references.pushInternal, {
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
		referenceName: v.string(),
		referenceDescription: v.string(),
		referenceContent: v.string(),
		commitSha: v.string(),
		generatedAt: v.string(),
		workosId: v.string(),
		repoStars: v.optional(v.number()),
		repoDescription: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<PushResult> => {
		const { workosId, repoStars, repoDescription, ...referenceData } = args;
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
			.query("reference")
			.withIndex("by_repositoryId_commitSha", (q) =>
				q.eq("repositoryId", repo._id).eq("commitSha", args.commitSha),
			)
			.first();

		if (existing) {
			return {
				success: false,
				error: "commit_already_exists",
				message: "A reference already exists for this commit",
			};
		}

		// 5. Insert new reference (no updates, immutable by commit)
		await ctx.db.insert("reference", {
			repositoryId: repo._id,
			referenceName: referenceData.referenceName,
			referenceDescription: referenceData.referenceDescription,
			referenceContent: referenceData.referenceContent,
			commitSha: referenceData.commitSha,
			generatedAt: referenceData.generatedAt,
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
	args: { fullName: v.string(), referenceName: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repository")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return;

		const referenceName = args.referenceName;
		const ref = referenceName
			? await ctx.db
					.query("reference")
					.withIndex("by_repositoryId_referenceName", (q) =>
						q.eq("repositoryId", repo._id).eq("referenceName", referenceName),
					)
					.first()
			: await ctx.db
					.query("reference")
					.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
					.first();

		if (ref) {
			await ctx.db.patch(ref._id, {
				pullCount: ref.pullCount + 1,
			});
		}
	},
});
