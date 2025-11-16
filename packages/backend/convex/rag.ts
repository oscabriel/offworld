import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { RAG } from "@convex-dev/rag";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
	calculateImportance,
	getFilterValues,
	shouldExcludeFile,
} from "./importance";

// Filter types for metadata
type FilterTypes = {
	fileType: "entry-point" | "core" | "regular" | "documentation";
	priority: "high" | "medium" | "low";
	extension: string;
};

/**
 * Create Google AI provider with our Gemini API key
 */
const google = createGoogleGenerativeAI({
	apiKey: process.env.GEMINI_API_KEY,
});

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
 * Replaces custom chunking logic with RAG's auto-chunking
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

		for (const file of args.files) {
			// Skip excluded files
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

			// Calculate importance and get filter values
			const importance = calculateImportance(file.path);
			const filterValues = getFilterValues(file.path);

			// Add to RAG with auto-chunking
			await rag.add(ctx, {
				namespace: args.namespace,
				key: file.path, // Unique key for updates
				text: fileData.content, // Extract the actual content string
				importance,
				filterValues,
			});

			filesProcessed++;
			chunksCreated += Math.ceil(fileData.content.length / 500); // Rough estimate
		}

		return { filesProcessed, chunksCreated };
	},
});
