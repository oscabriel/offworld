import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { getUser } from "./auth";

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
				fileUrls: v.optional(
					v.array(
						v.object({
							path: v.string(),
							url: v.string(),
						}),
					),
				),
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
				fileUrls: issue.fileUrls,
				difficulty: issue.difficulty,
				skillsRequired: issue.skillsRequired,
			});

			issueIds.push(issueId);
		}

		return issueIds;
	},
});

/**
 * Store pull requests for a repository
 */
export const storePullRequests = internalMutation({
	args: {
		repoId: v.id("repositories"),
		pullRequests: v.array(
			v.object({
				repositoryId: v.id("repositories"),
				githubPrId: v.number(),
				number: v.number(),
				title: v.string(),
				body: v.optional(v.string()),
				state: v.string(),
				author: v.string(),
				createdAt: v.number(),
				mergedAt: v.optional(v.number()),
				githubUrl: v.string(),
				filesChanged: v.array(v.string()),
				linesAdded: v.number(),
				linesDeleted: v.number(),
				aiSummary: v.optional(v.string()),
				difficulty: v.optional(v.number()),
				impactAreas: v.optional(v.array(v.string())),
				reviewComplexity: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const prIds = [];

		for (const pr of args.pullRequests) {
			const prId = await ctx.db.insert("pullRequests", {
				repositoryId: args.repoId,
				githubPrId: pr.githubPrId,
				number: pr.number,
				title: pr.title,
				body: pr.body,
				state: pr.state,
				author: pr.author,
				createdAt: pr.createdAt,
				mergedAt: pr.mergedAt,
				githubUrl: pr.githubUrl,
				filesChanged: pr.filesChanged,
				linesAdded: pr.linesAdded,
				linesDeleted: pr.linesDeleted,
				aiSummary: pr.aiSummary,
				difficulty: pr.difficulty,
				impactAreas: pr.impactAreas,
				reviewComplexity: pr.reviewComplexity,
			});

			prIds.push(prId);
		}

		return prIds;
	},
});

/**
 * Delete all issues for a repository
 */
export const deleteIssuesByRepo = internalMutation({
	args: {
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		for (const issue of issues) {
			await ctx.db.delete(issue._id);
		}

		return issues.length;
	},
});

/**
 * Reset repository metadata for re-indexing
 */
export const resetForReindex = internalMutation({
	args: {
		repoId: v.id("repositories"),
		owner: v.string(),
		name: v.string(),
		fullName: v.string(),
		description: v.optional(v.string()),
		stars: v.number(),
		language: v.optional(v.string()),
		githubUrl: v.string(),
		defaultBranch: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		await ctx.db.patch(args.repoId, {
			owner: args.owner,
			name: args.name,
			fullName: args.fullName,
			description: args.description,
			stars: args.stars,
			language: args.language,
			githubUrl: args.githubUrl,
			defaultBranch: args.defaultBranch,
			indexingStatus: "processing",
			summary: undefined,
			architecture: undefined,
			architectureNarrative: undefined,
			architectureMetadata: undefined,
			diagrams: undefined,
			errorMessage: undefined,
			indexedAt: now,
			lastAnalyzedAt: now,
		});

		return { success: true };
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
 * Update repository architecture with full metadata and diagrams
 */
export const updateArchitectureComplete = internalMutation({
	args: {
		repoId: v.id("repositories"),
		architecture: v.string(),
		architectureNarrative: v.optional(v.string()), // Phase 4C: Synthesized narrative
		architectureMetadata: v.object({
			totalIterations: v.number(),
			completedIterations: v.number(),
			discoveredPackages: v.number(),
			discoveredModules: v.number(),
			discoveredComponents: v.number(),
			lastIterationAt: v.number(),
		}),
		diagrams: v.object({
			architecture: v.string(),
			dataFlow: v.string(),
			routing: v.optional(v.string()),
		}),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			architecture: args.architecture,
			architectureNarrative: args.architectureNarrative,
			architectureMetadata: args.architectureMetadata,
			diagrams: args.diagrams,
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
 * Re-index repository: Clear all analysis data except conversations, then re-analyze
 * Preserves the repository record and user conversations
 */
export const reindexRepository = mutation({
	args: {
		fullName: v.string(),
		force: v.optional(v.boolean()), // If true, will re-index even if the repository was analyzed less than 7 days ago
	},
	handler: async (ctx, args) => {
		// Require authentication
		await getUser(ctx);

		return await reindexRepositoryInternal(ctx, args);
	},
});

/**
 * Internal re-index (no auth required - for dashboard/admin use)
 */
export const reindexRepositoryAdmin = internalMutation({
	args: {
		fullName: v.string(),
		force: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		return await reindexRepositoryInternal(ctx, args);
	},
});

/**
 * Shared re-index logic
 */
async function reindexRepositoryInternal(
	// biome-ignore lint/suspicious/noExplicitAny: Context type varies between mutation/internalMutation
	ctx: any,
	args: { fullName: string; force?: boolean },
) {
	// 1. Get the repository (case-insensitive)
	const allRepos = await ctx.db.query("repositories").collect();
	const repo = allRepos.find(
		// biome-ignore lint/suspicious/noExplicitAny: Query result type
		(r: any) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
	);

	if (!repo) {
		throw new Error("Repository not found");
	}

	// 2. Check if repository was analyzed in the last 7 days
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	if (
		repo.indexingStatus === "completed" &&
		repo.lastAnalyzedAt > sevenDaysAgo &&
		!args.force
	) {
		throw new Error(
			"Repository was analyzed less than 7 days ago. Please wait before re-indexing.",
		);
	}

	// 3. Prevent re-indexing if already processing
	if (repo.indexingStatus === "processing") {
		throw new Error(
			"Repository analysis is already in progress. Please wait for it to complete.",
		);
	}

	console.log(`Starting re-index for ${repo.fullName} (repoId: ${repo._id})`);

	// 4. Delete architecture entities
	const deletedEntities = await ctx.runMutation(
		// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder
		(internal as any).architectureEntities.deleteByRepo,
		{ repositoryId: repo._id },
	);
	console.log(`Deleted ${deletedEntities} architecture entities`);

	// 5. Delete issues
	const issues = await ctx.db
		.query("issues")
		.withIndex("repositoryId", (q: any) => q.eq("repositoryId", repo._id))
		.collect();
	for (const issue of issues) {
		await ctx.db.delete(issue._id);
	}
	console.log(`Deleted ${issues.length} issues`);

	// 6. RAG chunks will be cleared and re-ingested by the workflow
	// Note: Mutations can't call actions directly, so RAG clearing happens
	// during re-ingestion (chunks are overwritten with same file paths as keys)

	// 7. Keep conversations (as requested - they stay intact)

	// 8. Reset repository analysis fields
	await ctx.db.patch(repo._id, {
		indexingStatus: "processing",
		summary: undefined,
		architecture: undefined,
		architectureMetadata: undefined,
		diagrams: undefined,
		errorMessage: undefined,
		lastAnalyzedAt: Date.now(),
	});

	// 9. Start the workflow again
	const workflowResult = await ctx.runMutation(
		// biome-ignore lint/suspicious/noExplicitAny: WorkflowManager requires any type
		(internal as any).workflows.analyzeRepository.start,
		{
			owner: repo.owner,
			name: repo.name,
		},
	);

	console.log(
		`Re-index workflow started for ${repo.fullName}: ${workflowResult.workflowId}`,
	);

	return {
		workflowId: workflowResult.workflowId,
		status: "processing",
		message: `Re-indexing ${repo.fullName}`,
		deletedEntities,
		deletedIssues: issues.length,
	};
}

/**
 * Delete repository and all related data (for retry after failure)
 */
export const deleteRepository = mutation({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		// Get repository (case-insensitive)
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
		);

		if (!repo) {
			throw new Error("Repository not found");
		}

		// Delete all issues
		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();
		for (const issue of issues) {
			await ctx.db.delete(issue._id);
		}

		// Delete all architecture entities
		const entities = await ctx.db
			.query("architectureEntities")
			.withIndex("by_repository", (q) => q.eq("repositoryId", repo._id))
			.collect();
		for (const entity of entities) {
			await ctx.db.delete(entity._id);
		}

		// Delete all conversations
		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
			.collect();
		for (const conversation of conversations) {
			await ctx.db.delete(conversation._id);
		}

		// Delete the repository itself
		await ctx.db.delete(repo._id);

		return { success: true };
	},
});

/**
 * Get repository by full name (owner/name)
 * Case-insensitive: "tanstack/router" will find "TanStack/router"
 */
export const getByFullName = query({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		// Collect all repos and do case-insensitive comparison
		// This is acceptable since we have few repos; can optimize with fullNameLower index later
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
		);

		if (!repo) return null;

		// Get issues
		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();

		// Get pull requests
		const pullRequests = await ctx.db
			.query("pullRequests")
			.withIndex("by_repository", (q) => q.eq("repositoryId", repo._id))
			.collect();

		return {
			...repo,
			issueCount: issues.length,
			issues,
			pullRequestCount: pullRequests.length,
			pullRequests,
		};
	},
});

/**
 * Get repository by full name (owner/name) - INTERNAL VERSION for actions
 * Case-insensitive: "tanstack/router" will find "TanStack/router"
 */
export const getByFullNameInternal = internalQuery({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		// Collect all repos and do case-insensitive comparison
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
		);

		return repo || null;
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

		// Get pull requests
		const pullRequests = await ctx.db
			.query("pullRequests")
			.withIndex("by_repository", (q) => q.eq("repositoryId", args.repoId))
			.collect();

		return {
			...repo,
			issueCount: issues.length,
			issues,
			pullRequestCount: pullRequests.length,
			pullRequests,
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
		// Require authentication
		await getUser(ctx);

		// Parse GitHub URL
		const urlPattern =
			/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/;
		const match = args.repoUrl.match(urlPattern);

		if (!match) {
			throw new Error("Invalid GitHub repository URL");
		}

		const [, owner, name] = match;

		// Check if already exists (case-insensitive)
		const fullNameToCheck = `${owner}/${name}`;
		const allRepos = await ctx.db.query("repositories").collect();
		const existing = allRepos.find(
			(r) => r.fullName.toLowerCase() === fullNameToCheck.toLowerCase(),
		);

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
 * Validate and fetch repository metadata from GitHub
 * Used for client-side validation before navigation
 */
export const validateRepo = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		// Call the internal action to fetch from GitHub
		const metadata = await ctx.runAction(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(internal as any).github.fetchRepoMetadata,
			{
				owner: args.owner,
				name: args.name,
			},
		);

		return metadata;
	},
});

/**
 * Get repository metadata for display - fetches from DB if indexed, otherwise from GitHub
 * Caches GitHub metadata temporarily until repo is indexed
 */
export const getRepoMetadata = query({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const fullName = `${args.owner}/${args.name}`;

		// Check if repo exists in DB (case-insensitive)
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === fullName.toLowerCase(),
		);

		if (repo) {
			// Return DB data if indexed
			const issues = await ctx.db
				.query("issues")
				.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
				.collect();

			return {
				...repo,
				issueCount: issues.length,
				issues,
			};
		}

		// If not indexed, return null and let the action fetch from GitHub
		return null;
	},
});

/**
 * Fetch fresh GitHub metadata for unindexed repos
 */
export const fetchUnindexedRepoMetadata = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		// Call the internal action to fetch from GitHub
		const metadata = await ctx.runAction(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(internal as any).github.fetchRepoMetadata,
			{
				owner: args.owner,
				name: args.name,
			},
		);

		return {
			description: metadata.description,
			stars: metadata.stars,
			language: metadata.language,
			githubUrl: metadata.githubUrl,
		};
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
