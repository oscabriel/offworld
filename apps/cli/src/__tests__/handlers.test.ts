/**
 * Unit tests for CLI command handlers
 * PRD T4.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
	spinner: vi.fn(() => ({
		start: vi.fn(),
		stop: vi.fn(),
		message: vi.fn(),
	})),
	log: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
	},
	confirm: vi.fn(),
	isCancel: vi.fn(() => false),
}));

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
	readFileSync: vi.fn(),
	rmSync: vi.fn(),
}));

// Mock @offworld/sdk
vi.mock("@offworld/sdk", () => ({
	parseRepoInput: vi.fn(),
	cloneRepo: vi.fn(),
	updateRepo: vi.fn(),
	removeRepo: vi.fn(),
	isRepoCloned: vi.fn(),
	getClonedRepoPath: vi.fn(),
	getCommitSha: vi.fn(),
	loadConfig: vi.fn(),
	getAnalysisPath: vi.fn(),
	getMetaRoot: vi.fn(),
	updateIndex: vi.fn(),
	getIndexEntry: vi.fn(),
	listRepos: vi.fn(),
	pullAnalysis: vi.fn(),
	checkRemote: vi.fn(),
	checkStaleness: vi.fn(),
	runAnalysisPipeline: vi.fn(),
	RepoExistsError: class RepoExistsError extends Error {},
}));

import * as p from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import {
	parseRepoInput,
	cloneRepo,
	updateRepo,
	removeRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	loadConfig,
	getAnalysisPath,
	getMetaRoot,
	updateIndex,
	getIndexEntry,
	listRepos,
	pullAnalysis,
	checkRemote,
	runAnalysisPipeline,
} from "@offworld/sdk";
import type { RemoteRepoSource, LocalRepoSource, Config, RepoIndexEntry } from "@offworld/types";

// Import handlers after mocks
import { pullHandler } from "../handlers/pull.js";
import { generateHandler } from "../handlers/generate.js";
import { listHandler } from "../handlers/list.js";
import { rmHandler } from "../handlers/rm.js";

describe("CLI handlers", () => {
	const mockParseRepoInput = parseRepoInput as ReturnType<typeof vi.fn>;
	const mockCloneRepo = cloneRepo as ReturnType<typeof vi.fn>;
	const mockUpdateRepo = updateRepo as ReturnType<typeof vi.fn>;
	const mockRemoveRepo = removeRepo as ReturnType<typeof vi.fn>;
	const mockIsRepoCloned = isRepoCloned as ReturnType<typeof vi.fn>;
	const mockGetClonedRepoPath = getClonedRepoPath as ReturnType<typeof vi.fn>;
	const mockGetCommitSha = getCommitSha as ReturnType<typeof vi.fn>;
	const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;
	const mockGetAnalysisPath = getAnalysisPath as ReturnType<typeof vi.fn>;
	const mockGetMetaRoot = getMetaRoot as ReturnType<typeof vi.fn>;
	const mockUpdateIndex = updateIndex as ReturnType<typeof vi.fn>;
	const mockGetIndexEntry = getIndexEntry as ReturnType<typeof vi.fn>;
	const mockListRepos = listRepos as ReturnType<typeof vi.fn>;
	const mockPullAnalysis = pullAnalysis as ReturnType<typeof vi.fn>;
	const mockCheckRemote = checkRemote as ReturnType<typeof vi.fn>;
	const mockRunAnalysisPipeline = runAnalysisPipeline as ReturnType<typeof vi.fn>;
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
	const mockConfirm = p.confirm as ReturnType<typeof vi.fn>;

	const defaultConfig: Config = {
		repoRoot: "~/ow",
		metaRoot: "~/.ow",
		skillDir: "~/.config/opencode/skill",
		defaultShallow: true,
		autoAnalyze: true,
	};

	const mockGitHubSource: RemoteRepoSource = {
		type: "remote",
		provider: "github",
		owner: "tanstack",
		repo: "router",
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		cloneUrl: "https://github.com/tanstack/router.git",
	};

	const mockLocalSource: LocalRepoSource = {
		type: "local",
		path: "/home/user/projects/myrepo",
		name: "myrepo",
		qualifiedName: "local:abc123def456",
	};

	const mockRemoteAnalysis = {
		fullName: "tanstack/router",
		summary: "# TanStack Router\n...",
		architecture: {
			projectType: "library" as const,
			entities: [],
			relationships: [],
			keyFiles: [],
			patterns: {},
		},
		skill: {
			name: "tanstack-router",
			description: "TanStack Router expert",
			allowedTools: ["Read", "Glob", "Grep"],
			repositoryStructure: [{ path: "src", purpose: "Source code" }],
			keyFiles: [{ path: "src/index.ts", description: "Main entry" }],
			searchStrategies: ["Use Glob for file patterns"],
			whenToUse: ["When working with TanStack Router"],
		},
		fileIndex: [],
		commitSha: "abc123",
		analyzedAt: "2026-01-09T12:00:00Z",
		pullCount: 10,
	};

	const mockIndexEntry: RepoIndexEntry = {
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		localPath: "/home/user/ow/github/tanstack/router",
		analyzedAt: "2026-01-09T12:00:00Z",
		commitSha: "abc123",
		hasSkill: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadConfig.mockReturnValue(defaultConfig);
		mockGetMetaRoot.mockReturnValue("/home/user/.ow");
		mockExistsSync.mockReturnValue(false);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// pullHandler tests
	// =========================================================================
	describe("pullHandler", () => {
		it("calls cloneRepo for new repos", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(false);
			mockCloneRepo.mockResolvedValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockPullAnalysis.mockResolvedValue(mockRemoteAnalysis);
			mockGetAnalysisPath.mockReturnValue("/home/user/.ow/analyses/github--tanstack--router");

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockCloneRepo).toHaveBeenCalledWith(
				mockGitHubSource,
				expect.objectContaining({ shallow: true })
			);
			expect(result.success).toBe(true);
		});

		it("calls updateRepo for existing repos", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockUpdateRepo.mockResolvedValue({
				updated: true,
				previousSha: "abc123",
				currentSha: "def456",
			});
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockPullAnalysis.mockResolvedValue(mockRemoteAnalysis);
			mockGetAnalysisPath.mockReturnValue("/home/user/.ow/analyses/github--tanstack--router");

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockUpdateRepo).toHaveBeenCalledWith("github:tanstack/router");
			expect(mockCloneRepo).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
		});

		it("tries remote analysis before local generation", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(false);
			mockCloneRepo.mockResolvedValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockPullAnalysis.mockResolvedValue(mockRemoteAnalysis);
			mockGetAnalysisPath.mockReturnValue("/home/user/.ow/analyses/github--tanstack--router");

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockPullAnalysis).toHaveBeenCalledWith("tanstack/router");
			expect(mockRunAnalysisPipeline).not.toHaveBeenCalled();
			expect(result.analysisSource).toBe("remote");
		});

		it("falls back to local generation on remote failure", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(false);
			mockCloneRepo.mockResolvedValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockPullAnalysis.mockResolvedValue(null); // No remote analysis
			mockGetAnalysisPath.mockReturnValue("/home/user/.ow/analyses/github--tanstack--router");
			mockRunAnalysisPipeline.mockResolvedValue({
				analysisPath: "/home/user/.ow/analyses/github--tanstack--router",
				meta: { analyzedAt: "2026-01-09T12:00:00Z", commitSha: "abc123" },
			});
			mockGetCommitSha.mockReturnValue("abc123");

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockPullAnalysis).toHaveBeenCalled();
			expect(mockRunAnalysisPipeline).toHaveBeenCalled();
			expect(result.analysisSource).toBe("local");
		});

		it("uses cached analysis when available", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockUpdateRepo.mockResolvedValue({ updated: false, previousSha: "abc123", currentSha: "abc123" });
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockGetAnalysisPath.mockReturnValue("/home/user/.ow/analyses/github--tanstack--router");
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation((path: string) => {
				if (path.endsWith("meta.json")) {
					return JSON.stringify({ commitSha: "abc123" });
				}
				if (path.endsWith("skill.json")) {
					return JSON.stringify(mockRemoteAnalysis.skill);
				}
				return "";
			});
			mockGetCommitSha.mockReturnValue("abc123");

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(result.analysisSource).toBe("cached");
			expect(mockPullAnalysis).not.toHaveBeenCalled();
		});

		it("handles local repos without cloning", async () => {
			mockParseRepoInput.mockReturnValue(mockLocalSource);
			mockPullAnalysis.mockResolvedValue(null);
			mockRunAnalysisPipeline.mockResolvedValue({
				analysisPath: "/home/user/.ow/analyses/local--abc123def456",
				meta: { analyzedAt: "2026-01-09T12:00:00Z", commitSha: "xyz789" },
			});
			mockGetCommitSha.mockReturnValue("xyz789");

			const result = await pullHandler({ repo: "/home/user/projects/myrepo" });

			expect(mockCloneRepo).not.toHaveBeenCalled();
			expect(mockUpdateRepo).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
		});
	});

	// =========================================================================
	// generateHandler tests
	// =========================================================================
	describe("generateHandler", () => {
		it("warns if remote exists (mocked)", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockCheckRemote.mockResolvedValue({
				exists: true,
				commitSha: "abc123",
				analyzedAt: "2026-01-09T12:00:00Z",
			});

			const result = await generateHandler({ repo: "tanstack/router" });

			expect(mockCheckRemote).toHaveBeenCalledWith("tanstack/router");
			expect(result.success).toBe(false);
			expect(result.message).toContain("Remote analysis exists");
		});

		it("proceeds with --force flag", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockCheckRemote.mockResolvedValue({ exists: true, commitSha: "abc123" });
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockRunAnalysisPipeline.mockResolvedValue({
				analysisPath: "/home/user/.ow/analyses/github--tanstack--router",
				meta: { analyzedAt: "2026-01-09T12:00:00Z", commitSha: "def456" },
			});

			const result = await generateHandler({ repo: "tanstack/router", force: true });

			// Should not check remote when force=true
			expect(result.success).toBe(true);
			expect(mockRunAnalysisPipeline).toHaveBeenCalled();
		});

		it("calls full analysis pipeline", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockCheckRemote.mockResolvedValue({ exists: false });
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockRunAnalysisPipeline.mockResolvedValue({
				analysisPath: "/home/user/.ow/analyses/github--tanstack--router",
				meta: { analyzedAt: "2026-01-09T12:00:00Z", commitSha: "abc123", estimatedTokens: 5000 },
			});

			const result = await generateHandler({ repo: "tanstack/router" });

			expect(mockRunAnalysisPipeline).toHaveBeenCalledWith(
				"/home/user/ow/github/tanstack/router",
				expect.objectContaining({
					provider: "github",
					fullName: "tanstack/router",
				})
			);
			expect(result.success).toBe(true);
			expect(result.analysisPath).toBeDefined();
		});

		it("clones repo if not already cloned", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockCheckRemote.mockResolvedValue({ exists: false });
			mockIsRepoCloned.mockReturnValue(false);
			mockCloneRepo.mockResolvedValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockRunAnalysisPipeline.mockResolvedValue({
				analysisPath: "/home/user/.ow/analyses/github--tanstack--router",
				meta: { analyzedAt: "2026-01-09T12:00:00Z", commitSha: "abc123" },
			});

			const result = await generateHandler({ repo: "tanstack/router" });

			expect(mockCloneRepo).toHaveBeenCalled();
			expect(result.success).toBe(true);
		});
	});

	// =========================================================================
	// listHandler tests
	// =========================================================================
	describe("listHandler", () => {
		it("formats repo list correctly", async () => {
			mockListRepos.mockReturnValue([mockIndexEntry]);
			mockExistsSync.mockReturnValue(true);
			mockGetCommitSha.mockReturnValue("abc123");

			const result = await listHandler({});

			expect(result.repos).toHaveLength(1);
			expect(result.repos[0].fullName).toBe("tanstack/router");
			expect(result.repos[0].analyzed).toBe(true);
			expect(result.repos[0].hasSkill).toBe(true);
		});

		it("outputs JSON with --json flag", async () => {
			mockListRepos.mockReturnValue([mockIndexEntry]);
			mockExistsSync.mockReturnValue(true);
			mockGetCommitSha.mockReturnValue("abc123");

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await listHandler({ json: true });

			expect(result.repos).toHaveLength(1);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("filters stale repos with --stale flag", async () => {
			const staleEntry: RepoIndexEntry = {
				...mockIndexEntry,
				commitSha: "old123",
			};
			mockListRepos.mockReturnValue([staleEntry, mockIndexEntry]);
			mockExistsSync.mockReturnValue(true);
			mockGetCommitSha.mockImplementation((path: string) => {
				// First call returns different SHA (stale), second returns same (current)
				return path.includes("tanstack") ? "new456" : "abc123";
			});

			const result = await listHandler({ stale: true });

			// Should filter to only stale repos
			expect(result.repos.filter((r) => r.isStale === true)).toHaveLength(2);
		});

		it("shows paths with --paths flag", async () => {
			mockListRepos.mockReturnValue([mockIndexEntry]);
			mockExistsSync.mockReturnValue(true);
			mockGetCommitSha.mockReturnValue("abc123");

			const result = await listHandler({ paths: true });

			expect(result.repos[0].localPath).toBe(mockIndexEntry.localPath);
		});

		it("handles empty repo list", async () => {
			mockListRepos.mockReturnValue([]);

			const result = await listHandler({});

			expect(result.repos).toHaveLength(0);
		});
	});

	// =========================================================================
	// rmHandler tests
	// =========================================================================
	describe("rmHandler", () => {
		it("prompts for confirmation (mocked)", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);
			mockConfirm.mockResolvedValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router" });

			expect(mockConfirm).toHaveBeenCalled();
		});

		it("skips prompt with -y flag", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router", yes: true });

			expect(mockConfirm).not.toHaveBeenCalled();
			expect(mockRemoveRepo).toHaveBeenCalled();
		});

		it("shows dry run output without deleting", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);

			const result = await rmHandler({ repo: "tanstack/router", dryRun: true });

			expect(result.success).toBe(true);
			expect(mockRemoveRepo).not.toHaveBeenCalled();
		});

		it("calls removeRepo with keepSkill option", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router", yes: true, keepSkill: true });

			expect(mockRemoveRepo).toHaveBeenCalledWith("github:tanstack/router", { keepSkill: true });
		});

		it("returns error if repo not in index", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockGetIndexEntry.mockReturnValue(undefined);

			const result = await rmHandler({ repo: "nonexistent/repo" });

			expect(result.success).toBe(false);
			expect(result.message).toContain("not found");
		});

		it("aborts when user cancels confirmation", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockExistsSync.mockReturnValue(true);
			mockConfirm.mockResolvedValue(false);

			const result = await rmHandler({ repo: "tanstack/router" });

			expect(result.success).toBe(false);
			expect(result.message).toContain("Aborted");
			expect(mockRemoveRepo).not.toHaveBeenCalled();
		});
	});
});
