import { defaultChunker, RAG } from "@convex-dev/rag";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
	calculateImportance,
	getFilterValues,
	shouldExcludeFile,
} from "./importance";
import { google } from "./lib/google";

// Filter types for metadata
type FilterTypes = {
	fileType: "entry-point" | "core" | "regular" | "documentation";
	priority: "high" | "medium" | "low";
	extension: string;
};

/**
 * RAG instance configured with Gemini embeddings
 */
export const rag = new RAG<FilterTypes>(components.rag, {
	textEmbeddingModel: google.textEmbeddingModel("text-embedding-004"),
	embeddingDimension: 768,
	filterNames: ["fileType", "priority", "extension"],
});

/**
 * Clear all documents from a specific namespace
 * Used when re-indexing a repository
 */
export const clearNamespace = internalAction({
	args: {
		namespace: v.string(),
	},
	handler: async (ctx, args) => {
		// First, get the namespaceId for this namespace
		const namespace = await rag.getNamespace(ctx, {
			namespace: args.namespace,
		});

		// If namespace doesn't exist, nothing to clear
		if (!namespace) {
			console.log(`Namespace ${args.namespace} not found - nothing to clear`);
			return { deletedCount: 0 };
		}

		let totalDeleted = 0;
		let hasMore = true;
		let cursor = null;

		// Paginate through all entries using list() instead of search()
		// list() is more efficient since it doesn't compute vector similarity
		while (hasMore) {
			const results = await rag.list(ctx, {
				namespaceId: namespace.namespaceId,
				paginationOpts: {
					cursor,
					numItems: 100, // Batch size
				},
				status: "ready", // Only delete ready entries
			});

			// If no results, we're done
			if (results.page.length === 0) {
				break;
			}

			// Delete this batch in parallel using Promise.all()
			const deletePromises = results.page.map((entry) =>
				rag.delete(ctx, { entryId: entry.entryId }).catch((error) => {
					console.warn(`Failed to delete RAG entry ${entry.entryId}:`, error);
					return null; // Continue with other deletions
				}),
			);

			await Promise.all(deletePromises);
			totalDeleted += results.page.length;

			// Check if we have more pages
			hasMore = !results.isDone;
			cursor = results.continueCursor;
		}

		console.log(
			`Cleared ${totalDeleted} documents from namespace ${args.namespace}`,
		);
		return { deletedCount: totalDeleted };
	},
});

/**
 * Complete cascading delete for a repository
 * Clears RAG entries, architecture entities, issues, and conversations
 */
export const clearNamespaceComplete = internalAction({
	args: {
		namespace: v.string(),
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const results = {
			ragEntries: 0,
			architectureEntities: 0,
			issues: 0,
			conversations: 0,
		};

		// 1. Clear RAG entries
		const ragResult = await ctx.runAction(internal.rag.clearNamespace, {
			namespace: args.namespace,
		});
		results.ragEntries = ragResult.deletedCount;

		// 2. Clear architecture entities
		results.architectureEntities = await ctx.runMutation(
			internal.architectureEntities.deleteByRepo,
			{ repositoryId: args.repositoryId },
		);

		// 3. Clear issues
		results.issues = await ctx.runMutation(internal.repos.deleteIssuesByRepo, {
			repositoryId: args.repositoryId,
		});

		// 4. Clear conversations
		results.conversations = await ctx.runMutation(
			internal.chat.deleteConversationsByRepo,
			{ repositoryId: args.repositoryId },
		);

		console.log(
			`Complete clear for ${args.namespace}: ${results.ragEntries} RAG entries, ${results.architectureEntities} entities, ${results.issues} issues, ${results.conversations} conversations`,
		);

		return results;
	},
});

/**
 * Ingest repository files into RAG component
 * Uses custom chunking with larger chunk sizes (~2000-2500 chars) for better storage efficiency
 */
export const ingestRepository = internalAction({
	args: {
		repoId: v.id("repositories"),
		namespace: v.string(),
		files: v.array(
			v.object({
				path: v.string(),
				sha: v.string(),
				size: v.number(),
				url: v.string(),
			}),
		),
		owner: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		let filesProcessed = 0;
		let chunksCreated = 0;

		// Filter and sort files by importance
		const eligibleFiles = args.files
			.filter((file) => !shouldExcludeFile(file.path, file.size))
			.map((file) => ({
				...file,
				importance: calculateImportance(file.path),
			}))
			.sort((a, b) => b.importance - a.importance)
			.slice(0, 500); // Limit to top 500 most important files

		for (const file of eligibleFiles) {
			// Skip excluded files (redundant check but safe)
			if (shouldExcludeFile(file.path, file.size)) {
				continue;
			}

			// Fetch file content from GitHub
			const fileData = await ctx.runAction(
				// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder for internal
				(internal as any).github.fetchFileContent,
				{
					owner: args.owner,
					name: args.name,
					path: file.path,
				},
			);

			// fetchFileContent returns an object with { path, content, size, sha }
			if (!fileData || !fileData.content) continue;

			// Use pre-calculated importance and get filter values
			const filterValues = getFilterValues(file.path);

			// Custom chunking with larger chunk sizes for better storage efficiency
			// Target ~2000-2500 chars per chunk (vs default 1000) to reduce total chunk count by ~60%
			// while maintaining good search quality for code
			const chunks = defaultChunker(fileData.content, {
				minCharsSoftLimit: 500, // Increased from 100 - allow larger minimum chunks
				maxCharsSoftLimit: 2500, // Increased from 1000 - target ~2000-2500 chars per chunk
				maxCharsHardLimit: 12000, // Increased from 10000 - allow larger chunks if needed
				delimiter: "\n\n", // Keep default paragraph separator
			});

			// Add to RAG with custom chunks
			await rag.add(ctx, {
				namespace: args.namespace,
				key: file.path, // Unique key for updates
				chunks, // Use custom chunking instead of auto-chunking
				importance: file.importance, // Use pre-calculated importance
				filterValues,
			});

			filesProcessed++;
			chunksCreated += chunks.length; // Actual chunk count
		}

		return { filesProcessed, chunksCreated };
	},
});
