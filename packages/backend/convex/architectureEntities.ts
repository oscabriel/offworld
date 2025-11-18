import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, query } from "./_generated/server";
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
				keyFileUrls: v.optional(
					v.array(
						v.object({
							path: v.string(),
							url: v.string(),
						}),
					),
				),
				complexity: v.union(
					v.literal("low"),
					v.literal("medium"),
					v.literal("high"),
				),
				iteration: v.number(),
				codeSnippet: v.optional(v.string()),
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
export const consolidateEntities = internalAction({
	args: {
		entities: v.array(v.any()),
		owner: v.string(),
		repoName: v.string(),
		defaultBranch: v.string(),
		fileCount: v.number(),
		actualFilePaths: v.array(v.string()),
	},
	handler: async (_ctx, args) => {
		const maxEntities =
			args.fileCount < 50
				? 5
				: args.fileCount < 200
					? 8
					: args.fileCount < 500
						? 12
						: 15;

		// biome-ignore lint/suspicious/noExplicitAny: Entity structure is validated by aiValidation.ts
		const sorted = [...args.entities].sort((a: any, b: any) => {
			const importanceA = a.importance ?? 0;
			const importanceB = b.importance ?? 0;
			return importanceB - importanceA;
		});

		const topEntities = sorted.slice(0, maxEntities);

		// biome-ignore lint/suspicious/noExplicitAny: Entity structure is validated by aiValidation.ts
		const withValidatedUrls = topEntities.map((entity: any, index: number) => {
			const validatedPath = findBestPathMatch(
				entity.path,
				args.actualFilePaths,
			);
			const finalPath = validatedPath || entity.path;

			if (validatedPath && validatedPath !== entity.path) {
				console.log(`✓ Path corrected: ${entity.path} → ${validatedPath}`);
			} else if (
				!validatedPath &&
				!args.actualFilePaths.includes(entity.path)
			) {
				console.warn(`⚠ Could not validate path: ${entity.path}`);
			}

			const validatedKeyFiles =
				entity.keyFiles?.map((file: string) => {
					const validFile = findBestPathMatch(file, args.actualFilePaths);
					if (validFile && validFile !== file) {
						console.log(`✓ File path corrected: ${file} → ${validFile}`);
					}
					return validFile || file;
				}) || [];

			const keyFileUrls = validatedKeyFiles.map((filePath: string) => {
				const isFile = filePath.includes(".");
				const urlType = isFile ? "blob" : "tree";
				return {
					path: filePath,
					url: `https://github.com/${args.owner}/${args.repoName}/${urlType}/${args.defaultBranch}/${filePath}`,
				};
			});

			return {
				...entity,
				rank: index + 1,
				path: finalPath,
				keyFiles: validatedKeyFiles,
				keyFileUrls,
				githubUrl: `https://github.com/${args.owner}/${args.repoName}/tree/${args.defaultBranch}/${finalPath}`,
			};
		});

		console.log(
			`Consolidated ${args.entities.length} entities → ${withValidatedUrls.length} major entities (limit: ${maxEntities} for ${args.fileCount} files)`,
		);

		return withValidatedUrls;
	},
});
export function findBestPathMatch(
	llmPath: string,
	actualPaths: string[],
): string | null {
	if (actualPaths.includes(llmPath)) {
		return llmPath;
	}

	const lowerLlmPath = llmPath.toLowerCase();
	const caseMatch = actualPaths.find((p) => p.toLowerCase() === lowerLlmPath);
	if (caseMatch) {
		return caseMatch;
	}

	const llmSegments = llmPath.split("/");
	const llmFileName = llmSegments[llmSegments.length - 1];

	if (llmFileName) {
		const filenameMatches = actualPaths.filter(
			(p) => p.endsWith(`/${llmFileName}`) || p === llmFileName,
		);

		if (filenameMatches.length === 1) {
			return filenameMatches[0];
		}

		if (filenameMatches.length > 1) {
			const structuralMatch = filenameMatches.find((p) => {
				const pSegments = p.split("/");
				return llmSegments
					.slice(0, -1)
					.some((seg, i) =>
						pSegments[i]?.toLowerCase().includes(seg.toLowerCase()),
					);
			});
			if (structuralMatch) return structuralMatch;

			const scoredMatches = filenameMatches.map((p) => ({
				path: p,
				score: calculatePathPreferenceScore(p),
			}));
			scoredMatches.sort((a, b) => b.score - a.score);

			return scoredMatches[0].path;
		}
	}

	if (!llmPath.includes(".")) {
		const dirMatches = actualPaths.filter((p) => p.startsWith(`${llmPath}/`));
		if (dirMatches.length > 0) {
			return llmPath;
		}
	}

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

	return null;
}
function calculatePathSimilarity(pathA: string, pathB: string): number {
	const segmentsA = new Set(pathA.toLowerCase().split(/[/.]/));
	const segmentsB = new Set(pathB.toLowerCase().split(/[/.]/));

	const intersection = new Set([...segmentsA].filter((x) => segmentsB.has(x)));
	const union = new Set([...segmentsA, ...segmentsB]);

	return intersection.size / union.size;
}
function calculatePathPreferenceScore(path: string): number {
	let score = 0;
	const lower = path.toLowerCase();

	if (lower.includes("/bench/")) score -= 1000;
	if (lower.includes("/test/")) score -= 800;
	if (lower.includes("/__tests__/")) score -= 800;
	if (lower.includes("/legacy/")) score -= 600;
	if (lower.includes("/deprecated/")) score -= 600;
	if (lower.includes("/old/")) score -= 400;

	if (lower.includes("/v4/")) score += 400;
	else if (lower.includes("/v3/")) score += 300;
	else if (lower.includes("/v2/")) score += 200;
	else if (lower.includes("/v1/")) score += 100;

	if (lower.includes("/src/")) score += 100;

	if (lower.includes("-core/")) score += 50;
	if (lower.includes("/main/")) score += 50;

	if (lower.includes("/examples/")) score -= 200;
	if (lower.includes("/docs/")) score -= 100;

	return score;
}
