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

/**
 * Build quick paths from top 20 files, enhanced with export/function counts
 */
export function buildQuickPaths(
	topFiles: ASTEnhancedFileEntry[],
	_parsedFiles: Map<string, ParsedFile>,
): QuickPath[] {
	const top20 = topFiles.slice(0, 20);

	return top20.map((file) => {
		const reasons: string[] = [];

		// Add role-based reason
		if (file.type === "entry") reasons.push("entry point");
		else if (file.type === "config") reasons.push("configuration");
		else if (file.type === "types") reasons.push("type definitions");
		else if (file.type === "test") reasons.push("test file");
		else if (file.type === "core") reasons.push("core implementation");

		// Add AST-derived reasons
		if (file.exportCount && file.exportCount > 0) {
			reasons.push(`${file.exportCount} exports`);
		}
		if (file.functionCount && file.functionCount > 0) {
			reasons.push(`${file.functionCount} functions`);
		}

		// Fallback if no reasons
		if (reasons.length === 0) {
			reasons.push("source file");
		}

		return {
			path: file.path,
			reason: reasons.join(", "),
		};
	});
}

/**
 * Build search patterns from top symbol names in parsed files.
 * Filters out short/generic names.
 */
export function buildSearchPatterns(parsedFiles: Map<string, ParsedFile>): SearchPattern[] {
	const symbolCounts = new Map<string, { count: number; paths: string[] }>();

	// Count symbol occurrences
	for (const [path, parsed] of parsedFiles) {
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

			const existing = symbolCounts.get(name) ?? { count: 0, paths: [] };
			existing.count++;
			if (!existing.paths.includes(path)) {
				existing.paths.push(path);
			}
			symbolCounts.set(name, existing);
		}
	}

	// Sort by count and take top 10
	const sorted = [...symbolCounts.entries()]
		.filter(([_, data]) => data.count >= 1) // At least 1 occurrence
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 10);

	return sorted.map(([pattern, data]) => {
		// If symbol appears in only one file, scope to that directory
		const firstPath = data.paths[0];
		const scope = data.paths.length === 1 && firstPath ? dirname(firstPath) : undefined;

		return {
			pattern,
			scope,
		};
	});
}

/**
 * Build entities by grouping files by top-level directory.
 * Excludes node_modules, .git, dist, etc.
 */
export function buildEntities(topFiles: ASTEnhancedFileEntry[]): SkeletonEntity[] {
	const entityMap = new Map<string, string[]>();

	for (const file of topFiles) {
		const parts = file.path.split("/");
		const firstPart = parts[0];
		const topDir = parts.length > 1 && firstPart ? firstPart : "root";

		// Skip excluded directories
		if (EXCLUDED_DIRS.has(topDir)) {
			continue;
		}

		const existing = entityMap.get(topDir) ?? [];
		existing.push(file.path);
		entityMap.set(topDir, existing);
	}

	return [...entityMap.entries()]
		.map(([name, files]) => ({
			name,
			path: name === "root" ? "" : name,
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
