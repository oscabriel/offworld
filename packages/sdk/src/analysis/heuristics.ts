import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import type { FileIndexEntry, FileRole } from "@offworld/types";
import type { ParsedFile } from "../ast/parser.js";
import { DEFAULT_IGNORE_PATTERNS, SUPPORTED_EXTENSIONS, HEURISTICS_LIMITS } from "../constants.js";
import { loadGitignorePatternsSimple } from "../util.js";

export interface HeuristicsOptions {
	additionalIgnorePatterns?: string[];
	maxFiles?: number;
	maxFileSize?: number;
}

function matchesPattern(filePath: string, pattern: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, "/");
	const normalizedPattern = pattern.replace(/\\/g, "/");

	let regexStr = normalizedPattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "{{GLOBSTAR}}")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, "[^/]")
		.replace(/\{\{GLOBSTAR\}\}/g, ".*");

	if (!pattern.startsWith("/")) {
		regexStr = `(^|/)${regexStr}($|/)`;
	} else {
		regexStr = `^${regexStr.slice(1)}($|/)`;
	}

	const regex = new RegExp(regexStr);
	return regex.test(normalizedPath);
}

function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
	return ignorePatterns.some((pattern) => matchesPattern(filePath, pattern));
}

function discoverFiles(
	dir: string,
	repoRoot: string,
	ignorePatterns: string[],
	options: HeuristicsOptions,
	files: string[] = [],
): string[] {
	const maxFiles = options.maxFiles ?? HEURISTICS_LIMITS.MAX_FILES;
	const maxFileSize = options.maxFileSize ?? HEURISTICS_LIMITS.MAX_FILE_SIZE;

	if (files.length >= maxFiles) {
		return files;
	}

	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return files;
	}

	for (const entry of entries) {
		if (files.length >= maxFiles) {
			break;
		}

		const fullPath = join(dir, entry);
		const relativePath = relative(repoRoot, fullPath);

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
			discoverFiles(fullPath, repoRoot, ignorePatterns, options, files);
		} else if (stat.isFile()) {
			if (stat.size > maxFileSize) {
				continue;
			}

			const ext = extname(entry);
			if (SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
				files.push(relativePath);
			}
		}
	}

	return files;
}

function determineFileRole(filePath: string): FileRole {
	const fileName = basename(filePath).toLowerCase();
	const dirName = dirname(filePath).toLowerCase();

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

	if (
		fileName.includes("config") ||
		fileName.includes(".config.") ||
		fileName === "tsconfig.json" ||
		fileName === "package.json"
	) {
		return "config";
	}

	if (
		fileName.endsWith(".d.ts") ||
		fileName === "types.ts" ||
		fileName === "types.tsx" ||
		dirName.includes("types") ||
		dirName.includes("interfaces")
	) {
		return "types";
	}

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

	if (
		fileName === "util.ts" ||
		fileName === "utils.ts" ||
		fileName === "helpers.ts" ||
		dirName.includes("util") ||
		dirName.includes("helper")
	) {
		return "util";
	}

	if (fileName.endsWith(".md") || dirName.includes("docs")) {
		return "doc";
	}

	return "core";
}

/**
 * PRD-002 scoring rules:
 * - Entry points (index.*, main.*, lib.rs): 0.9
 * - Config files (package.json, *.config.*): 0.8
 * - Source directories (src/**, lib/**): 0.6-0.7
 * - Test files: 0.3
 */
function scoreFile(filePath: string): number {
	const dirPath = dirname(filePath).toLowerCase();
	const role = determineFileRole(filePath);

	if (role === "entry") {
		if (!filePath.includes("/") || dirPath === "src" || dirPath === "lib") {
			return 0.9;
		}
		return 0.85;
	}

	if (role === "config") {
		return 0.8;
	}

	if (role === "types") {
		return 0.75;
	}

	if (role === "test") {
		return 0.3;
	}

	if (role === "util") {
		return 0.5;
	}

	const depth = filePath.split("/").length;

	if (
		dirPath.startsWith("src") ||
		dirPath.startsWith("lib") ||
		/packages\/[^/]+\/src/.test(dirPath)
	) {
		if (depth <= 2) return 0.7;
		if (depth <= 4) return 0.65;
		return 0.6;
	}

	if (dirPath.includes("example") || dirPath.includes("sample")) {
		return 0.45;
	}

	return 0.55;
}

/**
 * Detect if a file is a re-export shim (barrel file with only exports).
 * These files add noise to analysis - they don't contain meaningful logic.
 */
function isReExportShim(content: string): boolean {
	const lines = content
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));

	if (lines.length === 0 || lines.length > 5) return false;

	return lines.every(
		(l) =>
			/^export \* from ['"]/.test(l) ||
			/^export \{[^}]+\} from ['"]/.test(l) ||
			/^\/\*\*.*\*\/\s*$/.test(l) ||
			l === "",
	);
}

/**
 * Check if a file at the given path is a re-export shim.
 * Only checks files named index.ts/js to limit I/O.
 */
function checkReExportShim(fullPath: string, fileName: string): boolean {
	// Only check index files - most common barrel pattern
	if (
		fileName !== "index.ts" &&
		fileName !== "index.js" &&
		fileName !== "index.tsx" &&
		fileName !== "index.mjs"
	) {
		return false;
	}

	try {
		const content = readFileSync(fullPath, "utf-8");
		return isReExportShim(content);
	} catch {
		return false;
	}
}

export async function rankFilesByHeuristics(
	repoPath: string,
	options: HeuristicsOptions = {},
): Promise<FileIndexEntry[]> {
	if (!existsSync(repoPath)) {
		throw new Error(`Repository path does not exist: ${repoPath}`);
	}

	const ignorePatterns: string[] = [
		...DEFAULT_IGNORE_PATTERNS,
		...loadGitignorePatternsSimple(repoPath),
		...(options.additionalIgnorePatterns ?? []),
	];

	const files = discoverFiles(repoPath, repoPath, ignorePatterns, options);

	if (files.length === 0) {
		return [];
	}

	const entries: FileIndexEntry[] = files.map((path) => {
		const fileName = basename(path);
		const fullPath = join(repoPath, path);
		let importance = scoreFile(path);

		// Penalize re-export shims (barrel files)
		if (checkReExportShim(fullPath, fileName)) {
			importance = 0.05;
		}

		return {
			path,
			importance: Math.round(importance * 1000) / 1000,
			type: determineFileRole(path),
		};
	});

	entries.sort((a, b) => b.importance - a.importance);

	return entries;
}

/**
 * Extended file entry with AST-derived metadata
 */
export interface ASTEnhancedFileEntry extends FileIndexEntry {
	exportCount?: number;
	functionCount?: number;
	hasTests?: boolean;
	reason?: string;
}

/**
 * Rank files using both heuristics and AST data.
 * Boosts scores based on export count, function count, and test file detection.
 */
export async function rankFilesWithAST(
	repoPath: string,
	parsedFiles: Map<string, ParsedFile>,
	options: HeuristicsOptions = {},
): Promise<ASTEnhancedFileEntry[]> {
	// Start with standard heuristic ranking
	const baseEntries = await rankFilesByHeuristics(repoPath, options);

	// Enhance with AST data
	const enhancedEntries: ASTEnhancedFileEntry[] = baseEntries.map((entry) => {
		const parsed = parsedFiles.get(entry.path);
		if (!parsed) {
			return entry;
		}

		let importance = entry.importance;
		const reasons: string[] = [];

		// Count exports (exported functions + exported classes)
		const exportCount =
			parsed.functions.filter((f) => f.isExported).length +
			parsed.classes.filter((c) => c.isExported).length +
			parsed.exports.length;

		// Count functions
		const functionCount = parsed.functions.length;

		// Boost for high export count (more public API surface)
		if (exportCount > 10) {
			importance += 0.15;
			reasons.push(`${exportCount} exports`);
		} else if (exportCount > 5) {
			importance += 0.1;
			reasons.push(`${exportCount} exports`);
		} else if (exportCount > 0) {
			importance += 0.05;
			reasons.push(`${exportCount} exports`);
		}

		// Boost for high function count (more logic)
		if (functionCount > 15) {
			importance += 0.1;
			reasons.push(`${functionCount} functions`);
		} else if (functionCount > 5) {
			importance += 0.05;
			reasons.push(`${functionCount} functions`);
		}

		// Flag test files from AST detection (may catch cases path heuristics miss)
		const hasTests = parsed.hasTests;
		if (hasTests && entry.type !== "test") {
			// AST detected test content in a file not caught by path heuristics
			// This is informational - don't change the score
			reasons.push("contains tests");
		}

		// Cap importance at 1.0
		importance = Math.min(1.0, importance);

		return {
			...entry,
			importance: Math.round(importance * 1000) / 1000,
			exportCount,
			functionCount,
			hasTests,
			reason: reasons.length > 0 ? reasons.join(", ") : undefined,
		};
	});

	// Re-sort after boosting
	enhancedEntries.sort((a, b) => b.importance - a.importance);

	return enhancedEntries;
}
