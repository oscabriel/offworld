import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";

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
