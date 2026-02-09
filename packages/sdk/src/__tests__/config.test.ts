/**
 * Unit tests for config.ts path utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

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

function getVirtualFs(): Record<string, VirtualFile> {
	return { ...virtualFs };
}

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

import { mkdirSync, writeFileSync } from "node:fs";
import {
	getMetaRoot,
	getRepoRoot,
	getRepoPath,
	getMetaPath,
	getConfigPath,
	loadConfig,
	saveConfig,
	toReferenceFileName,
} from "../config.js";

describe("config.ts", () => {
	const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
	const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;

	const home = homedir();
	const configDir = join(home, ".config", "offworld").replace(/\\/g, "/");
	const configPath = join(home, ".config", "offworld", "offworld.json").replace(/\\/g, "/");

	beforeEach(() => {
		vi.clearAllMocks();
		clearVirtualFs();
	});

	afterEach(() => {
		vi.resetAllMocks();
		clearVirtualFs();
	});

	describe("getMetaRoot", () => {
		it("returns path ending in offworld", () => {
			const result = getMetaRoot();
			expect(result).toMatch(/offworld$/);
		});

		it("expands ~ to home directory", () => {
			const result = getMetaRoot();
			expect(result).toBe(join(home, ".local", "share", "offworld"));
		});
	});

	describe("getRepoRoot", () => {
		it("returns default ~/ow when no config", () => {
			const result = getRepoRoot();
			expect(result).toBe(join(home, "ow"));
		});

		it("returns default ~/ow when config is undefined", () => {
			const result = getRepoRoot(undefined);
			expect(result).toBe(join(home, "ow"));
		});

		it("returns custom path when configured", () => {
			const config = {
				repoRoot: "/custom/repos",
				defaultModel: "anthropic/claude-sonnet-4-20250514",
				maxCommitDistance: 20,
				acceptUnknownDistance: false,
				agents: ["opencode"] as (
					| "opencode"
					| "claude-code"
					| "codex"
					| "amp"
					| "antigravity"
					| "cursor"
				)[],
			};
			const result = getRepoRoot(config);
			expect(result).toBe("/custom/repos");
		});

		it("expands tilde in custom path", () => {
			const config = {
				repoRoot: "~/custom/repos",
				defaultModel: "anthropic/claude-sonnet-4-20250514",
				maxCommitDistance: 20,
				acceptUnknownDistance: false,
				agents: ["opencode"] as (
					| "opencode"
					| "claude-code"
					| "codex"
					| "amp"
					| "antigravity"
					| "cursor"
				)[],
			};
			const result = getRepoRoot(config);
			expect(result).toBe(join(home, "custom/repos"));
		});
	});

	describe("getRepoPath", () => {
		it("returns {root}/github/owner/repo for owner/repo format", () => {
			const result = getRepoPath("tanstack/router");
			expect(result).toBe(join(home, "ow", "github", "tanstack", "router"));
		});

		it("returns {root}/gitlab/owner/repo for gitlab provider", () => {
			const result = getRepoPath("group/project", "gitlab");
			expect(result).toBe(join(home, "ow", "gitlab", "group", "project"));
		});

		it("returns {root}/bitbucket/owner/repo for bitbucket provider", () => {
			const result = getRepoPath("team/repo", "bitbucket");
			expect(result).toBe(join(home, "ow", "bitbucket", "team", "repo"));
		});

		it("uses custom repoRoot from config", () => {
			const config = {
				repoRoot: "/data/repos",
				defaultModel: "anthropic/claude-sonnet-4-20250514",
				maxCommitDistance: 20,
				acceptUnknownDistance: false,
				agents: ["opencode"] as (
					| "opencode"
					| "claude-code"
					| "codex"
					| "amp"
					| "antigravity"
					| "cursor"
				)[],
			};
			const result = getRepoPath("owner/repo", "github", config);
			expect(result).toBe(join("/data/repos", "github", "owner", "repo"));
		});

		it("throws error for invalid fullName format", () => {
			expect(() => getRepoPath("invalid")).toThrow("Invalid fullName format");
			expect(() => getRepoPath("")).toThrow("Invalid fullName format");
		});
	});

	describe("getMetaPath", () => {
		it("returns {meta}/meta/owner-repo for owner/repo", () => {
			const result = getMetaPath("tanstack/router");
			expect(result).toBe(join(home, ".local", "share", "offworld", "meta", "tanstack-router"));
		});

		it("handles single name (no slash) gracefully", () => {
			const result = getMetaPath("invalid");
			expect(result).toBe(join(home, ".local", "share", "offworld", "meta", "invalid"));
		});
	});

	describe("getConfigPath", () => {
		it("returns ~/.config/offworld/offworld.json", () => {
			const result = getConfigPath();
			expect(result).toBe(join(home, ".config", "offworld", "offworld.json"));
		});
	});

	describe("loadConfig", () => {
		it("returns defaults when config file missing", () => {
			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
			expect(result.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});

		it("parses existing config file correctly", () => {
			const existingConfig = {
				repoRoot: "/custom/path",
				defaultModel: "anthropic/claude-sonnet-4-20250514",
			};
			addVirtualFile(configPath, JSON.stringify(existingConfig));

			const result = loadConfig();

			expect(result.repoRoot).toBe("/custom/path");
			expect(result.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});

		it("applies defaults for missing fields in config file", () => {
			const partialConfig = {
				repoRoot: "/custom/path",
			};
			addVirtualFile(configPath, JSON.stringify(partialConfig));

			const result = loadConfig();

			expect(result.repoRoot).toBe("/custom/path");
			expect(result.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});

		it("returns defaults on JSON parse error - invalid syntax", () => {
			addVirtualFile(configPath, "invalid json {{{");

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
			expect(result.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});

		it("returns defaults on JSON parse error - truncated JSON", () => {
			addVirtualFile(configPath, '{"repoRoot": "/path"');

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});

		it("returns defaults on JSON parse error - empty file", () => {
			addVirtualFile(configPath, "");

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});

		it("returns defaults on JSON parse error - null content", () => {
			addVirtualFile(configPath, "null");

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});

		it("returns defaults on JSON parse error - array instead of object", () => {
			addVirtualFile(configPath, '["not", "an", "object"]');

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});

		it("returns defaults on JSON parse error - wrong type for repoRoot", () => {
			addVirtualFile(configPath, JSON.stringify({ repoRoot: 123 }));

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});

		it("returns defaults on read error - permission denied", () => {
			addVirtualFile(configPath, '{"repoRoot": "/path"}', { permissions: 0o000 });

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});

		it("returns defaults when config path is a directory", () => {
			addVirtualFile(configPath, "", { isDirectory: true });

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});
	});

	describe("saveConfig", () => {
		it("creates directory recursively if missing", () => {
			saveConfig({ repoRoot: "/new/path" });

			expect(mockMkdirSync).toHaveBeenCalledWith(configDir, { recursive: true });
		});

		it("does not create directory if it already exists", () => {
			addVirtualFile(configDir, "", { isDirectory: true });

			saveConfig({ repoRoot: "/new/path" });

			expect(mockMkdirSync).not.toHaveBeenCalled();
		});

		it("creates nested directory structure", () => {
			saveConfig({ repoRoot: "/new/path" });

			expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringMatching(/offworld$/), {
				recursive: true,
			});
		});

		it("merges with existing config", () => {
			const existingConfig = {
				repoRoot: "/old/path",
				defaultModel: "anthropic/claude-sonnet-4-20250514",
			};
			addVirtualFile(configDir, "", { isDirectory: true });
			addVirtualFile(configPath, JSON.stringify(existingConfig));

			saveConfig({ repoRoot: "/new/path" });

			expect(mockWriteFileSync).toHaveBeenCalled();
			const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string);
			expect(writtenContent.repoRoot).toBe("/new/path");
			expect(writtenContent.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});

		it("writes valid JSON", () => {
			saveConfig({ repoRoot: "/test/path" });

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			expect(() => JSON.parse(content as string)).not.toThrow();
		});

		it("returns validated config", () => {
			const result = saveConfig({ repoRoot: "/test/path" });

			expect(result.repoRoot).toBe("/test/path");
			expect(result.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});

		it("writes config with correct encoding", () => {
			saveConfig({ repoRoot: "/test/path" });

			expect(mockWriteFileSync).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				"utf-8",
			);
		});

		it("verifies actual file content after save", () => {
			addVirtualFile(configDir, "", { isDirectory: true });

			saveConfig({ repoRoot: "/verify/path" });

			const fs = getVirtualFs();
			const savedFile = fs[configPath];
			expect(savedFile).toBeDefined();
			const parsed = JSON.parse(savedFile!.content);
			expect(parsed.repoRoot).toBe("/verify/path");
			expect(parsed.defaultModel).toBe("anthropic/claude-sonnet-4-20250514");
		});
	});

	describe("toReferenceFileName", () => {
		it("collapses exact owner/repo match", () => {
			expect(toReferenceFileName("better-auth/better-auth")).toBe("better-auth.md");
		});

		it("collapses when repo part is contained in owner", () => {
			expect(toReferenceFileName("honojs/hono")).toBe("hono.md");
			expect(toReferenceFileName("get-convex/convex-backend")).toBe("convex-backend.md");
			expect(toReferenceFileName("get-convex/convex-helpers")).toBe("convex-helpers.md");
			expect(toReferenceFileName("alchemy-run/alchemy")).toBe("alchemy.md");
			expect(toReferenceFileName("vitest-dev/vitest")).toBe("vitest.md");
			expect(toReferenceFileName("use-gesture/gesture")).toBe("gesture.md");
		});

		it("keeps owner when no repo part is contained in owner", () => {
			expect(toReferenceFileName("tanstack/query")).toBe("tanstack-query.md");
			expect(toReferenceFileName("tanstack/router")).toBe("tanstack-router.md");
			expect(toReferenceFileName("vercel/ai")).toBe("vercel-ai.md");
		});

		it("ignores short parts (< 3 chars) to avoid false positives", () => {
			expect(toReferenceFileName("vercel/ai")).toBe("vercel-ai.md");
		});

		it("handles simple repo name without slash", () => {
			expect(toReferenceFileName("my-lib")).toBe("my-lib.md");
		});

		it("is case insensitive for matching", () => {
			expect(toReferenceFileName("HonoJS/Hono")).toBe("hono.md");
			expect(toReferenceFileName("Get-Convex/Convex-Backend")).toBe("convex-backend.md");
		});
	});
});
