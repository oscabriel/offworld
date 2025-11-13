import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Smart file prioritization for large repositories
 * Returns top N files based on importance
 */
export const prioritizeFiles = internalAction({
	args: {
		files: v.array(
			v.object({
				path: v.string(),
				sha: v.string(),
				size: v.number(),
				url: v.string(),
			}),
		),
		maxFiles: v.number(),
	},
	handler: async (_ctx, args) => {
		const { files, maxFiles } = args;

		// If under limit, return all
		if (files.length <= maxFiles) {
			return files.map((f) => f.path);
		}

		// Priority files (always include)
		const priorityPatterns = [
			/^README\.md$/i,
			/^package\.json$/,
			/^tsconfig\.json$/,
			/^(src\/)?index\.(ts|tsx|js|jsx)$/,
			/^(src\/)?main\.(ts|tsx|js|jsx)$/,
		];

		const priorityFiles = files.filter((file) =>
			priorityPatterns.some((pattern) => pattern.test(file.path)),
		);

		// Calculate import count heuristic (files in common directories are likely imported more)
		const importanceScore = (path: string): number => {
			let score = 0;

			// Bonus for being in src/ or lib/
			if (/^(src|lib)\//.test(path)) score += 10;

			// Bonus for being in core directories
			if (/\/(core|utils|helpers|types|models)\//.test(path)) score += 5;

			// Penalty for being deeply nested
			const depth = path.split("/").length;
			score -= depth * 0.5;

			// Bonus for smaller files (easier to analyze)
			const fileSize = files.find((f) => f.path === path)?.size ?? 0;
			score += Math.max(0, 10 - fileSize / 10000);

			return score;
		};

		// Sort by importance
		const scoredFiles = files
			.filter((file) => !priorityFiles.some((pf) => pf.path === file.path))
			.map((file) => ({
				...file,
				score: importanceScore(file.path),
			}))
			.sort((a, b) => b.score - a.score);

		// Select top files
		const remainingSlots = maxFiles - priorityFiles.length;
		const selectedFiles = [
			...priorityFiles.map((f) => f.path),
			...scoredFiles.slice(0, remainingSlots).map((f) => f.path),
		];

		return selectedFiles;
	},
});

/**
 * Fetch and chunk files from GitHub repository
 */
export const chunkFiles = internalAction({
	args: {
		owner: v.string(),
		name: v.string(),
		filePaths: v.array(v.string()),
		maxFileSize: v.optional(v.number()), // Skip files larger than this
	},
	handler: async (ctx, args) => {
		const maxFileSize = args.maxFileSize || 100000; // 100KB default
		const chunks: Array<{
			filePath: string;
			content: string;
			startLine: number;
			endLine: number;
		}> = [];

		// Fetch files in batches
		const batchSize = 10;
		for (let i = 0; i < args.filePaths.length; i += batchSize) {
			const batch = args.filePaths.slice(i, i + batchSize);

			const fileContents = await Promise.all(
				batch.map(async (path) => {
					try {
						const file = await ctx.runAction(internal.github.fetchFileContent, {
							owner: args.owner,
							name: args.name,
							path,
						});

						// Skip files that are too large
						if (file.size > maxFileSize) {
							console.log(`Skipping ${path}: too large (${file.size} bytes)`);
							return null;
						}

						return file;
					} catch (error) {
						console.error(`Failed to fetch ${path}:`, error);
						return null;
					}
				}),
			);

			// Chunk each file
			for (const file of fileContents) {
				if (!file) continue;

				const lines = file.content.split("\n");
				const chunkSize = 100; // Lines per chunk

				// For small files, create single chunk
				if (lines.length <= chunkSize) {
					chunks.push({
						filePath: file.path,
						content: file.content,
						startLine: 1,
						endLine: lines.length,
					});
				} else {
					// Split into chunks with overlap
					const overlap = 10; // Lines of overlap between chunks
					for (
						let start = 0;
						start < lines.length;
						start += chunkSize - overlap
					) {
						const end = Math.min(start + chunkSize, lines.length);
						const chunkLines = lines.slice(start, end);

						chunks.push({
							filePath: file.path,
							content: chunkLines.join("\n"),
							startLine: start + 1,
							endLine: end,
						});

						// Break if we've reached the end
						if (end >= lines.length) break;
					}
				}
			}
		}

		return chunks;
	},
});

/**
 * Prepare text for embedding generation
 * Adds context about file path and line numbers
 */
export const prepareChunksForEmbedding = internalAction({
	args: {
		chunks: v.array(
			v.object({
				filePath: v.string(),
				content: v.string(),
				startLine: v.number(),
				endLine: v.number(),
			}),
		),
	},
	handler: async (_ctx, args) => {
		return args.chunks.map((chunk) => {
			const header = `File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n`;
			return header + chunk.content;
		});
	},
});

/**
 * Chunk files and store them immediately
 * Returns only the count to avoid large arrays in workflow state
 */
export const chunkAndStoreFiles = internalAction({
	args: {
		repoId: v.id("repositories"),
		owner: v.string(),
		name: v.string(),
		filePaths: v.array(v.string()),
		maxFileSize: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<number> => {
		const maxFileSize = args.maxFileSize || 100000;
		const chunks: Array<{
			filePath: string;
			content: string;
			startLine: number;
			endLine: number;
		}> = [];

		// Fetch files in batches and chunk them inline to avoid circular reference
		const batchSize = 10;
		for (let i = 0; i < args.filePaths.length; i += batchSize) {
			const batch = args.filePaths.slice(i, i + batchSize);

			const fileContents = await Promise.all(
				batch.map(async (path) => {
					try {
						const file = await ctx.runAction(internal.github.fetchFileContent, {
							owner: args.owner,
							name: args.name,
							path,
						});

						if (file.size > maxFileSize) {
							console.log(`Skipping ${path}: too large (${file.size} bytes)`);
							return null;
						}

						return file;
					} catch (error) {
						console.error(`Failed to fetch ${path}:`, error);
						return null;
					}
				}),
			);

			// Chunk each file
			for (const file of fileContents) {
				if (!file) continue;

				const lines = file.content.split("\n");
				const chunkSize = 100;

				if (lines.length <= chunkSize) {
					chunks.push({
						filePath: file.path,
						content: file.content,
						startLine: 1,
						endLine: lines.length,
					});
				} else {
					const overlap = 10;
					for (
						let start = 0;
						start < lines.length;
						start += chunkSize - overlap
					) {
						const end = Math.min(start + chunkSize, lines.length);
						const chunkLines = lines.slice(start, end);

						chunks.push({
							filePath: file.path,
							content: chunkLines.join("\n"),
							startLine: start + 1,
							endLine: end,
						});

						if (end >= lines.length) break;
					}
				}
			}
		}

		// Store chunks
		await ctx.runMutation(internal.repos.storeChunks, {
			repoId: args.repoId,
			chunks,
		});

		return chunks.length;
	},
});

/**
 * Generate embeddings and store them in the database
 * This avoids keeping large arrays in workflow state
 */
export const generateAndStoreEmbeddings = internalAction({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args): Promise<{ updated: number }> => {
		// Fetch all chunks for this repo from DB
		const chunks = await ctx.runQuery(internal.repos.getChunksForEmbedding, {
			repoId: args.repoId,
		});

		if (chunks.length === 0) {
			return { updated: 0 };
		}

		// Prepare chunks for embedding
		const textsForEmbedding = chunks.map(
			(chunk: {
				filePath: string;
				content: string;
				startLine: number;
				endLine: number;
			}) => {
				const header = `File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n`;
				return header + chunk.content;
			},
		);

		// Generate embeddings
		const embeddings = await ctx.runAction(internal.gemini.generateEmbeddings, {
			texts: textsForEmbedding,
		});

		// Update chunks with embeddings
		await ctx.runMutation(internal.repos.updateChunkEmbeddings, {
			repoId: args.repoId,
			embeddings,
		});

		return { updated: chunks.length };
	},
});
