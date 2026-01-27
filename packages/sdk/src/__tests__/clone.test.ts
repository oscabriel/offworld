/**
 * Unit tests for clone.ts git operations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GlobalMapRepoEntry, RemoteRepoSource } from "@offworld/types";

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
	readdirSync: vi.fn((path: string) => {
		const normalized = normalizePath(path);
		const entries: string[] = [];
		for (const key of Object.keys(virtualFs)) {
			if (key.startsWith(normalized + "/")) {
				const relative = key.slice(normalized.length + 1);
				const firstSegment = relative.split("/")[0];
				if (firstSegment && !entries.includes(firstSegment)) {
					entries.push(firstSegment);
				}
			}
		}
		return entries;
	}),
	rmSync: vi.fn((path: string, _options?: { recursive?: boolean; force?: boolean }) => {
		const normalized = normalizePath(path);
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

function createMockSpawn(gitCommand: string, args: string[]) {
	// biome-ignore lint/suspicious/noExplicitAny: test mock
	const listeners: Record<string, ((...args: any[]) => void)[]> = {};
	const stdout = {
		on: (event: string, cb: (data: Buffer) => void) => {
			if (!listeners[`stdout:${event}`]) listeners[`stdout:${event}`] = [];
			listeners[`stdout:${event}`]!.push(cb);
		},
	};
	const stderr = {
		on: (event: string, cb: (data: Buffer) => void) => {
			if (!listeners[`stderr:${event}`]) listeners[`stderr:${event}`] = [];
			listeners[`stderr:${event}`]!.push(cb);
		},
	};

	const proc = {
		stdout,
		stderr,
		on: (event: string, cb: (...args: unknown[]) => void) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(cb);

			if (event === "close") {
				setImmediate(() => {
					let shouldSucceed = true;
					let errorMessage = "";

					switch (gitCommand) {
						case "clone": {
							const config = gitConfig.clone ?? defaultGitConfig.clone;
							shouldSucceed = config?.shouldSucceed ?? true;
							errorMessage = config?.errorMessage ?? "fatal: repository not found";
							const destPath = args[args.length - 1];
							if (destPath) {
								const normalized = normalizePath(destPath);
								const parentDir = normalized.substring(0, normalized.lastIndexOf("/"));
								virtualFs[parentDir] = { content: "", isDirectory: true };
								if (shouldSucceed) {
									virtualFs[normalized] = { content: "", isDirectory: true };
									virtualFs[join(normalized, ".git").replace(/\\/g, "/")] = {
										content: "",
										isDirectory: true,
									};
								}
							}
							break;
						}
						case "fetch": {
							const config = gitConfig.fetch ?? defaultGitConfig.fetch;
							shouldSucceed = config?.shouldSucceed ?? true;
							errorMessage = config?.errorMessage ?? "fatal: unable to access";
							break;
						}
						case "pull": {
							const config = gitConfig.pull ?? defaultGitConfig.pull;
							shouldSucceed = config?.shouldSucceed ?? true;
							errorMessage = config?.errorMessage ?? "error: pull failed";
							break;
						}
						case "sparse-checkout":
						case "checkout":
							shouldSucceed = true;
							break;
					}

					if (!shouldSucceed) {
						for (const listener of listeners["stderr:data"] ?? []) {
							listener(Buffer.from(errorMessage));
						}
					}

					for (const listener of listeners["close"] ?? []) {
						listener(shouldSucceed ? 0 : 128);
					}
				});
			}
		},
	};

	return proc;
}

vi.mock("node:child_process", () => ({
	spawn: vi.fn((command: string, args: string[], _options?: { cwd?: string }) => {
		if (command !== "git") {
			throw new Error(`Expected git command, got: ${command}`);
		}
		return createMockSpawn(args[0] ?? "", args.slice(1));
	}),
	execFileSync: vi.fn((command: string, args: string[], options?: { cwd?: string }) => {
		if (command !== "git") {
			throw new Error(`Expected git command, got: ${command}`);
		}

		const gitCommand = args[0];
		const cwd = options?.cwd;

		switch (gitCommand) {
			case "clone": {
				const config = gitConfig.clone ?? defaultGitConfig.clone;
				const destPath = args[args.length - 1];
				if (!config?.shouldSucceed) {
					if (destPath) {
						const normalized = normalizePath(destPath);
						const parentDir = normalized.substring(0, normalized.lastIndexOf("/"));
						virtualFs[parentDir] = { content: "", isDirectory: true };
					}
					const error = new Error(config?.errorMessage ?? "Clone failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 128;
					error.stderr = config?.errorMessage ?? "fatal: repository not found";
					throw error;
				}
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

const mockMetaRoot = vi.hoisted(() => "/mock/offworld");
const mockRepoRoot = vi.hoisted(() => "/mock/ow");
const mockReferencesRoot = vi.hoisted(() => "/mock/references");

vi.mock("../paths.js", () => ({
	Paths: {
		offworldReferencesDir: mockReferencesRoot,
		metaDir: "/mock/offworld/meta",
	},
}));

vi.mock("../config.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config.js")>();
	return {
		...actual,
		loadConfig: vi.fn(() => ({
			repoRoot: "~/ow",
			defaultShallow: true,
			agents: [],
		})),
		getRepoPath: vi.fn((fullName: string, provider: string) => {
			return join(mockRepoRoot, provider, fullName);
		}),
		getReferencePath: vi.fn((fullName: string) => {
			return join(
				mockMetaRoot,
				"skill",
				"offworld",
				"references",
				actual.toReferenceFileName(fullName),
			);
		}),
		getMetaPath: vi.fn((fullName: string) => {
			return join(mockMetaRoot, "meta", actual.toMetaDirName(fullName));
		}),
	};
});

// Map state
const mapEntries: Record<string, GlobalMapRepoEntry> = {};

vi.mock("../index-manager.js", () => ({
	readGlobalMap: vi.fn(() => ({ repos: { ...mapEntries } })),
	upsertGlobalMapEntry: vi.fn((qualifiedName: string, entry: GlobalMapRepoEntry) => {
		mapEntries[qualifiedName] = entry;
	}),
	removeGlobalMapEntry: vi.fn((qualifiedName: string) => {
		if (!(qualifiedName in mapEntries)) {
			return false;
		}
		delete mapEntries[qualifiedName];
		return true;
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
	qualifiedName: "github.com:tanstack/router",
	cloneUrl: "https://github.com/tanstack/router.git",
};

const mockMapEntry: GlobalMapRepoEntry = {
	localPath: join(mockRepoRoot, "github", "tanstack/router"),
	references: ["tanstack-router.md"],
	primary: "tanstack-router.md",
	keywords: [],
	updatedAt: "2026-01-25T00:00:00Z",
};

// ============================================================================
// Setup and teardown
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
	clearVirtualFs();
	resetGitMock();
	// Clear map entries
	for (const key of Object.keys(mapEntries)) {
		delete mapEntries[key];
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
		const { spawn } = await import("node:child_process");

		await cloneRepo(mockSource);

		expect(spawn).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining(["clone", "https://github.com/tanstack/router.git"]),
			expect.any(Object),
		);
	});

	it("uses --depth 1 when shallow=true", async () => {
		const { spawn } = await import("node:child_process");

		await cloneRepo(mockSource, { shallow: true });

		expect(spawn).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining(["--depth", "1"]),
			expect.any(Object),
		);
	});

	it("uses --branch flag when branch specified", async () => {
		const { spawn } = await import("node:child_process");

		await cloneRepo(mockSource, { branch: "develop" });

		expect(spawn).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining(["--branch", "develop"]),
			expect.any(Object),
		);
	});

	it("throws RepoExistsError if path exists", async () => {
		const repoPath = join(mockRepoRoot, "github", "tanstack/router");
		addVirtualPath(repoPath, true);

		await expect(cloneRepo(mockSource)).rejects.toThrow(RepoExistsError);
	});

	it("updates map after successful clone when reference exists", async () => {
		const { upsertGlobalMapEntry } = await import("../index-manager.js");
		const { toReferenceFileName } = await import("../config.js");
		const referenceFileName = toReferenceFileName(mockSource.fullName);
		addVirtualPath(join(mockReferencesRoot, referenceFileName));

		await cloneRepo(mockSource);

		expect(upsertGlobalMapEntry).toHaveBeenCalledWith(
			mockSource.qualifiedName,
			expect.objectContaining({
				localPath: mockMapEntry.localPath,
				references: [referenceFileName],
				primary: referenceFileName,
			}),
		);
	});

	it("removes existing and clones when force=true", async () => {
		const repoPath = join(mockRepoRoot, "github", "tanstack/router");
		addVirtualPath(repoPath, true);
		const { rmSync } = await import("node:fs");
		const { spawn } = await import("node:child_process");

		await cloneRepo(mockSource, { force: true });

		expect(rmSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
		expect(spawn).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining(["clone"]),
			expect.any(Object),
		);
	});

	describe("sparse checkout", () => {
		it("uses sparse checkout flags when sparse=true", async () => {
			const { spawn } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true });

			expect(spawn).toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["--filter=blob:none"]),
				expect.any(Object),
			);
			expect(spawn).toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["--no-checkout"]),
				expect.any(Object),
			);
			expect(spawn).toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["--sparse"]),
				expect.any(Object),
			);
		});

		it("sets sparse-checkout directories after clone", async () => {
			const { spawn } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true });

			expect(spawn).toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["sparse-checkout", "set"]),
				expect.any(Object),
			);
		});

		it("runs checkout after setting sparse-checkout", async () => {
			const { spawn } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true });

			const calls = (spawn as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1] as string[]);
			const sparseSetIdx = calls.findIndex(
				(args) => args.includes("sparse-checkout") && args.includes("set"),
			);
			const checkoutIdx = calls.findIndex(
				(args) => args.includes("checkout") && !args.includes("sparse-checkout"),
			);

			expect(sparseSetIdx).toBeGreaterThan(-1);
			expect(checkoutIdx).toBeGreaterThan(sparseSetIdx);
		});

		it("combines sparse with shallow clone", async () => {
			const { spawn } = await import("node:child_process");

			await cloneRepo(mockSource, { sparse: true, shallow: true });

			expect(spawn).toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["--depth", "1"]),
				expect.any(Object),
			);
			expect(spawn).toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["--sparse"]),
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

	describe("partial clone failures and cleanup", () => {
		it("does not leave partial state in index on clone failure", async () => {
			configureGitMock({
				clone: { shouldSucceed: false, errorMessage: "Clone interrupted" },
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);

			expect(mapEntries[mockSource.fullName]).toBeUndefined();
		});

		it("cleans up empty owner directory on clone failure", async () => {
			const { rmSync } = await import("node:fs");

			configureGitMock({
				clone: { shouldSucceed: false, errorMessage: "fatal: repository not found" },
			});

			await expect(cloneRepo(mockSource)).rejects.toThrow(GitError);

			const ownerDir = join(mockRepoRoot, "github", "tanstack");
			expect(rmSync).toHaveBeenCalledWith(ownerDir, { recursive: true, force: true });
		});

		it("creates map entry when reference exists", async () => {
			const { toReferenceFileName } = await import("../config.js");
			configureGitMock({
				revParse: { sha: "newsha789xyz", shouldSucceed: true },
			});
			const referenceFileName = toReferenceFileName(mockSource.fullName);
			addVirtualPath(join(mockReferencesRoot, referenceFileName));

			await cloneRepo(mockSource);

			expect(mapEntries[mockSource.qualifiedName]).toBeDefined();
			expect(mapEntries[mockSource.qualifiedName]?.references).toEqual([referenceFileName]);
		});
	});
});

// ============================================================================
// updateRepo tests
// ============================================================================

describe("updateRepo", () => {
	beforeEach(() => {
		// Setup: add repo to clone map and filesystem
		mapEntries[mockSource.qualifiedName] = { ...mockMapEntry };
		addVirtualPath(mockMapEntry.localPath, true);
	});

	it("calls git fetch then git pull", async () => {
		const { spawn } = await import("node:child_process");

		await updateRepo("github.com:tanstack/router");

		const calls = (spawn as ReturnType<typeof vi.fn>).mock.calls;
		const fetchCall = calls.find((call) => (call[1] as string[]).includes("fetch"));
		const pullCall = calls.find((call) => (call[1] as string[]).includes("pull"));

		expect(fetchCall).toBeDefined();
		expect(pullCall).toBeDefined();
	});

	it("throws RepoNotFoundError if not in index", async () => {
		await expect(updateRepo("github.com:unknown/repo")).rejects.toThrow(RepoNotFoundError);
	});

	it("throws RepoNotFoundError if path doesn't exist on disk", async () => {
		clearVirtualFs(); // Remove repo from disk but keep in index

		await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(RepoNotFoundError);
	});

	it("returns UpdateResult with commit SHAs", async () => {
		configureGitMock({
			revParse: { shas: ["oldsha123", "newsha456"], shouldSucceed: true },
		});

		const result = await updateRepo("github.com:tanstack/router");

		expect(result).toHaveProperty("previousSha", "oldsha123");
		expect(result).toHaveProperty("currentSha", "newsha456");
		expect(result).toHaveProperty("updated", true);
	});

	it("returns updated=false when SHAs match", async () => {
		configureGitMock({
			revParse: { shas: ["sameSha", "sameSha"], shouldSucceed: true },
		});

		const result = await updateRepo("github.com:tanstack/router");

		expect(result.updated).toBe(false);
		expect(result.previousSha).toBe("sameSha");
		expect(result.currentSha).toBe("sameSha");
	});

	it("updates map entry timestamp", async () => {
		const { upsertGlobalMapEntry } = await import("../index-manager.js");
		configureGitMock({
			revParse: { shas: ["old", "newCommitSha"], shouldSucceed: true },
		});

		await updateRepo("github.com:tanstack/router");

		expect(upsertGlobalMapEntry).toHaveBeenCalledWith(
			"github.com:tanstack/router",
			expect.objectContaining({
				localPath: mockMapEntry.localPath,
				updatedAt: expect.any(String),
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

			await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(GitError);
			await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(
				/Connection timed out/,
			);
		});

		it("throws GitError when pull fails with merge conflict", async () => {
			configureGitMock({
				pull: {
					shouldSucceed: false,
					errorMessage: "error: Your local changes would be overwritten by merge",
				},
			});

			await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(GitError);
			await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(/local changes/);
		});

		it("throws GitError when fetch fails with auth error", async () => {
			configureGitMock({
				fetch: {
					shouldSucceed: false,
					errorMessage: "fatal: Authentication failed",
				},
			});

			await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(GitError);
			await expect(updateRepo("github.com:tanstack/router")).rejects.toThrow(
				/Authentication failed/,
			);
		});
	});
});

// ============================================================================
// removeRepo tests
// ============================================================================

describe("removeRepo", () => {
	beforeEach(async () => {
		mapEntries[mockSource.qualifiedName] = { ...mockMapEntry };
		addVirtualPath(mockMapEntry.localPath, true);
		const { toReferenceFileName, getMetaPath } = await import("../config.js");
		const referenceFileName = toReferenceFileName(mockSource.fullName);
		addVirtualPath(join(mockReferencesRoot, referenceFileName));
		const metaPath = getMetaPath(mockSource.fullName);
		addVirtualPath(metaPath, true);
	});

	it("removes repo directory", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github.com:tanstack/router");

		expect(rmSync).toHaveBeenCalledWith(mockMapEntry.localPath, {
			recursive: true,
			force: true,
		});
	});

	it("removes reference file", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github.com:tanstack/router");

		expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("references"), {
			force: true,
		});
	});

	it("removes meta directory", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github.com:tanstack/router");

		expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("meta"), {
			recursive: true,
			force: true,
		});
	});

	it("updates map after removal", async () => {
		const { removeGlobalMapEntry } = await import("../index-manager.js");

		await removeRepo("github.com:tanstack/router");

		expect(removeGlobalMapEntry).toHaveBeenCalledWith("github.com:tanstack/router");
	});

	it("returns false if not in index", async () => {
		const result = await removeRepo("github.com:unknown/repo");

		expect(result).toBe(false);
	});

	it("returns true after successful removal", async () => {
		const result = await removeRepo("github.com:tanstack/router");

		expect(result).toBe(true);
	});

	it("with referenceOnly keeps repo directory", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github.com:tanstack/router", { referenceOnly: true });

		expect(rmSync).not.toHaveBeenCalledWith(mockMapEntry.localPath, expect.anything());
		expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("references"), {
			force: true,
		});
		expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("meta"), {
			recursive: true,
			force: true,
		});
	});

	it("with repoOnly keeps reference files", async () => {
		const { rmSync } = await import("node:fs");

		await removeRepo("github.com:tanstack/router", { repoOnly: true });

		expect(rmSync).toHaveBeenCalledWith(mockMapEntry.localPath, {
			recursive: true,
			force: true,
		});
		expect(rmSync).not.toHaveBeenCalledWith(
			expect.stringContaining("references"),
			expect.anything(),
		);
		expect(rmSync).not.toHaveBeenCalledWith(expect.stringContaining("meta"), expect.anything());
	});

	it("with referenceOnly clears references in map", async () => {
		const { upsertGlobalMapEntry } = await import("../index-manager.js");

		await removeRepo("github.com:tanstack/router", { referenceOnly: true });

		expect(upsertGlobalMapEntry).toHaveBeenCalledWith(
			"github.com:tanstack/router",
			expect.objectContaining({ references: [], primary: "" }),
		);
	});
});

// ============================================================================
// listRepos tests
// ============================================================================

describe("listRepos", () => {
	it("returns repos from index", () => {
		mapEntries[mockSource.qualifiedName] = mockMapEntry;

		const result = listRepos();

		expect(result).toEqual(["github.com:tanstack/router"]);
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
		mapEntries[mockSource.qualifiedName] = mockMapEntry;
		addVirtualPath(mockMapEntry.localPath, true);

		expect(isRepoCloned("github.com:tanstack/router")).toBe(true);
	});

	it("returns false if not in index", () => {
		expect(isRepoCloned("github.com:unknown/repo")).toBe(false);
	});

	it("returns false if in index but not on disk", () => {
		mapEntries[mockSource.qualifiedName] = mockMapEntry;
		// Don't add to virtualFs

		expect(isRepoCloned("github.com:tanstack/router")).toBe(false);
	});
});

// ============================================================================
// getClonedRepoPath tests
// ============================================================================

describe("getClonedRepoPath", () => {
	it("returns local path if exists", () => {
		mapEntries[mockSource.qualifiedName] = mockMapEntry;
		addVirtualPath(mockMapEntry.localPath, true);

		const result = getClonedRepoPath("github.com:tanstack/router");

		expect(result).toBe(mockMapEntry.localPath);
	});

	it("returns undefined if not in index", () => {
		expect(getClonedRepoPath("github.com:unknown/repo")).toBeUndefined();
	});

	it("returns undefined if not on disk", () => {
		mapEntries[mockSource.qualifiedName] = mockMapEntry;

		expect(getClonedRepoPath("github.com:tanstack/router")).toBeUndefined();
	});
});

// ============================================================================
// getCommitSha tests
// ============================================================================

describe("getCommitSha", () => {
	it("returns commit SHA from git rev-parse", async () => {
		const { execFileSync } = await import("node:child_process");
		configureGitMock({
			revParse: { sha: "sha123456", shouldSucceed: true },
		});

		const result = getCommitSha("/some/repo");

		expect(execFileSync).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining(["rev-parse", "HEAD"]),
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
