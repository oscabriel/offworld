import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, query } from "./_generated/server";

/**
 * Architecture Entities CRUD Operations
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all entities for a repository
 */
export const listByRepo = query({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("architectureEntities")
			.withIndex("by_repository", (q) => q.eq("repositoryId", args.repoId))
			.collect();
	},
});

/**
 * Get entities by type (package, module, component, etc.)
 */
export const listByType = query({
	args: {
		repoId: v.id("repositories"),
		type: v.union(
			v.literal("package"),
			v.literal("module"),
			v.literal("component"),
			v.literal("service"),
			v.literal("directory"),
		),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("architectureEntities")
			.withIndex("by_type", (q) =>
				q.eq("repositoryId", args.repoId).eq("type", args.type),
			)
			.collect();
	},
});

/**
 * Get a specific entity by slug
 */
export const getBySlug = query({
	args: {
		repoId: v.id("repositories"),
		slug: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("architectureEntities")
			.withIndex("by_slug", (q) =>
				q.eq("repositoryId", args.repoId).eq("slug", args.slug),
			)
			.first();
	},
});

/**
 * Get entities by iteration (useful for progressive display)
 */
export const listByIteration = query({
	args: {
		repoId: v.id("repositories"),
		iteration: v.number(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("architectureEntities")
			.withIndex("by_iteration", (q) =>
				q.eq("repositoryId", args.repoId).eq("iteration", args.iteration),
			)
			.collect();
	},
});

/**
 * Get count of entities by type
 */
export const getEntityCounts = query({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const entities = await ctx.db
			.query("architectureEntities")
			.withIndex("by_repository", (q) => q.eq("repositoryId", args.repoId))
			.collect();

		return {
			total: entities.length,
			packages: entities.filter((e) => e.type === "package").length,
			modules: entities.filter((e) => e.type === "module").length,
			components: entities.filter((e) => e.type === "component").length,
			services: entities.filter((e) => e.type === "service").length,
			directories: entities.filter((e) => e.type === "directory").length,
		};
	},
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a single entity
 */
export const create = internalMutation({
	args: {
		repoId: v.id("repositories"),
		type: v.union(
			v.literal("package"),
			v.literal("module"),
			v.literal("component"),
			v.literal("service"),
			v.literal("directory"),
		),
		name: v.string(),
		slug: v.string(),
		path: v.string(),
		description: v.string(),
		purpose: v.string(),
		dependencies: v.array(v.string()),
		usedBy: v.array(v.string()),
		keyFiles: v.array(v.string()),
		complexity: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
		),
		iteration: v.number(),
		codeSnippet: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { repoId, ...entity } = args;
		return await ctx.db.insert("architectureEntities", {
			repositoryId: repoId,
			...entity,
		});
	},
});

/**
 * Create multiple entities in batch
 */
export const createBatch = internalMutation({
	args: {
		repoId: v.id("repositories"),
		entities: v.array(
			v.object({
				type: v.union(
					v.literal("package"),
					v.literal("module"),
					v.literal("component"),
					v.literal("service"),
					v.literal("directory"),
				),
				name: v.string(),
				slug: v.string(),
				path: v.string(),
				description: v.string(),
				purpose: v.string(),
				dependencies: v.array(v.string()),
				usedBy: v.optional(v.array(v.string())),
				keyFiles: v.array(v.string()),
				complexity: v.union(
					v.literal("low"),
					v.literal("medium"),
					v.literal("high"),
				),
				iteration: v.number(),
				codeSnippet: v.optional(v.string()),

				// NEW OPTIONAL FIELDS (Phase 4C)
				dataFlow: v.optional(
					v.object({
						entry: v.string(),
						processing: v.array(v.string()),
						output: v.string(),
						narrative: v.string(),
					}),
				),
				githubUrl: v.optional(v.string()),
				layer: v.optional(
					v.union(
						v.literal("public"),
						v.literal("internal"),
						v.literal("extension"),
						v.literal("utility"),
					),
				),
				importance: v.optional(v.number()),
				rank: v.optional(v.number()),
				relatedGroup: v.optional(v.string()),
				relatedEntities: v.optional(v.array(v.string())),
			}),
		),
	},
	handler: async (ctx, args) => {
		const ids: Id<"architectureEntities">[] = [];

		for (const entity of args.entities) {
			const id = await ctx.db.insert("architectureEntities", {
				repositoryId: args.repoId,
				...entity,
				usedBy: entity.usedBy || [],
				relatedEntities: entity.relatedEntities || [],
			});
			ids.push(id);
		}

		return ids;
	},
});

/**
 * Delete all entities for a repository
 */
export const deleteByRepo = internalMutation({
	args: {
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const entities = await ctx.db
			.query("architectureEntities")
			.withIndex("by_repository", (q) =>
				q.eq("repositoryId", args.repositoryId),
			)
			.collect();

		for (const entity of entities) {
			await ctx.db.delete(entity._id);
		}

		return entities.length;
	},
});

/**
 * Update an entity's dependencies/usedBy
 */
export const updateRelationships = internalMutation({
	args: {
		entityId: v.id("architectureEntities"),
		dependencies: v.optional(v.array(v.string())),
		usedBy: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const updates: Partial<Doc<"architectureEntities">> = {};

		if (args.dependencies !== undefined) {
			updates.dependencies = args.dependencies;
		}

		if (args.usedBy !== undefined) {
			updates.usedBy = args.usedBy;
		}

		await ctx.db.patch(args.entityId, updates);
	},
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Consolidate entities to top N most important
 * Filters from 50+ entities down to 5-15 major architectural entities
 * Generates GitHub URLs and ranks entities by importance
 */
export const consolidateEntities = internalAction({
	args: {
		entities: v.array(v.any()),
		owner: v.string(),
		repoName: v.string(),
		defaultBranch: v.string(),
		fileCount: v.number(),
		actualFilePaths: v.array(v.string()), // NEW: Actual GitHub file paths for validation
	},
	handler: async (_ctx, args) => {
		// 1. Calculate dynamic entity limit based on repo size
		const maxEntities =
			args.fileCount < 50
				? 5
				: args.fileCount < 200
					? 8
					: args.fileCount < 500
						? 12
						: 15;

		// 2. Sort all entities by importance score (descending)
		// biome-ignore lint/suspicious/noExplicitAny: Entity structure is validated by aiValidation.ts
		const sorted = [...args.entities].sort((a: any, b: any) => {
			const importanceA = a.importance ?? 0;
			const importanceB = b.importance ?? 0;
			return importanceB - importanceA;
		});

		// 3. Filter to top N by importance
		const topEntities = sorted.slice(0, maxEntities);

		// 4. Validate paths and generate GitHub URLs
		// biome-ignore lint/suspicious/noExplicitAny: Entity structure is validated by aiValidation.ts
		const withValidatedUrls = topEntities.map((entity: any, index: number) => {
			// Validate entity path against actual file tree
			const validatedPath = findBestPathMatch(
				entity.path,
				args.actualFilePaths,
			);
			const finalPath = validatedPath || entity.path;

			// Log corrections for debugging
			if (validatedPath && validatedPath !== entity.path) {
				console.log(`✓ Path corrected: ${entity.path} → ${validatedPath}`);
			} else if (
				!validatedPath &&
				!args.actualFilePaths.includes(entity.path)
			) {
				console.warn(`⚠ Could not validate path: ${entity.path}`);
			}

			// Validate keyFiles paths
			const validatedKeyFiles =
				entity.keyFiles?.map((file: string) => {
					const validFile = findBestPathMatch(file, args.actualFilePaths);
					if (validFile && validFile !== file) {
						console.log(`✓ File path corrected: ${file} → ${validFile}`);
					}
					return validFile || file;
				}) || [];

			return {
				...entity,
				rank: index + 1,
				path: finalPath,
				keyFiles: validatedKeyFiles,
				githubUrl: `https://github.com/${args.owner}/${args.repoName}/tree/${args.defaultBranch}/${finalPath}`,
			};
		});

		console.log(
			`Consolidated ${args.entities.length} entities → ${withValidatedUrls.length} major entities (limit: ${maxEntities} for ${args.fileCount} files)`,
		);

		return withValidatedUrls;
	},
});

// ============================================================================
// PATH VALIDATION HELPERS
// ============================================================================

/**
 * Find best matching actual path for LLM-generated path
 * Handles case-insensitivity, monorepo package confusion, typos
 * Exported for use in issue analysis validation
 */
export function findBestPathMatch(
	llmPath: string,
	actualPaths: string[],
): string | null {
	// 1. Exact match (ideal case)
	if (actualPaths.includes(llmPath)) {
		return llmPath;
	}

	// 2. Case-insensitive match (LLM might use wrong case)
	const lowerLlmPath = llmPath.toLowerCase();
	const caseMatch = actualPaths.find((p) => p.toLowerCase() === lowerLlmPath);
	if (caseMatch) {
		return caseMatch;
	}

	// 3. Filename match (monorepo package confusion: "router/src/index.ts" vs "router-core/src/index.ts")
	const llmSegments = llmPath.split("/");
	const llmFileName = llmSegments[llmSegments.length - 1];

	if (llmFileName) {
		const filenameMatches = actualPaths.filter(
			(p) => p.endsWith(`/${llmFileName}`) || p === llmFileName,
		);

		// If exactly one match, use it
		if (filenameMatches.length === 1) {
			return filenameMatches[0];
		}

		// If multiple matches, apply priority-based selection
		if (filenameMatches.length > 1) {
			// Strategy 1: Prefer paths with similar directory structure
			const structuralMatch = filenameMatches.find((p) => {
				const pSegments = p.split("/");
				return llmSegments
					.slice(0, -1)
					.some((seg, i) =>
						pSegments[i]?.toLowerCase().includes(seg.toLowerCase()),
					);
			});
			if (structuralMatch) return structuralMatch;

			// Strategy 2: Prefer latest version (v4 > v3, exclude bench/test/legacy)
			const scoredMatches = filenameMatches.map((p) => ({
				path: p,
				score: calculatePathPreferenceScore(p),
			}));
			scoredMatches.sort((a, b) => b.score - a.score);

			// Return highest scoring match
			return scoredMatches[0].path;
		}
	}

	// 4. Directory match (path is a directory like "packages/router")
	if (!llmPath.includes(".")) {
		// Check if it's a valid directory prefix
		const dirMatches = actualPaths.filter((p) => p.startsWith(`${llmPath}/`));
		if (dirMatches.length > 0) {
			// Valid directory, keep as-is
			return llmPath;
		}
	}

	// 5. Fuzzy match by similarity (for typos like "ruter" vs "router")
	let bestMatch: string | null = null;
	let bestScore = 0;

	for (const actualPath of actualPaths) {
		const score = calculatePathSimilarity(llmPath, actualPath);
		if (score > 0.8 && score > bestScore) {
			bestScore = score;
			bestMatch = actualPath;
		}
	}

	if (bestMatch) {
		return bestMatch;
	}

	// Could not validate - return null to signal warning
	return null;
}

/**
 * Calculate similarity between two paths (0.0 to 1.0)
 * Based on shared path segments
 */
function calculatePathSimilarity(pathA: string, pathB: string): number {
	const segmentsA = new Set(pathA.toLowerCase().split(/[/.]/));
	const segmentsB = new Set(pathB.toLowerCase().split(/[/.]/));

	const intersection = new Set([...segmentsA].filter((x) => segmentsB.has(x)));
	const union = new Set([...segmentsA, ...segmentsB]);

	// Jaccard similarity
	return intersection.size / union.size;
}

/**
 * Score path preference (higher = better)
 * Prefer: latest versions, src directories, exclude test/bench/legacy
 */
function calculatePathPreferenceScore(path: string): number {
	let score = 0;
	const lower = path.toLowerCase();

	// Penalty: test/bench/legacy/deprecated paths (strongly discouraged)
	if (lower.includes("/bench/")) score -= 1000;
	if (lower.includes("/test/")) score -= 800;
	if (lower.includes("/__tests__/")) score -= 800;
	if (lower.includes("/legacy/")) score -= 600;
	if (lower.includes("/deprecated/")) score -= 600;
	if (lower.includes("/old/")) score -= 400;

	// Version priority: v4 > v3 > v2 > v1
	if (lower.includes("/v4/")) score += 400;
	else if (lower.includes("/v3/")) score += 300;
	else if (lower.includes("/v2/")) score += 200;
	else if (lower.includes("/v1/")) score += 100;

	// Bonus: src directories (main source code)
	if (lower.includes("/src/")) score += 100;

	// Bonus: main/core packages
	if (lower.includes("-core/")) score += 50;
	if (lower.includes("/main/")) score += 50;

	// Penalty: examples/docs (not main source)
	if (lower.includes("/examples/")) score -= 200;
	if (lower.includes("/docs/")) score -= 100;

	return score;
}
