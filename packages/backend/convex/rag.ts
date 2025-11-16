import { RAG, defaultChunker } from "@convex-dev/rag";
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
