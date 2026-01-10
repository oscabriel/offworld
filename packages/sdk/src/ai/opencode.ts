/**
 * OpenCode SDK wrapper for analysis operations
 * PRD 3.12: OpenCode SDK wrapper
 */

import type { z } from "zod";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for OpenCode analysis
 */
export interface OpenCodeAnalysisOptions<T extends z.ZodType> {
	/** The prompt describing what to analyze */
	prompt: string;
	/** Working directory for the analysis */
	cwd: string;
	/** Zod schema for structured output */
	schema: T;
	/** Additional system prompt instructions */
	systemPrompt?: string;
	/** Model to use (default: anthropic/claude-sonnet-4-20250514) */
	model?: {
		providerID: string;
		modelID: string;
	};
	/** Agent type (default: plan for read-only analysis) */
	agent?: "build" | "plan";
	/** Session title for identification */
	sessionTitle?: string;
	/** OpenCode server base URL (default: http://localhost:4096) */
	baseUrl?: string;
}

/**
 * Result from OpenCode analysis
 */
export interface OpenCodeAnalysisResult<T> {
	/** The structured output matching the schema */
	output: T;
	/** Session ID for reference */
	sessionId: string;
	/** Duration in milliseconds */
	durationMs: number;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error during OpenCode analysis
 */
export class OpenCodeAnalysisError extends Error {
	constructor(
		message: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "OpenCodeAnalysisError";
	}
}

/**
 * Error when OpenCode server is not reachable
 */
export class OpenCodeConnectionError extends OpenCodeAnalysisError {
	constructor(baseUrl: string) {
		super(
			`Cannot connect to OpenCode server at ${baseUrl}. ` +
				`Ensure OpenCode is running with: opencode server`,
		);
		this.name = "OpenCodeConnectionError";
	}
}

// ============================================================================
// Internal Types for OpenCode API
// ============================================================================

interface OpenCodeSession {
	id: string;
	title?: string;
}

interface OpenCodeMessage {
	id: string;
	role: "user" | "assistant";
	parts: Array<{ type: string; text?: string }>;
}

interface OpenCodeClient {
	session: {
		create: (options: { body: { title?: string } }) => Promise<{ data: OpenCodeSession }>;
		prompt: (options: {
			path: { id: string };
			body: {
				parts: Array<{ type: string; text: string }>;
				model?: { providerID: string; modelID: string };
				noReply?: boolean;
			};
		}) => Promise<{ data: unknown }>;
		messages: (options: { path: { id: string } }) => Promise<{ data: OpenCodeMessage[] }>;
		delete: (options: { path: { id: string } }) => Promise<void>;
	};
}

// ============================================================================
// Client Creation
// ============================================================================

/**
 * Create an OpenCode client pointing to localhost:4096
 * Uses dynamic import to avoid bundling issues
 */
async function createClient(baseUrl: string): Promise<OpenCodeClient> {
	try {
		const { createOpencodeClient } = await import("@opencode-ai/sdk");
		// Using 'as unknown as' because the SDK types may differ from our interface
		return createOpencodeClient({ baseUrl }) as unknown as OpenCodeClient;
	} catch (error) {
		throw new OpenCodeAnalysisError(
			"Failed to import @opencode-ai/sdk. Install it with: npm install @opencode-ai/sdk",
			error,
		);
	}
}

/**
 * Check if OpenCode server is healthy
 */
async function checkServerHealth(baseUrl: string): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		const response = await fetch(`${baseUrl}/health`, {
			method: "GET",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		return response.ok;
	} catch {
		return false;
	}
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Analyze a repository using OpenCode SDK
 *
 * Creates a session, injects context via system prompt, sends the analysis prompt,
 * and parses the response using the provided Zod schema.
 *
 * @param options - Analysis options including prompt, cwd, and output schema
 * @returns Structured analysis result matching the provided schema
 * @throws OpenCodeConnectionError if server is not reachable
 * @throws OpenCodeAnalysisError if analysis fails
 */
export async function analyzeWithOpenCode<T extends z.ZodType>(
	options: OpenCodeAnalysisOptions<T>,
): Promise<OpenCodeAnalysisResult<z.infer<T>>> {
	const {
		prompt,
		cwd,
		schema,
		systemPrompt,
		model = { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
		agent = "plan", // Use plan agent for read-only analysis
		sessionTitle = "offworld-analysis",
		baseUrl = "http://localhost:4096",
	} = options;

	const startTime = Date.now();

	// Check server health
	const isHealthy = await checkServerHealth(baseUrl);
	if (!isHealthy) {
		throw new OpenCodeConnectionError(baseUrl);
	}

	// Create client
	const client = await createClient(baseUrl);

	// Create session
	const { data: session } = await client.session.create({
		body: { title: sessionTitle },
	});

	try {
		// Build the analysis prompt with JSON output instructions
		const schemaDescription = JSON.stringify(schema._def, null, 2);
		const jsonInstructions = `
You are analyzing a codebase at: ${cwd}

${systemPrompt ? `Additional context: ${systemPrompt}\n` : ""}

${agent === "plan" ? "You are in read-only mode. Use Read, Glob, and Grep tools to explore the codebase." : ""}

IMPORTANT: Your response MUST be valid JSON that matches this schema structure.
Do not include any text before or after the JSON.
Do not use markdown code blocks.

Expected output structure:
${schemaDescription}

Task: ${prompt}

Respond with ONLY the JSON output.`;

		// Send the prompt
		await client.session.prompt({
			path: { id: session.id },
			body: {
				parts: [{ type: "text", text: jsonInstructions }],
				model,
			},
		});

		// Get the response messages
		const { data: messages } = await client.session.messages({
			path: { id: session.id },
		});

		// Find the assistant's response
		const assistantMessage = messages.filter((m) => m.role === "assistant").pop();

		if (!assistantMessage) {
			throw new OpenCodeAnalysisError("No response received from OpenCode");
		}

		// Extract text content from the response
		const textPart = assistantMessage.parts.find((p) => p.type === "text" && p.text);

		if (!textPart?.text) {
			throw new OpenCodeAnalysisError("Response did not contain text content");
		}

		// Parse the JSON response
		let jsonResponse: unknown;
		try {
			// Try to extract JSON from the response (handle potential markdown wrapping)
			let jsonText = textPart.text.trim();

			// Remove markdown code blocks if present
			if (jsonText.startsWith("```json")) {
				jsonText = jsonText.slice(7);
			} else if (jsonText.startsWith("```")) {
				jsonText = jsonText.slice(3);
			}
			if (jsonText.endsWith("```")) {
				jsonText = jsonText.slice(0, -3);
			}
			jsonText = jsonText.trim();

			jsonResponse = JSON.parse(jsonText);
		} catch (parseError) {
			throw new OpenCodeAnalysisError(
				`Failed to parse JSON response: ${textPart.text.substring(0, 200)}...`,
				parseError,
			);
		}

		// Validate against the schema
		const parsed = schema.safeParse(jsonResponse);
		if (!parsed.success) {
			throw new OpenCodeAnalysisError(
				`Response did not match expected schema: ${parsed.error.message}`,
				parsed.error,
			);
		}

		const durationMs = Date.now() - startTime;

		return {
			output: parsed.data,
			sessionId: session.id,
			durationMs,
		};
	} finally {
		// Clean up the session
		try {
			await client.session.delete({ path: { id: session.id } });
		} catch {
			// Ignore cleanup errors
		}
	}
}
