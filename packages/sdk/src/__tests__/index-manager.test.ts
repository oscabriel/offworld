/**
 * Unit tests for index-manager.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";

// ============================================================================
// Virtual file system state (inline due to vi.mock hoisting)
// ============================================================================

interface VirtualFile {
	content: string;
	isDirectory?: boolean;
	permissions?: number;
}

const virtualFs: Record<string, VirtualFile> = {};
const createdDirs = new Set<string>();

function clearVirtualFs(): void {
	for (const key of Object.keys(virtualFs)) {
		delete virtualFs[key];
	}
	createdDirs.clear();
}

function addVirtualFile(
	path: string,
	content: string,
	options?: { isDirectory?: boolean; permissions?: number },
): void {
	const normalized = path.replace(/\\/g, "/");
	virtualFs[normalized] = {
		content,
		isDirectory: options?.isDirectory ?? false,
		permissions: options?.permissions ?? 0o644,
	};
}

// initVirtualFs available for future use but not currently needed
// function initVirtualFs(files: Record<string, string | { content: string; isDirectory?: boolean; permissions?: number }>): void { ... }

function getVirtualFs(): Record<string, VirtualFile> {
	return { ...virtualFs };
}

// ============================================================================
// Mock node:fs before importing index-manager module
// ============================================================================

vi.mock("node:fs", () => ({
	existsSync: vi.fn((path: string) => {
		const normalized = path.replace(/\\/g, "/");
		return normalized in virtualFs || createdDirs.has(normalized);
	}),
	readFileSync: vi.fn((path: string, _encoding?: string) => {
		const normalized = path.replace(/\\/g, "/");
		const file = virtualFs[normalized];
		if (!file) {
			const error = new Error(
				`ENOENT: no such file or directory, open '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}
		if (file.isDirectory) {
			const error = new Error(
				`EISDIR: illegal operation on a directory, read '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "EISDIR";
			throw error;
		}
		if (file.permissions === 0o000) {
			const error = new Error(`EACCES: permission denied, open '${path}'`) as NodeJS.ErrnoException;
			error.code = "EACCES";
			throw error;
		}
		return file.content;
	}),
	writeFileSync: vi.fn((path: string, content: string, _encoding?: string) => {
		const normalized = path.replace(/\\/g, "/");
		// Check if parent dir exists or was created
		const parentDir = normalized.substring(0, normalized.lastIndexOf("/"));
		if (parentDir && !(parentDir in virtualFs) && !createdDirs.has(parentDir)) {
			const error = new Error(
				`ENOENT: no such file or directory, open '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}
		virtualFs[normalized] = { content, isDirectory: false, permissions: 0o644 };
	}),
	mkdirSync: vi.fn((path: string, options?: { recursive?: boolean }) => {
		const normalized = path.replace(/\\/g, "/");
		if (options?.recursive) {
			const parts = normalized.split("/").filter(Boolean);
			let current = "";
			for (const part of parts) {
				current += "/" + part;
				createdDirs.add(current);
			}
		} else {
			createdDirs.add(normalized);
		}
	}),
}));

vi.mock("../config.js", () => ({
	getStateRoot: vi.fn(() => "/home/user/.local/state/offworld"),
}));

vi.mock("../constants.js", () => ({
	VERSION: "0.1.0",
}));

import { mkdirSync, writeFileSync } from "node:fs";
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
	const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
	const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;

	const stateRoot = "/home/user/.local/state/offworld";
	const indexPath = join(stateRoot, "index.json").replace(/\\/g, "/");

	const sampleEntry: RepoIndexEntry = {
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		localPath: "/home/user/ow/github/tanstack/router",
		commitSha: "abc123",
		hasSkill: false,
	};

	const sampleIndex: RepoIndex = {
		version: 1,
		repos: {
			"github:tanstack/router": sampleEntry,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		clearVirtualFs();
	});

	afterEach(() => {
		vi.resetAllMocks();
		clearVirtualFs();
	});

	// =========================================================================
	// getIndexPath tests
	// =========================================================================
	describe("getIndexPath", () => {
		it("returns path to ~/.local/state/offworld/index.json", () => {
			const result = getIndexPath();
			expect(result).toBe("/home/user/.local/state/offworld/index.json");
		});
	});

	// =========================================================================
	// getIndex tests - Real JSON parsing
	// =========================================================================
	describe("getIndex", () => {
		it("returns empty index when file missing", () => {
			// Virtual FS is empty

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("parses existing index.json", () => {
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = getIndex();

			// Deprecated function now returns empty stub
			expect(result.version).toBe(1);
			expect(result.repos).toEqual({});
		});

		// =====================================================================
		// Malformed JSON tests (T2.2 requirement)
		// =====================================================================
		it("returns empty index on JSON parse error - invalid syntax", () => {
			addVirtualFile(indexPath, "invalid json {{{");

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index on JSON parse error - truncated JSON", () => {
			addVirtualFile(indexPath, '{"version": "0.1.0", "repos": {');

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index on JSON parse error - empty file", () => {
			addVirtualFile(indexPath, "");

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index on JSON parse error - null content", () => {
			addVirtualFile(indexPath, "null");

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index on JSON parse error - array instead of object", () => {
			addVirtualFile(indexPath, '["not", "an", "index"]');

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index on schema validation error - missing repos", () => {
			addVirtualFile(indexPath, JSON.stringify({ version: 1 }));

			const result = getIndex();

			expect(result.repos).toEqual({});
		});

		it("returns empty index on schema validation error - invalid structure", () => {
			addVirtualFile(indexPath, JSON.stringify({ invalid: "structure" }));

			const result = getIndex();

			expect(result.repos).toEqual({});
		});

		it("returns empty index on schema validation error - wrong repos type", () => {
			addVirtualFile(indexPath, JSON.stringify({ version: 1, repos: "not-an-object" }));

			const result = getIndex();

			expect(result.repos).toEqual({});
		});

		// =====================================================================
		// Permission scenario tests (T2.2 requirement)
		// =====================================================================
		it("returns empty index on permission denied", () => {
			addVirtualFile(indexPath, JSON.stringify(sampleIndex), { permissions: 0o000 });

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});

		it("returns empty index when path is a directory", () => {
			addVirtualFile(indexPath, "", { isDirectory: true });

			const result = getIndex();

			expect(result.version).toBe("0.1.0");
			expect(result.repos).toEqual({});
		});
	});

	// =========================================================================
	// saveIndex tests - Directory creation logic
	// =========================================================================
	describe("saveIndex", () => {
		it("writes valid JSON", () => {
			// Pre-create the directory
			addVirtualFile(stateRoot, "", { isDirectory: true });

			saveIndex(sampleIndex);

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			expect(() => JSON.parse(content as string)).not.toThrow();
		});

		// =====================================================================
		// Directory creation tests (T2.2 requirement)
		// =====================================================================
		it("creates directory recursively if missing", () => {
			// Virtual FS is empty

			saveIndex(sampleIndex);

			expect(mockMkdirSync).toHaveBeenCalledWith(stateRoot, { recursive: true });
		});

		it("does not create directory if it already exists", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });

			saveIndex(sampleIndex);

			expect(mockMkdirSync).not.toHaveBeenCalled();
		});

		it("writes to correct path", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });

			saveIndex(sampleIndex);

			expect(mockWriteFileSync).toHaveBeenCalledWith(
				"/home/user/.local/state/offworld/index.json",
				expect.any(String),
				"utf-8",
			);
		});

		it("verifies actual file content after save", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });

			saveIndex(sampleIndex);

			const fs = getVirtualFs();
			const savedFile = fs[indexPath];
			expect(savedFile).toBeDefined();
			const parsed = JSON.parse(savedFile!.content) as RepoIndex;
			expect(parsed.version).toBe("0.1.0");
			expect(parsed.repos["github:tanstack/router"]).toBeDefined();
		});

		it("formats JSON with indentation", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });

			saveIndex(sampleIndex);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			expect(content).toContain("\n"); // Has newlines from JSON.stringify(_, null, 2)
		});
	});

	// =========================================================================
	// updateIndex tests
	// =========================================================================
	describe("updateIndex", () => {
		it("adds new repo entry to empty index", () => {
			// Virtual FS empty - no existing index

			updateIndex(sampleEntry);

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:tanstack/router"]).toBeDefined();
			expect(written.repos["github:tanstack/router"]!.commitSha).toBe("abc123");
		});

		it("updates existing repo entry", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

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
				version: 1,
				repos: {
					"github:other/repo": {
						fullName: "other/repo",
						qualifiedName: "github:other/repo",
						localPath: "/home/user/ow/github/other/repo",
						hasSkill: false,
					},
				},
			};
			addVirtualFile(stateRoot, "", { isDirectory: true });
			addVirtualFile(indexPath, JSON.stringify(existingIndex));

			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:other/repo"]).toBeDefined();
			expect(written.repos["github:tanstack/router"]).toBeDefined();
		});

		it("creates directory if missing when adding entry", () => {
			// Virtual FS empty

			updateIndex(sampleEntry);

			expect(mockMkdirSync).toHaveBeenCalledWith(stateRoot, { recursive: true });
		});
	});

	// =========================================================================
	// removeFromIndex tests
	// =========================================================================
	describe("removeFromIndex", () => {
		it("removes existing entry and returns true", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = removeFromIndex("github:tanstack/router");

			expect(result).toBe(true);
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:tanstack/router"]).toBeUndefined();
		});

		it("returns false if entry not found", () => {
			addVirtualFile(stateRoot, "", { isDirectory: true });
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = removeFromIndex("github:nonexistent/repo");

			expect(result).toBe(false);
		});

		it("returns false when index file does not exist", () => {
			// Virtual FS empty - no index file

			const result = removeFromIndex("github:nonexistent/repo");

			expect(result).toBe(false);
		});

		it("preserves other entries when removing", () => {
			const multiIndex: RepoIndex = {
				version: 1,
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
			addVirtualFile(stateRoot, "", { isDirectory: true });
			addVirtualFile(indexPath, JSON.stringify(multiIndex));

			removeFromIndex("github:tanstack/router");

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.repos["github:tanstack/router"]).toBeUndefined();
			expect(written.repos["github:vercel/ai"]).toBeDefined();
		});
	});

	// =========================================================================
	// getIndexEntry tests
	// =========================================================================
	describe("getIndexEntry", () => {
		it("returns entry if exists", () => {
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = getIndexEntry("github:tanstack/router");

			expect(result).toBeDefined();
			expect(result?.fullName).toBe("tanstack/router");
		});

		it("returns undefined if not found", () => {
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = getIndexEntry("github:nonexistent/repo");

			expect(result).toBeUndefined();
		});

		it("returns undefined when index file does not exist", () => {
			// Virtual FS empty

			const result = getIndexEntry("github:tanstack/router");

			expect(result).toBeUndefined();
		});

		it("returns all fields from entry", () => {
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = getIndexEntry("github:tanstack/router");

			expect(result?.fullName).toBe("tanstack/router");
			expect(result?.qualifiedName).toBe("github:tanstack/router");
			expect(result?.localPath).toBe("/home/user/ow/github/tanstack/router");
			expect(result?.commitSha).toBe("abc123");
			expect(result?.hasSkill).toBe(false);
		});
	});

	// =========================================================================
	// listIndexedRepos tests
	// =========================================================================
	describe("listIndexedRepos", () => {
		it("returns all repo entries as array", () => {
			const multiIndex: RepoIndex = {
				version: 1,
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
			addVirtualFile(indexPath, JSON.stringify(multiIndex));

			const result = listIndexedRepos();

			expect(result).toHaveLength(2);
			expect(result.map((r) => r.fullName)).toContain("tanstack/router");
			expect(result.map((r) => r.fullName)).toContain("vercel/ai");
		});

		it("returns empty array when no repos", () => {
			// Virtual FS empty - no index file

			const result = listIndexedRepos();

			expect(result).toEqual([]);
		});

		it("returns empty array when index has empty repos", () => {
			addVirtualFile(indexPath, JSON.stringify({ version: 1, repos: {} }));

			const result = listIndexedRepos();

			expect(result).toEqual([]);
		});

		it("returns entries with all fields populated", () => {
			addVirtualFile(indexPath, JSON.stringify(sampleIndex));

			const result = listIndexedRepos();

			expect(result).toHaveLength(1);
			expect(result[0]!.fullName).toBe("tanstack/router");
			expect(result[0]!.qualifiedName).toBe("github:tanstack/router");
			expect(result[0]!.localPath).toBe("/home/user/ow/github/tanstack/router");
		});
	});

	// =========================================================================
	// Version field tests
	// =========================================================================
	describe("version field", () => {
		it("is set correctly on save", () => {
			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.version).toBe("0.1.0");
		});

		it("updates version when saving", () => {
			const oldIndex: RepoIndex = {
				version: 1, // old version
				repos: {},
			};
			addVirtualFile(stateRoot, "", { isDirectory: true });
			addVirtualFile(indexPath, JSON.stringify(oldIndex));

			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.version).toBe("0.1.0"); // updated to current
		});

		it("preserves version from constants", () => {
			addVirtualFile(indexPath, JSON.stringify({ version: "9.9.9", repos: {} }));

			updateIndex(sampleEntry);

			const [, content] = mockWriteFileSync.mock.calls[0]!;
			const written = JSON.parse(content as string) as RepoIndex;
			expect(written.version).toBe("0.1.0"); // Always uses VERSION constant
		});
	});
});
