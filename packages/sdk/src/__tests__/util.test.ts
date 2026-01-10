/**
 * Unit tests for util.ts helper functions
 * PRD T3.3
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs before importing util module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";
import {
	isBinaryBuffer,
	hashBuffer,
	loadGitignorePatterns,
	loadGitignorePatternsSimple,
} from "../util.js";

describe("util.ts", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// isBinaryBuffer tests
	// =========================================================================
	describe("isBinaryBuffer", () => {
		it("returns true for buffer with null bytes", () => {
			const buffer = Buffer.from([
				0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x77, 0x6f, 0x72, 0x6c, 0x64,
			]);
			expect(isBinaryBuffer(buffer)).toBe(true);
		});

		it("returns true for buffer with >30% suspicious bytes", () => {
			// Create a buffer with 40% control characters (above 30% threshold)
			// 10 bytes total: 4 suspicious control chars, 6 normal
			const buffer = Buffer.from([
				0x01,
				0x02,
				0x03,
				0x04, // suspicious
				0x41,
				0x42,
				0x43,
				0x44,
				0x45,
				0x46, // normal ASCII 'ABCDEF'
			]);
			expect(isBinaryBuffer(buffer)).toBe(true);
		});

		it("returns false for UTF-8 text buffer", () => {
			const text = "Hello, World! This is a UTF-8 text file.\nWith multiple lines.\n";
			const buffer = Buffer.from(text, "utf-8");
			expect(isBinaryBuffer(buffer)).toBe(false);
		});

		it("returns false for empty buffer", () => {
			const buffer = Buffer.alloc(0);
			expect(isBinaryBuffer(buffer)).toBe(false);
		});

		it("returns false for buffer with only ASCII", () => {
			const buffer = Buffer.from("Hello, World!", "utf-8");
			expect(isBinaryBuffer(buffer)).toBe(false);
		});

		it("returns false for buffer with tabs and newlines", () => {
			// 0x09 = tab, 0x0A = newline, 0x0D = carriage return
			const buffer = Buffer.from("Hello\tWorld\nNew Line\r\nCRLF");
			expect(isBinaryBuffer(buffer)).toBe(false);
		});

		it("returns true for actual binary content (null byte)", () => {
			// Binary file typically has null bytes
			const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x0d]);
			expect(isBinaryBuffer(buffer)).toBe(true);
		});
	});

	// =========================================================================
	// hashBuffer tests
	// =========================================================================
	describe("hashBuffer", () => {
		it("returns 64-char hex string", () => {
			const buffer = Buffer.from("hello world");
			const hash = hashBuffer(buffer);

			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		});

		it("returns consistent hash for same input", () => {
			const buffer1 = Buffer.from("test content");
			const buffer2 = Buffer.from("test content");

			expect(hashBuffer(buffer1)).toBe(hashBuffer(buffer2));
		});

		it("returns different hash for different input", () => {
			const buffer1 = Buffer.from("content A");
			const buffer2 = Buffer.from("content B");

			expect(hashBuffer(buffer1)).not.toBe(hashBuffer(buffer2));
		});

		it("returns correct SHA-256 hash for known input", () => {
			// Known SHA-256 hash for "hello"
			const buffer = Buffer.from("hello");
			const hash = hashBuffer(buffer);

			expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
		});

		it("handles empty buffer", () => {
			const buffer = Buffer.alloc(0);
			const hash = hashBuffer(buffer);

			expect(hash).toHaveLength(64);
			// Empty string SHA-256
			expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
		});
	});

	// =========================================================================
	// loadGitignorePatterns tests
	// =========================================================================
	describe("loadGitignorePatterns", () => {
		it("returns empty array for missing file", () => {
			mockExistsSync.mockReturnValue(false);

			const result = loadGitignorePatterns("/some/repo");

			expect(result).toEqual([]);
		});

		it("parses simple patterns", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("node_modules\n*.log\ndist\n");

			const result = loadGitignorePatterns("/some/repo");

			expect(result).toContainEqual({ pattern: "node_modules", negation: false });
			expect(result).toContainEqual({ pattern: "*.log", negation: false });
			expect(result).toContainEqual({ pattern: "dist", negation: false });
		});

		it("handles comments (# lines)", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				"# This is a comment\nnode_modules\n# Another comment\ndist\n",
			);

			const result = loadGitignorePatterns("/some/repo");

			// Should only have the actual patterns
			expect(result).toHaveLength(2);
			expect(result.every((p) => !p.pattern.startsWith("#"))).toBe(true);
		});

		it("handles negation (!pattern)", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("*.log\n!important.log\ndist\n");

			const result = loadGitignorePatterns("/some/repo");

			expect(result).toContainEqual({ pattern: "*.log", negation: false });
			expect(result).toContainEqual({ pattern: "important.log", negation: true });
			expect(result).toContainEqual({ pattern: "dist", negation: false });
		});

		it("converts directory patterns (dir/)", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("node_modules/\nbuild/\n");

			const result = loadGitignorePatterns("/some/repo");

			// Should have both the dir and dir/** patterns
			expect(result).toContainEqual({ pattern: "node_modules", negation: false });
			expect(result).toContainEqual({ pattern: "node_modules/**", negation: false });
			expect(result).toContainEqual({ pattern: "build", negation: false });
			expect(result).toContainEqual({ pattern: "build/**", negation: false });
		});

		it("handles root-relative patterns (/pattern)", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("/build\n/dist\n*.tmp\n");

			const result = loadGitignorePatterns("/some/repo");

			// Root-relative patterns should have leading / stripped
			expect(result).toContainEqual({ pattern: "build", negation: false });
			expect(result).toContainEqual({ pattern: "dist", negation: false });
			expect(result).toContainEqual({ pattern: "*.tmp", negation: false });
		});

		it("handles empty lines", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("node_modules\n\n\ndist\n\n");

			const result = loadGitignorePatterns("/some/repo");

			expect(result).toHaveLength(2);
		});

		it("trims whitespace from lines", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("  node_modules  \n  dist  \n");

			const result = loadGitignorePatterns("/some/repo");

			expect(result).toContainEqual({ pattern: "node_modules", negation: false });
			expect(result).toContainEqual({ pattern: "dist", negation: false });
		});
	});

	// =========================================================================
	// loadGitignorePatternsSimple tests
	// =========================================================================
	describe("loadGitignorePatternsSimple", () => {
		it("returns empty array for missing file", () => {
			mockExistsSync.mockReturnValue(false);

			const result = loadGitignorePatternsSimple("/some/repo");

			expect(result).toEqual([]);
		});

		it("returns only non-negation patterns as strings", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("*.log\n!important.log\nnode_modules/\n");

			const result = loadGitignorePatternsSimple("/some/repo");

			expect(result).toContain("*.log");
			expect(result).toContain("node_modules");
			expect(result).toContain("node_modules/**");
			expect(result).not.toContain("important.log");
		});

		it("returns array of strings not objects", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("dist\n");

			const result = loadGitignorePatternsSimple("/some/repo");

			expect(typeof result[0]).toBe("string");
		});
	});
});
