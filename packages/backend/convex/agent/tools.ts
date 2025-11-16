import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Context type for codebase agent
 */
export type CodebaseAgentContext = {
	repositoryId: Id<"repositories">;
	userId?: string;
};

/**
 * Search for relevant code using RAG vector search
 */
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
		// Get repository info
		const repo = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.repos.getById,
			{ repoId: ctx.repositoryId },
		);

		if (!repo) return "Repository not found";

		const namespace = `repo:${repo.owner}/${repo.name}`;

		// Import RAG dynamically to avoid circular dependency
		const { rag } = await import("../rag");

		// Search using RAG
		const results = await rag.search(ctx, {
			namespace,
			query,
			limit: 10,
			vectorScoreThreshold: 0.7,
			chunkContext: { before: 1, after: 1 }, // Include surrounding chunks
		});

		if (!results.entries || results.entries.length === 0) {
			return "No relevant code found for this query.";
		}

		// RAG search returns a single text string with all results combined
		// and an entries array with metadata about each matching entry
		return `Found ${results.entries.length} relevant code sections:\n\n${results.text}`;
	},
});

/**
 * Get high-level architecture overview
 */
export const getArchitecture = createTool({
	description:
		"Get the high-level architecture overview of the repository. Use this when the user wants to understand the project structure or how different parts connect.",
	args: z.object({}),
	handler: async (ctx: ActionCtx & CodebaseAgentContext): Promise<string> => {
		const repo = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.repos.getById,
			{ repoId: ctx.repositoryId },
		);

		return repo?.architecture || "Architecture overview not yet generated";
	},
});

/**
 * Get repository summary
 */
export const getSummary = createTool({
	description:
		"Get the high-level summary of what this repository does. Use when the user first asks about the project.",
	args: z.object({}),
	handler: async (ctx: ActionCtx & CodebaseAgentContext): Promise<string> => {
		const repo = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.repos.getById,
			{ repoId: ctx.repositoryId },
		);

		return repo?.summary || "Summary not yet generated";
	},
});

/**
 * List files by pattern
 */
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
		// Get repository info
		const repo = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.repos.getById,
			{ repoId: ctx.repositoryId },
		);

		if (!repo) return "Repository not found";

		const namespace = `repo:${repo.owner}/${repo.name}`;

		// Import RAG dynamically
		const { rag } = await import("../rag");

		// Use RAG search with pattern as query
		const results = await rag.search(ctx, {
			namespace,
			query: pattern,
			limit: 50,
		});

		// Extract unique file paths
		const files = [...new Set(results.entries.map((entry) => entry.entryId))];

		if (files.length === 0) {
			return `No files found matching pattern: ${pattern}`;
		}

		return `Found ${files.length} files:\n${files.join("\n")}`;
	},
});

/**
 * Explain specific file in detail
 */
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
		const repo = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.repos.getById,
			{ repoId: ctx.repositoryId },
		);

		if (!repo) return "Repository not found";

		const namespace = `repo:${repo.owner}/${repo.name}`;

		// Import RAG dynamically
		const { rag } = await import("../rag");

		// Search for exact file match
		const results = await rag.search(ctx, {
			namespace,
			query: filePath,
			limit: 20,
		});

		// Check if we found any matching entries
		if (!results.entries || results.entries.length === 0) {
			return `File not found: ${filePath}`;
		}

		// Return the combined text from all matching chunks
		return `File: ${filePath}\n\n${results.text}`;
	},
});

/**
 * Find and analyze GitHub issues
 */
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
	}),
	handler: async (
		ctx: ActionCtx & CodebaseAgentContext,
		args,
	): Promise<string> => {
		const repo = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.repos.getById,
			{ repoId: ctx.repositoryId },
		);

		if (!repo?.issues || repo.issues.length === 0) {
			return "No issues found for this repository.";
		}

		let filteredIssues = repo.issues;

		// Filter by difficulty if specified
		if (args.difficulty !== undefined) {
			filteredIssues = filteredIssues.filter(
				(issue: { difficulty?: number }) =>
					issue.difficulty === args.difficulty,
			);
		}

		// Filter by topic if specified (search in title and AI summary)
		if (args.topic) {
			const topicLower = args.topic.toLowerCase();
			filteredIssues = filteredIssues.filter(
				(issue: { title: string; aiSummary?: string }) => {
					const titleMatch = issue.title.toLowerCase().includes(topicLower);
					const summaryMatch =
						issue.aiSummary?.toLowerCase().includes(topicLower) || false;
					return titleMatch || summaryMatch;
				},
			);
		}

		if (filteredIssues.length === 0) {
			return "No issues found matching criteria.";
		}

		return filteredIssues
			.map(
				(issue: {
					number: number;
					title: string;
					difficulty?: number;
					skillsRequired?: string[];
					filesLikelyTouched?: string[];
					aiSummary?: string;
				}) =>
					`#${issue.number}: ${issue.title}\n` +
					`Difficulty: ${issue.difficulty || "N/A"}/5\n` +
					`Skills: ${issue.skillsRequired?.join(", ") || "N/A"}\n` +
					`Files: ${issue.filesLikelyTouched?.join(", ") || "N/A"}\n` +
					`${issue.aiSummary || ""}`,
			)
			.join("\n\n---\n\n");
	},
});
