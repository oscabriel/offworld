import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

/**
 * Create authenticated Octokit instance using GitHub App credentials
 */
function getOctokit() {
	const appId = process.env.GITHUB_APP_ID;
	const privateKey = process.env.GITHUB_PRIVATE_KEY;
	const installationId = process.env.GITHUB_INSTALLATION_ID;

	if (!appId || !privateKey || !installationId) {
		throw new Error(
			"Missing GitHub App credentials. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, and GITHUB_INSTALLATION_ID",
		);
	}

	const octokit = new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: Number.parseInt(appId, 10),
			privateKey: privateKey,
			installationId: Number.parseInt(installationId, 10),
		},
	});

	return octokit;
}

/**
 * Fetch repository metadata from GitHub
 */
export const fetchRepoMetadata = internalAction({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			const { data: repo } = await octokit.repos.get({
				owner: args.owner,
				repo: args.name,
			});

			return {
				owner: repo.owner.login,
				name: repo.name,
				fullName: repo.full_name,
				description: repo.description || undefined,
				stars: repo.stargazers_count,
				language: repo.language || undefined,
				githubUrl: repo.html_url,
				defaultBranch: repo.default_branch,
			};
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				error.status === 404
			) {
				throw new Error(`Repository ${args.owner}/${args.name} not found`);
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch repository: ${message}`);
		}
	},
});

/**
 * Fetch file tree from GitHub repository
 */
export const fetchFileTree = internalAction({
	args: {
		owner: v.string(),
		name: v.string(),
		branch: v.string(),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			// Get the tree recursively
			const { data: ref } = await octokit.git.getRef({
				owner: args.owner,
				repo: args.name,
				ref: `heads/${args.branch}`,
			});

			const { data: tree } = await octokit.git.getTree({
				owner: args.owner,
				repo: args.name,
				tree_sha: ref.object.sha,
				recursive: "true", // Get all files recursively
			});

			// Filter to only files (not trees/subdirectories) with supported extensions
			const supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".md"];
			const files = tree.tree
				.filter((item) => {
					if (item.type !== "blob") return false;
					if (!item.path) return false;

					// Exclude patterns
					const excludePatterns = [
						/node_modules/,
						/\.test\.(ts|tsx|js|jsx)$/,
						/\.spec\.(ts|tsx|js|jsx)$/,
						/__tests__/,
						/\/tests?\//,
						/\/examples?\//,
						/\/demos?\//,
						/\.lock$/,
						/package-lock\.json$/,
						/yarn\.lock$/,
						/\.github\//,
						/dist\//,
						/build\//,
						/\.min\./,
						/\.map$/,
					];

					if (
						excludePatterns.some((pattern) => pattern.test(item.path as string))
					) {
						return false;
					}

					return supportedExtensions.some((ext) => item.path?.endsWith(ext));
				})
				.map((item) => ({
					path: item.path as string,
					sha: item.sha as string,
					size: item.size || 0,
					url: item.url as string,
				}));

			return {
				files,
				totalCount: files.length,
			};
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch file tree: ${message}`);
		}
	},
});

/**
 * Fetch file content from GitHub
 */
export const fetchFileContent = internalAction({
	args: {
		owner: v.string(),
		name: v.string(),
		path: v.string(),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			const { data } = await octokit.repos.getContent({
				owner: args.owner,
				repo: args.name,
				path: args.path,
			});

			if (Array.isArray(data) || data.type !== "file") {
				throw new Error(`${args.path} is not a file`);
			}

			// Decode base64 content (Convex doesn't have Buffer, use browser APIs)
			const binaryString = atob(data.content);
			const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
			const content = new TextDecoder().decode(bytes);

			return {
				path: data.path,
				content,
				size: data.size,
				sha: data.sha,
			};
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch file ${args.path}: ${message}`);
		}
	},
});

/**
 * Fetch issues with "good first issue" or "help wanted" labels
 */
export const fetchIssues = internalAction({
	args: {
		owner: v.string(),
		name: v.string(),
		labels: v.optional(v.array(v.string())),
		state: v.optional(
			v.union(v.literal("open"), v.literal("closed"), v.literal("all")),
		),
		perPage: v.optional(v.number()),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			const { data: issues } = await octokit.issues.listForRepo({
				owner: args.owner,
				repo: args.name,
				labels: args.labels?.join(","),
				state: args.state || "open",
				per_page: args.perPage || 30,
				sort: "updated",
				direction: "desc",
			});

			return issues.map((issue) => ({
				githubIssueId: issue.id,
				number: issue.number,
				title: issue.title,
				body: issue.body || undefined,
				labels: issue.labels.map((label) =>
					typeof label === "string" ? label : label.name || "",
				),
				state: issue.state,
				githubUrl: issue.html_url,
				createdAt: new Date(issue.created_at).getTime(),
				updatedAt: new Date(issue.updated_at).getTime(),
			}));
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch issues: ${message}`);
		}
	},
});

/**
 * Fetch, analyze, and store issues in one action
 * This avoids keeping large arrays in workflow state
 */
export const analyzeAndStoreIssues = internalAction({
	args: {
		repoId: v.id("repositories"),
		owner: v.string(),
		name: v.string(),
		summary: v.string(),
		maxIssues: v.number(),
	},
	handler: async (ctx, args) => {
		// Fetch issues
		const issuesData = await ctx.runAction(internal.github.fetchIssues, {
			owner: args.owner,
			name: args.name,
			labels: undefined,
			state: "open",
			perPage: 20,
		});

		// Analyze issues in batches
		const analyzedIssues: Array<{
			repositoryId: Id<"repositories">;
			githubIssueId: number;
			number: number;
			title: string;
			body?: string;
			labels: string[];
			state: string;
			githubUrl: string;
			createdAt: number;
			updatedAt: number;
			aiSummary?: string;
			filesLikelyTouched?: string[];
			difficulty?: number;
			skillsRequired?: string[];
		}> = [];

		const issuesToAnalyze = issuesData.slice(0, args.maxIssues);

		for (const issue of issuesToAnalyze) {
			const analysis = await ctx.runAction(internal.gemini.analyzeIssue, {
				issueTitle: issue.title,
				issueBody: issue.body,
				labels: issue.labels,
				repoContext: args.summary,
			});

			analyzedIssues.push({
				...issue,
				...analysis,
				repositoryId: args.repoId,
			});
		}

		// Store issues
		await ctx.runMutation(internal.repos.storeIssues, {
			repoId: args.repoId,
			issues: analyzedIssues,
		});

		return analyzedIssues.length;
	},
});

/**
 * Fetch owner (user or organization) information from GitHub
 */
export const fetchOwnerInfo = internalAction({
	args: {
		owner: v.string(),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			// Try fetching as user first
			const { data: user } = await octokit.users.getByUsername({
				username: args.owner,
			});

			return {
				login: user.login,
				name: user.name || user.login,
				avatarUrl: user.avatar_url,
				bio: user.bio || undefined,
				type: user.type.toLowerCase() as "user" | "organization",
				publicRepos: user.public_repos,
				followers: user.followers || undefined,
				following: user.following || undefined,
				htmlUrl: user.html_url,
			};
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				error.status === 404
			) {
				throw new Error(`User or organization ${args.owner} not found`);
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch owner info: ${message}`);
		}
	},
});

/**
 * Fetch all public repositories for a user or organization
 */
export const fetchOwnerRepos = internalAction({
	args: {
		owner: v.string(),
		perPage: v.optional(v.number()),
		sort: v.optional(
			v.union(
				v.literal("created"),
				v.literal("updated"),
				v.literal("pushed"),
				v.literal("full_name"),
			),
		),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			// Fetch repos - works for both users and orgs
			const { data: repos } = await octokit.repos.listForUser({
				username: args.owner,
				per_page: args.perPage || 30,
				sort: args.sort || "updated",
			});

			return repos.map((repo) => ({
				owner: repo.owner.login,
				name: repo.name,
				fullName: repo.full_name,
				description: repo.description || undefined,
				stars: repo.stargazers_count,
				language: repo.language || undefined,
				githubUrl: repo.html_url,
				defaultBranch: repo.default_branch,
				updatedAt: repo.updated_at
					? new Date(repo.updated_at).getTime()
					: Date.now(),
			}));
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				error.status === 404
			) {
				throw new Error(`Repositories for ${args.owner} not found`);
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch repositories: ${message}`);
		}
	},
});
