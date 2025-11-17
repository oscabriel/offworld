import { generateText } from "ai";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { google } from "./lib/google";
import {
	ArchitectureIterationSchema,
	IssueAnalysisSchema,
	safeParseAIResponse,
} from "./schemas/aiValidation";

/**
 * Generate repository summary using Gemini 2.5 Flash Lite
 */
export const generateRepoSummary = internalAction({
	args: {
		repoId: v.id("repositories"),
		repoName: v.string(),
		description: v.optional(v.string()),
		language: v.optional(v.string()),
		fileCount: v.number(),
		namespace: v.string(), // RAG namespace
	},
	handler: async (ctx, args) => {
		// Import RAG dynamically to avoid circular dependency
		const { rag } = await import("./rag");

		// Use RAG to get high-priority files for summary generation
		const results = await rag.search(ctx, {
			namespace: args.namespace,
			query: "README package.json main entry point core",
			limit: 5,
			filters: [{ name: "priority", value: "high" }],
			chunkContext: { before: 1, after: 1 },
		});

		// Extract file paths and get a representative sample of the codebase
		const sampleContent = results.text.slice(0, 10000); // Limit to 10k chars

		const prompt = `You are an expert code analyst. Analyze this GitHub repository and provide a comprehensive summary.

Repository: ${args.repoName}
${args.description ? `Description: ${args.description}` : ""}
${args.language ? `Primary Language: ${args.language}` : ""}
Total Files Analyzed: ${args.fileCount}

Sample Code from Key Files:
\`\`\`
${sampleContent}
\`\`\`

Please provide:
1. A clear, concise overview of what this project does (2-3 sentences)
2. The main problem it solves
3. Key features and capabilities
4. Target users/use cases

Keep the summary under 300 words. Focus on clarity and practical understanding.`;

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		// Strip top-level headings as fallback (prompt should prevent this)
		return stripTopLevelHeadings(text);
	},
});

/**
 * Helper: Strip redundant top-level H1 headings from LLM output
 */
function stripTopLevelHeadings(text: string): string {
	// Remove only top-level H1 headings (single #)
	let cleaned = text.replace(/^#\s+.+$/gm, "");

	// Remove standalone redundant labels at start
	cleaned = cleaned.replace(
		/^(Summary|Overview|Repository Analysis|Introduction):\s*/im,
		"",
	);

	// Trim excessive newlines
	cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

	return cleaned.trim();
}

/**
 * Generate architecture overview using Gemini 2.5 Flash Lite
 */
export const generateArchitecture = internalAction({
	args: {
		repoName: v.string(),
		summary: v.string(),
		namespace: v.string(),
	},
	handler: async (ctx, args) => {
		// Import rag dynamically to avoid circular dependency
		const { rag } = await import("./rag");

		// Search RAG for high-priority files to understand structure
		const highPriorityResults = await rag.search(ctx, {
			namespace: args.namespace,
			query: "main entry point core architecture",
			limit: 50,
			filters: [{ name: "priority", value: "high" }],
			chunkContext: { before: 1, after: 1 },
		});

		// Extract file paths from RAG results
		const filePaths = highPriorityResults.entries.map((entry) => {
			// Extract the key (file path) from entry metadata or content
			return entry.entryId; // This will be the file path we used as the key
		});

		// Group files by directory
		const directoryStructure: Record<string, string[]> = {};
		for (const path of filePaths) {
			const dir = path.split("/").slice(0, -1).join("/") || "root";
			if (!directoryStructure[dir]) {
				directoryStructure[dir] = [];
			}
			directoryStructure[dir].push(path);
		}

		const structureOverview = Object.entries(directoryStructure)
			.slice(0, 20) // Top 20 directories
			.map(([dir, files]) => `${dir}/ (${files.length} files)`)
			.join("\n");

		const prompt = `You are an expert software architect. Analyze this codebase structure and provide an architecture overview.

Repository: ${args.repoName}
Summary: ${args.summary}

Directory Structure:
${structureOverview}

Please provide:
1. High-level architecture pattern (e.g., MVC, microservices, monorepo, etc.)
2. Key directories and their purposes
3. Main entry points
4. Notable patterns or design decisions
5. Technology stack insights

Keep it under 250 words. Focus on helping developers understand how the code is organized.`;

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		return text;
	},
});

/**
 * Architecture Iteration 1: High-level structure discovery
 * Discovers packages, top-level directories, and main subsystems
 */
export const generateArchitectureIteration1 = internalAction({
	args: {
		repoName: v.string(),
		summary: v.string(),
		namespace: v.string(),
	},
	handler: async (ctx, args) => {
		const { rag } = await import("./rag");
		const { ARCHITECTURE_ITERATION_1, renderPrompt, extractJSON } =
			await import("./prompts");

		// Search for entry points and top-level configuration
		const results = await rag.search(ctx, {
			namespace: args.namespace,
			query: "package.json README entry point index main tsconfig",
			limit: 20,
			filters: [{ name: "priority", value: "high" }],
			chunkContext: { before: 1, after: 1 },
		});

		const prompt = renderPrompt(ARCHITECTURE_ITERATION_1, {
			repoName: args.repoName,
			summary: args.summary,
			codeContext: results.text.slice(0, 8000),
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		try {
			const data = extractJSON(text);

			// Preprocess entities: map invalid types to valid ones before validation
			if (
				data &&
				typeof data === "object" &&
				"entities" in data &&
				Array.isArray(data.entities)
			) {
				// biome-ignore lint/suspicious/noExplicitAny: Preprocessing unvalidated LLM JSON response
				data.entities = data.entities.map((entity: any) => {
					// Map common LLM mistakes to valid types
					if (entity.type === "utility" || entity.type === "helper") {
						entity.type = "component";
					} else if (entity.type === "core" || entity.type === "library") {
						entity.type = "package";
					}
					return entity;
				});
			}
			const validated = safeParseAIResponse(ArchitectureIterationSchema, data, {
				overview: `The ${args.repoName.split("/")[1]} library is organized around a core module that provides the primary API surface for developers.`,
				pattern: "Unknown",
				entities: [],
			});

			// Filter by iteration-specific types
			const validTypes = ["package", "directory"];
			const filteredEntities = validated.entities.filter((e) =>
				validTypes.includes(e.type),
			);

			if (filteredEntities.length !== validated.entities.length) {
				console.warn(
					`Iteration 1: Filtered out ${validated.entities.length - filteredEntities.length} entities with invalid types`,
				);
			}

			return {
				overview: validated.overview,
				pattern: validated.pattern || "Unknown",
				entities: filteredEntities,
			};
		} catch (error) {
			console.error("Failed to parse iteration 1 response:", error);
			console.error("Raw LLM response (first 500 chars):", text.slice(0, 500));
			return {
				overview: `The ${args.repoName.split("/")[1]} library is organized around a core module that provides the primary API surface for developers.`,
				pattern: "Unknown",
				entities: [],
			};
		}
	},
});

/**
 * Architecture Iteration 2: Module and service discovery
 * Discovers core modules, services, and subsystems
 */
export const generateArchitectureIteration2 = internalAction({
	args: {
		repoName: v.string(),
		summary: v.string(),
		namespace: v.string(),
		iteration1Overview: v.string(),
		previousEntities: v.string(), // JSON string of previous entities
	},
	handler: async (ctx, args) => {
		const { rag } = await import("./rag");
		const { ARCHITECTURE_ITERATION_2, renderPrompt, extractJSON } =
			await import("./prompts");

		// Search for modules, services, core directories
		const results = await rag.search(ctx, {
			namespace: args.namespace,
			query: "modules services api router controller handlers middleware",
			limit: 30,
			chunkContext: { before: 1, after: 1 },
		});

		const prompt = renderPrompt(ARCHITECTURE_ITERATION_2, {
			repoName: args.repoName,
			summary: args.summary,
			iteration1Overview: args.iteration1Overview,
			previousEntities: args.previousEntities,
			codeContext: results.text.slice(0, 10000),
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		try {
			const data = extractJSON(text);
			const validated = safeParseAIResponse(ArchitectureIterationSchema, data, {
				overview: "Unable to analyze modules and services",
				entities: [],
			});

			// Filter by iteration-specific types
			const validTypes = ["module", "service"];
			const filteredEntities = validated.entities.filter((e) =>
				validTypes.includes(e.type),
			);

			if (filteredEntities.length !== validated.entities.length) {
				console.warn(
					`Iteration 2: Filtered out ${validated.entities.length - filteredEntities.length} entities with invalid types`,
				);
			}

			return {
				overview: validated.overview,
				entities: filteredEntities,
			};
		} catch (error) {
			console.error("Failed to parse iteration 2 response:", error);
			return {
				overview: "Unable to analyze modules and services",
				entities: [],
			};
		}
	},
});

/**
 * Architecture Iteration 3: Component and utility discovery
 * Discovers individual components, utilities, and helpers
 */
export const generateArchitectureIteration3 = internalAction({
	args: {
		repoName: v.string(),
		summary: v.string(),
		namespace: v.string(),
		previousOverview: v.string(),
		previousEntities: v.string(), // JSON string of all previous entities
	},
	handler: async (ctx, args) => {
		const { rag } = await import("./rag");
		const { ARCHITECTURE_ITERATION_3, renderPrompt, extractJSON } =
			await import("./prompts");

		// Search for components, utilities, helpers
		const results = await rag.search(ctx, {
			namespace: args.namespace,
			query: "components utils helpers hooks utilities lib shared",
			limit: 25,
			chunkContext: { before: 1, after: 1 },
		});

		const prompt = renderPrompt(ARCHITECTURE_ITERATION_3, {
			repoName: args.repoName,
			summary: args.summary,
			previousOverview: args.previousOverview,
			previousEntities: args.previousEntities,
			codeContext: results.text.slice(0, 10000),
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		try {
			const data = extractJSON(text);
			const validated = safeParseAIResponse(ArchitectureIterationSchema, data, {
				overview: "Unable to analyze components and utilities",
				entities: [],
			});

			// Filter by iteration-specific types
			const validTypes = ["component"];
			const filteredEntities = validated.entities.filter((e) =>
				validTypes.includes(e.type),
			);

			if (filteredEntities.length !== validated.entities.length) {
				console.warn(
					`Iteration 3: Filtered out ${validated.entities.length - filteredEntities.length} entities with invalid types`,
				);
			}

			return {
				overview: validated.overview,
				entities: filteredEntities,
			};
		} catch (error) {
			console.error("Failed to parse iteration 3 response:", error);
			return {
				overview: "Unable to analyze components and utilities",
				entities: [],
			};
		}
	},
});

/**
 * Architecture Synthesis: Final narrative generation
 * Synthesizes all iteration overviews into a cohesive architectural narrative
 */
export const synthesizeArchitecture = internalAction({
	args: {
		repoName: v.string(),
		pattern: v.string(),
		iteration1Overview: v.string(),
		iteration2Overview: v.string(),
		iteration3Overview: v.string(),
		entityCount: v.number(),
		allEntities: v.string(), // JSON string of all entities
	},
	handler: async (_ctx, args) => {
		const { ARCHITECTURE_SYNTHESIS, renderPrompt } = await import("./prompts");

		const prompt = renderPrompt(ARCHITECTURE_SYNTHESIS, {
			repoName: args.repoName,
			pattern: args.pattern,
			iteration1Overview: args.iteration1Overview,
			iteration2Overview: args.iteration2Overview,
			iteration3Overview: args.iteration3Overview,
			entityCount: args.entityCount.toString(),
			allEntities: args.allEntities,
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		// Return raw narrative text (no extraction needed)
		return text.trim();
	},
});

/**
 * Generate C4 architecture diagram
 */
export const generateArchitectureDiagram = internalAction({
	args: {
		repoName: v.string(),
		pattern: v.string(),
		entities: v.string(), // JSON string of entities
	},
	handler: async (_ctx, args) => {
		const { ARCHITECTURE_DIAGRAM_PROMPT, renderPrompt } = await import(
			"./prompts"
		);

		const prompt = renderPrompt(ARCHITECTURE_DIAGRAM_PROMPT, {
			repoName: args.repoName,
			pattern: args.pattern,
			entities: args.entities,
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		// Extract mermaid code (remove markdown fences if present)
		let diagram = text.trim();
		const mermaidMatch = text.match(/```mermaid\s*([\s\S]*?)\s*```/);
		if (mermaidMatch) {
			diagram = mermaidMatch[1].trim();
		}

		// Basic validation
		if (!diagram.startsWith("graph ")) {
			console.warn(
				"Invalid mermaid diagram (no graph keyword), using fallback",
			);
			return generateFallbackDiagram(args.repoName, "architecture");
		}

		// Sanitize node IDs (replace problematic characters)
		diagram = sanitizeMermaidDiagram(diagram);

		return diagram;
	},
});

/**
 * Generate data flow diagram
 */
export const generateDataFlowDiagram = internalAction({
	args: {
		repoName: v.string(),
		overview: v.string(),
		entities: v.string(), // JSON string of entities
	},
	handler: async (_ctx, args) => {
		const { DATA_FLOW_DIAGRAM_PROMPT, renderPrompt } = await import(
			"./prompts"
		);

		const prompt = renderPrompt(DATA_FLOW_DIAGRAM_PROMPT, {
			repoName: args.repoName,
			overview: args.overview,
			entities: args.entities,
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		// Extract mermaid code
		let diagram = text.trim();
		const mermaidMatch = text.match(/```mermaid\s*([\s\S]*?)\s*```/);
		if (mermaidMatch) {
			diagram = mermaidMatch[1].trim();
		}

		// Basic validation
		if (!diagram.startsWith("graph ")) {
			console.warn("Invalid data flow diagram, using fallback");
			return generateFallbackDiagram(args.repoName, "dataFlow");
		}

		// Sanitize
		diagram = sanitizeMermaidDiagram(diagram);

		return diagram;
	},
});

/**
 * Generate routing diagram (for frontend applications)
 */
export const generateRoutingDiagram = internalAction({
	args: {
		repoName: v.string(),
		namespace: v.string(),
	},
	handler: async (ctx, args) => {
		const { rag } = await import("./rag");
		const { ROUTING_DIAGRAM_PROMPT, renderPrompt } = await import("./prompts");

		// Search for route files
		const results = await rag.search(ctx, {
			namespace: args.namespace,
			query: "routes pages app router routing navigation",
			limit: 20,
			chunkContext: { before: 1, after: 1 },
		});

		// Extract file paths that look like routes
		const routeFiles = results.entries
			.map((e) => e.entryId)
			.filter(
				(path) =>
					path.includes("/routes/") ||
					path.includes("/pages/") ||
					path.includes("/app/") ||
					path.includes("route.ts") ||
					path.includes("page.tsx"),
			)
			.join("\n");

		// Skip routing diagram if no routes found
		if (!routeFiles || routeFiles.length === 0) {
			return null;
		}

		const prompt = renderPrompt(ROUTING_DIAGRAM_PROMPT, {
			repoName: args.repoName,
			routeFiles,
		});

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		// Extract mermaid code
		let diagram = text.trim();
		const mermaidMatch = text.match(/```mermaid\s*([\s\S]*?)\s*```/);
		if (mermaidMatch) {
			diagram = mermaidMatch[1].trim();
		}

		// Basic validation
		if (!diagram.startsWith("graph ")) {
			console.warn("Invalid routing diagram, using fallback");
			return generateFallbackDiagram(args.repoName, "routing");
		}

		// Sanitize
		diagram = sanitizeMermaidDiagram(diagram);

		return diagram;
	},
});

/**
 * Sanitize Mermaid diagram by fixing common issues
 */
function sanitizeMermaidDiagram(diagram: string): string {
	// Replace problematic characters in node definitions
	// Pattern: NodeID[Label] - keep label as-is, clean ID
	return diagram.replace(
		/([A-Za-z][\w-]*)\[([^\]]+)\]/g,
		(_match, id, label) => {
			// Clean the ID: remove all non-alphanumeric except underscore
			const cleanId = id.replace(/[^A-Za-z0-9_]/g, "");
			return `${cleanId}[${label}]`;
		},
	);
}

/**
 * Generate fallback diagram when LLM output is invalid
 */
function generateFallbackDiagram(repoName: string, type: string): string {
	if (type === "architecture") {
		return `graph TB
    A[${repoName}]
    B[Core Logic]
    C[API Surface]
    D[Utilities]

    A --> B
    A --> C
    B --> D

    style A fill:#e1f5ff
    style B fill:#fff3e0`;
	}

	if (type === "dataFlow") {
		return `graph LR
    A[Input] --> B[Process]
    B --> C[Output]

    style A fill:#e1f5ff
    style C fill:#e8f5e9`;
	}

	// routing
	return `graph TD
    A[Root] --> B[Main Routes]
    B --> C[Sub Routes]

    style A fill:#e1f5ff`;
}

/**
 * Analyze an issue to determine difficulty and required skills
 */
export const analyzeIssue = internalAction({
	args: {
		issueTitle: v.string(),
		issueBody: v.optional(v.string()),
		labels: v.array(v.string()),
		repoContext: v.string(),
	},
	handler: async (_ctx, args) => {
		const prompt = `You are an expert developer mentor. Analyze this GitHub issue and provide guidance for potential contributors.

Repository Context: ${args.repoContext}

Issue Title: ${args.issueTitle}
Labels: ${args.labels.join(", ")}
${args.issueBody ? `Description: ${args.issueBody.slice(0, 1000)}` : ""}

Please provide a JSON response with:
{
  "difficulty": <number 1-5, where 1 is easiest and 5 is hardest>,
  "summary": "<2-3 sentence plain English explanation of what needs to be done>",
  "filesLikelyTouched": ["<list of 2-5 file paths or directory patterns that will likely need changes>"],
  "skillsRequired": ["<list of 2-4 technical skills needed, e.g., 'TypeScript', 'React', 'Testing'>"]
}

Respond ONLY with valid JSON, no additional text.`;

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		try {
			// Extract JSON from response (handle markdown code blocks)
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in response");
			}

			const data = JSON.parse(jsonMatch[0]);
			const validated = safeParseAIResponse(IssueAnalysisSchema, data, {
				difficulty: 3,
				summary: args.issueTitle,
				filesLikelyTouched: [],
				skillsRequired: [],
			});

			return {
				difficulty: validated.difficulty,
				aiSummary: validated.summary,
				filesLikelyTouched: validated.filesLikelyTouched,
				skillsRequired: validated.skillsRequired,
			};
		} catch (error) {
			console.error("Failed to parse Gemini response:", error);
			return {
				difficulty: 3,
				aiSummary: args.issueTitle,
				filesLikelyTouched: [],
				skillsRequired: [],
			};
		}
	},
});

/**
 * Analyze pull request impact for contributors
 */
export const analyzePullRequest = internalAction({
	args: {
		prTitle: v.string(),
		prBody: v.optional(v.string()),
		linesAdded: v.number(),
		linesDeleted: v.number(),
		repoContext: v.string(),
	},
	handler: async (_ctx, args) => {
		const prompt = `You are an expert code reviewer. Analyze this pull request and provide insights for potential reviewers.

Repository Context: ${args.repoContext}

PR Title: ${args.prTitle}
Lines: +${args.linesAdded} -${args.linesDeleted}
${args.prBody ? `Description: ${args.prBody.slice(0, 1000)}` : ""}

Please provide a JSON response with:
{
  "difficulty": <number 1-5, where 1 is easiest to review and 5 is hardest>,
  "summary": "<2-3 sentence plain English explanation of what this PR changes>",
  "filesChanged": ["<list of 2-5 file paths or directory patterns that were likely changed>"],
  "impactAreas": ["<list of 2-4 functional areas affected, e.g., 'Authentication', 'Database', 'UI'>"],
  "reviewComplexity": "<'simple' | 'moderate' | 'complex' based on review effort needed>"
}

Respond ONLY with valid JSON, no additional text.`;

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		try {
			// Extract JSON from response (handle markdown code blocks)
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in response");
			}

			const data = JSON.parse(jsonMatch[0]);

			return {
				difficulty: data.difficulty || 3,
				aiSummary: data.summary || args.prTitle,
				filesChanged: data.filesChanged || [],
				impactAreas: data.impactAreas || [],
				reviewComplexity: data.reviewComplexity || "moderate",
			};
		} catch (error) {
			console.error("Failed to parse PR analysis response:", error);
			return {
				difficulty: 3,
				aiSummary: args.prTitle,
				filesChanged: [],
				impactAreas: [],
				reviewComplexity: "moderate",
			};
		}
	},
});

/**
 * Generate answer for code question using RAG (Retrieval-Augmented Generation)
 */
export const generateCodeAnswer = internalAction({
	args: {
		question: v.string(),
		namespace: v.string(),
		repoName: v.string(),
	},
	handler: async (ctx, args) => {
		// Import rag dynamically to avoid circular dependency
		const { rag } = await import("./rag");

		// Search RAG for relevant code chunks
		const searchResults = await rag.search(ctx, {
			namespace: args.namespace,
			query: args.question,
			limit: 10,
			vectorScoreThreshold: 0.7,
			chunkContext: { before: 1, after: 1 }, // Include surrounding chunks
		});

		// Format results as code context
		const context = searchResults.entries
			.map(
				(entry) => `
File: ${entry.entryId}
\`\`\`
${searchResults.text}
\`\`\`
`,
			)
			.join("\n\n");

		const prompt = `You are an expert code assistant. Answer the user's question about the ${args.repoName} repository using the provided code context.

Question: ${args.question}

Relevant Code:
${context}

Instructions:
- Provide a clear, accurate answer based on the code shown
- Include specific code references with file paths and line numbers when relevant
- If the code doesn't contain enough information to answer, say so
- Keep answers concise but thorough
- Use markdown formatting for code snippets`;

		const { text } = await generateText({
			model: google("gemini-2.5-flash-lite"),
			prompt,
		});

		return text;
	},
});
