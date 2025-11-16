import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";

/**
 * Create a new repository record
 */
export const createRepo = internalMutation({
	args: {
		owner: v.string(),
		name: v.string(),
		fullName: v.string(),
		description: v.optional(v.string()),
		stars: v.number(),
		language: v.optional(v.string()),
		githubUrl: v.string(),
		defaultBranch: v.string(),
		indexingStatus: v.union(
			v.literal("queued"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("failed"),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		const repoId = await ctx.db.insert("repositories", {
			owner: args.owner,
			name: args.name,
			fullName: args.fullName,
			description: args.description,
			stars: args.stars,
			language: args.language,
			githubUrl: args.githubUrl,
			defaultBranch: args.defaultBranch,
			indexedAt: now,
			lastAnalyzedAt: now,
			indexingStatus: args.indexingStatus,
		});

		return repoId;
	},
});

/**
 * Store code chunks for a repository
 */
/**
 * Store analyzed issues
 */
export const storeIssues = internalMutation({
	args: {
		repoId: v.id("repositories"),
		issues: v.array(
			v.object({
				repositoryId: v.id("repositories"),
				githubIssueId: v.number(),
				number: v.number(),
				title: v.string(),
				body: v.optional(v.string()),
				labels: v.array(v.string()),
				state: v.string(),
				githubUrl: v.string(),
				createdAt: v.number(),
				updatedAt: v.number(),
				aiSummary: v.optional(v.string()),
				filesLikelyTouched: v.optional(v.array(v.string())),
				difficulty: v.optional(v.number()),
				skillsRequired: v.optional(v.array(v.string())),
			}),
		),
	},
	handler: async (ctx, args) => {
		const issueIds = [];

		for (const issue of args.issues) {
			const issueId = await ctx.db.insert("issues", {
				repositoryId: args.repoId,
				githubIssueId: issue.githubIssueId,
				number: issue.number,
				title: issue.title,
				body: issue.body,
				labels: issue.labels,
				state: issue.state,
				githubUrl: issue.githubUrl,
				createdAt: issue.createdAt,
				updatedAt: issue.updatedAt,
				aiSummary: issue.aiSummary,
				filesLikelyTouched: issue.filesLikelyTouched,
				difficulty: issue.difficulty,
				skillsRequired: issue.skillsRequired,
			});

			issueIds.push(issueId);
		}

		return issueIds;
	},
});

/**
 * Update repository summary (progressive update)
 */
export const updateSummary = internalMutation({
	args: {
		repoId: v.id("repositories"),
		summary: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			summary: args.summary,
		});

		return { success: true };
	},
});

/**
 * Update repository architecture (progressive update)
 */
export const updateArchitecture = internalMutation({
	args: {
		repoId: v.id("repositories"),
		architecture: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			architecture: args.architecture,
		});

		return { success: true };
	},
});

/**
 * Finalize repository analysis
 */
export const finalizeAnalysis = internalMutation({
	args: {
		repoId: v.id("repositories"),
		status: v.union(v.literal("completed"), v.literal("failed")),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			indexingStatus: args.status,
			lastAnalyzedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Mark repository as failed
 */
export const markAsFailed = internalMutation({
	args: {
		repoId: v.id("repositories"),
		errorMessage: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			indexingStatus: "failed",
			errorMessage: args.errorMessage,
			lastAnalyzedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Get repository by full name (owner/name)
 */
export const getByFullName = query({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repositories")
			.withIndex("fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		if (!repo) return null;

		// Get issues
		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();

		return {
			...repo,
			issueCount: issues.length,
			issues,
		};
	},
});

/**
 * Get repository by full name (owner/name) - INTERNAL VERSION for actions
 */
export const getByFullNameInternal = internalQuery({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repositories")
			.withIndex("fullName", (q) => q.eq("fullName", args.fullName))
			.first();

		return repo;
	},
});

/**
 * Get repository by ID with related data
 */
export const getById = query({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const repo = await ctx.db.get(args.repoId);
		if (!repo) return null;

		// Get issues
		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repoId))
			.collect();

		return {
			...repo,
			issueCount: issues.length,
			issues,
		};
	},
});

/**
 * List all repositories
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const repos = await ctx.db
			.query("repositories")
			.withIndex("lastAnalyzedAt")
			.order("desc")
			.take(20);

		return repos;
	},
});

/**
 * Start repository analysis (public mutation)
 */
export const startAnalysis = mutation({
	args: {
		repoUrl: v.string(),
	},
	handler: async (ctx, args) => {
		// Parse GitHub URL
		const urlPattern =
			/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/;
		const match = args.repoUrl.match(urlPattern);

		if (!match) {
			throw new Error("Invalid GitHub repository URL");
		}

		const [, owner, name] = match;

		// Check if already exists
		const existing = await ctx.db
			.query("repositories")
			.withIndex("fullName", (q) => q.eq("fullName", `${owner}/${name}`))
			.first();

		if (existing) {
			// If completed less than 7 days ago, return existing
			const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
			if (
				existing.indexingStatus === "completed" &&
				existing.lastAnalyzedAt > sevenDaysAgo
			) {
				return {
					repoId: existing._id,
					status: "cached",
					message: "Repository recently analyzed, using cached results",
				};
			}

			// If processing, return status
			if (existing.indexingStatus === "processing") {
				return {
					repoId: existing._id,
					status: "processing",
					message: "Repository analysis already in progress",
				};
			}
		}

		// Start workflow via the workflow's start mutation
		const result = await ctx.runMutation(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder for internal
			(internal as any).workflows.analyzeRepository.start,
			{
				owner,
				name,
				userId: undefined,
			},
		);

		return {
			workflowId: result.workflowId,
			status: "queued",
			message: `Repository analysis started for ${owner}/${name}`,
		};
	},
});

/**
 * Fetch owner information from GitHub (public action)
 */
export const getOwnerInfo = action({
	args: {
		owner: v.string(),
	},
	handler: async (ctx, args) => {
		// Call the internal action to fetch from GitHub
		const ownerInfo = await ctx.runAction(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(internal as any).github.fetchOwnerInfo,
			{
				owner: args.owner,
			},
		);

		return ownerInfo;
	},
});

/**
 * Fetch owner's repositories from GitHub and check indexing status
 */
export const getOwnerRepos = action({
	args: {
		owner: v.string(),
		perPage: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Fetch repos from GitHub
		const repos = await ctx.runAction(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(internal as any).github.fetchOwnerRepos,
			{
				owner: args.owner,
				perPage: args.perPage || 30,
				sort: "updated",
			},
		);

		// For each repo, check if we have it indexed in our DB
		const reposWithStatus = await Promise.all(
			repos.map(
				async (repo: {
					owner: string;
					name: string;
					fullName: string;
					description?: string;
					stars: number;
					language?: string;
					githubUrl: string;
					defaultBranch: string;
					updatedAt: number;
				}) => {
					const indexed = await ctx.runQuery(
						internal.repos.getByFullNameInternal,
						{
							fullName: repo.fullName,
						},
					);

					return {
						...repo,
						isIndexed: indexed !== null,
						indexingStatus: indexed?.indexingStatus || null,
					};
				},
			),
		);

		return reposWithStatus;
	},
});
