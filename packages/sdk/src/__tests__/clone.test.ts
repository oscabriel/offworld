/**
 * Unit tests for clone.ts git operations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import type { RemoteRepoSource, RepoIndexEntry } from "@offworld/types";

// ============================================================================
// Virtual file system state (module-scoped for mock access)
// ============================================================================

const virtualFs: Record<string, { content: string; isDirectory?: boolean }> = {};
const createdDirs = new Set<string>();

function normalizePath(p: string): string {
	if (p.startsWith("~/")) {
		p = join(homedir(), p.slice(2));
	}
	return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

function clearVirtualFs(): void {
	for (const key of Object.keys(virtualFs)) {
		delete virtualFs[key];
	}
	createdDirs.clear();
}

function addVirtualPath(path: string, isDirectory = false): void {
	const normalized = normalizePath(path);
	virtualFs[normalized] = { content: "", isDirectory };
}

// ============================================================================
// Git mock configuration (module-scoped)
// ============================================================================

interface GitMockConfig {
	clone?: { shouldSucceed?: boolean; errorMessage?: string };
	fetch?: { shouldSucceed?: boolean; errorMessage?: string };
	pull?: { shouldSucceed?: boolean; errorMessage?: string };
	revParse?: { sha?: string; shouldSucceed?: boolean; errorMessage?: string; shas?: string[] };
}

const defaultGitConfig: GitMockConfig = {
	clone: { shouldSucceed: true },
	fetch: { shouldSucceed: true },
	pull: { shouldSucceed: true },
	revParse: { sha: "abc123def456", shouldSucceed: true },
};

let gitConfig: GitMockConfig = { ...defaultGitConfig };
let revParseCallCount = 0;

function configureGitMock(config: Partial<GitMockConfig>): void {
	gitConfig = { ...defaultGitConfig, ...config };
	revParseCallCount = 0;
}

function resetGitMock(): void {
	gitConfig = { ...defaultGitConfig };
	revParseCallCount = 0;
}

// ============================================================================
// Mock setup - vi.mock calls are hoisted
// ============================================================================

vi.mock("node:fs", () => ({
	existsSync: vi.fn((path: string) => {
		const normalized = normalizePath(path);
		return normalized in virtualFs;
	}),
	rmSync: vi.fn((path: string, _options?: { recursive?: boolean; force?: boolean }) => {
		const normalized = normalizePath(path);
		// Remove all paths starting with this path
		for (const key of Object.keys(virtualFs)) {
			if (key === normalized || key.startsWith(normalized + "/")) {
				delete virtualFs[key];
			}
		}
	}),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(async (path: string, _options?: { recursive?: boolean }) => {
		const normalized = normalizePath(path);
		createdDirs.add(normalized);
		virtualFs[normalized] = { content: "", isDirectory: true };
	}),
}));

vi.mock("node:child_process", () => ({
	execSync: vi.fn((command: string, options?: { cwd?: string }) => {
		const parts = command.split(" ");
		if (parts[0] !== "git") {
			throw new Error(`Expected git command, got: ${command}`);
		}

		const gitCommand = parts[1];
		const cwd = options?.cwd;

		switch (gitCommand) {
			case "clone": {
				const config = gitConfig.clone ?? defaultGitConfig.clone;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "Clone failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 128;
					error.stderr = config?.errorMessage ?? "fatal: repository not found";
					throw error;
				}
				// Simulate clone success - extract destination path and mark as existing
				const args = parts.slice(2);
				const destPath = args[args.length - 1];
				if (destPath) {
					const normalized = normalizePath(destPath);
					virtualFs[normalized] = { content: "", isDirectory: true };
					virtualFs[join(normalized, ".git").replace(/\\/g, "/")] = {
						content: "",
						isDirectory: true,
					};
				}
				return "";
			}

			case "fetch": {
				const config = gitConfig.fetch ?? defaultGitConfig.fetch;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "Fetch failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 1;
					error.stderr = config?.errorMessage ?? "fatal: unable to access";
					throw error;
				}
				return "";
			}

			case "pull": {
				const config = gitConfig.pull ?? defaultGitConfig.pull;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "Pull failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 1;
					error.stderr = config?.errorMessage ?? "error: pull failed";
					throw error;
				}
				return "Already up to date.";
			}

			case "rev-parse": {
				const config = gitConfig.revParse ?? defaultGitConfig.revParse;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "rev-parse failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 128;
					error.stderr = config?.errorMessage ?? "fatal: not a git repository";
					throw error;
				}
				// Support multiple SHA returns for testing update scenarios
				if (config.shas && config.shas.length > revParseCallCount) {
					return config.shas[revParseCallCount++] ?? config.sha ?? "abc123def456";
				}
				return config.sha ?? "abc123def456";
			}

			case "sparse-checkout":
				return "";

			case "checkout":
				return "";

			default:
				throw new Error(`Unhandled git command: ${gitCommand} (cwd: ${cwd})`);
		}
	}),
}));

const mockMetaRoot = join(homedir(), ".ow");
const mockRepoRoot = join(homedir(), "ow");

vi.mock("../config.js", () => ({
	loadConfig: vi.fn(() => ({
		repoRoot: "~/ow",
		metaRoot: "~/.config/offworld",
		skillDir: "~/.config/opencode/skill",
		defaultShallow: true,
		autoAnalyze: true,
	})),
	getRepoPath: vi.fn((fullName: string, provider: string) => {
		return join(mockRepoRoot, provider, fullName);
	}),
	getMetaRoot: vi.fn(() => mockMetaRoot),
}));

// Index state
const indexEntries: Record<string, RepoIndexEntry> = {};

vi.mock("../index-manager.js", () => ({
	getIndexEntry: vi.fn((qualifiedName: string) => {
		return indexEntries[qualifiedName] ?? null;
	}),
	listIndexedRepos: vi.fn(() => Object.values(indexEntries)),
	removeFromIndex: vi.fn((qualifiedName: string) => {
		delete indexEntries[qualifiedName];
	}),
	updateIndex: vi.fn((entry: RepoIndexEntry) => {
		indexEntries[entry.qualifiedName] = entry;
	}),
}));

// Import after mocking
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

// ============================================================================
// Test fixtures
// ============================================================================

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
	localPath: join(mockRepoRoot, "github", "tanstack/router"),
	commitSha: "abc123",
	hasSkill: false,
};

// ============================================================================
// Setup and teardown
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
	clearVirtualFs();
	resetGitMock();
	// Clear index entries
	for (const key of Object.keys(indexEntries)) {
		delete indexEntries[key];
	}
});

afterEach(() => {
	vi.clearAllMocks();
	clearVirtualFs();
	resetGitMock();
});

// ============================================================================
// cloneRepo tests
// ============================================================================

describe("cloneRepo", () => {
	it("calls git clone with correct URL", async () => {
		const { execSync } = await import("node:child_process");

		await cloneRepo(mockSource);

		expect(execSync).toHaveBeenCalledWith(expect.stringContaining("git clone"), expect.any(Object));
		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("https://github.com/tanstack/router.git"),
			expect.any(Object),
		);
	});

	it("uses --depth 1 when shallow=true", async () => {
		const { execSync } = await import("node:child_process");

		await cloneRepo(mockSource, { shallow: true });

		expect(execSync).toHaveBeenCalledWith(expect.stringContaining("--depth 1"), expect.any(Object));
	});

	it("uses --branch flag when branch specified", async () => {
		const { execSync } = await import("node:child_process");

		await cloneRepo(mockSource, { branch: "develop" });

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("--branch develop"),
			expect.any(Object),
		);
	});

	it("throws RepoExistsError if path exists", async () => {
		const repoPath = join(mockRepoRoot, "github", "tanstack/router");
		addVirtualPath(repoPath, true);

		await expect(cloneRepo(mockSource)).rejects.toThrow(RepoExistsError);
	});

	it("creates parent directories if missing", async () => {
		const { mkdir } = await import("node:fs/promises");

		await cloneRepo(mockSource);

		expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
	});

	it("updates index after successful clone", async () => {
		const { updateIndex } = await import("../index-manager.js");

		await cloneRepo(mockSource);

		expect(updateIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				fullName: "tanstack/router",
				qualifiedName: "github:tanstack/router",
			}),
		);
	});

	it("removes existing and clones when force=true", async () => {
		const repoPath = join(mockRepoRoot, "github", "tanstack/router");
		addVirtualPath(repoPath, true);
		const { rmSync } = await import("node:fs");
		const { execSync } = await import("node:child_process");

		await cloneRepo(mockSource, { force: true });

		expect(rmSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
		expect(execSync).toHaveBeenCalledWith(expect.stringContaining("git clone"), expect.any(Object));
	});

	describe("sparse checkout", () => {
		it("uses sparse checkout flags when sparse=true", async () => {
			const { execSync } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true });

			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining("--filter=blob:none"),
				expect.any(Object),
			);
			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining("--no-checkout"),
				expect.any(Object),
			);
			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining("--sparse"),
				expect.any(Object),
			);
		});

		it("sets sparse-checkout directories after clone", async () => {
			const { execSync } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true });

			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining("git sparse-checkout set"),
				expect.any(Object),
			);
		});

		it("runs checkout after setting sparse-checkout", async () => {
			const { execSync } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true });

			const calls = (execSync as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
			const sparseSetIdx = calls.findIndex((c: string) => c.includes("sparse-checkout set"));
			const checkoutIdx = calls.findIndex(
				(c: string) => c.includes("git checkout") && !c.includes("sparse-checkout"),
			);

			expect(sparseSetIdx).toBeGreaterThan(-1);
			expect(checkoutIdx).toBeGreaterThan(sparseSetIdx);
		});

		it("combines sparse with shallow clone", async () => {
			const { execSync } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true, shallow: true });

			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining("--depth 1"),
				expect.any(Object),
			);
			expect(execSync).toHaveBeenCalledWith(
				expect.stringContaining("--sparse"),
				expect.any(Object),
			);
		});
	});

	// New tests for git command failure scenarios
	describe("git command failure scenarios", () => {
		it("throws GitError with network error message", async () => {
			configureGitMock({
				clone: {
					shouldSucceed: false,
					errorMessage:
						"fatal: unable to access 'https://github.com/tanstack/router.git/': Could not resolve host: github.com",
				},
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);
			await expect(cloneRepo(mockSource)).rejects.toThrow(/Could not resolve host/);
		});

		it("throws GitError with auth failure message", async () => {
			configureGitMock({
				clone: {
					shouldSucceed: false,
					errorMessage:
						"fatal: Authentication failed for 'https://github.com/tanstack/router.git/'",
				},
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);
			await expect(cloneRepo(mockSource)).rejects.toThrow(/Authentication failed/);
		});

		it("throws GitError when repository not found", async () => {
			configureGitMock({
				clone: {
					shouldSucceed: false,
					errorMessage: "fatal: repository 'https://github.com/tanstack/router.git/' not found",
				},
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);
			await expect(cloneRepo(mockSource)).rejects.toThrow(/repository.*not found/);
		});
	});

	// Tests for partial clone failures and cleanup behavior
	describe("partial clone failures and cleanup", () => {
		it("does not leave partial state in index on clone failure", async () => {
			configureGitMock({
				clone: { shouldSucceed: false, errorMessage: "Clone interrupted" },
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);

			// Index should not be updated on failure
			expect(indexEntries[mockSource.qualifiedName]).toBeUndefined();
		});

		it("index contains correct commit SHA after successful clone", async () => {
			configureGitMock({
				revParse: { sha: "newsha789xyz", shouldSucceed: true },
			});

			await cloneRepo(mockSource);

			expect(indexEntries[mockSource.qualifiedName]).toBeDefined();
			expect(indexEntries[mockSource.qualifiedName]?.commitSha).toBe("newsha789xyz");
		});
	});
});

// ============================================================================
// updateRepo tests
// ============================================================================

describe("updateRepo", () => {
	beforeEach(() => {
		// Setup: add repo to index and filesystem
		indexEntries[mockIndexEntry.qualifiedName] = { ...mockIndexEntry };
		addVirtualPath(mockIndexEntry.localPath, true);
	});

	it("calls git fetch then git pull", async () => {
		const { execSync } = await import("node:child_process");

		await updateRepo("github:tanstack/router");

		const calls = (execSync as ReturnType<typeof vi.fn>).mock.calls;
		const fetchCall = calls.find((call) => (call[0] as string).includes("git fetch"));
		const pullCall = calls.find((call) => (call[0] as string).includes("git pull"));

		expect(fetchCall).toBeDefined();
		expect(pullCall).toBeDefined();
	});

	it("throws RepoNotFoundError if not in index", async () => {
		await expect(updateRepo("github:unknown/repo")).rejects.toThrow(RepoNotFoundError);
	});

	it("throws RepoNotFoundError if path doesn't exist on disk", async () => {
		clearVirtualFs(); // Remove repo from disk but keep in index

		await expect(updateRepo("github:tanstack/router")).rejects.toThrow(RepoNotFoundError);
	});

	it("returns UpdateResult with commit SHAs", async () => {
		configureGitMock({
			revParse: { shas: ["oldsha123", "newsha456"], shouldSucceed: true },
		});

		const result = await updateRepo("github:tanstack/router");

		expect(result).toHaveProperty("previousSha", "oldsha123");
		expect(result).toHaveProperty("currentSha", "newsha456");
		expect(result).toHaveProperty("updated", true);
	});

	it("returns updated=false when SHAs match", async () => {
		configureGitMock({
			revParse: { shas: ["sameSha", "sameSha"], shouldSucceed: true },
		});

		const result = await updateRepo("github:tanstack/router");

		expect(result.updated).toBe(false);
		expect(result.previousSha).toBe("sameSha");
		expect(result.currentSha).toBe("sameSha");
	});

	it("updates index with new commit SHA", async () => {
		const { updateIndex } = await import("../index-manager.js");
		configureGitMock({
			revParse: { shas: ["old", "newCommitSha"], shouldSucceed: true },
		});

		await updateRepo("github:tanstack/router");

		expect(updateIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				commitSha: "newCommitSha",
			}),
		);
	});

	// Git command failure scenarios for update
	describe("git command failure scenarios", () => {
		it("throws GitError when fetch fails with network error", async () => {
			configureGitMock({
				fetch: {
					shouldSucceed: false,
					errorMessage: "fatal: unable to access: Connection timed out",
				},
			});

			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(GitError);
			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(/Connection timed out/);
		});

		it("throws GitError when pull fails with merge conflict", async () => {
			configureGitMock({
				pull: {
					shouldSucceed: false,
					errorMessage: "error: Your local changes would be overwritten by merge",
				},
			});

			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(GitError);
			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(/local changes/);
		});

		it("throws GitError when fetch fails with auth error", async () => {
			configureGitMock({
				fetch: {
					shouldSucceed: false,
					errorMessage: "fatal: Authentication failed",
				},
			});

			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(GitError);
			await expect(updateRepo("github:tanstack/router")).rejects.toThrow(/Authentication failed/);
		});
	});
});

// ============================================================================
// removeRepo tests
// ============================================================================

describe("removeRepo", () => {
	beforeEach(() => {
		indexEntries[mockIndexEntry.qualifiedName] = { ...mockIndexEntry };
		addVirtualPath(mockIndexEntry.localPath, true);
		const analysisPath = join(mockMetaRoot, "skills", "tanstack-router-reference");
		addVirtualPath(analysisPath, true);
	});

	it("removes repo directory", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github:tanstack/router");

		expect(rmSync).toHaveBeenCalledWith(mockIndexEntry.localPath, {
			recursive: true,
			force: true,
		});
	});

	it("removes analysis directory", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github:tanstack/router");

		expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("skills"), {
			recursive: true,
			force: true,
		});
	});

	it("updates index after removal", async () => {
		const { removeFromIndex } = await import("../index-manager.js");

		await removeRepo("github:tanstack/router");

		expect(removeFromIndex).toHaveBeenCalledWith("github:tanstack/router");
	});

	it("returns false if not in index", async () => {
		const result = await removeRepo("github:unknown/repo");

		expect(result).toBe(false);
	});

	it("returns true after successful removal", async () => {
		const result = await removeRepo("github:tanstack/router");

		expect(result).toBe(true);
	});
});

// ============================================================================
// listRepos tests
// ============================================================================

describe("listRepos", () => {
	it("returns repos from index", () => {
		indexEntries[mockIndexEntry.qualifiedName] = mockIndexEntry;

		const result = listRepos();

		expect(result).toEqual([mockIndexEntry]);
	});

	it("returns empty array when no repos indexed", () => {
		const result = listRepos();

		expect(result).toEqual([]);
	});
});

// ============================================================================
// isRepoCloned tests
// ============================================================================

describe("isRepoCloned", () => {
	it("returns true if in index and exists on disk", () => {
		indexEntries[mockIndexEntry.qualifiedName] = mockIndexEntry;
		addVirtualPath(mockIndexEntry.localPath, true);

		expect(isRepoCloned("github:tanstack/router")).toBe(true);
	});

	it("returns false if not in index", () => {
		expect(isRepoCloned("github:unknown/repo")).toBe(false);
	});

	it("returns false if in index but not on disk", () => {
		indexEntries[mockIndexEntry.qualifiedName] = mockIndexEntry;
		// Don't add to virtualFs

		expect(isRepoCloned("github:tanstack/router")).toBe(false);
	});
});

// ============================================================================
// getClonedRepoPath tests
// ============================================================================

describe("getClonedRepoPath", () => {
	it("returns local path if exists", () => {
		indexEntries[mockIndexEntry.qualifiedName] = mockIndexEntry;
		addVirtualPath(mockIndexEntry.localPath, true);

		const result = getClonedRepoPath("github:tanstack/router");

		expect(result).toBe(mockIndexEntry.localPath);
	});

	it("returns undefined if not in index", () => {
		expect(getClonedRepoPath("github:unknown/repo")).toBeUndefined();
	});

	it("returns undefined if not on disk", () => {
		indexEntries[mockIndexEntry.qualifiedName] = mockIndexEntry;

		expect(getClonedRepoPath("github:tanstack/router")).toBeUndefined();
	});
});

// ============================================================================
// getCommitSha tests
// ============================================================================

describe("getCommitSha", () => {
	it("returns commit SHA from git rev-parse", async () => {
		const { execSync } = await import("node:child_process");
		configureGitMock({
			revParse: { sha: "sha123456", shouldSucceed: true },
		});

		const result = getCommitSha("/some/repo");

		expect(execSync).toHaveBeenCalledWith(
			expect.stringContaining("git rev-parse HEAD"),
			expect.objectContaining({ cwd: "/some/repo" }),
		);
		expect(result).toBe("sha123456");
	});

	it("throws GitError when not a git repository", async () => {
		configureGitMock({
			revParse: {
				shouldSucceed: false,
				errorMessage: "fatal: not a git repository (or any of the parent directories): .git",
			},
		});

		expect(() => getCommitSha("/not/a/repo")).toThrow(GitError);
		expect(() => getCommitSha("/not/a/repo")).toThrow(/not a git repository/);
	});
});

// ============================================================================
// Error handling tests
// ============================================================================

describe("error handling", () => {
	it("throws GitError when clone fails", async () => {
		configureGitMock({
			clone: {
				shouldSucceed: false,
				errorMessage: "fatal: repository not found",
			},
		});

		await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);
	});

	it("GitError includes command that failed", async () => {
		configureGitMock({
			clone: {
				shouldSucceed: false,
				errorMessage: "fatal: repository not found",
			},
		});

		try {
			await cloneRepo(mockSource);
			expect.fail("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(GitError);
			expect((error as GitError).command).toContain("git clone");
		}
	});

	it("GitError includes exit code", async () => {
		configureGitMock({
			clone: {
				shouldSucceed: false,
				errorMessage: "fatal: repository not found",
			},
		});

		try {
			await cloneRepo(mockSource);
			expect.fail("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(GitError);
			expect((error as GitError).exitCode).toBe(128);
		}
	});
});
