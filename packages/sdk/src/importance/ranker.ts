/**
 * File Importance Ranking
 * PRD 3.9: Rank files by importance using import graph analysis
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import type { FileIndexEntry, FileRole } from "@offworld/types";

import { DEFAULT_IGNORE_PATTERNS, SUPPORTED_EXTENSIONS } from "../constants.js";
import { isBinaryBuffer, loadGitignorePatternsSimple } from "../util.js";
import { extractImports, type ExtractedImport } from "./queries.js";
import { getLanguage, initializeParser, isParserInitialized } from "./parser.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Import graph node with inbound/outbound edges
 */
interface ImportGraphNode {
	/** Relative path from repo root */
	path: string;
	/** Modules this file imports */
	imports: string[];
	/** Files that import this file (relative paths) */
	importedBy: string[];
}

/**
 * Options for file discovery and ranking
 */
export interface RankOptions {
	/** Additional patterns to ignore (combined with defaults and .gitignore) */
	additionalIgnorePatterns?: string[];
	/** Maximum number of files to process (default: 10000) */
	maxFiles?: number;
	/** Maximum file size in bytes to process (default: 1MB) */
	maxFileSize?: number;
}

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Check if a path matches a glob pattern.
 * Supports basic glob patterns: *, **, ?
 */
function matchesPattern(filePath: string, pattern: string): boolean {
	// Normalize path separators
	const normalizedPath = filePath.replace(/\\/g, "/");
	const normalizedPattern = pattern.replace(/\\/g, "/");

	// Convert glob pattern to regex
	let regexStr = normalizedPattern
		// Escape special regex chars except * and ?
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		// ** matches any path segments
		.replace(/\*\*/g, "{{GLOBSTAR}}")
		// * matches anything except /
		.replace(/\*/g, "[^/]*")
		// ? matches single char except /
		.replace(/\?/g, "[^/]")
		// Restore globstar
		.replace(/\{\{GLOBSTAR\}\}/g, ".*");

	// Pattern can match anywhere in the path if it doesn't start with /
	if (!pattern.startsWith("/")) {
		regexStr = `(^|/)${regexStr}($|/)`;
	} else {
		regexStr = `^${regexStr.slice(1)}($|/)`;
	}

	const regex = new RegExp(regexStr);
	return regex.test(normalizedPath);
}

/**
 * Check if a path should be ignored based on patterns
 */
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
	return ignorePatterns.some((pattern) => matchesPattern(filePath, pattern));
}

// ============================================================================
// File Discovery
// ============================================================================

/**
 * Recursively discover all source files in a directory
 */
function discoverFiles(
	dir: string,
	repoRoot: string,
	ignorePatterns: string[],
	options: RankOptions,
	files: string[] = [],
): string[] {
	const maxFiles = options.maxFiles ?? 10000;
	const maxFileSize = options.maxFileSize ?? 1024 * 1024; // 1MB

	if (files.length >= maxFiles) {
		return files;
	}

	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		// Permission denied or other error
		return files;
	}

	for (const entry of entries) {
		if (files.length >= maxFiles) {
			break;
		}

		const fullPath = join(dir, entry);
		const relativePath = relative(repoRoot, fullPath);

		// Check ignore patterns
		if (shouldIgnore(relativePath, ignorePatterns)) {
			continue;
		}

		let stat;
		try {
			stat = statSync(fullPath);
		} catch {
			continue;
		}

		if (stat.isDirectory()) {
			// Recursively process directories
			discoverFiles(fullPath, repoRoot, ignorePatterns, options, files);
		} else if (stat.isFile()) {
			// Check file size
			if (stat.size > maxFileSize) {
				continue;
			}

			// Check if it's a supported extension
			const ext = extname(entry);
			if (SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
				files.push(relativePath);
			}
		}
	}

	return files;
}

// ============================================================================
// Import Resolution
// ============================================================================

/**
 * Resolve a relative import to a file path within the repository.
 * Returns null if the import cannot be resolved to a file.
 */
function resolveRelativeImport(
	importPath: string,
	importerPath: string,
	existingFiles: Set<string>,
): string | null {
	// Get directory of the importing file
	const importerDir = dirname(importerPath);

	// Resolve the import path relative to the importer
	let resolved = resolve("/", importerDir, importPath).slice(1); // Remove leading /

	// Try exact match first
	if (existingFiles.has(resolved)) {
		return resolved;
	}

	// Try with common extensions
	const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];
	for (const ext of extensions) {
		const withExt = resolved + ext;
		if (existingFiles.has(withExt)) {
			return withExt;
		}
	}

	// Try index files
	const indexFiles = ["index.ts", "index.tsx", "index.js", "index.jsx"];
	for (const indexFile of indexFiles) {
		const withIndex = join(resolved, indexFile);
		if (existingFiles.has(withIndex)) {
			return withIndex;
		}
	}

	return null;
}

// ============================================================================
// Import Graph Building
// ============================================================================

/**
 * Build an import graph from discovered files.
 * Parses each file and extracts imports, then builds the graph.
 */
async function buildImportGraph(
	files: string[],
	repoRoot: string,
): Promise<Map<string, ImportGraphNode>> {
	const graph = new Map<string, ImportGraphNode>();
	const fileSet = new Set(files);

	// Initialize graph nodes
	for (const file of files) {
		graph.set(file, {
			path: file,
			imports: [],
			importedBy: [],
		});
	}

	// Parse each file and extract imports
	for (const file of files) {
		const fullPath = join(repoRoot, file);
		const ext = extname(file);
		const language = getLanguage(ext);

		if (!language) {
			continue;
		}

		// Read file content
		let content: string;
		try {
			const buffer = readFileSync(fullPath);

			// Skip binary files
			if (isBinaryBuffer(buffer)) {
				continue;
			}

			content = buffer.toString("utf-8");
		} catch {
			continue;
		}

		// Extract imports
		let imports: ExtractedImport[];
		try {
			imports = await extractImports(content, language);
		} catch {
			// Parser error - skip this file
			continue;
		}

		const node = graph.get(file)!;

		// Process each import
		for (const imp of imports) {
			node.imports.push(imp.module);

			// Only track relative imports for the dependency graph
			if (imp.isRelative) {
				const resolved = resolveRelativeImport(imp.module, file, fileSet);
				if (resolved) {
					const targetNode = graph.get(resolved);
					if (targetNode && !targetNode.importedBy.includes(file)) {
						targetNode.importedBy.push(file);
					}
				}
			}
		}
	}

	return graph;
}

// ============================================================================
// Importance Scoring
// ============================================================================

/**
 * Determine file role based on path and characteristics
 */
function determineFileRole(filePath: string): FileRole {
	const fileName = basename(filePath).toLowerCase();
	const dirName = dirname(filePath).toLowerCase();

	// Entry points
	if (
		fileName === "index.ts" ||
		fileName === "index.tsx" ||
		fileName === "index.js" ||
		fileName === "main.ts" ||
		fileName === "main.py" ||
		fileName === "main.go" ||
		fileName === "lib.rs" ||
		fileName === "mod.rs"
	) {
		return "entry";
	}

	// Config files
	if (
		fileName.includes("config") ||
		fileName.includes(".config.") ||
		fileName === "tsconfig.json" ||
		fileName === "package.json"
	) {
		return "config";
	}

	// Type definition files
	if (
		fileName.endsWith(".d.ts") ||
		fileName === "types.ts" ||
		fileName === "types.tsx" ||
		dirName.includes("types") ||
		dirName.includes("interfaces")
	) {
		return "types";
	}

	// Test files
	if (
		fileName.includes(".test.") ||
		fileName.includes(".spec.") ||
		fileName.includes("_test.") ||
		dirName.includes("__tests__") ||
		dirName.includes("test") ||
		dirName.includes("tests")
	) {
		return "test";
	}

	// Utility files
	if (
		fileName === "util.ts" ||
		fileName === "utils.ts" ||
		fileName === "helpers.ts" ||
		dirName.includes("util") ||
		dirName.includes("helper")
	) {
		return "util";
	}

	// Documentation
	if (fileName.endsWith(".md") || dirName.includes("docs")) {
		return "doc";
	}

	// Default to core
	return "core";
}

/**
 * Calculate importance scores for all files in the graph.
 * Uses inbound edge count (how many files import this file) as the primary metric.
 */
function calculateImportanceScores(graph: Map<string, ImportGraphNode>): Map<string, number> {
	const scores = new Map<string, number>();

	// Find maximum inbound count for normalization
	let maxInbound = 0;
	for (const node of graph.values()) {
		maxInbound = Math.max(maxInbound, node.importedBy.length);
	}

	// Calculate scores
	for (const [path, node] of graph) {
		let score = 0;

		// Base score from inbound imports (normalized to 0-0.7)
		if (maxInbound > 0) {
			score += (node.importedBy.length / maxInbound) * 0.7;
		}

		// Bonus for entry points (up to 0.2)
		const role = determineFileRole(path);
		if (role === "entry") {
			score += 0.2;
		}

		// Bonus for core files (up to 0.1)
		if (role === "core") {
			score += 0.05;
		}

		// Penalty for test files
		if (role === "test") {
			score *= 0.3;
		}

		// Ensure score is in [0, 1] range
		score = Math.min(1, Math.max(0, score));

		scores.set(path, score);
	}

	return scores;
}

// ============================================================================
// Main Ranking Function
// ============================================================================

/**
 * Rank all files in a repository by importance.
 *
 * Algorithm:
 * 1. Discover all source files respecting ignore patterns
 * 2. Parse each file to extract imports
 * 3. Build import graph with inbound/outbound edges
 * 4. Score files by inbound import count (how many files depend on this file)
 * 5. Return sorted FileIndexEntry[] (highest importance first)
 *
 * @param repoPath - Absolute path to the repository root
 * @param options - Optional configuration for ranking
 * @returns Array of FileIndexEntry sorted by importance (descending)
 *
 * @example
 * ```ts
 * const ranked = await rankFileImportance('/path/to/repo');
 * console.log(ranked[0]); // Most important file
 * ```
 */
export async function rankFileImportance(
	repoPath: string,
	options: RankOptions = {},
): Promise<FileIndexEntry[]> {
	// Ensure parser is initialized
	if (!isParserInitialized()) {
		await initializeParser();
	}

	// Validate repo path exists
	if (!existsSync(repoPath)) {
		throw new Error(`Repository path does not exist: ${repoPath}`);
	}

	// Build combined ignore patterns
	const ignorePatterns: string[] = [
		...DEFAULT_IGNORE_PATTERNS,
		...loadGitignorePatternsSimple(repoPath),
		...(options.additionalIgnorePatterns ?? []),
	];

	// Discover files
	const files = discoverFiles(repoPath, repoPath, ignorePatterns, options);

	if (files.length === 0) {
		return [];
	}

	// Build import graph
	const graph = await buildImportGraph(files, repoPath);

	// Calculate importance scores
	const scores = calculateImportanceScores(graph);

	// Build FileIndexEntry array
	const entries: FileIndexEntry[] = [];
	for (const [path, node] of graph) {
		const score = scores.get(path) ?? 0;
		const role = determineFileRole(path);

		entries.push({
			path,
			importance: Math.round(score * 1000) / 1000, // Round to 3 decimal places
			type: role,
			imports: node.imports.length > 0 ? node.imports : undefined,
		});
	}

	// Sort by importance descending
	entries.sort((a, b) => b.importance - a.importance);

	return entries;
}
