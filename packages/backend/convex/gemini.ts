import { GoogleGenerativeAI } from "@google/generative-ai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Initialize Gemini API client
 */
function getGeminiClient() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY environment variable is not set");
	}
	return new GoogleGenerativeAI(apiKey);
}

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
	},
	handler: async (ctx, args) => {
		const genAI = getGeminiClient();
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

		// Fetch sample chunks from DB to avoid large data in workflow state
		const chunks = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated types use anyApi placeholder for internal
			(internal as any).repos.getChunksForEmbedding,
			{ repoId: args.repoId },
		);

		const sampleFiles = chunks
			.slice(0, 5)
			.map(
				(chunk: {
					filePath: string;
					content: string;
					startLine: number;
					endLine: number;
				}) => ({
					path: chunk.filePath,
					content: chunk.content,
				}),
			);

		const prompt = `You are an expert code analyst. Analyze this GitHub repository and provide a comprehensive summary.

Repository: ${args.repoName}
${args.description ? `Description: ${args.description}` : ""}
${args.language ? `Primary Language: ${args.language}` : ""}
Total Files Analyzed: ${args.fileCount}

Sample Files:
${sampleFiles
	.map(
		(file: { path: string; content: string }) => `
File: ${file.path}
\`\`\`
${file.content.slice(0, 2000)}
\`\`\`
`,
	)
	.join("\n")}

Please provide:
1. A clear, concise overview of what this project does (2-3 sentences)
2. The main problem it solves
3. Key features and capabilities
4. Target users/use cases

Keep the summary under 300 words. Focus on clarity and practical understanding.`;

		const result = await model.generateContent(prompt);
		const response = result.response;
		return response.text();
	},
});

/**
 * Generate architecture overview using Gemini 2.5 Flash Lite
 */
export const generateArchitecture = internalAction({
	args: {
		repoName: v.string(),
		summary: v.string(),
		filePaths: v.array(v.string()),
	},
	handler: async (_ctx, args) => {
		const genAI = getGeminiClient();
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

		// Group files by directory
		const directoryStructure: Record<string, string[]> = {};
		for (const path of args.filePaths) {
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

		const result = await model.generateContent(prompt);
		const response = result.response;
		return response.text();
	},
});

/**
 * Generate embeddings for code chunks using Gemini text-embedding-004
 * With retry logic and rate limiting
 */
export const generateEmbeddings = internalAction({
	args: {
		texts: v.array(v.string()),
	},
	handler: async (_ctx, args) => {
		const genAI = getGeminiClient();
		const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

		const embeddings: number[][] = [];

		// Helper function to retry with exponential backoff
		async function retryWithBackoff<T>(
			fn: () => Promise<T>,
			maxRetries = 3,
			initialDelayMs = 1000,
		): Promise<T> {
			let lastError: Error | undefined;
			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				try {
					return await fn();
				} catch (error) {
					lastError = error as Error;
					const errorMessage =
						error instanceof Error ? error.message : String(error);

					// Check if it's a retryable error (500, rate limit, etc.)
					const isRetryable =
						errorMessage.includes("500") ||
						errorMessage.includes("Internal Server Error") ||
						errorMessage.includes("429") ||
						errorMessage.includes("rate limit");

					if (!isRetryable || attempt === maxRetries) {
						throw error;
					}

					// Exponential backoff with jitter
					const delayMs = initialDelayMs * 2 ** attempt + Math.random() * 1000;
					console.log(
						`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`,
					);
					await new Promise((resolve) => setTimeout(resolve, delayMs));
				}
			}
			throw lastError;
		}

		// Process in smaller batches with delays to avoid overwhelming API
		const batchSize = 5; // Reduced from 10
		console.log(
			`Generating embeddings for ${args.texts.length} text chunks...`,
		);

		for (let i = 0; i < args.texts.length; i += batchSize) {
			const batch = args.texts.slice(i, i + batchSize);
			const batchNumber = Math.floor(i / batchSize) + 1;
			const totalBatches = Math.ceil(args.texts.length / batchSize);

			console.log(
				`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`,
			);

			// Process batch sequentially with retry logic
			for (let j = 0; j < batch.length; j++) {
				const text = batch[j];
				const embedding = await retryWithBackoff(async () => {
					const result = await model.embedContent(text);
					return result.embedding.values;
				});
				embeddings.push(embedding);
			}

			// Add delay between batches to avoid rate limiting
			if (i + batchSize < args.texts.length) {
				console.log("Waiting 500ms before next batch...");
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		console.log(`Successfully generated ${embeddings.length} embeddings`);
		return embeddings;
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
		const genAI = getGeminiClient();
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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

		const result = await model.generateContent(prompt);
		const response = result.response;
		const text = response.text();

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
		codeChunks: v.array(
			v.object({
				filePath: v.string(),
				content: v.string(),
			}),
		),
		repoName: v.string(),
	},
	handler: async (_ctx, args) => {
		const genAI = getGeminiClient();
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

		const context = args.codeChunks
			.map(
				(chunk) => `
File: ${chunk.filePath}
\`\`\`
${chunk.content}
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

		const result = await model.generateContent(prompt);
		const response = result.response;
		return response.text();
	},
});
