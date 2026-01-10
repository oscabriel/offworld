/**
 * AI module exports
 * PRD 3.10-3.13: AI provider detection and unified interface
 */

import type { z } from "zod";
import type { AIProvider, Config } from "@offworld/types";
import { detectProvider, AIProviderNotFoundError } from "./provider.js";
import { analyzeWithClaudeCode, type ClaudeCodeAnalysisResult } from "./claude-code.js";
import { analyzeWithOpenCode, type OpenCodeAnalysisResult } from "./opencode.js";

// ============================================================================
// Unified Analysis Interface (PRD 3.13)
// ============================================================================

/**
 * Options for unified analysis
 */
export interface AnalysisOptions<T extends z.ZodType> {
	/** The prompt describing what to analyze */
	prompt: string;
	/** Working directory for the analysis */
	cwd: string;
	/** Zod schema for structured output */
	schema: T;
	/** Additional system prompt instructions */
	systemPrompt?: string;
	/** Optional config (will load from disk if not provided) */
	config?: Config;
	/** Force a specific provider instead of auto-detection */
	forceProvider?: AIProvider;
	/** Abort controller for cancellation */
	abortController?: AbortController;
}

/**
 * Result from unified analysis
 */
export interface AnalysisResult<T> {
	/** The structured output matching the schema */
	output: T;
	/** Which provider was used */
	provider: AIProvider;
	/** Whether the preferred provider was used */
	isPreferred: boolean;
	/** Duration in milliseconds */
	durationMs: number;
	/** Cost in USD (only available for Claude Code) */
	costUsd?: number;
	/** Token usage (only available for Claude Code) */
	usage?: {
		inputTokens: number;
		outputTokens: number;
		cacheReadInputTokens: number;
		cacheCreationInputTokens: number;
	};
	/** Session ID (only available for OpenCode) */
	sessionId?: string;
}

/**
 * Run analysis using auto-detected or specified AI provider
 *
 * Priority:
 * 1. forceProvider option if specified
 * 2. config.preferredProvider if set AND available
 * 3. Claude Code if available
 * 4. OpenCode if available
 *
 * @param options - Analysis options including prompt, cwd, and output schema
 * @returns Structured analysis result matching the provided schema
 * @throws AIProviderNotFoundError if no provider is available
 */
export async function runAnalysis<T extends z.ZodType>(
	options: AnalysisOptions<T>,
): Promise<AnalysisResult<z.infer<T>>> {
	const { prompt, cwd, schema, systemPrompt, config, forceProvider, abortController } = options;

	// Determine which provider to use
	let provider: AIProvider;
	let isPreferred = false;

	if (forceProvider) {
		provider = forceProvider;
		isPreferred = false;
	} else {
		const detection = await detectProvider(config);
		provider = detection.provider;
		isPreferred = detection.isPreferred;
	}

	// Route to appropriate provider
	switch (provider) {
		case "claude-code": {
			const result: ClaudeCodeAnalysisResult<z.infer<T>> = await analyzeWithClaudeCode({
				prompt,
				cwd,
				schema,
				systemPrompt,
				abortController,
			});

			return {
				output: result.output,
				provider,
				isPreferred,
				durationMs: result.durationMs,
				costUsd: result.costUsd,
				usage: result.usage,
			};
		}

		case "opencode": {
			const result: OpenCodeAnalysisResult<z.infer<T>> = await analyzeWithOpenCode({
				prompt,
				cwd,
				schema,
				systemPrompt,
			});

			return {
				output: result.output,
				provider,
				isPreferred,
				durationMs: result.durationMs,
				sessionId: result.sessionId,
			};
		}

		default:
			// Should never reach here if detectProvider works correctly
			throw new AIProviderNotFoundError();
	}
}

// ============================================================================
// Re-exports
// ============================================================================

// Provider detection (PRD 3.10)
export {
	// Errors
	AIProviderError,
	AIProviderNotFoundError,
	PreferredProviderNotAvailableError,
	// Detection functions
	isClaudeCodeAvailable,
	isOpenCodeAvailable,
	isProviderAvailable,
	detectProvider,
	// Utilities
	getProviderDisplayName,
	// Types
	type DetectionResult,
} from "./provider.js";

// Claude Code SDK wrapper (PRD 3.11)
export {
	// Main function
	analyzeWithClaudeCode,
	// Errors
	ClaudeCodeAnalysisError,
	// Types
	type ClaudeCodeAnalysisOptions,
	type ClaudeCodeAnalysisResult,
} from "./claude-code.js";

// OpenCode SDK wrapper (PRD 3.12)
export {
	// Main function
	analyzeWithOpenCode,
	// Errors
	OpenCodeAnalysisError,
	OpenCodeConnectionError,
	// Types
	type OpenCodeAnalysisOptions,
	type OpenCodeAnalysisResult,
} from "./opencode.js";
