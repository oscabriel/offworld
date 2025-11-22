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

type FilterTypes = {
	fileType: "entry-point" | "core" | "regular" | "documentation";
	priority: "high" | "medium" | "low";
	extension: string;
};

export const rag = new RAG<FilterTypes>(components.rag, {
	textEmbeddingModel: google.textEmbeddingModel("text-embedding-004"),
	embeddingDimension: 768,
	filterNames: ["fileType", "priority", "extension"],
});

export const clearNamespace = internalAction({
	args: {
		namespace: v.string(),
	},
	handler: async (ctx, args) => {
		const namespace = await rag.getNamespace(ctx, {
			namespace: args.namespace,
		});

		if (!namespace) {
			return { deletedCount: 0 };
		}

		let totalDeleted = 0;
		let hasMore = true;
		let cursor = null;

		while (hasMore) {
			const results = await rag.list(ctx, {
				namespaceId: namespace.namespaceId,
				paginationOpts: {
					cursor,
					numItems: 100,
				},
				status: "ready",
			});

			if (results.page.length === 0) {
				break;
			}

			const deletePromises = results.page.map((entry) =>
				rag.delete(ctx, { entryId: entry.entryId }).catch(() => null),
			);

			await Promise.all(deletePromises);
			totalDeleted += results.page.length;

			hasMore = !results.isDone;
			cursor = results.continueCursor;
		}

		return { deletedCount: totalDeleted };
	},
});

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

		const ragResult = await ctx.runAction(internal.rag.clearNamespace, {
			namespace: args.namespace,
		});
		results.ragEntries = ragResult.deletedCount;

		results.architectureEntities = await ctx.runMutation(
			internal.architectureEntities.deleteByRepo,
			{ repositoryId: args.repositoryId },
		);

		results.issues = await ctx.runMutation(internal.repos.deleteIssuesByRepo, {
			repositoryId: args.repositoryId,
		});

		results.conversations = await ctx.runMutation(
			internal.chat.deleteConversationsByRepo,
			{ repositoryId: args.repositoryId },
		);

		return results;
	},
});

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

		const eligibleFiles = args.files
			.filter((file) => !shouldExcludeFile(file.path, file.size))
			.map((file) => ({
				...file,
				importance: calculateImportance(file.path),
			}))
			.sort((a, b) => b.importance - a.importance)
			.slice(0, 500);

		for (const file of eligibleFiles) {
			if (shouldExcludeFile(file.path, file.size)) {
				continue;
			}

			const fileData = await ctx.runAction(
				// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder for internal
				(internal as any).github.fetchFileContent,
				{
					owner: args.owner,
					name: args.name,
					path: file.path,
				},
			);

			if (!fileData || !fileData.content) continue;

			const filterValues = getFilterValues(file.path);

			const chunks = defaultChunker(fileData.content, {
				minCharsSoftLimit: 500,
				maxCharsSoftLimit: 2500,
				maxCharsHardLimit: 12000,
				delimiter: "\n\n",
			});

			await rag.add(ctx, {
				namespace: args.namespace,
				key: file.path,
				chunks,
				importance: file.importance,
				filterValues,
			});

			filesProcessed++;
			chunksCreated += chunks.length;
		}

		return { filesProcessed, chunksCreated };
	},
});
