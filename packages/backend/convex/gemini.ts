import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Create Google AI provider with our Gemini API key
 */
const google = createGoogleGenerativeAI({
	apiKey: process.env.GEMINI_API_KEY,
});

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

		return text;
	},
});

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

			const analysis = JSON.parse(jsonMatch[0]);

			return {
				difficulty: analysis.difficulty,
				aiSummary: analysis.summary,
				filesLikelyTouched: analysis.filesLikelyTouched || [],
				skillsRequired: analysis.skillsRequired || [],
			};
		} catch (_error) {
			console.error("Failed to parse Gemini response:", text);
			// Return fallback values
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
