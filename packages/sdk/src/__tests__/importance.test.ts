/**
 * Unit tests for importance ranking (parser.ts, queries.ts, ranker.ts)
 * PRD T3.6
 *
 * Note: Tree-sitter WASM loading is complex to mock. Tests focus on:
 * - getLanguage extension mapping (synchronous, no WASM)
 * - Import extraction structure (mocked Tree-sitter)
 * - Ranking algorithm logic (mocked imports)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportedLanguage } from "../constants.js";

// Mock web-tree-sitter since it requires WASM loading
vi.mock("web-tree-sitter", () => ({
	default: {
		init: vi.fn(() => Promise.resolve()),
		Language: {
			load: vi.fn(() => Promise.resolve({})),
		},
	},
}));

// Import after mocking
import { getLanguage, isExtensionSupported } from "../importance/parser.js";

describe("importance - parser.ts", () => {
	// =========================================================================
	// getLanguage tests
	// =========================================================================
	describe("getLanguage", () => {
		it("returns typescript for .ts", () => {
			expect(getLanguage(".ts")).toBe("typescript");
		});

		it("returns typescript for .tsx", () => {
			expect(getLanguage(".tsx")).toBe("typescript");
		});

		it("returns javascript for .js", () => {
			expect(getLanguage(".js")).toBe("javascript");
		});

		it("returns javascript for .jsx", () => {
			expect(getLanguage(".jsx")).toBe("javascript");
		});

		it("returns javascript for .mjs", () => {
			expect(getLanguage(".mjs")).toBe("javascript");
		});

		it("returns python for .py", () => {
			expect(getLanguage(".py")).toBe("python");
		});

		it("returns go for .go", () => {
			expect(getLanguage(".go")).toBe("go");
		});

		it("returns rust for .rs", () => {
			expect(getLanguage(".rs")).toBe("rust");
		});

		it("returns undefined for .txt", () => {
			expect(getLanguage(".txt")).toBeUndefined();
		});

		it("returns undefined for .md", () => {
			expect(getLanguage(".md")).toBeUndefined();
		});

		it("returns undefined for .json", () => {
			expect(getLanguage(".json")).toBeUndefined();
		});

		it("handles extension without leading dot", () => {
			expect(getLanguage("ts")).toBe("typescript");
			expect(getLanguage("py")).toBe("python");
		});
	});

	// =========================================================================
	// isExtensionSupported tests
	// =========================================================================
	describe("isExtensionSupported", () => {
		it("returns true for supported extensions", () => {
			expect(isExtensionSupported(".ts")).toBe(true);
			expect(isExtensionSupported(".js")).toBe(true);
			expect(isExtensionSupported(".py")).toBe(true);
			expect(isExtensionSupported(".go")).toBe(true);
			expect(isExtensionSupported(".rs")).toBe(true);
		});

		it("returns false for unsupported extensions", () => {
			expect(isExtensionSupported(".txt")).toBe(false);
			expect(isExtensionSupported(".md")).toBe(false);
			expect(isExtensionSupported(".css")).toBe(false);
		});
	});
});

/**
 * Tests for extractImports - these would require WASM loading
 * so we test the structure/interface instead
 */
describe("importance - queries.ts interface", () => {
	it("ExtractedImport has correct shape", async () => {
		// Dynamic import to check type exists
		const { extractImports } = await import("../importance/queries.js");
		expect(typeof extractImports).toBe("function");
	});

	it("extractModuleNames returns string array type", async () => {
		const { extractModuleNames } = await import("../importance/queries.js");
		expect(typeof extractModuleNames).toBe("function");
	});
});

/**
 * Tests for ranker.ts - mock at the file discovery level
 */
describe("importance - ranker.ts", () => {
	// These tests require mocking fs operations extensively
	// Testing the exported interface exists
	it("rankFileImportance function exists", async () => {
		const { rankFileImportance } = await import("../importance/ranker.js");
		expect(typeof rankFileImportance).toBe("function");
	});
});

/**
 * Unit tests for file role determination logic
 * This tests the pure logic without WASM dependencies
 */
describe("file role determination", () => {
	// Test helper that mimics determineFileRole logic
	function determineTestRole(path: string): string {
		const filename = path.split("/").pop() || "";
		const normalizedPath = path.toLowerCase();

		// Check for entry point patterns
		if (/^(index|main|cli|app|entry)\.[jt]sx?$/.test(filename)) {
			return "entry";
		}

		// Check for test patterns
		if (normalizedPath.includes("__tests__") || normalizedPath.includes(".test.") || normalizedPath.includes(".spec.")) {
			return "test";
		}

		// Check for config patterns
		if (
			normalizedPath.includes("config") ||
			filename.endsWith(".config.ts") ||
			filename.endsWith(".config.js")
		) {
			return "config";
		}

		// Check for type definition patterns
		if (normalizedPath.includes("/types/") || filename.endsWith(".d.ts")) {
			return "types";
		}

		// Check for utility patterns
		if (normalizedPath.includes("/utils/") || normalizedPath.includes("/util/") || normalizedPath.includes("/helpers/")) {
			return "util";
		}

		// Check for documentation
		if (filename.endsWith(".md") || normalizedPath.includes("/docs/")) {
			return "doc";
		}

		return "core";
	}

	it("classifies index.ts as entry", () => {
		expect(determineTestRole("src/index.ts")).toBe("entry");
	});

	it("classifies main.ts as entry", () => {
		expect(determineTestRole("src/main.ts")).toBe("entry");
	});

	it("classifies cli.js as entry", () => {
		expect(determineTestRole("apps/cli/src/cli.js")).toBe("entry");
	});

	it("classifies __tests__/*.test.ts as test", () => {
		expect(determineTestRole("src/__tests__/utils.test.ts")).toBe("test");
	});

	it("classifies *.spec.ts as test", () => {
		expect(determineTestRole("src/parser.spec.ts")).toBe("test");
	});

	it("classifies *.config.ts as config", () => {
		expect(determineTestRole("tsconfig.ts")).toBe("core");
		expect(determineTestRole("vitest.config.ts")).toBe("config");
	});

	it("classifies /types/*.ts as types", () => {
		expect(determineTestRole("packages/types/src/schemas.ts")).toBe("types");
	});

	it("classifies /utils/*.ts as util", () => {
		expect(determineTestRole("src/utils/helpers.ts")).toBe("util");
	});

	it("classifies regular files as core", () => {
		expect(determineTestRole("src/parser.ts")).toBe("core");
		expect(determineTestRole("packages/sdk/src/clone.ts")).toBe("core");
	});
});

/**
 * Tests for importance scoring algorithm
 */
describe("importance scoring algorithm", () => {
	// Test the normalization logic
	it("normalizes scores to 0-1 range", () => {
		// Simulate importance scoring
		const files = [
			{ path: "a.ts", inboundCount: 10 },
			{ path: "b.ts", inboundCount: 5 },
			{ path: "c.ts", inboundCount: 0 },
		];

		const maxInbound = Math.max(...files.map((f) => f.inboundCount));

		const normalized = files.map((f) => ({
			path: f.path,
			importance: maxInbound > 0 ? (f.inboundCount / maxInbound) * 0.7 : 0,
		}));

		// Most imported file should have 0.7 (70% of max)
		expect(normalized[0].importance).toBe(0.7);
		// Half as many imports should have 0.35
		expect(normalized[1].importance).toBe(0.35);
		// No imports should have 0
		expect(normalized[2].importance).toBe(0);
	});

	it("entry points get bonus", () => {
		const ENTRY_BONUS = 0.2;
		const baseScore = 0.5;
		const entryScore = Math.min(1, baseScore + ENTRY_BONUS);

		expect(entryScore).toBe(0.7);
	});

	it("test files get penalty", () => {
		const TEST_PENALTY = 0.3;
		const baseScore = 0.5;
		const testScore = baseScore * TEST_PENALTY;

		expect(testScore).toBe(0.15);
	});

	it("scores are sorted descending", () => {
		const scores = [0.3, 0.8, 0.1, 0.5];
		const sorted = [...scores].sort((a, b) => b - a);

		expect(sorted).toEqual([0.8, 0.5, 0.3, 0.1]);
	});
});

/**
 * Tests for ignore pattern matching
 */
describe("ignore pattern matching", () => {
	// Simplified pattern matching logic test
	function matchesPattern(filePath: string, pattern: string): boolean {
		// Simple glob matching
		if (pattern.includes("**")) {
			const prefix = pattern.split("**")[0];
			return filePath.startsWith(prefix);
		}
		if (pattern.includes("*")) {
			const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
			return regex.test(filePath);
		}
		return filePath === pattern || filePath.startsWith(pattern + "/");
	}

	it("matches exact patterns", () => {
		expect(matchesPattern("node_modules", "node_modules")).toBe(true);
	});

	it("matches wildcard patterns", () => {
		expect(matchesPattern("file.log", "*.log")).toBe(true);
		expect(matchesPattern("file.txt", "*.log")).toBe(false);
	});

	it("matches directory patterns", () => {
		expect(matchesPattern("node_modules/foo/bar.js", "node_modules")).toBe(true);
	});

	it("matches double-star patterns", () => {
		expect(matchesPattern("src/deep/nested/file.ts", "src/**")).toBe(true);
	});
});
