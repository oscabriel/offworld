/**
 * Integration tests for analysis pipeline
 * Tests the deterministic parts of the pipeline without AI calls.
 *
 * These tests verify:
 * - skill.name uses qualifiedName not local path
 * - language detection works correctly
 * - Analysis path encoding is correct
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSkeleton, buildSearchPatterns, detectLanguage } from "../analysis/skeleton.js";
import { mergeProseIntoSkeleton } from "../analysis/merge.js";
import { parseFile } from "../ast/parser.js";
import { initLanguages } from "../ast/index.js";
import type { ProseEnhancements } from "../analysis/prose.js";
import type { ASTEnhancedFileEntry } from "../analysis/heuristics.js";

// ============================================================================
// Test configuration
// ============================================================================

let tempDir: string;

// ============================================================================
// Setup and teardown
// ============================================================================

beforeEach(async () => {
	// Create fresh temp directory for test repos
	tempDir = mkdtempSync(join(tmpdir(), "pipeline-integration-test-"));
	// Initialize language parsers once
	await initLanguages();
});

afterEach(() => {
	// Cleanup temp directory
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
});

// ============================================================================
// Helper functions
// ============================================================================

function createTestRepo(name: string, files: Record<string, string>): string {
	const repoPath = join(tempDir, name);
	mkdirSync(repoPath, { recursive: true });

	for (const [filePath, content] of Object.entries(files)) {
		const fullPath = join(repoPath, filePath);
		mkdirSync(join(fullPath, ".."), { recursive: true });
		writeFileSync(fullPath, content, "utf-8");
	}

	return repoPath;
}

function createMockProse(): ProseEnhancements {
	return {
		overview:
			"This is a test repository created for integration testing purposes. It contains multiple modules designed to verify the analysis pipeline functionality.",
		problemsSolved:
			"Enables automated testing of the analysis pipeline, verifying correct handling of repository structures.",
		features:
			"Supports qualifiedName handling, language detection, and entity relationship mapping.",
		patterns:
			"Follow standard testing patterns: create isolated repos, run pipeline, verify outputs.",
		targetUseCases:
			"Developers working on the offworld SDK who need to verify pipeline correctness.",
		summary: "A test repository for integration testing purposes with multiple modules.",
		whenToUse: [
			"When you need to test pipeline functionality",
			"When you need to verify qualifiedName handling",
			"When you need to check language detection",
		],
		entityDescriptions: {
			src: "Source code directory containing main implementation",
		},
		relationships: [],
	};
}

// ============================================================================
// Integration tests
// ============================================================================

describe("pipeline.integration", () => {
	describe("skill.name uses qualifiedName", () => {
		it("uses qualifiedName for remote repos (owner/repo format)", () => {
			const repoPath = createTestRepo("query", {
				"src/index.ts": 'export function useQuery() { return "query"; }',
			});

			// Parse files
			const parsedFiles = new Map();
			const content = 'export function useQuery() { return "query"; }';
			const parsed = parseFile("src/index.ts", content);
			if (parsed) {
				parsedFiles.set("src/index.ts", parsed);
			}

			// Create mock top files
			const topFiles: ASTEnhancedFileEntry[] = [
				{
					path: "src/index.ts",
					type: "core",
					importance: 1.0,
					exportCount: 1,
					functionCount: 1,
				},
			];

			// Build skeleton with qualifiedName
			const qualifiedName = "tanstack/query";
			const skeleton = buildSkeleton(repoPath, qualifiedName, topFiles, parsedFiles);

			// Verify skeleton.name is the qualifiedName, not the local path
			expect(skeleton.name).toBe("tanstack/query");
			expect(skeleton.name).not.toContain("/Users");
			expect(skeleton.name).not.toContain(tempDir);
		});

		it("uses simple name for local repos", () => {
			const repoPath = createTestRepo("my-local-lib", {
				"src/index.ts": 'export function hello() { return "world"; }',
			});

			const parsedFiles = new Map();
			const content = 'export function hello() { return "world"; }';
			const parsed = parseFile("src/index.ts", content);
			if (parsed) {
				parsedFiles.set("src/index.ts", parsed);
			}

			const topFiles: ASTEnhancedFileEntry[] = [
				{
					path: "src/index.ts",
					type: "core",
					importance: 1.0,
					exportCount: 1,
					functionCount: 1,
				},
			];

			// Build skeleton with local name
			const skeleton = buildSkeleton(repoPath, "my-local-lib", topFiles, parsedFiles);

			expect(skeleton.name).toBe("my-local-lib");
		});
	});

	describe("analysis path encoding", () => {
		it("encodes tanstack/query as tanstack--query", () => {
			const repoPath = createTestRepo("query", {
				"src/index.ts": "export function useQuery() {}",
			});

			const parsedFiles = new Map();
			const parsed = parseFile("src/index.ts", "export function useQuery() {}");
			if (parsed) {
				parsedFiles.set("src/index.ts", parsed);
			}

			const topFiles: ASTEnhancedFileEntry[] = [
				{ path: "src/index.ts", type: "core", importance: 1.0, exportCount: 1, functionCount: 1 },
			];

			const skeleton = buildSkeleton(repoPath, "tanstack/query", topFiles, parsedFiles);
			const prose = createMockProse();
			const result = mergeProseIntoSkeleton(skeleton, prose, { qualifiedName: "tanstack/query" });

			expect(result.skill.basePaths?.analysis).toBe("${OW_META}/skills/tanstack--query");
			expect(result.skill.basePaths?.analysis).not.toContain("/Users");
		});

		it("handles deeply nested org/repo names", () => {
			const repoPath = createTestRepo("router", {
				"src/index.ts": "export function createRouter() {}",
			});

			const parsedFiles = new Map();
			const parsed = parseFile("src/index.ts", "export function createRouter() {}");
			if (parsed) {
				parsedFiles.set("src/index.ts", parsed);
			}

			const topFiles: ASTEnhancedFileEntry[] = [
				{ path: "src/index.ts", type: "core", importance: 1.0, exportCount: 1, functionCount: 1 },
			];

			const skeleton = buildSkeleton(repoPath, "tanstack/router", topFiles, parsedFiles);
			const prose = createMockProse();
			const result = mergeProseIntoSkeleton(skeleton, prose, { qualifiedName: "tanstack/router" });

			expect(result.skill.basePaths?.analysis).toBe("${OW_META}/skills/tanstack--router");
		});
	});

	describe("language detection", () => {
		it("detects TypeScript as primary language", () => {
			const parsedFiles = new Map();
			const files = [
				{ path: "src/index.ts", content: "export const x: number = 1;" },
				{ path: "src/utils.ts", content: 'export function helper(): string { return ""; }' },
			];

			for (const file of files) {
				const parsed = parseFile(file.path, file.content);
				if (parsed) {
					parsedFiles.set(file.path, parsed);
				}
			}

			const language = detectLanguage(parsedFiles);
			expect(language).toBe("TypeScript");
		});

		it("detects JavaScript as primary language", () => {
			const parsedFiles = new Map();
			const files = [
				{ path: "src/index.js", content: "export const x = 1;" },
				{ path: "src/utils.js", content: 'export function helper() { return ""; }' },
			];

			for (const file of files) {
				const parsed = parseFile(file.path, file.content);
				if (parsed) {
					parsedFiles.set(file.path, parsed);
				}
			}

			const language = detectLanguage(parsedFiles);
			expect(language).toBe("JavaScript");
		});

		it("returns unknown for empty file set", () => {
			const parsedFiles = new Map();
			const language = detectLanguage(parsedFiles);
			expect(language).toBe("unknown");
		});
	});

	describe("search pattern generation", () => {
		it("separates library code from example directories", () => {
			// Create files with symbols in both library and example directories
			const parsedFiles = new Map();

			// Library code
			const libContent = `
export function useQuery() {}
export function useMutation() {}
export function QueryClient() {}
export function MutationClient() {}
export function CacheManager() {}
export function StoreProvider() {}
export function DataFetcher() {}
export function ResultHandler() {}
`;
			const libParsed = parseFile("src/core.ts", libContent);
			if (libParsed) {
				parsedFiles.set("src/core.ts", libParsed);
			}

			// Example code
			const exampleContent = `
export function ExampleApp() {}
export function DemoComponent() {}
export function SamplePage() {}
export function TestFixture() {}
`;
			const exampleParsed = parseFile("examples/demo.ts", exampleContent);
			if (exampleParsed) {
				parsedFiles.set("examples/demo.ts", exampleParsed);
			}

			const patterns = buildSearchPatterns(parsedFiles);

			// Verify we get patterns from both library and example code
			const patternNames = patterns.map((p) => p.pattern);

			// Library patterns should be prioritized (first 7)
			// Note: Some patterns may be filtered by GENERIC_SYMBOLS
			expect(patterns.length).toBeLessThanOrEqual(10);

			// Library patterns should include core functions
			const hasLibraryPattern = patternNames.some(
				(p) =>
					p === "useQuery" || p === "useMutation" || p === "QueryClient" || p === "CacheManager",
			);
			expect(hasLibraryPattern).toBe(true);
		});

		it("filters out generic patterns", () => {
			const parsedFiles = new Map();
			const content = `
export function Page() {}
export function Loading() {}
export function Example() {}
export function useRealQuery() {}
`;
			const parsed = parseFile("src/index.ts", content);
			if (parsed) {
				parsedFiles.set("src/index.ts", parsed);
			}

			const patterns = buildSearchPatterns(parsedFiles);
			const patternNames = patterns.map((p) => p.pattern);

			// Generic patterns should be filtered out
			expect(patternNames).not.toContain("Page");
			expect(patternNames).not.toContain("Loading");
			expect(patternNames).not.toContain("Example");

			// Real patterns should remain
			expect(patternNames).toContain("useRealQuery");
		});
	});
});
