import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal as internalApi } from "../_generated/api";
import { mutation } from "../_generated/server";

// Type assertion for internal API (will be properly typed when Convex dev runs in watch mode)
// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder
const internal = internalApi as any;

// Initialize workflow manager
// biome-ignore lint/suspicious/noExplicitAny: WorkflowManager requires any type for components
const workflow = new WorkflowManager(components.workflow as any);

/**
 * 11-Step Durable Workflow for Repository Analysis
 * Survives crashes, resumes from last completed step
 */
export const analyzeRepositoryWorkflow = workflow.define({
	args: {
		owner: v.string(),
		name: v.string(),
		userId: v.optional(v.string()),
	},
	handler: async (step, args) => {
		// Step 1: Fetch & validate GitHub metadata (~5-10 seconds)
		const metadata = await step.runAction(internal.github.fetchRepoMetadata, {
			owner: args.owner,
			name: args.name,
		});

		// Step 2: Create repo record (atomic mutation)
		const repoId = await step.runMutation(internal.repos.createRepo, {
			...metadata,
			indexingStatus: "processing",
		});

		try {
			// Step 3: Fetch file tree from GitHub (~10-30 seconds)
			const fileTreeResult = await step.runAction(
				internal.github.fetchFileTree,
				{
					owner: args.owner,
					name: args.name,
					branch: metadata.defaultBranch,
				},
			);

			// Step 4-7: Ingest repository into RAG component (~2-5 minutes)
			// Replaces custom chunking with RAG's auto-chunking + embedding generation
			const namespace = `repo:${args.owner}/${args.name}`;
			const ingestResult = await step.runAction(internal.rag.ingestRepository, {
				repoId,
				namespace,
				files: fileTreeResult.files,
				owner: args.owner,
				name: args.name,
			});

			// Step 8: Generate summary with Gemini (~30-60 seconds)
			// Uses RAG to fetch high-priority files for context
			const summary = await step.runAction(
				internal.gemini.generateRepoSummary,
				{
					repoId,
					repoName: metadata.fullName,
					description: metadata.description,
					language: metadata.language,
					fileCount: ingestResult.filesProcessed,
					namespace,
				},
			);

			// Update DB immediately so frontend sees summary (progressive update)
			await step.runMutation(internal.repos.updateSummary, {
				repoId,
				summary,
			});

			// Step 9: Generate architecture overview (~30-60 seconds)
			// Uses RAG component for context instead of file paths
			const architecture = await step.runAction(
				internal.gemini.generateArchitecture,
				{
					repoName: metadata.fullName,
					summary,
					namespace,
				},
			);

			// Update DB immediately so frontend sees architecture (progressive update)
			await step.runMutation(internal.repos.updateArchitecture, {
				repoId,
				architecture,
			});

			// Step 10: Analyze issues in batches to minimize workflow state
			// Fetch, analyze, and store issues without keeping large arrays in memory
			const issueCount = await step.runAction(
				internal.github.analyzeAndStoreIssues,
				{
					repoId,
					owner: args.owner,
					name: args.name,
					summary,
					maxIssues: 10,
				},
			);

			// Step 11: Finalize analysis (mark as completed)
			await step.runMutation(internal.repos.finalizeAnalysis, {
				repoId,
				status: "completed",
			});

			return {
				repoId,
				status: "completed",
				filesAnalyzed: ingestResult.filesProcessed,
				chunksCreated: ingestResult.chunksCreated,
				issuesAnalyzed: issueCount,
			};
		} catch (error: unknown) {
			// Mark repo as failed
			await step.runMutation(internal.repos.markAsFailed, {
				repoId,
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});

			throw error;
		}
	},
});

/**
 * Public mutation to start the repository analysis workflow
 */
export const start = mutation({
	args: {
		owner: v.string(),
		name: v.string(),
		userId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Use workflow.start with the workflow name as a string reference
		const handle = await workflow.start(
			ctx,
			// biome-ignore lint/suspicious/noExplicitAny: WorkflowManager.start requires any type for workflow reference
			internal.workflows.analyzeRepository.analyzeRepositoryWorkflow as any,
			{
				owner: args.owner,
				name: args.name,
				userId: args.userId,
			},
		);

		return { workflowId: handle };
	},
});
