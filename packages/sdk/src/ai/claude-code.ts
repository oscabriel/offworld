/**
 * Claude Code SDK wrapper for analysis operations
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for Claude Code analysis
 */
export interface ClaudeCodeAnalysisOptions<T extends z.ZodType> {
	/** The prompt describing what to analyze */
	prompt: string;
	/** Working directory for the analysis */
	cwd: string;
	/** Zod schema for structured output */
	schema: T;
	/** Additional system prompt instructions */
	systemPrompt?: string;
	/** Maximum turns for the agent (default: 50) */
	maxTurns?: number;
	/** Abort controller for cancellation */
	abortController?: AbortController;
}

/**
 * Result from Claude Code analysis
 */
export interface ClaudeCodeAnalysisResult<T> {
	/** The structured output matching the schema */
	output: T;
	/** Total cost in USD */
	costUsd: number;
	/** Duration in milliseconds */
	durationMs: number;
	/** Token usage statistics */
	usage: {
		inputTokens: number;
		outputTokens: number;
		cacheReadInputTokens: number;
		cacheCreationInputTokens: number;
	};
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error during Claude Code analysis
 */
export class ClaudeCodeAnalysisError extends Error {
	constructor(
		message: string,
		public readonly errors?: string[],
	) {
		super(message);
		this.name = "ClaudeCodeAnalysisError";
	}
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Analyze a repository using Claude Code SDK
 *
 * Uses the Claude Agent SDK query function with:
 * - Read, Glob, Grep tools for codebase exploration
 * - bypassPermissions mode for autonomous operation
 * - JSON Schema output format from Zod schema
 *
 * @param options - Analysis options including prompt, cwd, and output schema
 * @returns Structured analysis result matching the provided schema
 * @throws ClaudeCodeAnalysisError if analysis fails
 */
export async function analyzeWithClaudeCode<T extends z.ZodType>(
	options: ClaudeCodeAnalysisOptions<T>,
): Promise<ClaudeCodeAnalysisResult<z.infer<T>>> {
	const { prompt, cwd, schema, systemPrompt, maxTurns = 50, abortController } = options;

	// Convert Zod schema to JSON Schema
	// Using 'as any' because zod-to-json-schema may have type compatibility issues with Zod v4
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const jsonSchema = zodToJsonSchema(schema as any, {
		$refStrategy: "none", // Inline all refs for compatibility
	});

	let result: ClaudeCodeAnalysisResult<z.infer<T>> | undefined;

	// Build query options
	const queryOptions: Parameters<typeof query>[0]["options"] = {
		cwd,
		allowedTools: ["Read", "Glob", "Grep"],
		permissionMode: "bypassPermissions",
		allowDangerouslySkipPermissions: true,
		maxTurns,
		abortController,
		outputFormat: {
			type: "json_schema",
			schema: jsonSchema as Record<string, unknown>,
		},
	};

	// Add system prompt if provided (append to Claude Code's default)
	if (systemPrompt) {
		queryOptions.systemPrompt = {
			type: "preset",
			preset: "claude_code",
			append: systemPrompt,
		};
	}

	// Run the query and collect results
	for await (const message of query({
		prompt,
		options: queryOptions,
	})) {
		// Handle result message
		if (message.type === "result") {
			if (message.subtype === "success" && message.structured_output !== undefined) {
				// Parse and validate the structured output
				const parsed = schema.safeParse(message.structured_output);
				if (!parsed.success) {
					throw new ClaudeCodeAnalysisError(
						`Failed to validate output against schema: ${parsed.error.message}`,
					);
				}

				result = {
					output: parsed.data,
					costUsd: message.total_cost_usd,
					durationMs: message.duration_ms,
					usage: {
						inputTokens: message.usage.input_tokens ?? 0,
						outputTokens: message.usage.output_tokens ?? 0,
						cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
						cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
					},
				};
			} else if (message.subtype === "error_max_turns") {
				throw new ClaudeCodeAnalysisError("Analysis exceeded maximum turns", ["Max turns reached"]);
			} else if (message.subtype === "error_during_execution") {
				throw new ClaudeCodeAnalysisError(
					"Analysis failed during execution",
					"errors" in message ? message.errors : undefined,
				);
			} else if (message.subtype === "error_max_budget_usd") {
				throw new ClaudeCodeAnalysisError("Analysis exceeded budget", ["Budget limit reached"]);
			} else if (message.subtype === "error_max_structured_output_retries") {
				throw new ClaudeCodeAnalysisError(
					"Failed to produce valid structured output after maximum retries",
					["Structured output validation failed"],
				);
			}
		}
	}

	if (!result) {
		throw new ClaudeCodeAnalysisError("Analysis completed without producing a result");
	}

	return result;
}
