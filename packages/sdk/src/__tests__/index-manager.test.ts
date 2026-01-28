/**
 * Unit tests for index-manager.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import type { GlobalMap, GlobalMapRepoEntry } from "@offworld/types";

interface VirtualFile {
	content: string;
	isDirectory?: boolean;
	permissions?: number;
}

const virtualFs: Record<string, VirtualFile> = {};
const createdDirs = new Set<string>();

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

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
	const normalized = normalizePath(path);
	virtualFs[normalized] = {
		content,
		isDirectory: options?.isDirectory ?? false,
		permissions: options?.permissions ?? 0o644,
	};
}

const globalMapPath = vi.hoisted(
	() => "/home/user/.local/share/offworld/skill/offworld/assets/map.json",
);
const globalMapDir = vi.hoisted(() => "/home/user/.local/share/offworld/skill/offworld/assets");

vi.mock("node:fs", () => ({
	existsSync: vi.fn((path: string) => {
		const normalized = normalizePath(path);
		return normalized in virtualFs || createdDirs.has(normalized);
	}),
	readFileSync: vi.fn((path: string, _encoding?: string) => {
		const normalized = normalizePath(path);
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
		const normalized = normalizePath(path);
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
		const normalized = normalizePath(path);
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

vi.mock("../paths.js", () => ({
	Paths: {
		offworldGlobalMapPath: globalMapPath,
	},
}));

import { mkdirSync, writeFileSync } from "node:fs";
import { Paths } from "../paths.js";
import {
	readGlobalMap,
	writeGlobalMap,
	upsertGlobalMapEntry,
	removeGlobalMapEntry,
	writeProjectMap,
} from "../index-manager.js";

describe("index-manager.ts", () => {
	const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
	const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;

	const sampleEntry: GlobalMapRepoEntry = {
		localPath: "/home/user/ow/github/tanstack/router",
		references: ["tanstack-router.md"],
		primary: "tanstack-router.md",
		keywords: ["router"],
		updatedAt: "2026-01-25T00:00:00Z",
	};

	const sampleMap: GlobalMap = {
		repos: {
			"github.com:tanstack/router": sampleEntry,
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

	describe("Paths.offworldGlobalMapPath", () => {
		it("returns global map path", () => {
			expect(Paths.offworldGlobalMapPath).toBe(globalMapPath);
		});
	});

	describe("readGlobalMap", () => {
		it("returns empty map when file missing", () => {
			expect(readGlobalMap()).toEqual({ repos: {} });
		});

		it("reads valid map", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleMap));

			expect(readGlobalMap()).toEqual(sampleMap);
		});

		it("returns empty map on invalid JSON", () => {
			addVirtualFile(globalMapPath, "{not json");

			expect(readGlobalMap()).toEqual({ repos: {} });
		});

		it("returns empty map on schema error", () => {
			addVirtualFile(
				globalMapPath,
				JSON.stringify({ repos: { "github.com:tanstack/router": { localPath: "/tmp" } } }),
			);

			expect(readGlobalMap()).toEqual({ repos: {} });
		});
	});

	describe("writeGlobalMap", () => {
		it("creates directory when missing", () => {
			writeGlobalMap(sampleMap);

			expect(mockMkdirSync).toHaveBeenCalledWith(globalMapDir, { recursive: true });
		});

		it("writes validated JSON", () => {
			writeGlobalMap(sampleMap);

			expect(mockWriteFileSync).toHaveBeenCalledWith(globalMapPath, expect.any(String), "utf-8");
			const saved = virtualFs[normalizePath(globalMapPath)];
			expect(saved).toBeDefined();
			expect(JSON.parse(saved!.content)).toEqual(sampleMap);
		});
	});

	describe("upsertGlobalMapEntry", () => {
		it("adds entry to empty map", () => {
			upsertGlobalMapEntry("github.com:tanstack/router", sampleEntry);

			const saved = virtualFs[normalizePath(globalMapPath)];
			expect(saved).toBeDefined();
			const parsed = JSON.parse(saved!.content) as GlobalMap;
			expect(parsed.repos["github.com:tanstack/router"]).toEqual(sampleEntry);
		});

		it("preserves other entries", () => {
			const existing: GlobalMap = {
				repos: {
					"github.com:other/repo": {
						localPath: "/home/user/ow/github/other/repo",
						references: ["other-repo.md"],
						primary: "other-repo.md",
						keywords: [],
						updatedAt: "2026-01-24T00:00:00Z",
					},
				},
			};
			addVirtualFile(globalMapPath, JSON.stringify(existing));

			upsertGlobalMapEntry("github.com:tanstack/router", sampleEntry);

			const saved = virtualFs[normalizePath(globalMapPath)];
			const parsed = JSON.parse(saved!.content) as GlobalMap;
			expect(parsed.repos["github.com:other/repo"]).toBeDefined();
			expect(parsed.repos["github.com:tanstack/router"]).toBeDefined();
		});
	});

	describe("removeGlobalMapEntry", () => {
		it("returns false when entry missing", () => {
			const result = removeGlobalMapEntry("github.com:missing/repo");

			expect(result).toBe(false);
			expect(mockWriteFileSync).not.toHaveBeenCalled();
		});

		it("removes existing entry", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleMap));

			const result = removeGlobalMapEntry("github.com:tanstack/router");

			expect(result).toBe(true);
			const saved = virtualFs[normalizePath(globalMapPath)];
			const parsed = JSON.parse(saved!.content) as GlobalMap;
			expect(parsed.repos["github.com:tanstack/router"]).toBeUndefined();
		});
	});

	describe("writeProjectMap", () => {
		it("writes project map to .offworld/map.json", () => {
			const projectRoot = "/home/user/project";
			const entries = {
				"github.com:tanstack/router": {
					localPath: "/home/user/ow/github/tanstack/router",
					reference: "tanstack-router.md",
					keywords: [],
				},
			};

			writeProjectMap(projectRoot, entries);

			expect(mockMkdirSync).toHaveBeenCalledWith(join(projectRoot, ".offworld"), {
				recursive: true,
			});
			const projectMapPath = normalizePath(join(projectRoot, ".offworld", "map.json"));
			const saved = virtualFs[projectMapPath];
			expect(saved).toBeDefined();
			const parsed = JSON.parse(saved!.content) as {
				version: number;
				scope: string;
				globalMapPath: string;
				repos: typeof entries;
			};
			expect(parsed.scope).toBe("project");
			expect(parsed.version).toBe(1);
			expect(parsed.globalMapPath).toBe(globalMapPath);
			expect(parsed.repos["github.com:tanstack/router"]).toBeDefined();
		});
	});
});
