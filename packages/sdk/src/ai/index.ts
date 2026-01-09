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
