/**
 * Importance weighting and file exclusion logic for RAG component
 * Used to prioritize files during repository ingestion
 */

/**
 * Calculate importance score (0-1) for file prioritization in RAG
 * Higher scores = more important = ranked higher in search results
 */
export function calculateImportance(filePath: string): number {
	// Essential files (highest priority)
	if (/^README\.md$/i.test(filePath)) return 1.0;
	if (/^package\.json$/.test(filePath)) return 0.95;
	if (/^tsconfig\.json$/.test(filePath)) return 0.9;
	if (/^(src\/)?index\.(ts|tsx|js|jsx)$/.test(filePath)) return 0.95;
	if (/^(src\/)?main\.(ts|tsx|js|jsx)$/.test(filePath)) return 0.95;

	// Core source directories (high priority)
	if (/^(src|lib)\//.test(filePath)) return 0.7;
	if (/\/(core|utils|helpers|types|models)\//.test(filePath)) return 0.65;

	// Configuration files
	if (/\.(config|rc)\.(ts|js|json)$/.test(filePath)) return 0.6;

	// Regular TypeScript source files
	if (/\.(ts|tsx)$/.test(filePath)) return 0.5;
	if (/\.(js|jsx)$/.test(filePath)) return 0.45;

	// Documentation (lower priority)
	if (/\.md$/.test(filePath)) return 0.3;

	// Everything else
	return 0.1;
}

/** Exclude files too large (>100KB) or non-essential (lockfiles, build output, tests) */
export function shouldExcludeFile(filePath: string, size: number): boolean {
	if (/\.(lock|lockb)$/.test(filePath)) return true;
	if (/package-lock\.json$/.test(filePath)) return true;
	if (/yarn\.lock$/.test(filePath)) return true;
	if (/pnpm-lock\.yaml$/.test(filePath)) return true;
	if (/bun\.lockb$/.test(filePath)) return true;

	if (/^(dist|build|\.next|\.nuxt|out)\//.test(filePath)) return true;

	if (/node_modules\//.test(filePath)) return true;

	if (/\/(examples?|demos?|samples?)\//.test(filePath)) return true;

	if (/\/(migrations?|seeds?)\//.test(filePath)) return true;

	if (/\/(vendor|generated|\.git)\//.test(filePath)) return true;

	// Exclude large files (>100KB) - reduced from 200KB
	if (size > 100000) return true;

	// Exclude test files (we can search them later if needed)
	if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) return true;
	if (/\/__tests__\//.test(filePath)) return true;

	return false;
}

export function getFilterValues(filePath: string) {
	let fileType: "entry-point" | "core" | "regular" | "documentation";
	let priority: "high" | "medium" | "low";

	const importance = calculateImportance(filePath);

	if (importance >= 0.9) {
		fileType = "entry-point";
		priority = "high";
	} else if (importance >= 0.6) {
		fileType = "core";
		priority = "high";
	} else if (/\.md$/.test(filePath)) {
		fileType = "documentation";
		priority = "low";
	} else {
		fileType = "regular";
		priority = importance >= 0.4 ? "medium" : "low";
	}

	const extension = filePath.split(".").pop() || "";

	return [
		{ name: "fileType" as const, value: fileType },
		{ name: "priority" as const, value: priority },
		{ name: "extension" as const, value: extension },
	];
}
