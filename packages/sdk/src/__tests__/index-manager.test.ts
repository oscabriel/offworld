/**
 * Unit tests for index-manager.ts
 * PRD T3.5
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs before importing index-manager module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
}));

vi.mock("../config.js", () => ({
	getMetaRoot: vi.fn(() => "/home/user/.ow"),
}));

vi.mock("../constants.js", () => ({
	VERSION: "0.1.0",
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
	getIndexPath,
	getIndex,
	saveIndex,
	updateIndex,
	removeFromIndex,
	getIndexEntry,
	listIndexedRepos,
} from "../index-manager.js";
import type { RepoIndex, RepoIndexEntry } from "@offworld/types";

describe("index-manager.ts", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
	const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
	const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;

	const sampleEntry: RepoIndexEntry = {
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		localPath: "/home/user/ow/github/tanstack/router",
		commitSha: "abc123",
		hasSkill: false,
	};

	const sampleIndex: RepoIndex = {
		version: "0.1.0",
		repos: {
			"github:tanstack/router": sampleEntry,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// getIndexPath tests
	// =========================================================================
	describe("getIndexPath", () => {
		it("returns path to ~/.ow/index.json", () => {
			const result = getIndexPath();
			expect(result).toBe("/home/user/.ow/index.json");
		});
	});

	// =========================================================================
	// getIndex tests
	// =========================================================================
	describe("getIndex", () => {
		it("returns empty index when file missing", () => {
			mockExistsSync.mockReturnValue(false);

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("parses existing index.json", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleIndex));

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos["github:tanstack/router"]).toBeDefined();
			expect(result.repos["github:tanstack/router"]!.fullName).toBe("tanstack/router");
		});

		it("returns empty index on JSON parse error", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("invalid json {{{");

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index on schema validation error", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify({ invalid: "structure" }));

			const result = getIndex();

			expect(result.repos).toEqual({});
		});
	});

	// =========================================================================
	// saveIndex tests
	// =========================================================================
	describe("saveIndex", () => {
		it("writes valid JSON", () => {
			mockExistsSync.mockReturnValue(true);

			saveIndex(sampleIndex);

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			expect(() => JSON.parse(content as string)).not.toThrow();
		});

		it("creates directory if missing", () => {
			mockExistsSync.mockReturnValue(false);

			saveIndex(sampleIndex);

			expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
		});

		it("writes to correct path", () => {
			mockExistsSync.mockReturnValue(true);

			saveIndex(sampleIndex);

			expect(mockWriteFileSync).toHaveBeenCalledWith(
				"/home/user/.ow/index.json",
				expect.any(String),
				"utf-8",
			);
		});
	});

	// =========================================================================
	// updateIndex tests
	// =========================================================================
	describe("updateIndex", () => {
		it("adds new repo entry", () => {
			mockExistsSync.mockReturnValue(false);

			updateIndex(sampleEntry);

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:tanstack/router"]).toBeDefined();
		});

		it("updates existing repo entry", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleIndex));

			const updatedEntry: RepoIndexEntry = {
				...sampleEntry,
				commitSha: "newsha456",
				hasSkill: true,
			};

			updateIndex(updatedEntry);

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:tanstack/router"]!.commitSha).toBe("newsha456");
			expect(written.repos["github:tanstack/router"]!.hasSkill).toBe(true);
		});

		it("preserves other entries when updating", () => {
			const existingIndex: RepoIndex = {
				version: "0.1.0",
				repos: {
					"github:other/repo": {
						fullName: "other/repo",
						qualifiedName: "github:other/repo",
						localPath: "/home/user/ow/github/other/repo",
						hasSkill: false,
					},
				},
			};
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(existingIndex));

			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:other/repo"]).toBeDefined();
			expect(written.repos["github:tanstack/router"]).toBeDefined();
		});
	});

	// =========================================================================
	// removeFromIndex tests
	// =========================================================================
	describe("removeFromIndex", () => {
		it("removes existing entry and returns true", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleIndex));

			const result = removeFromIndex("github:tanstack/router");

			expect(result).toBe(true);
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:tanstack/router"]).toBeUndefined();
		});

		it("returns false if entry not found", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleIndex));

			const result = removeFromIndex("github:nonexistent/repo");

			expect(result).toBe(false);
		});
	});

	// =========================================================================
	// getIndexEntry tests
	// =========================================================================
	describe("getIndexEntry", () => {
		it("returns entry if exists", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleIndex));

			const result = getIndexEntry("github:tanstack/router");

			expect(result).toBeDefined();
			expect(result?.fullName).toBe("tanstack/router");
		});

		it("returns undefined if not found", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleIndex));

			const result = getIndexEntry("github:nonexistent/repo");

			expect(result).toBeUndefined();
		});
	});

	// =========================================================================
	// listIndexedRepos tests
	// =========================================================================
	describe("listIndexedRepos", () => {
		it("returns all repo entries as array", () => {
			const multiIndex: RepoIndex = {
				version: "0.1.0",
				repos: {
					"github:tanstack/router": sampleEntry,
					"github:vercel/ai": {
						fullName: "vercel/ai",
						qualifiedName: "github:vercel/ai",
						localPath: "/home/user/ow/github/vercel/ai",
						hasSkill: true,
					},
				},
			};
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(multiIndex));

			const result = listIndexedRepos();

			expect(result).toHaveLength(2);
			expect(result.map((r) => r.fullName)).toContain("tanstack/router");
			expect(result.map((r) => r.fullName)).toContain("vercel/ai");
		});

		it("returns empty array when no repos", () => {
			mockExistsSync.mockReturnValue(false);

			const result = listIndexedRepos();

			expect(result).toEqual([]);
		});
	});

	// =========================================================================
	// Version field tests
	// =========================================================================
	describe("version field", () => {
		it("is set correctly on save", () => {
			mockExistsSync.mockReturnValue(false);

			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.version).toBe("0.1.0");
		});

		it("updates version when saving", () => {
			const oldIndex: RepoIndex = {
				version: "0.0.1", // old version
				repos: {},
			};
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(oldIndex));

			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.version).toBe("0.1.0"); // updated to current
		});
	});
});
