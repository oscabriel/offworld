/**
 * Unit tests for map.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalMap, ProjectMap } from "@offworld/types";

// ============================================================================
// Virtual file system state
// ============================================================================

interface VirtualFile {
	content: string;
	isDirectory?: boolean;
}

const virtualFs: Record<string, VirtualFile> = {};

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function clearVirtualFs(): void {
	for (const key of Object.keys(virtualFs)) {
		delete virtualFs[key];
	}
}

function addVirtualFile(path: string, content: string): void {
	const normalized = normalizePath(path);
	virtualFs[normalized] = { content, isDirectory: false };
}

const globalMapPath = vi.hoisted(
	() => "/home/user/.local/share/offworld/skill/offworld/assets/map.json",
);
const referencesDir = vi.hoisted(
	() => "/home/user/.local/share/offworld/skill/offworld/references",
);

// ============================================================================
// Mock node:fs before importing module
// ============================================================================

vi.mock("node:fs", () => ({
	existsSync: vi.fn((path: string) => {
		const normalized = normalizePath(path);
		return normalized in virtualFs;
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
		return file.content;
	}),
}));

vi.mock("../paths.js", () => ({
	Paths: {
		offworldGlobalMapPath: globalMapPath,
		offworldReferencesDir: referencesDir,
	},
}));

import { resolveRepoKey, getMapEntry, searchMap, getProjectMapPath } from "../map.js";

describe("map.ts", () => {
	const sampleGlobalMap: GlobalMap = {
		repos: {
			"github.com:tanstack/router": {
				localPath: "/home/user/ow/github/tanstack/router",
				references: ["tanstack-router.md"],
				primary: "tanstack-router.md",
				keywords: ["router", "react-router", "tanstack"],
				updatedAt: "2026-01-25T00:00:00Z",
			},
			"github.com:colinhacks/zod": {
				localPath: "/home/user/ow/github/colinhacks/zod",
				references: ["colinhacks-zod.md"],
				primary: "colinhacks-zod.md",
				keywords: ["zod", "validation", "schema"],
				updatedAt: "2026-01-25T00:00:00Z",
			},
			"github.com:microsoft/TypeScript": {
				localPath: "/home/user/ow/github/microsoft/TypeScript",
				references: ["microsoft-TypeScript.md"],
				primary: "microsoft-TypeScript.md",
				keywords: ["typescript", "ts", "compiler"],
				updatedAt: "2026-01-25T00:00:00Z",
			},
		},
	};

	const sampleProjectMap: ProjectMap = {
		version: 1,
		scope: "project",
		globalMapPath: globalMapPath,
		repos: {
			"github.com:tanstack/router": {
				localPath: "/home/user/ow/github/tanstack/router",
				reference: "tanstack-router.md",
				keywords: ["router"],
			},
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

	describe("resolveRepoKey", () => {
		it("matches exact qualified name", () => {
			const result = resolveRepoKey("github.com:tanstack/router", sampleGlobalMap);
			expect(result).toBe("github.com:tanstack/router");
		});

		it("matches by owner/repo", () => {
			const result = resolveRepoKey("tanstack/router", sampleGlobalMap);
			expect(result).toBe("github.com:tanstack/router");
		});

		it("matches by repo name only", () => {
			const result = resolveRepoKey("zod", sampleGlobalMap);
			expect(result).toBe("github.com:colinhacks/zod");
		});

		it("is case insensitive", () => {
			const result = resolveRepoKey("TanStack/Router", sampleGlobalMap);
			expect(result).toBe("github.com:tanstack/router");
		});

		it("returns null for no match", () => {
			const result = resolveRepoKey("nonexistent/repo", sampleGlobalMap);
			expect(result).toBeNull();
		});
	});

	describe("getMapEntry", () => {
		it("returns null when no maps exist", () => {
			const result = getMapEntry("tanstack/router");
			expect(result).toBeNull();
		});

		it("returns entry from global map", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));

			const result = getMapEntry("tanstack/router");

			expect(result).not.toBeNull();
			expect(result?.scope).toBe("global");
			expect(result?.qualifiedName).toBe("github.com:tanstack/router");
			expect(result?.entry.localPath).toBe("/home/user/ow/github/tanstack/router");
		});

		it("prefers project map when it exists", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));
			addVirtualFile(
				normalizePath(process.cwd() + "/.offworld/map.json"),
				JSON.stringify(sampleProjectMap),
			);

			const result = getMapEntry("tanstack/router");

			expect(result).not.toBeNull();
			expect(result?.scope).toBe("project");
		});

		it("falls back to global when not in project map", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));
			addVirtualFile(
				normalizePath(process.cwd() + "/.offworld/map.json"),
				JSON.stringify(sampleProjectMap),
			);

			const result = getMapEntry("colinhacks/zod");

			expect(result).not.toBeNull();
			expect(result?.scope).toBe("global");
			expect(result?.qualifiedName).toBe("github.com:colinhacks/zod");
		});
	});

	describe("searchMap", () => {
		it("returns empty array when no map exists", () => {
			const results = searchMap("router");
			expect(results).toEqual([]);
		});

		it("finds exact fullName matches with high score", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));

			const results = searchMap("tanstack/router");

			expect(results.length).toBeGreaterThan(0);
			expect(results[0]!.fullName).toBe("tanstack/router");
			expect(results[0]!.score).toBeGreaterThanOrEqual(100);
		});

		it("finds keyword matches", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));

			const results = searchMap("validation");

			expect(results.length).toBeGreaterThan(0);
			expect(results[0]!.fullName).toBe("colinhacks/zod");
		});

		it("finds partial matches", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));

			const results = searchMap("tan");

			expect(results.length).toBeGreaterThan(0);
			expect(results.some((r) => r.fullName.includes("tanstack"))).toBe(true);
		});

		it("respects limit option", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));

			const results = searchMap("a", { limit: 2 });

			expect(results.length).toBeLessThanOrEqual(2);
		});

		it("sorts by score descending", () => {
			addVirtualFile(globalMapPath, JSON.stringify(sampleGlobalMap));

			const results = searchMap("router");

			for (let i = 1; i < results.length; i++) {
				const prev = results[i - 1];
				const curr = results[i];
				if (prev && curr) {
					expect(prev.score).toBeGreaterThanOrEqual(curr.score);
				}
			}
		});
	});

	describe("getProjectMapPath", () => {
		it("returns null when project map does not exist", () => {
			const result = getProjectMapPath("/some/project");
			expect(result).toBeNull();
		});

		it("returns path when project map exists", () => {
			const projectPath = "/some/project";
			const mapPath = normalizePath(`${projectPath}/.offworld/map.json`);
			addVirtualFile(mapPath, JSON.stringify(sampleProjectMap));

			const result = getProjectMapPath(projectPath);
			expect(result).toBe(mapPath);
		});
	});
});
