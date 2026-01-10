/**
 * Context Gathering for AI Analysis
 * PRD 5.1: Gather repository context for AI prompts
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { FileIndexEntry } from "@offworld/types";
import { rankFileImportance } from "../importance/ranker.js";
import { isBinaryBuffer } from "../util.js";

// ============================================================================
// Configuration
// ============================================================================

/** Maximum token budget for context (roughly 4 chars per token) */
const MAX_CONTEXT_TOKENS = 4000;
const CHARS_PER_TOKEN = 4;

/** Token budget allocations */
const README_TOKEN_BUDGET = 500;
const PACKAGE_JSON_TOKEN_BUDGET = 300;
const FILE_TREE_TOKEN_BUDGET = 400;

/** Number of top files to include content for */
const TOP_FILES_COUNT = 15;
const MAX_FILE_CONTENT_CHARS = 2000;

// ============================================================================
// Types
// ============================================================================

/** Gathered context for AI analysis */
export interface GatheredContext {
	/** Absolute path to the repository */
	repoPath: string;
	/** Repository name (basename) */
	repoName: string;
	/** Truncated README content */
	readme: string | null;
	/** Package.json or equivalent config content */
	packageConfig: string | null;
	/** File tree string representation */
	fileTree: string;
	/** Top files by importance with content */
	topFiles: Array<{
		path: string;
		importance: number;
		role: string;
		content: string;
	}>;
	/** Estimated total tokens */
	estimatedTokens: number;
}

/** Options for context gathering */
export interface ContextOptions {
	/** Maximum number of top files to include (default: 15) */
	maxTopFiles?: number;
	/** Maximum characters per file content (default: 2000) */
	maxFileContentChars?: number;
	/** Override ranked files (for testing) */
	rankedFiles?: FileIndexEntry[];
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count from character count.
 * Uses rough approximation of 4 chars per token.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to approximately target token count.
 */
function truncateToTokens(text: string, targetTokens: number): string {
	const targetChars = targetTokens * CHARS_PER_TOKEN;
	if (text.length <= targetChars) {
		return text;
	}
	return text.slice(0, targetChars) + "\n... (truncated)";
}

// ============================================================================
// README Detection
// ============================================================================

/**
 * Find and read README file from repository.
 */
function findReadme(repoPath: string): string | null {
	const readmeNames = ["README.md", "readme.md", "README.MD", "Readme.md", "README", "readme"];

	for (const name of readmeNames) {
		const readmePath = join(repoPath, name);
		if (existsSync(readmePath)) {
			try {
				const content = readFileSync(readmePath, "utf-8");
				return truncateToTokens(content, README_TOKEN_BUDGET);
			} catch {
				return null;
			}
		}
	}

	return null;
}

// ============================================================================
// Package Config Detection
// ============================================================================

/**
 * Find and read package configuration file.
 * Supports: package.json, Cargo.toml, go.mod, pyproject.toml, etc.
 */
function findPackageConfig(repoPath: string): string | null {
	const configFiles = [
		{ name: "package.json", type: "json" },
		{ name: "Cargo.toml", type: "toml" },
		{ name: "go.mod", type: "text" },
		{ name: "pyproject.toml", type: "toml" },
		{ name: "setup.py", type: "python" },
		{ name: "requirements.txt", type: "text" },
		{ name: "deno.json", type: "json" },
		{ name: "bun.toml", type: "toml" },
	];

	for (const { name } of configFiles) {
		const configPath = join(repoPath, name);
		if (existsSync(configPath)) {
			try {
				const content = readFileSync(configPath, "utf-8");
				return truncateToTokens(content, PACKAGE_JSON_TOKEN_BUDGET);
			} catch {
				return null;
			}
		}
	}

	return null;
}

// ============================================================================
// File Tree Generation
// ============================================================================

/**
 * Build a tree representation of top files.
 */
function buildFileTree(topFiles: FileIndexEntry[]): string {
	const lines: string[] = ["Repository Structure (top files by importance):", ""];

	// Group by directory
	const byDir = new Map<string, FileIndexEntry[]>();
	for (const file of topFiles) {
		const dir = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : ".";
		if (!byDir.has(dir)) {
			byDir.set(dir, []);
		}
		byDir.get(dir)!.push(file);
	}

	// Sort directories
	const sortedDirs = Array.from(byDir.keys()).sort();

	for (const dir of sortedDirs) {
		const files = byDir.get(dir)!;
		lines.push(`${dir}/`);
		for (const file of files) {
			const fileName = basename(file.path);
			const importance = (file.importance * 100).toFixed(0);
			lines.push(`  ${fileName} (${file.type}, ${importance}%)`);
		}
	}

	const tree = lines.join("\n");
	return truncateToTokens(tree, FILE_TREE_TOKEN_BUDGET);
}

// ============================================================================
// File Content Reading
// ============================================================================

/**
 * Read file content safely, handling binary files.
 */
function readFileContent(filePath: string, maxChars: number): string | null {
	try {
		const buffer = readFileSync(filePath);
		if (isBinaryBuffer(buffer)) {
			return null;
		}
		const content = buffer.toString("utf-8");
		if (content.length > maxChars) {
			return content.slice(0, maxChars) + "\n... (truncated)";
		}
		return content;
	} catch {
		return null;
	}
}

// ============================================================================
// Main Context Gathering
// ============================================================================

/**
 * Gather context from a repository for AI analysis.
 *
 * This function collects:
 * 1. README.md (truncated to ~500 tokens)
 * 2. package.json or equivalent config
 * 3. File tree of top important files
 * 4. Content of top 10-20 files by importance
 *
 * Total context stays within ~3500-4000 token budget.
 *
 * @param repoPath - Absolute path to the repository
 * @param options - Optional configuration
 * @returns Gathered context for AI analysis
 *
 * @example
 * ```ts
 * const context = await gatherContext('/path/to/repo');
 * console.log(context.estimatedTokens); // ~3500
 * ```
 */
export async function gatherContext(
	repoPath: string,
	options: ContextOptions = {},
): Promise<GatheredContext> {
	const maxTopFiles = options.maxTopFiles ?? TOP_FILES_COUNT;
	const maxFileContentChars = options.maxFileContentChars ?? MAX_FILE_CONTENT_CHARS;

	// Get repository name
	const repoName = basename(repoPath);

	// Read README
	const readme = findReadme(repoPath);

	// Read package config
	const packageConfig = findPackageConfig(repoPath);

	// Get ranked files (or use provided for testing)
	const rankedFiles = options.rankedFiles ?? (await rankFileImportance(repoPath));

	// Take top N files
	const topFilesRanked = rankedFiles.slice(0, maxTopFiles);

	// Build file tree
	const fileTree = buildFileTree(topFilesRanked);

	// Calculate remaining token budget for file contents
	let usedTokens = 0;
	usedTokens += readme ? estimateTokens(readme) : 0;
	usedTokens += packageConfig ? estimateTokens(packageConfig) : 0;
	usedTokens += estimateTokens(fileTree);

	const remainingTokenBudget = MAX_CONTEXT_TOKENS - usedTokens;
	const tokensPerFile = Math.floor(remainingTokenBudget / maxTopFiles);
	const charsPerFile = Math.min(maxFileContentChars, tokensPerFile * CHARS_PER_TOKEN);

	// Read file contents
	const topFiles: GatheredContext["topFiles"] = [];

	for (const file of topFilesRanked) {
		const fullPath = join(repoPath, file.path);
		const content = readFileContent(fullPath, charsPerFile);

		if (content !== null) {
			topFiles.push({
				path: file.path,
				importance: file.importance,
				role: file.type,
				content,
			});
		}
	}

	// Calculate total estimated tokens
	let totalTokens = usedTokens;
	for (const file of topFiles) {
		totalTokens += estimateTokens(file.content);
	}

	return {
		repoPath,
		repoName,
		readme,
		packageConfig,
		fileTree,
		topFiles,
		estimatedTokens: totalTokens,
	};
}

/**
 * Format gathered context into a single prompt string for AI.
 */
export function formatContextForPrompt(context: GatheredContext): string {
	const sections: string[] = [];

	sections.push(`# Repository: ${context.repoName}`);
	sections.push("");

	if (context.readme) {
		sections.push("## README");
		sections.push("");
		sections.push(context.readme);
		sections.push("");
	}

	if (context.packageConfig) {
		sections.push("## Package Configuration");
		sections.push("");
		sections.push("```");
		sections.push(context.packageConfig);
		sections.push("```");
		sections.push("");
	}

	sections.push("## " + context.fileTree);
	sections.push("");

	sections.push("## Key Files Content");
	sections.push("");

	for (const file of context.topFiles) {
		const ext = extname(file.path).slice(1) || "text";
		sections.push(`### ${file.path}`);
		sections.push("");
		sections.push("```" + ext);
		sections.push(file.content);
		sections.push("```");
		sections.push("");
	}

	return sections.join("\n");
}
