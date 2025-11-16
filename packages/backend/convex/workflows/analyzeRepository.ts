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
		// Step 0: Clear old RAG data if this is a re-index (optional but thorough)
		// This ensures deleted files don't leave stale chunks
		const namespace = `repo:${args.owner}/${args.name}`;
		try {
			await step.runAction(internal.rag.clearNamespace, { namespace });
			console.log(`Cleared old RAG data for ${namespace}`);
		} catch (error) {
			// If this fails, it's okay - chunks will be overwritten during ingestion
			console.warn("Failed to clear RAG namespace (non-critical):", error);
		}

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

			// Determine iteration count based on repo size
			const fileCount = fileTreeResult.files.length;
			const iterationCount =
				fileCount < 50
					? 2
					: // Small repos: 2 iterations
						fileCount < 200
						? 3
						: // Medium repos: 3 iterations
							fileCount < 500
							? 4
							: // Large repos: 4 iterations
								5; // Very large repos: 5 iterations

			console.log(
				`Repository has ${fileCount} files, using ${iterationCount} iterations for architecture analysis`,
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

			// Step 9: Generate architecture overview with adaptive iterations
			// Uses RAG component for context instead of file paths
			const allEntities: any[] = [];
			const iterationOverviews: string[] = [];
			let architecturePattern = "Unknown";

			for (let i = 1; i <= iterationCount; i++) {
				// Determine which iteration function to call
				// i=1: iteration1 (packages/directories)
				// i=2: iteration2 (modules/services)
				// i>=3: iteration3 (components/utilities) - can be called multiple times
				const iterationFunc =
					i === 1
						? internal.gemini.generateArchitectureIteration1
						: i === 2
							? internal.gemini.generateArchitectureIteration2
							: internal.gemini.generateArchitectureIteration3;

				// Build context from previous iterations
				const previousContext =
					i === 1
						? { repoName: metadata.fullName, summary, namespace }
						: i === 2
							? {
									repoName: metadata.fullName,
									summary,
									namespace,
									iteration1Overview: iterationOverviews[0],
									previousEntities: JSON.stringify(allEntities),
								}
							: {
									repoName: metadata.fullName,
									summary,
									namespace,
									previousOverview: iterationOverviews.join("\n\n"),
									previousEntities: JSON.stringify(allEntities),
								};

				// Run the iteration
				const result = await step.runAction(iterationFunc, previousContext);

				// Store pattern from first iteration
				if (i === 1 && result.pattern) {
					architecturePattern = result.pattern;
				}

				// Store overview
				iterationOverviews.push(result.overview);

				// Process and store entities
				const maxEntities = i === 1 ? 15 : i % 2 === 0 ? 20 : 15;
				// biome-ignore lint/suspicious/noExplicitAny: Architecture entities are not typed
				const entities = result.entities
					.slice(0, maxEntities)
					.map((e: any) => ({
						...e,
						iteration: i,
						usedBy: e.usedBy || [],
					}));

				allEntities.push(...entities);

				await step.runMutation(internal.architectureEntities.createBatch, {
					repoId,
					entities,
				});
			}

			// Generate C4 diagrams using discovered entities
			const architectureDiagram = await step.runAction(
				internal.gemini.generateArchitectureDiagram,
				{
					repoName: metadata.fullName,
					pattern: architecturePattern,
					entities: JSON.stringify(allEntities.slice(0, 20)),
				},
			);

			const dataFlowDiagram = await step.runAction(
				internal.gemini.generateDataFlowDiagram,
				{
					repoName: metadata.fullName,
					overview: iterationOverviews.join("\n\n"),
					entities: JSON.stringify(allEntities.slice(0, 15)),
				},
			);

			const routingDiagram = await step.runAction(
				internal.gemini.generateRoutingDiagram,
				{
					repoName: metadata.fullName,
					namespace,
				},
			);

			// Generate final architecture text dynamically based on iterations
			let finalArchitecture = `# Architecture Pattern: ${architecturePattern}\n\n`;
			iterationOverviews.forEach((overview, index) => {
				const sectionTitle =
					index === 0
						? "High-Level Structure"
						: index === 1
							? "Module Organization"
							: index === 2
								? "Component Structure"
								: `Iteration ${index + 1}`;
				finalArchitecture += `## ${sectionTitle}\n\n${overview}\n\n`;
			});
			finalArchitecture += `---\n\n*Discovered ${allEntities.length} architectural entities across ${iterationCount} analysis iterations*`;

			// Update DB with architecture, metadata, and diagrams
			await step.runMutation(internal.repos.updateArchitectureComplete, {
				repoId,
				architecture: finalArchitecture,
				architectureMetadata: {
					totalIterations: iterationCount,
					completedIterations: iterationCount,
					// biome-ignore lint/suspicious/noExplicitAny: Architecture entities are not typed
					discoveredPackages: allEntities.filter(
						(e: any) => e.type === "package",
					).length,
					// biome-ignore lint/suspicious/noExplicitAny: Architecture entities are not typed
					discoveredModules: allEntities.filter(
						(e: any) => e.type === "module" || e.type === "service",
					).length,
					// biome-ignore lint/suspicious/noExplicitAny: Architecture entities are not typed
					discoveredComponents: allEntities.filter(
						(e: any) => e.type === "component",
					).length,
					lastIterationAt: Date.now(),
				},
				diagrams: {
					architecture: architectureDiagram,
					dataFlow: dataFlowDiagram,
					routing: routingDiagram || undefined,
				},
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
