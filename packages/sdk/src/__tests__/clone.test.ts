/**
 * Unit tests for clone.ts git operations
 * PRD T3.4
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	rmSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

vi.mock("../config.js", () => ({
	loadConfig: vi.fn(),
	getRepoPath: vi.fn(),
	getMetaRoot: vi.fn(),
}));

vi.mock("../index-manager.js", () => ({
	getIndexEntry: vi.fn(),
	listIndexedRepos: vi.fn(),
	removeFromIndex: vi.fn(),
	updateIndex: vi.fn(),
}));

import { existsSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { loadConfig, getRepoPath, getMetaRoot } from "../config.js";
import { getIndexEntry, listIndexedRepos, removeFromIndex, updateIndex } from "../index-manager.js";
import {
	cloneRepo,
	updateRepo,
	removeRepo,
	listRepos,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	RepoExistsError,
	RepoNotFoundError,
	GitError,
} from "../clone.js";
import type { RemoteRepoSource, RepoIndexEntry } from "@offworld/types";

describe("clone.ts", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockRmSync = rmSync as ReturnType<typeof vi.fn>;
	const mockMkdir = mkdir as ReturnType<typeof vi.fn>;
	const mockExecSync = execSync as ReturnType<typeof vi.fn>;
	const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;
	const mockGetRepoPath = getRepoPath as ReturnType<typeof vi.fn>;
	const mockGetMetaRoot = getMetaRoot as ReturnType<typeof vi.fn>;
	const mockGetIndexEntry = getIndexEntry as ReturnType<typeof vi.fn>;
	const mockListIndexedRepos = listIndexedRepos as ReturnType<typeof vi.fn>;
	const mockRemoveFromIndex = removeFromIndex as ReturnType<typeof vi.fn>;
	const mockUpdateIndex = updateIndex as ReturnType<typeof vi.fn>;

	const mockSource: RemoteRepoSource = {
		type: "remote",
		provider: "github",
		owner: "tanstack",
		repo: "router",
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		cloneUrl: "https://github.com/tanstack/router.git",
	};

	const mockIndexEntry: RepoIndexEntry = {
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		localPath: "/home/user/ow/github/tanstack/router",
		commitSha: "abc123",
		hasSkill: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadConfig.mockReturnValue({
			repoRoot: "~/ow",
			metaRoot: "~/.ow",
			skillDir: "~/.config/opencode/skill",
			defaultShallow: true,
			autoAnalyze: true,
		});
		mockGetRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
		mockGetMetaRoot.mockReturnValue("/home/user/.ow");
		mockExecSync.mockReturnValue("abc123def456");
		mockMkdir.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// cloneRepo tests
	// =========================================================================
	describe("cloneRepo", () => {
		it("calls git clone with correct URL (mocked execa)", async () => {
			mockExistsSync.mockReturnValue(false);

			await cloneRepo(mockSource);

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("git clone"),
				expect.any(Object)
			);
			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("https://github.com/tanstack/router.git"),
				expect.any(Object)
			);
		});

		it("uses --depth 1 when shallow=true", async () => {
			mockExistsSync.mockReturnValue(false);

			await cloneRepo(mockSource, { shallow: true });

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("--depth 1"),
				expect.any(Object)
			);
		});

		it("uses --branch flag when branch specified", async () => {
			mockExistsSync.mockReturnValue(false);

			await cloneRepo(mockSource, { branch: "develop" });

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("--branch develop"),
				expect.any(Object)
			);
		});

		it("throws RepoExistsError if path exists", async () => {
			mockExistsSync.mockReturnValue(true);

			await expect(cloneRepo(mockSource)).rejects.toThrow(RepoExistsError);
		});

		it("creates parent directories if missing", async () => {
			mockExistsSync.mockReturnValue(false);

			await cloneRepo(mockSource);

			expect(mockMkdir).toHaveBeenCalledWith(
				expect.any(String),
				{ recursive: true }
			);
		});

		it("updates index after successful clone", async () => {
			mockExistsSync.mockReturnValue(false);

			await cloneRepo(mockSource);

			expect(mockUpdateIndex).toHaveBeenCalledWith(
				expect.objectContaining({
					fullName: "tanstack/router",
					qualifiedName: "github:tanstack/router",
				})
			);
		});

		it("removes existing and clones when force=true", async () => {
			mockExistsSync.mockReturnValue(true);

			await cloneRepo(mockSource, { force: true });

			expect(mockRmSync).toHaveBeenCalledWith(
				expect.any(String),
				{ recursive: true, force: true }
			);
			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("git clone"),
				expect.any(Object)
			);
		});
	});

	// =========================================================================
	// updateRepo tests
	// =========================================================================
	describe("updateRepo", () => {
		it("calls git fetch then git pull", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			await updateRepo("github:tanstack/router");

			const calls = mockExecSync.mock.calls;
			const fetchCall = calls.find(([cmd]: [string]) => cmd.includes("git fetch"));
			const pullCall = calls.find(([cmd]: [string]) => cmd.includes("git pull"));

			expect(fetchCall).toBeDefined();
			expect(pullCall).toBeDefined();
		});

		it("throws RepoNotFoundError if not cloned", async () => {
			mockGetIndexEntry.mockReturnValue(null);

			await expect(updateRepo("github:unknown/repo")).rejects.toThrow(RepoNotFoundError);
		});

		it("throws RepoNotFoundError if path doesn't exist on disk", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(false);

			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(RepoNotFoundError);
		});

		it("returns UpdateResult with commit SHAs", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);
			mockExecSync
				.mockReturnValueOnce("oldsha123") // first rev-parse (previous)
				.mockReturnValueOnce("") // fetch
				.mockReturnValueOnce("") // pull
				.mockReturnValueOnce("newsha456"); // second rev-parse (current)

			const result = await updateRepo("github:tanstack/router");

			expect(result).toHaveProperty("previousSha", "oldsha123");
			expect(result).toHaveProperty("currentSha", "newsha456");
			expect(result).toHaveProperty("updated", true);
		});

		it("updates index with new commit SHA", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			await updateRepo("github:tanstack/router");

			expect(mockUpdateIndex).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// removeRepo tests
	// =========================================================================
	describe("removeRepo", () => {
		it("removes repo directory", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			await removeRepo("github:tanstack/router");

			expect(mockRmSync).toHaveBeenCalledWith(
				mockIndexEntry.localPath,
				{ recursive: true, force: true }
			);
		});

		it("removes analysis directory", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			await removeRepo("github:tanstack/router");

			expect(mockRmSync).toHaveBeenCalledWith(
				expect.stringContaining("analyses"),
				{ recursive: true, force: true }
			);
		});

		it("updates index after removal", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			await removeRepo("github:tanstack/router");

			expect(mockRemoveFromIndex).toHaveBeenCalledWith("github:tanstack/router");
		});

		it("returns false if not in index", async () => {
			mockGetIndexEntry.mockReturnValue(null);

			const result = await removeRepo("github:unknown/repo");

			expect(result).toBe(false);
		});

		it("returns true after successful removal", async () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			const result = await removeRepo("github:tanstack/router");

			expect(result).toBe(true);
		});
	});

	// =========================================================================
	// listRepos tests
	// =========================================================================
	describe("listRepos", () => {
		it("returns repos from index", () => {
			const repos = [mockIndexEntry];
			mockListIndexedRepos.mockReturnValue(repos);

			const result = listRepos();

			expect(result).toEqual(repos);
			expect(mockListIndexedRepos).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// isRepoCloned tests
	// =========================================================================
	describe("isRepoCloned", () => {
		it("returns true if in index and exists on disk", () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			expect(isRepoCloned("github:tanstack/router")).toBe(true);
		});

		it("returns false if not in index", () => {
			mockGetIndexEntry.mockReturnValue(null);

			expect(isRepoCloned("github:unknown/repo")).toBe(false);
		});

		it("returns false if in index but not on disk", () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(false);

			expect(isRepoCloned("github:tanstack/router")).toBe(false);
		});
	});

	// =========================================================================
	// getClonedRepoPath tests
	// =========================================================================
	describe("getClonedRepoPath", () => {
		it("returns local path if exists", () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			const result = getClonedRepoPath("github:tanstack/router");

			expect(result).toBe(mockIndexEntry.localPath);
		});

		it("returns undefined if not in index", () => {
			mockGetIndexEntry.mockReturnValue(null);

			expect(getClonedRepoPath("github:unknown/repo")).toBeUndefined();
		});

		it("returns undefined if not on disk", () => {
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(false);

			expect(getClonedRepoPath("github:tanstack/router")).toBeUndefined();
		});
	});

	// =========================================================================
	// getCommitSha tests
	// =========================================================================
	describe("getCommitSha", () => {
		it("returns commit SHA from git rev-parse", () => {
			mockExecSync.mockReturnValue("sha123456");

			const result = getCommitSha("/some/repo");

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("git rev-parse HEAD"),
				expect.objectContaining({ cwd: "/some/repo" })
			);
			expect(result).toBe("sha123456");
		});
	});

	// =========================================================================
	// Error handling tests
	// =========================================================================
	describe("error handling", () => {
		it("throws GitError when clone fails", async () => {
			mockExistsSync.mockReturnValue(false);
			mockExecSync.mockImplementation(() => {
				const error = new Error("fatal: repository not found") as Error & {
					status: number;
					stderr: string;
				};
				error.status = 128;
				error.stderr = "fatal: repository not found";
				throw error;
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);
		});
	});
});
