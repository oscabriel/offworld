import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
export type CodebaseAgentContext = {
	repositoryId: Id<"repositories">;
	userId?: string;
};
export const searchCodeContext = createTool({
	description:
		"Search the codebase for relevant code snippets related to a query. Use this when the user asks about specific functionality, patterns, or wants to find where something is implemented.",
	args: z.object({
		query: z
			.string()
			.describe(
				"What to search for in the codebase (e.g., 'authentication logic', 'database queries', 'error handling')",
			),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		{ query },
	): Promise<string> => {
		const repo = await ctx.runQuery(api.repos.getById, {
			repoId: ctx.repositoryId,
		});

		if (!repo) {
			return "Repository not found";
		}

		const namespace = `repo:${repo.owner}/${repo.name}`;

		const { rag } = await import("../rag");

		const results = await rag.search(ctx, {
			namespace,
			query,
			limit: 10,
			vectorScoreThreshold: 0.7,
			chunkContext: { before: 1, after: 1 },
		});

		if (!results.entries || results.entries.length === 0) {
			return "No relevant code found for this query.";
		}

		return `Found ${results.entries.length} relevant code sections:\n\n${results.text}`;
	},
});
export const getArchitecture = createTool({
	description:
		"Get the high-level architecture overview of the repository. Use this when the user wants to understand the project structure or how different parts connect.",
	args: z.object({}),
	handler: async (ctx: ActionCtx & CodebaseAgentContext): Promise<string> => {
		const repo = await ctx.runQuery(api.repos.getById, {
			repoId: ctx.repositoryId,
		});

		return repo?.architecture || "Architecture overview not yet generated";
	},
});
export const getSummary = createTool({
	description:
		"Get the high-level summary of what this repository does. Use when the user first asks about the project.",
	args: z.object({}),
	handler: async (ctx: ActionCtx & CodebaseAgentContext): Promise<string> => {
		const repo = await ctx.runQuery(api.repos.getById, {
			repoId: ctx.repositoryId,
		});

		return repo?.summary || "Summary not yet generated";
	},
});
export const listFiles = createTool({
	description:
		"List files in the repository matching a pattern. Use when the user wants to explore the project structure or find specific types of files.",
	args: z.object({
		pattern: z
			.string()
			.describe(
				"File pattern to search for (e.g., '*.test.ts', 'components/', 'src/api/')",
			),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		{ pattern },
	): Promise<string> => {
		const repo = await ctx.runQuery(api.repos.getById, {
			repoId: ctx.repositoryId,
		});

		if (!repo) return "Repository not found";

		const namespace = `repo:${repo.owner}/${repo.name}`;

		const { rag } = await import("../rag");

		const results = await rag.search(ctx, {
			namespace,
			query: pattern,
			limit: 50,
		});

		const files = [...new Set(results.entries.map((entry) => entry.entryId))];

		if (files.length === 0) {
			return `No files found matching pattern: ${pattern}`;
		}

		return `Found ${files.length} files:\n${files.join("\n")}`;
	},
});
export const explainFile = createTool({
	description:
		"Get detailed explanation of a specific file. Use when the user wants to understand what a particular file does.",
	args: z.object({
		filePath: z
			.string()
			.describe("Path to the file to explain (e.g., 'src/auth/login.ts')"),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		{ filePath },
	): Promise<string> => {
		const repo = await ctx.runQuery(api.repos.getById, {
			repoId: ctx.repositoryId,
		});

		if (!repo) return "Repository not found";

		const namespace = `repo:${repo.owner}/${repo.name}`;

		const { rag } = await import("../rag");

		const results = await rag.search(ctx, {
			namespace,
			query: filePath,
			limit: 20,
		});

		if (!results.entries || results.entries.length === 0) {
			return `File not found: ${filePath}`;
		}

		return `File: ${filePath}\n\n${results.text}`;
	},
});
export const findIssues = createTool({
	description:
		"Find GitHub issues related to a topic or difficulty level. Useful when the user wants to contribute or understand known problems.",
	args: z.object({
		topic: z
			.string()
			.optional()
			.describe(
				"Topic to search for in issues (e.g., 'authentication', 'routing')",
			),
		difficulty: z
			.number()
			.optional()
			.describe("Difficulty level 1-5, where 1 is easiest"),
		state: z
			.enum(["open", "closed", "all"])
			.optional()
			.describe("Filter by issue state (default: open)"),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		args,
	): Promise<string> => {
		const allIssues = await ctx.runQuery(api.issues.listByRepository, {
			repositoryId: ctx.repositoryId,
		});

		if (!allIssues || allIssues.length === 0) {
			return "No issues found for this repository.";
		}

		let filteredIssues = allIssues;

		const state = args.state || "open";
		if (state !== "all") {
			filteredIssues = filteredIssues.filter((issue) => issue.state === state);
		}

		if (args.difficulty !== undefined) {
			filteredIssues = filteredIssues.filter(
				(issue) => issue.difficulty === args.difficulty,
			);
		}

		if (args.topic) {
			const topicLower = args.topic.toLowerCase();
			filteredIssues = filteredIssues.filter((issue) => {
				const titleMatch = issue.title.toLowerCase().includes(topicLower);
				const summaryMatch =
					issue.aiSummary?.toLowerCase().includes(topicLower) || false;
				return titleMatch || summaryMatch;
			});
		}

		if (filteredIssues.length === 0) {
			return "No issues found matching criteria.";
		}

		return filteredIssues
			.slice(0, 10)
			.map(
				(issue) =>
					`#${issue.number}: ${issue.title}\n` +
					`State: ${issue.state}\n` +
					`Difficulty: ${issue.difficulty || "N/A"}/5\n` +
					`Skills: ${issue.skillsRequired?.join(", ") || "N/A"}\n` +
					`Files: ${issue.filesLikelyTouched?.join(", ") || "N/A"}\n` +
					`URL: ${issue.githubUrl}\n` +
					`${issue.aiSummary || ""}`,
			)
			.join("\n\n---\n\n");
	},
});
export const findPullRequests = createTool({
	description:
		"Find GitHub pull requests. Useful when the user wants to see recent changes or contributions.",
	args: z.object({
		state: z
			.enum(["open", "closed", "merged", "all"])
			.optional()
			.describe("Filter by PR state (default: all)"),
		limit: z
			.number()
			.optional()
			.describe("Maximum number of PRs to return (default: 10)"),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		args,
	): Promise<string> => {
		const allPRs = await ctx.runQuery(api.pullRequests.listByRepository, {
			repositoryId: ctx.repositoryId,
		});

		if (!allPRs || allPRs.length === 0) {
			return "No pull requests found for this repository.";
		}

		let filteredPRs = allPRs;

		if (args.state && args.state !== "all") {
			filteredPRs = filteredPRs.filter((pr) => pr.state === args.state);
		}

		if (filteredPRs.length === 0) {
			return `No ${args.state || ""} pull requests found.`;
		}

		const limit = args.limit || 10;
		return filteredPRs
			.slice(0, limit)
			.map(
				(pr) =>
					`#${pr.number}: ${pr.title}\n` +
					`State: ${pr.state}\n` +
					`Author: ${pr.author}\n` +
					`Changes: +${pr.linesAdded} -${pr.linesDeleted} (${pr.filesChanged} files)\n` +
					`URL: ${pr.githubUrl}`,
			)
			.join("\n\n---\n\n");
	},
});
export const getIssueByNumber = createTool({
	description:
		"Get details about a specific GitHub issue by its number. Use this when the user references a specific issue number (e.g., 'issue #123' or '#4510').",
	args: z.object({
		number: z
			.number()
			.describe("The issue number (e.g., 4510 for issue #4510)"),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		args,
	): Promise<string> => {
		const issue = await ctx.runQuery(api.issues.getByNumber, {
			repositoryId: ctx.repositoryId,
			number: args.number,
		});

		if (!issue) {
			return `Issue #${args.number} not found in this repository.`;
		}

		return (
			`#${issue.number}: ${issue.title}\n` +
			`State: ${issue.state}\n` +
			`Difficulty: ${issue.difficulty || "N/A"}/5\n` +
			`Skills: ${issue.skillsRequired?.join(", ") || "N/A"}\n` +
			`Files: ${issue.filesLikelyTouched?.join(", ") || "N/A"}\n` +
			`URL: ${issue.githubUrl}\n` +
			`\n${issue.aiSummary || issue.body || "No description available"}`
		);
	},
});
export const getPullRequestByNumber = createTool({
	description:
		"Get details about a specific GitHub pull request by its number. Use this when the user references a specific PR number (e.g., 'PR #456' or '#789').",
	args: z.object({
		number: z.number().describe("The PR number (e.g., 456 for PR #456)"),
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		args,
	): Promise<string> => {
		const pr = await ctx.runQuery(api.pullRequests.getByNumber, {
			repositoryId: ctx.repositoryId,
			number: args.number,
		});

		if (!pr) {
			return `Pull request #${args.number} not found in this repository.`;
		}

		return (
			`#${pr.number}: ${pr.title}\n` +
			`State: ${pr.state}\n` +
			`Author: ${pr.author}\n` +
			`Changes: +${pr.linesAdded} -${pr.linesDeleted} (${pr.filesChanged.length} files)\n` +
			`Files: ${pr.filesChanged.join(", ")}\n` +
			`URL: ${pr.githubUrl}\n` +
			`\n${pr.aiSummary || pr.body || "No description available"}`
		);
	},
});
