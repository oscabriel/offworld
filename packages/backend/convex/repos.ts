import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { getUser } from "./auth";

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

export const updateArchitectureComplete = internalMutation({
	args: {
		repoId: v.id("repositories"),
		architecture: v.string(),
		architectureNarrative: v.optional(v.string()),
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

export const reindexRepository = mutation({
	args: {
		fullName: v.string(),
		force: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		await getUser(ctx);

		return await reindexRepositoryInternal(ctx, args);
	},
});

export const reindexRepositoryAdmin = internalMutation({
	args: {
		fullName: v.string(),
		force: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		return await reindexRepositoryInternal(ctx, args);
	},
});

async function reindexRepositoryInternal(
	ctx: MutationCtx,
	args: { fullName: string; force?: boolean },
) {
	const allRepos = await ctx.db.query("repositories").collect();
	const repo = allRepos.find(
		(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
	);

	if (!repo) {
		throw new Error("Repository not found");
	}

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

	if (repo.indexingStatus === "processing") {
		throw new Error(
			"Repository analysis is already in progress. Please wait for it to complete.",
		);
	}

	console.log(`Starting re-index for ${repo.fullName} (repoId: ${repo._id})`);

	const deletedEntities = await ctx.runMutation(
		// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder
		(internal as any).architectureEntities.deleteByRepo,
		{ repositoryId: repo._id },
	);
	console.log(`Deleted ${deletedEntities} architecture entities`);

	const issues = await ctx.db
		.query("issues")
		.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
		.collect();
	for (const issue of issues) {
		await ctx.db.delete(issue._id);
	}
	console.log(`Deleted ${issues.length} issues`);

	await ctx.db.patch(repo._id, {
		indexingStatus: "processing",
		summary: undefined,
		architecture: undefined,
		architectureMetadata: undefined,
		diagrams: undefined,
		errorMessage: undefined,
		lastAnalyzedAt: Date.now(),
	});

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

export const deleteRepository = mutation({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
		);

		if (!repo) {
			throw new Error("Repository not found");
		}

		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();
		for (const issue of issues) {
			await ctx.db.delete(issue._id);
		}

		const entities = await ctx.db
			.query("architectureEntities")
			.withIndex("by_repository", (q) => q.eq("repositoryId", repo._id))
			.collect();
		for (const entity of entities) {
			await ctx.db.delete(entity._id);
		}

		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
			.collect();
		for (const conversation of conversations) {
			await ctx.db.delete(conversation._id);
		}

		await ctx.db.delete(repo._id);

		return { success: true };
	},
});

export const getByFullName = query({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
		);

		if (!repo) return null;

		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", repo._id))
			.collect();

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

export const getByFullNameInternal = internalQuery({
	args: {
		fullName: v.string(),
	},
	handler: async (ctx, args) => {
		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === args.fullName.toLowerCase(),
		);

		return repo || null;
	},
});

export const getById = query({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const repo = await ctx.db.get(args.repoId);
		if (!repo) return null;

		const issues = await ctx.db
			.query("issues")
			.withIndex("repositoryId", (q) => q.eq("repositoryId", args.repoId))
			.collect();

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

export const startAnalysis = mutation({
	args: {
		repoUrl: v.string(),
	},
	handler: async (ctx, args) => {
		await getUser(ctx);

		const urlPattern =
			/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/;
		const match = args.repoUrl.match(urlPattern);

		if (!match) {
			throw new Error("Invalid GitHub repository URL");
		}

		const [, owner, name] = match;

		const fullNameToCheck = `${owner}/${name}`;
		const allRepos = await ctx.db.query("repositories").collect();
		const existing = allRepos.find(
			(r) => r.fullName.toLowerCase() === fullNameToCheck.toLowerCase(),
		);

		if (existing) {
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

			if (existing.indexingStatus === "processing") {
				return {
					repoId: existing._id,
					status: "processing",
					message: "Repository analysis already in progress",
				};
			}
		}

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

export const getOwnerInfo = action({
	args: {
		owner: v.string(),
	},
	handler: async (ctx, args) => {
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

export const validateRepo = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
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

export const getRepoMetadata = query({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const fullName = `${args.owner}/${args.name}`;

		const allRepos = await ctx.db.query("repositories").collect();
		const repo = allRepos.find(
			(r) => r.fullName.toLowerCase() === fullName.toLowerCase(),
		);

		if (repo) {
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

		return null;
	},
});

export const fetchUnindexedRepoMetadata = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
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

export const getOwnerRepos = action({
	args: {
		owner: v.string(),
		perPage: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const repos = await ctx.runAction(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(internal as any).github.fetchOwnerRepos,
			{
				owner: args.owner,
				perPage: args.perPage || 30,
				sort: "updated",
			},
		);

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
