/**
 * AI Provider detection for analysis operations
 * PRD 3.10: AI provider detection
 */

import { execSync } from "node:child_process";
import type { AIProvider, Config } from "@offworld/types";
import { loadConfig } from "../config.js";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error for AI provider issues
 */
export class AIProviderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AIProviderError";
	}
}

/**
 * Thrown when no AI provider is available
 */
export class AIProviderNotFoundError extends AIProviderError {
	constructor() {
		super(
			`No AI provider found. Please install one of the following:

Claude Code:
  npm install -g @anthropic-ai/claude-code
  # or visit: https://claude.ai/code

OpenCode:
  # Start OpenCode server on localhost:4096
  # Visit: https://opencode.ai for installation instructions

After installation, run your command again.`,
		);
		this.name = "AIProviderNotFoundError";
	}
}

/**
 * Thrown when preferred provider is not available
 */
export class PreferredProviderNotAvailableError extends AIProviderError {
	constructor(provider: AIProvider) {
		super(
			`Preferred provider "${provider}" is not available. ` +
				`Either install it or remove the preference from your config.`,
		);
		this.name = "PreferredProviderNotAvailableError";
	}
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Check if Claude Code CLI is available
 * Runs `claude --version` to verify installation
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
	try {
		execSync("claude --version", {
			stdio: "pipe",
			encoding: "utf-8",
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if OpenCode server is available
 * Calls localhost:4096/health to verify the server is running
 */
export async function isOpenCodeAvailable(): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		const response = await fetch("http://localhost:4096/health", {
			method: "GET",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Check if a specific provider is available
 */
export async function isProviderAvailable(provider: AIProvider): Promise<boolean> {
	switch (provider) {
		case "claude-code":
			return isClaudeCodeAvailable();
		case "opencode":
			return isOpenCodeAvailable();
		default:
			return false;
	}
}

/**
 * Detection result with provider info
 */
export interface DetectionResult {
	provider: AIProvider;
	isPreferred: boolean;
}

/**
 * Detect available AI provider
 *
 * Priority:
 * 1. config.preferredProvider if set AND available
 * 2. Claude Code if available
 * 3. OpenCode if available
 * 4. Throws AIProviderNotFoundError if none available
 *
 * @param config - Optional config, will load from disk if not provided
 * @throws AIProviderNotFoundError if no provider is available
 * @throws PreferredProviderNotAvailableError if preferred is set but unavailable
 */
export async function detectProvider(config?: Config): Promise<DetectionResult> {
	const cfg = config ?? loadConfig();

	// Check preferred provider first
	if (cfg.preferredProvider) {
		const available = await isProviderAvailable(cfg.preferredProvider);
		if (available) {
			return {
				provider: cfg.preferredProvider,
				isPreferred: true,
			};
		}
		// Preferred provider set but not available - warn but continue
		// Don't throw here, fall back to detection
	}

	// Try Claude Code first (more commonly installed)
	if (await isClaudeCodeAvailable()) {
		return {
			provider: "claude-code",
			isPreferred: false,
		};
	}

	// Try OpenCode
	if (await isOpenCodeAvailable()) {
		return {
			provider: "opencode",
			isPreferred: false,
		};
	}

	// No provider available
	throw new AIProviderNotFoundError();
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: AIProvider): string {
	switch (provider) {
		case "claude-code":
			return "Claude Code";
		case "opencode":
			return "OpenCode";
		default:
			return provider;
	}
}
