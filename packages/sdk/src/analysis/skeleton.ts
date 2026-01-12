import { dirname } from "node:path";
import type { ParsedFile } from "../ast/parser.js";
import type { ASTEnhancedFileEntry } from "./heuristics.js";

/**
 * Quick path entry for fast file access
 */
export interface QuickPath {
	path: string;
	reason: string;
}

/**
 * Search pattern for finding code
 */
export interface SearchPattern {
	pattern: string;
	scope?: string;
}

/**
 * Entity representing a directory/module
 */
export interface SkeletonEntity {
	name: string;
	path: string;
	files: string[];
}

/**
 * Detected patterns about the repository
 */
export interface DetectedPatterns {
	language: string;
	hasTests: boolean;
	hasDocs: boolean;
}

/**
 * Deterministic skeleton built from repository analysis
 */
export interface SkillSkeleton {
	name: string;
	repoPath: string;
	quickPaths: QuickPath[];
	searchPatterns: SearchPattern[];
	entities: SkeletonEntity[];
	detectedPatterns: DetectedPatterns;
}

// Directories to exclude from entity grouping
const EXCLUDED_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	"out",
	".next",
	".nuxt",
	"coverage",
	"__pycache__",
	".pytest_cache",
	"target",
	"vendor",
]);

// Generic symbol names to filter out
const GENERIC_SYMBOLS = new Set([
	"default",
	"index",
	"main",
	"init",
	"setup",
	"config",
	"utils",
	"helpers",
	"types",
	"constants",
	"get",
	"set",
	"run",
	"start",
	"stop",
	"create",
	"update",
	"delete",
	"handle",
	"process",
	"render",
	"App",
	"Component",
	"Provider",
	"Context",
	// Deprioritize example/demo patterns common in library codebases
	"Page",
	"Loading",
	"Example",
	"Demo",
	"Sample",
	"Test",
	"Spec",
]);

// Directories that typically contain example/demo code rather than library code
const EXAMPLE_DIRS = new Set([
	"examples",
	"example",
	"demo",
	"demos",
	"playground",
	"playgrounds",
	"samples",
	"sample",
	"e2e",
	"test",
	"tests",
	"__tests__",
	"fixtures",
]);

/**
 * Build a deterministic skill skeleton from repository analysis.
 * No AI calls - purely deterministic structure generation.
 */
export function buildSkeleton(
	repoPath: string,
	repoName: string,
	topFiles: ASTEnhancedFileEntry[],
	parsedFiles: Map<string, ParsedFile>,
): SkillSkeleton {
	const quickPaths = buildQuickPaths(topFiles, parsedFiles);
	const searchPatterns = buildSearchPatterns(parsedFiles);
	const entities = buildEntities(topFiles);
	const detectedPatterns = detectPatterns(parsedFiles, topFiles);

	return {
		name: repoName,
		repoPath,
		quickPaths,
		searchPatterns,
		entities,
		detectedPatterns,
	};
}

export function buildQuickPaths(
	topFiles: ASTEnhancedFileEntry[],
	_parsedFiles: Map<string, ParsedFile>,
): QuickPath[] {
	const top10 = topFiles.slice(0, 10);

	return top10.map((file) => {
		let reason: string;

		if (file.type === "entry") reason = "entry";
		else if (file.type === "config") reason = "config";
		else if (file.type === "types") reason = "types";
		else if (file.type === "test") reason = "test";
		else if (file.type === "core") reason = "core";
		else reason = "source";

		return { path: file.path, reason };
	});
}

/**
 * Check if a file path is within an example/demo directory
 */
function isExamplePath(path: string): boolean {
	const parts = path.toLowerCase().split("/");
	return parts.some((part) => EXAMPLE_DIRS.has(part));
}

/**
 * Build search patterns from top symbol names in parsed files.
 * Separates library code from example directories, prioritizing library patterns.
 * Returns max 10 patterns: up to 7 from library code, up to 3 from examples.
 */
export function buildSearchPatterns(parsedFiles: Map<string, ParsedFile>): SearchPattern[] {
	const librarySymbols = new Map<string, { count: number; paths: string[] }>();
	const exampleSymbols = new Map<string, { count: number; paths: string[] }>();

	// Count symbol occurrences, separating library from example code
	for (const [path, parsed] of parsedFiles) {
		const isExample = isExamplePath(path);
		const targetMap = isExample ? exampleSymbols : librarySymbols;

		const symbols = [...parsed.functions, ...parsed.classes];
		for (const symbol of symbols) {
			const name = symbol.name;

			// Filter out short names (< 4 chars) and generic names
			if (name.length < 4 || GENERIC_SYMBOLS.has(name)) {
				continue;
			}

			// Filter out names that are all lowercase single words (likely private/internal)
			if (/^[a-z]+$/.test(name) && name.length < 6) {
				continue;
			}

			const existing = targetMap.get(name) ?? { count: 0, paths: [] };
			existing.count++;
			if (!existing.paths.includes(path)) {
				existing.paths.push(path);
			}
			targetMap.set(name, existing);
		}
	}

	// Sort library patterns by count and take top 7
	const sortedLibrary = [...librarySymbols.entries()]
		.filter(([_, data]) => data.count >= 1)
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 7);

	// Sort example patterns by count and take top 3
	const sortedExamples = [...exampleSymbols.entries()]
		.filter(([_, data]) => data.count >= 1)
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 3);

	// Combine patterns, library first
	const allPatterns = [...sortedLibrary, ...sortedExamples];

	return allPatterns.map(([pattern, data]) => {
		// If symbol appears in only one file, scope to that directory
		const firstPath = data.paths[0];
		const scope = data.paths.length === 1 && firstPath ? dirname(firstPath) : undefined;

		return {
			pattern,
			scope,
		};
	});
}

// Directories that indicate nested entities should be used (e.g., packages/foo, apps/bar)
const MONOREPO_PARENT_DIRS = new Set([
	"packages",
	"apps",
	"libs",
	"modules",
	"services",
	"plugins",
	"crates", // Rust workspaces
	"internal", // Go internal packages
]);

/**
 * Determine the entity path for a file. For monorepo patterns, uses nested paths.
 * Returns the directory path that should be used as the entity identifier.
 */
function getEntityPath(filePath: string): string | null {
	const parts = filePath.split("/");
	if (parts.length < 2) return "root";

	const firstPart = parts[0];
	if (!firstPart) return "root";

	// Skip excluded directories
	if (EXCLUDED_DIRS.has(firstPart)) return null;

	// Check if this is a monorepo parent directory with nested packages
	if (MONOREPO_PARENT_DIRS.has(firstPart) && parts.length >= 2) {
		const secondPart = parts[1];
		// If there's a second level, use that as the entity
		if (secondPart && !EXCLUDED_DIRS.has(secondPart)) {
			return `${firstPart}/${secondPart}`;
		}
	}

	// Default: use first-level directory
	return firstPart;
}

/**
 * Build entities by grouping files by directory.
 * For monorepo patterns (packages/*, apps/*), uses nested entities.
 * Excludes node_modules, .git, dist, etc.
 */
export function buildEntities(topFiles: ASTEnhancedFileEntry[]): SkeletonEntity[] {
	const entityMap = new Map<string, string[]>();

	for (const file of topFiles) {
		const entityPath = getEntityPath(file.path);
		if (!entityPath) continue;

		const existing = entityMap.get(entityPath) ?? [];
		existing.push(file.path);
		entityMap.set(entityPath, existing);
	}

	return [...entityMap.entries()]
		.map(([path, files]) => ({
			name: path === "root" ? "root" : (path.split("/").pop() ?? path), // Use last segment as name
			path: path === "root" ? "" : path,
			files,
		}))
		.sort((a, b) => b.files.length - a.files.length); // Sort by file count descending
}

/**
 * Detect patterns about the repository: language, tests, docs
 */
export function detectPatterns(
	parsedFiles: Map<string, ParsedFile>,
	topFiles: ASTEnhancedFileEntry[],
): DetectedPatterns {
	const language = detectLanguage(parsedFiles);
	const hasTests = topFiles.some((f) => f.type === "test" || f.hasTests);
	const hasDocs = topFiles.some((f) => f.type === "doc" || f.path.toLowerCase().includes("readme"));

	return {
		language,
		hasTests,
		hasDocs,
	};
}

/**
 * Detect the primary programming language
 */
export function detectLanguage(parsedFiles: Map<string, ParsedFile>): string {
	const langCounts: Record<string, number> = {};

	for (const parsed of parsedFiles.values()) {
		const lang = parsed.language.toLowerCase();
		langCounts[lang] = (langCounts[lang] ?? 0) + 1;
	}

	const sorted = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);

	const topLang = sorted[0];
	if (!topLang) {
		return "unknown";
	}

	// Normalize language names
	const langNames: Record<string, string> = {
		typescript: "TypeScript",
		tsx: "TypeScript",
		javascript: "JavaScript",
		python: "Python",
		rust: "Rust",
		go: "Go",
		java: "Java",
	};

	const [langKey] = topLang;
	return langNames[langKey] ?? langKey;
}
