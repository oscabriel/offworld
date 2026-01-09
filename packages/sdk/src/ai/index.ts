/**
 * AI module exports
 * PRD 3.10-3.13: AI provider detection and unified interface
 */

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
