/**
 * Unit tests for context gathering
 * PRD T5.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	readdirSync: vi.fn(),
	statSync: vi.fn(),
}));

// Mock rankFileImportance to avoid Tree-sitter dependencies
vi.mock("../importance/ranker.js", () => ({
	rankFileImportance: vi.fn(),
}));

// Mock util
vi.mock("../util.js", () => ({
	isBinaryBuffer: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";
import { rankFileImportance } from "../importance/ranker.js";
import { isBinaryBuffer } from "../util.js";
import {
	gatherContext,
	formatContextForPrompt,
	estimateTokens,
	type GatheredContext,
} from "../analysis/context.js";
import type { FileIndexEntry } from "@offworld/types";

describe("analysis/context.ts", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
	const mockRankFileImportance = rankFileImportance as ReturnType<typeof vi.fn>;
	const mockIsBinaryBuffer = isBinaryBuffer as ReturnType<typeof vi.fn>;

	const mockRankedFiles: FileIndexEntry[] = [
		{ path: "src/index.ts", importance: 1.0, type: "entry" },
		{ path: "src/core/router.ts", importance: 0.8, type: "core" },
		{ path: "src/utils/helpers.ts", importance: 0.6, type: "util" },
		{ path: "src/types/index.ts", importance: 0.5, type: "types" },
		{ path: "tests/router.test.ts", importance: 0.3, type: "test" },
	];

	const mockReadmeContent = `# Test Repository

This is a test repository for unit testing.

## Features
- Feature 1
- Feature 2

## Installation
\`\`\`bash
npm install
\`\`\`
`;

	const mockPackageJson = `{
  "name": "test-repo",
  "version": "1.0.0",
  "description": "Test repository",
  "main": "dist/index.js",
  "dependencies": {
    "lodash": "^4.17.21"
  }
}`;

	const mockFileContent = {
		"src/index.ts": "export * from './core/router';\nexport * from './types';",
		"src/core/router.ts": "export class Router {\n  // Router implementation\n}",
		"src/utils/helpers.ts": "export function helper() {\n  return 'helper';\n}",
		"src/types/index.ts": "export interface Config {\n  name: string;\n}",
		"tests/router.test.ts": "describe('Router', () => {\n  it('works', () => {});\n});",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockRankFileImportance.mockResolvedValue(mockRankedFiles);
		mockIsBinaryBuffer.mockReturnValue(false);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// estimateTokens tests
	// =========================================================================
	describe("estimateTokens", () => {
		it("approximates token count (4 chars/token)", () => {
			// 20 characters / 4 = 5 tokens
			expect(estimateTokens("12345678901234567890")).toBe(5);
		});

		it("handles empty string", () => {
			expect(estimateTokens("")).toBe(0);
		});

		it("rounds up partial tokens", () => {
			// 5 characters / 4 = 1.25 -> 2 tokens (ceil)
			expect(estimateTokens("12345")).toBe(2);
		});

		it("handles longer text", () => {
			const text = "a".repeat(400); // 400 chars / 4 = 100 tokens
			expect(estimateTokens(text)).toBe(100);
		});
	});

	// =========================================================================
	// gatherContext tests
	// =========================================================================
	describe("gatherContext", () => {
		beforeEach(() => {
			// Default file system setup
			mockExistsSync.mockImplementation((path: string) => {
				if (path.includes("README.md")) return true;
				if (path.includes("package.json")) return true;
				if (path.includes("src/") || path.includes("tests/")) return true;
				return false;
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes("README.md")) return mockReadmeContent;
				if (path.includes("package.json")) return mockPackageJson;

				// Return file content for known paths
				for (const [filePath, content] of Object.entries(mockFileContent)) {
					if (path.endsWith(filePath)) {
						return Buffer.from(content);
					}
				}
				throw new Error(`File not found: ${path}`);
			});
		});

		it("reads README.md if exists", async () => {
			const context = await gatherContext("/test/repo");

			expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining("README.md"));
			expect(context.readme).toBeTruthy();
			expect(context.readme).toContain("Test Repository");
		});

		it("truncates README to token limit", async () => {
			// Create a very long README
			const longReadme = "# Title\n" + "Content ".repeat(1000);
			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes("README.md")) return longReadme;
				if (path.includes("package.json")) return mockPackageJson;
				for (const [filePath, content] of Object.entries(mockFileContent)) {
					if (path.endsWith(filePath)) return Buffer.from(content);
				}
				throw new Error(`File not found: ${path}`);
			});

			const context = await gatherContext("/test/repo");

			// README budget is 500 tokens * 4 chars = 2000 chars max
			expect(context.readme!.length).toBeLessThanOrEqual(2100); // Some buffer for truncation message
			expect(context.readme).toContain("(truncated)");
		});

		it("reads package.json if exists", async () => {
			const context = await gatherContext("/test/repo");

			expect(context.packageConfig).toBeTruthy();
			expect(context.packageConfig).toContain("test-repo");
		});

		it("builds file tree string", async () => {
			const context = await gatherContext("/test/repo", { rankedFiles: mockRankedFiles });

			expect(context.fileTree).toBeTruthy();
			expect(context.fileTree).toContain("Repository Structure");
			expect(context.fileTree).toContain("src/");
		});

		it("includes top N files by importance", async () => {
			const context = await gatherContext("/test/repo", {
				rankedFiles: mockRankedFiles,
				maxTopFiles: 3,
			});

			expect(context.topFiles.length).toBeLessThanOrEqual(3);
			// First file should be highest importance
			expect(context.topFiles[0]!.importance).toBe(1.0);
		});

		it("total size is within token budget", async () => {
			const context = await gatherContext("/test/repo", { rankedFiles: mockRankedFiles });

			// Max budget is ~4000 tokens
			expect(context.estimatedTokens).toBeLessThanOrEqual(4500); // Some tolerance
		});

		it("handles missing README", async () => {
			mockExistsSync.mockImplementation((path: string) => {
				if (path.includes("README")) return false;
				if (path.includes("package.json")) return true;
				return true;
			});

			const context = await gatherContext("/test/repo", { rankedFiles: mockRankedFiles });

			expect(context.readme).toBeNull();
		});

		it("handles missing package.json", async () => {
			mockExistsSync.mockImplementation((path: string) => {
				if (path.includes("README.md")) return true;
				if (path.includes("package.json")) return false;
				if (path.includes("Cargo.toml")) return false;
				if (path.includes("go.mod")) return false;
				if (path.includes("pyproject.toml")) return false;
				if (path.includes("setup.py")) return false;
				if (path.includes("requirements.txt")) return false;
				if (path.includes("deno.json")) return false;
				if (path.includes("bun.toml")) return false;
				return true;
			});

			const context = await gatherContext("/test/repo", { rankedFiles: mockRankedFiles });

			expect(context.packageConfig).toBeNull();
		});

		it("skips binary files", async () => {
			mockIsBinaryBuffer.mockImplementation((buffer: Buffer) => {
				// Make one file appear binary (case-insensitive check for "router")
				return buffer.toString().toLowerCase().includes("router");
			});

			const context = await gatherContext("/test/repo", { rankedFiles: mockRankedFiles });

			// Should not include the binary file content (path contains "router")
			const hasRouterContent = context.topFiles.some((f) => f.path.includes("router"));
			expect(hasRouterContent).toBe(false);
		});

		it("uses provided rankedFiles option", async () => {
			const customFiles: FileIndexEntry[] = [{ path: "custom.ts", importance: 0.9, type: "core" }];

			mockExistsSync.mockImplementation((path: string) => {
				if (path.includes("custom.ts")) return true;
				if (path.includes("README.md")) return true;
				if (path.includes("package.json")) return true;
				return false;
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes("README.md")) return mockReadmeContent;
				if (path.includes("package.json")) return mockPackageJson;
				if (path.endsWith("custom.ts")) return Buffer.from("// custom file");
				throw new Error(`File not found: ${path}`);
			});

			const context = await gatherContext("/test/repo", { rankedFiles: customFiles });

			// Should not call rankFileImportance when rankedFiles provided
			expect(mockRankFileImportance).not.toHaveBeenCalled();
			expect(context.topFiles).toHaveLength(1);
			expect(context.topFiles[0]!.path).toBe("custom.ts");
		});

		it("extracts repo name from path", async () => {
			const context = await gatherContext("/home/user/projects/awesome-repo", {
				rankedFiles: mockRankedFiles,
			});

			expect(context.repoName).toBe("awesome-repo");
		});
	});

	// =========================================================================
	// formatContextForPrompt tests
	// =========================================================================
	describe("formatContextForPrompt", () => {
		const mockContext: GatheredContext = {
			repoPath: "/mock/test-repo",
			repoName: "test-repo",
			readme: "# Test Repo\nThis is a test.",
			packageConfig: '{"name": "test-repo"}',
			fileTree: "Repository Structure:\n  src/index.ts",
			topFiles: [
				{
					path: "src/index.ts",
					importance: 1.0,
					role: "entry",
					content: "export const main = () => {}",
				},
			],
			estimatedTokens: 100,
		};

		it("includes repository name header", () => {
			const prompt = formatContextForPrompt(mockContext);

			expect(prompt).toContain("# Repository: test-repo");
		});

		it("includes README section when present", () => {
			const prompt = formatContextForPrompt(mockContext);

			expect(prompt).toContain("## README");
			expect(prompt).toContain("# Test Repo");
		});

		it("includes package config section when present", () => {
			const prompt = formatContextForPrompt(mockContext);

			expect(prompt).toContain("## Package Configuration");
			expect(prompt).toContain('"name": "test-repo"');
		});

		it("includes file tree", () => {
			const prompt = formatContextForPrompt(mockContext);

			expect(prompt).toContain("Repository Structure:");
		});

		it("includes key files content section", () => {
			const prompt = formatContextForPrompt(mockContext);

			expect(prompt).toContain("## Key Files Content");
			expect(prompt).toContain("### src/index.ts");
			expect(prompt).toContain("export const main");
		});

		it("uses file extension for code blocks", () => {
			const prompt = formatContextForPrompt(mockContext);

			expect(prompt).toContain("```ts");
		});

		it("handles missing README", () => {
			const contextNoReadme: GatheredContext = {
				...mockContext,
				readme: null,
			};

			const prompt = formatContextForPrompt(contextNoReadme);

			expect(prompt).not.toContain("## README");
		});

		it("handles missing package config", () => {
			const contextNoConfig: GatheredContext = {
				...mockContext,
				packageConfig: null,
			};

			const prompt = formatContextForPrompt(contextNoConfig);

			expect(prompt).not.toContain("## Package Configuration");
		});

		it("handles multiple files", () => {
			const contextMultiFile: GatheredContext = {
				...mockContext,
				topFiles: [
					{ path: "src/a.ts", importance: 1.0, role: "entry", content: "const a = 1;" },
					{ path: "src/b.ts", importance: 0.8, role: "core", content: "const b = 2;" },
				],
			};

			const prompt = formatContextForPrompt(contextMultiFile);

			expect(prompt).toContain("### src/a.ts");
			expect(prompt).toContain("### src/b.ts");
			expect(prompt).toContain("const a = 1;");
			expect(prompt).toContain("const b = 2;");
		});
	});
});
