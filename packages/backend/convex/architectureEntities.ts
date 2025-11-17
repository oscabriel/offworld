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

		// 4. Generate GitHub URLs and add rank field
		// biome-ignore lint/suspicious/noExplicitAny: Entity structure is validated by aiValidation.ts
		const withUrls = topEntities.map((entity: any, index: number) => ({
			...entity,
			rank: index + 1,
			githubUrl: `https://github.com/${args.owner}/${args.repoName}/tree/${args.defaultBranch}/${entity.path}`,
		}));

		console.log(
			`Consolidated ${args.entities.length} entities → ${withUrls.length} major entities (limit: ${maxEntities} for ${args.fileCount} files)`,
		);

		return withUrls;
	},
});
