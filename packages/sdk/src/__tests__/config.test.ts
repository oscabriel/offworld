/**
 * Unit tests for config.ts path utilities
 * PRD T3.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock node:fs before importing config module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
	getMetaRoot,
	getRepoRoot,
	getRepoPath,
	getAnalysisPath,
	getConfigPath,
	loadConfig,
	saveConfig,
} from "../config.js";

describe("config.ts", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
	const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
	const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// getMetaRoot tests
	// =========================================================================
	describe("getMetaRoot", () => {
		it("returns path ending in .ow", () => {
			const result = getMetaRoot();
			expect(result).toMatch(/\.ow$/);
		});

		it("expands ~ to home directory", () => {
			const result = getMetaRoot();
			const home = homedir();
			expect(result).toBe(join(home, ".ow"));
		});
	});

	// =========================================================================
	// getRepoRoot tests
	// =========================================================================
	describe("getRepoRoot", () => {
		it("returns default ~/ow when no config", () => {
			const result = getRepoRoot();
			const home = homedir();
			expect(result).toBe(join(home, "ow"));
		});

		it("returns default ~/ow when config is undefined", () => {
			const result = getRepoRoot(undefined);
			const home = homedir();
			expect(result).toBe(join(home, "ow"));
		});

		it("returns custom path when configured", () => {
			const config = {
				repoRoot: "/custom/repos",
				metaRoot: "~/.ow",
				skillDir: "~/.config/opencode/skill",
				defaultShallow: true,
				autoAnalyze: true,
			};
			const result = getRepoRoot(config);
			expect(result).toBe("/custom/repos");
		});

		it("expands tilde in custom path", () => {
			const config = {
				repoRoot: "~/custom/repos",
				metaRoot: "~/.ow",
				skillDir: "~/.config/opencode/skill",
				defaultShallow: true,
				autoAnalyze: true,
			};
			const result = getRepoRoot(config);
			const home = homedir();
			expect(result).toBe(join(home, "custom/repos"));
		});
	});

	// =========================================================================
	// getRepoPath tests
	// =========================================================================
	describe("getRepoPath", () => {
		it("returns {root}/github/owner/repo for owner/repo format", () => {
			const result = getRepoPath("tanstack/router");
			const home = homedir();
			expect(result).toBe(join(home, "ow", "github", "tanstack", "router"));
		});

		it("returns {root}/gitlab/owner/repo for gitlab provider", () => {
			const result = getRepoPath("group/project", "gitlab");
			const home = homedir();
			expect(result).toBe(join(home, "ow", "gitlab", "group", "project"));
		});

		it("returns {root}/bitbucket/owner/repo for bitbucket provider", () => {
			const result = getRepoPath("team/repo", "bitbucket");
			const home = homedir();
			expect(result).toBe(join(home, "ow", "bitbucket", "team", "repo"));
		});

		it("uses custom repoRoot from config", () => {
			const config = {
				repoRoot: "/data/repos",
				metaRoot: "~/.ow",
				skillDir: "~/.config/opencode/skill",
				defaultShallow: true,
				autoAnalyze: true,
			};
			const result = getRepoPath("owner/repo", "github", config);
			expect(result).toBe(join("/data/repos", "github", "owner", "repo"));
		});

		it("throws error for invalid fullName format", () => {
			expect(() => getRepoPath("invalid")).toThrow("Invalid fullName format");
			expect(() => getRepoPath("")).toThrow("Invalid fullName format");
		});
	});

	// =========================================================================
	// getAnalysisPath tests
	// =========================================================================
	describe("getAnalysisPath", () => {
		it("returns {meta}/analyses/github--owner--repo for owner/repo", () => {
			const result = getAnalysisPath("tanstack/router");
			const home = homedir();
			expect(result).toBe(join(home, ".ow", "analyses", "github--tanstack--router"));
		});

		it("returns {meta}/analyses/gitlab--owner--repo for gitlab", () => {
			const result = getAnalysisPath("group/project", "gitlab");
			const home = homedir();
			expect(result).toBe(join(home, ".ow", "analyses", "gitlab--group--project"));
		});

		it("returns {meta}/analyses/bitbucket--owner--repo for bitbucket", () => {
			const result = getAnalysisPath("team/repo", "bitbucket");
			const home = homedir();
			expect(result).toBe(join(home, ".ow", "analyses", "bitbucket--team--repo"));
		});

		it("throws error for invalid fullName format", () => {
			expect(() => getAnalysisPath("invalid")).toThrow("Invalid fullName format");
		});
	});

	// =========================================================================
	// getConfigPath tests
	// =========================================================================
	describe("getConfigPath", () => {
		it("returns ~/.ow/config.json", () => {
			const result = getConfigPath();
			const home = homedir();
			expect(result).toBe(join(home, ".ow", "config.json"));
		});
	});

	// =========================================================================
	// loadConfig tests
	// =========================================================================
	describe("loadConfig", () => {
		it("returns defaults when config file missing", () => {
			mockExistsSync.mockReturnValue(false);

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
			expect(result.metaRoot).toBe("~/.ow");
			expect(result.skillDir).toBe("~/.config/opencode/skill");
			expect(result.defaultShallow).toBe(true);
			expect(result.autoAnalyze).toBe(true);
		});

		it("parses existing config file correctly", () => {
			const existingConfig = {
				repoRoot: "/custom/path",
				metaRoot: "/custom/meta",
				skillDir: "/custom/skill",
				defaultShallow: false,
				autoAnalyze: false,
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(existingConfig));

			const result = loadConfig();

			expect(result.repoRoot).toBe("/custom/path");
			expect(result.metaRoot).toBe("/custom/meta");
			expect(result.skillDir).toBe("/custom/skill");
			expect(result.defaultShallow).toBe(false);
			expect(result.autoAnalyze).toBe(false);
		});

		it("applies defaults for missing fields in config file", () => {
			const partialConfig = {
				repoRoot: "/custom/path",
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(partialConfig));

			const result = loadConfig();

			expect(result.repoRoot).toBe("/custom/path");
			expect(result.metaRoot).toBe("~/.ow"); // default
			expect(result.defaultShallow).toBe(true); // default
		});

		it("returns defaults on JSON parse error", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("invalid json {{{");

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
			expect(result.defaultShallow).toBe(true);
		});

		it("returns defaults on read error", () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation(() => {
				throw new Error("EACCES: permission denied");
			});

			const result = loadConfig();

			expect(result.repoRoot).toBe("~/ow");
		});
	});

	// =========================================================================
	// saveConfig tests
	// =========================================================================
	describe("saveConfig", () => {
		it("creates directory if missing", () => {
			mockExistsSync.mockImplementation((_path: string) => {
				// Config dir doesn't exist, config file doesn't exist
				return false;
			});
			mockReadFileSync.mockImplementation(() => {
				throw new Error("ENOENT");
			});

			saveConfig({ repoRoot: "/new/path" });

			expect(mockMkdirSync).toHaveBeenCalled();
			expect(mockMkdirSync.mock.calls[0]![1]).toEqual({ recursive: true });
		});

		it("merges with existing config", () => {
			const existingConfig = {
				repoRoot: "/old/path",
				metaRoot: "/old/meta",
				skillDir: "/old/skill",
				defaultShallow: true,
				autoAnalyze: true,
			};

			// First call: check config dir
			// Second call: check config file
			mockExistsSync
				.mockReturnValueOnce(true) // config dir exists
				.mockReturnValueOnce(true); // config file exists
			mockReadFileSync.mockReturnValue(JSON.stringify(existingConfig));

			saveConfig({ repoRoot: "/new/path" });

			expect(mockWriteFileSync).toHaveBeenCalled();
			const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string);
			expect(writtenContent.repoRoot).toBe("/new/path");
			expect(writtenContent.metaRoot).toBe("/old/meta"); // preserved
		});

		it("writes valid JSON", () => {
			mockExistsSync.mockReturnValue(false);

			saveConfig({ repoRoot: "/test/path" });

			expect(mockWriteFileSync).toHaveBeenCalled();
			const [, content] = mockWriteFileSync.mock.calls[0]!;
			expect(() => JSON.parse(content as string)).not.toThrow();
		});

		it("returns validated config", () => {
			mockExistsSync.mockReturnValue(false);

			const result = saveConfig({ repoRoot: "/test/path" });

			expect(result.repoRoot).toBe("/test/path");
			expect(result.metaRoot).toBe("~/.ow"); // default applied
		});
	});
});
