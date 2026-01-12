import { basename, dirname } from "node:path";
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
	framework: string | null;
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
 * Detect patterns about the repository: framework, language, tests, docs
 */
export function detectPatterns(
	parsedFiles: Map<string, ParsedFile>,
	topFiles: ASTEnhancedFileEntry[],
): DetectedPatterns {
	const framework = detectFramework(parsedFiles);
	const language = detectPrimaryLanguage(parsedFiles);
	const hasTests = topFiles.some((f) => f.type === "test" || f.hasTests);
	const hasDocs = topFiles.some((f) => f.type === "doc" || f.path.toLowerCase().includes("readme"));

	return {
		framework,
		language,
		hasTests,
		hasDocs,
	};
}

/**
 * Detect the primary framework used in the repository
 */
export function detectFramework(parsedFiles: Map<string, ParsedFile>): string | null {
	const indicators = {
		react: 0,
		nextjs: 0,
		vue: 0,
		angular: 0,
		express: 0,
		fastapi: 0,
		django: 0,
		flask: 0,
		nestjs: 0,
		svelte: 0,
		solidjs: 0,
		astro: 0,
	};

	for (const [path, parsed] of parsedFiles) {
		const fileName = basename(path).toLowerCase();
		const imports = parsed.imports.join(" ").toLowerCase();

		// Next.js indicators
		if (fileName === "next.config.js" || fileName === "next.config.ts") {
			indicators.nextjs += 5;
		}
		if (path.includes("app/") && (fileName === "page.tsx" || fileName === "layout.tsx")) {
			indicators.nextjs += 2;
		}
		if (path.includes("pages/") && fileName.endsWith(".tsx")) {
			indicators.nextjs += 1;
		}
		if (imports.includes("next/")) {
			indicators.nextjs += 2;
		}

		// React indicators (not Next.js)
		if (imports.includes("from 'react'") || imports.includes('from "react"')) {
			indicators.react += 1;
		}
		if (imports.includes("react-dom")) {
			indicators.react += 1;
		}

		// Vue indicators
		if (fileName.endsWith(".vue") || imports.includes("from 'vue'")) {
			indicators.vue += 2;
		}
		if (fileName === "vite.config.ts" && imports.includes("@vitejs/plugin-vue")) {
			indicators.vue += 3;
		}

		// Angular indicators
		if (fileName === "angular.json" || imports.includes("@angular/")) {
			indicators.angular += 3;
		}

		// Express indicators
		if (imports.includes("from 'express'") || imports.includes('from "express"')) {
			indicators.express += 2;
		}

		// FastAPI indicators
		if (imports.includes("fastapi") || imports.includes("from fastapi")) {
			indicators.fastapi += 3;
		}

		// Django indicators
		if (imports.includes("from django") || fileName === "manage.py") {
			indicators.django += 3;
		}

		// Flask indicators
		if (imports.includes("from flask") || imports.includes("import flask")) {
			indicators.flask += 3;
		}

		// NestJS indicators
		if (imports.includes("@nestjs/")) {
			indicators.nestjs += 3;
		}

		// Svelte indicators
		if (fileName.endsWith(".svelte") || imports.includes("from 'svelte'")) {
			indicators.svelte += 2;
		}

		// SolidJS indicators
		if (imports.includes("from 'solid-js'") || imports.includes('from "solid-js"')) {
			indicators.solidjs += 2;
		}

		// Astro indicators
		if (fileName.endsWith(".astro") || fileName === "astro.config.mjs") {
			indicators.astro += 3;
		}
	}

	// Find the framework with highest score
	const sorted = Object.entries(indicators)
		.filter(([_, score]) => score > 0)
		.sort((a, b) => b[1] - a[1]);

	if (sorted.length === 0) {
		return null;
	}

	// Return the top framework (or Next.js if it has React + Next.js indicators)
	const top = sorted[0];
	if (!top) {
		return null;
	}

	const [topName] = top;
	if (topName === "react" && indicators.nextjs > 0) {
		return "Next.js";
	}

	// Capitalize framework name
	const frameworkNames: Record<string, string> = {
		react: "React",
		nextjs: "Next.js",
		vue: "Vue",
		angular: "Angular",
		express: "Express",
		fastapi: "FastAPI",
		django: "Django",
		flask: "Flask",
		nestjs: "NestJS",
		svelte: "Svelte",
		solidjs: "SolidJS",
		astro: "Astro",
	};

	return frameworkNames[topName] ?? null;
}

/**
 * Detect the primary programming language
 */
function detectPrimaryLanguage(parsedFiles: Map<string, ParsedFile>): string {
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
