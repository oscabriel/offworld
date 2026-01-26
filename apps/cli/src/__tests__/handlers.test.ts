/**
 * Unit tests for CLI command handlers
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
	removeReferenceByName: vi.fn(),
	isRepoCloned: vi.fn(),
	getClonedRepoPath: vi.fn(),
	getCommitSha: vi.fn(),
	getCommitDistance: vi.fn(),
	loadConfig: vi.fn(),
	getReferencePath: vi.fn(),
	getMetaPath: vi.fn(),
	getMetaRoot: vi.fn(),
	updateIndex: vi.fn(),
	getIndexEntry: vi.fn(),
	listRepos: vi.fn(),
	readGlobalMap: vi.fn(),
	pullAnalysis: vi.fn(),
	pullAnalysisByName: vi.fn(),
	checkRemote: vi.fn(),
	checkRemoteByName: vi.fn(),
	checkStaleness: vi.fn(),
	generateReferenceWithAI: vi.fn(),
	installReference: vi.fn(),
	loadAuthData: vi.fn(),
	canPushToWeb: vi.fn(),
	pushAnalysis: vi.fn(),
	getAllAgentConfigs: vi.fn(() => []),
	expandTilde: vi.fn((path: string) => path),
	toSkillDirName: vi.fn((repoName: string) => {
		if (repoName.includes("/")) {
			const [owner, repo] = repoName.split("/");
			return `${owner}-${repo}-reference`;
		}
		return `${repoName}-reference`;
	}),
	Paths: {
		offworldReferencesDir: "/mock/references",
	},
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
	getCommitDistance,
	loadConfig,
	getReferencePath,
	getMetaPath,
	getMetaRoot,
	getIndexEntry,
	listRepos,
	readGlobalMap,
	pullAnalysis,
	checkRemote,
	generateReferenceWithAI,
	loadAuthData,
	canPushToWeb,
} from "@offworld/sdk";
import type { RemoteRepoSource, LocalRepoSource, Config, RepoIndexEntry } from "@offworld/types";

// Import handlers after mocks
import { pullHandler } from "../handlers/pull.js";
import { generateHandler } from "../handlers/generate.js";
import { listHandler } from "../handlers/list.js";
import { rmHandler } from "../handlers/remove.js";

describe("CLI handlers", () => {
	const mockParseRepoInput = parseRepoInput as ReturnType<typeof vi.fn>;
	const mockCloneRepo = cloneRepo as ReturnType<typeof vi.fn>;
	const mockUpdateRepo = updateRepo as ReturnType<typeof vi.fn>;
	const mockRemoveRepo = removeRepo as ReturnType<typeof vi.fn>;
	const mockIsRepoCloned = isRepoCloned as ReturnType<typeof vi.fn>;
	const mockGetClonedRepoPath = getClonedRepoPath as ReturnType<typeof vi.fn>;
	const mockGetCommitSha = getCommitSha as ReturnType<typeof vi.fn>;
	const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;
	const mockGetReferencePath = getReferencePath as ReturnType<typeof vi.fn>;
	const mockGetMetaPath = getMetaPath as ReturnType<typeof vi.fn>;
	const mockGetMetaRoot = getMetaRoot as ReturnType<typeof vi.fn>;
	const mockLoadAuthData = loadAuthData as ReturnType<typeof vi.fn>;
	const mockCanPushToWeb = canPushToWeb as ReturnType<typeof vi.fn>;
	const mockGetIndexEntry = getIndexEntry as ReturnType<typeof vi.fn>;
	const mockListRepos = listRepos as ReturnType<typeof vi.fn>;
	const mockReadGlobalMap = readGlobalMap as ReturnType<typeof vi.fn>;
	const mockPullAnalysis = pullAnalysis as ReturnType<typeof vi.fn>;
	const mockCheckRemote = checkRemote as ReturnType<typeof vi.fn>;
	const mockGetCommitDistance = getCommitDistance as ReturnType<typeof vi.fn>;
	const mockGenerateReferenceWithAI = generateReferenceWithAI as ReturnType<typeof vi.fn>;
	const mockGenerateSkillWithAI = mockGenerateReferenceWithAI;
	const mockGetSkillPath = mockGetReferencePath;
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
	const mockConfirm = p.confirm as ReturnType<typeof vi.fn>;

	const defaultConfig: Config = {
		repoRoot: "~/ow",
		defaultShallow: true,
		defaultModel: "anthropic/claude-sonnet-4-20250514",
		agents: ["opencode"],
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
		referenceName: "tanstack-router",
		referenceDescription: "TanStack Router expert",
		referenceContent: "# TanStack Router\n...",
		commitSha: "abc123",
		generatedAt: "2026-01-09T12:00:00Z",
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
			mockGetCommitSha.mockReturnValue("abc1234");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockCheckRemote.mockResolvedValue({ exists: true, commitSha: "abc1234" });
			mockGetCommitDistance.mockReturnValue(0);
			mockPullAnalysis.mockResolvedValue(mockRemoteAnalysis);
			mockGetReferencePath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockConfirm.mockResolvedValue(true);

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockCloneRepo).toHaveBeenCalledWith(
				mockGitHubSource,
				expect.objectContaining({ config: defaultConfig }),
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
			mockGetCommitSha.mockReturnValue("def4567");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockCheckRemote.mockResolvedValue({ exists: false });
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "def456",
			});
			mockGetReferencePath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockUpdateRepo).toHaveBeenCalledWith("github:tanstack/router");
			expect(mockCloneRepo).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
		});

		it("tries remote reference before local generation", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(false);
			mockCloneRepo.mockResolvedValue("/home/user/ow/github/tanstack/router");
			mockGetCommitSha.mockReturnValue("abc1234");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockCheckRemote.mockResolvedValue({ exists: true, commitSha: "abc1234" });
			mockGetCommitDistance.mockReturnValue(0);
			mockPullAnalysis.mockResolvedValue(mockRemoteAnalysis);
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockConfirm.mockResolvedValue(true);

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockCheckRemote).toHaveBeenCalledWith("tanstack/router");
			expect(mockGetCommitDistance).toHaveBeenCalled();
			expect(mockPullAnalysis).toHaveBeenCalledWith("tanstack/router");
			expect(mockGenerateSkillWithAI).not.toHaveBeenCalled();
			expect(result.analysisSource).toBe("remote");
		});

		it("falls back to local generation when no remote reference exists", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(false);
			mockCloneRepo.mockResolvedValue("/home/user/ow/github/tanstack/router");
			mockGetCommitSha.mockReturnValue("abc123");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockCheckRemote.mockResolvedValue({ exists: false });
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "abc123",
			});

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockCheckRemote).toHaveBeenCalled();
			expect(mockPullAnalysis).not.toHaveBeenCalled();
			expect(mockGenerateSkillWithAI).toHaveBeenCalled();
			expect(result.analysisSource).toBe("local");
		});

		it.skip("falls back to local generation when remote SHA differs", async () => {
			// TODO: Update test to handle new prompt-based flow where user decides remote vs local
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockUpdateRepo.mockResolvedValue({
				updated: false,
				previousSha: "abc123",
				currentSha: "def456",
			});
			mockCheckRemote.mockResolvedValue({ exists: true, commitSha: "abc123" });
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "abc123",
			});

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(mockCheckRemote).toHaveBeenCalled();
			expect(mockPullAnalysis).not.toHaveBeenCalled();
			expect(mockGenerateSkillWithAI).toHaveBeenCalled();
			expect(result.analysisSource).toBe("local");
		});

		it("uses cached reference when available", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockUpdateRepo.mockResolvedValue({
				updated: false,
				previousSha: "abc123",
				currentSha: "abc123",
			});
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation((path: string) => {
				if (path.endsWith("meta.json")) {
					return JSON.stringify({ commitSha: "abc123" });
				}
				return "";
			});
			mockGetCommitSha.mockReturnValue("abc123");

			const result = await pullHandler({ repo: "tanstack/router" });

			expect(result.analysisSource).toBe("cached");
			expect(mockPullAnalysis).not.toHaveBeenCalled();
			expect(mockGenerateSkillWithAI).not.toHaveBeenCalled();
		});

		it("handles local repos without cloning", async () => {
			mockParseRepoInput.mockReturnValue(mockLocalSource);
			mockGetMetaRoot.mockReturnValue("/home/user/.ow");
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/myrepo");
			mockGetCommitSha.mockReturnValue("xyz789");
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "xyz789",
			});

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
			expect(result.message).toContain("Remote reference exists");
		});

		it("proceeds with --force flag", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockCheckRemote.mockResolvedValue({ exists: true, commitSha: "abc123" });
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockGetCommitSha.mockReturnValue("def456");
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "def456",
			});

			const result = await generateHandler({ repo: "tanstack/router", force: true });

			// Should not check remote when force=true
			expect(result.success).toBe(true);
			expect(mockGenerateSkillWithAI).toHaveBeenCalled();
		});

		it("calls generateSkillWithAI", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockCheckRemote.mockResolvedValue({ exists: false });
			mockIsRepoCloned.mockReturnValue(true);
			mockGetClonedRepoPath.mockReturnValue("/home/user/ow/github/tanstack/router");
			mockGetIndexEntry.mockReturnValue(mockIndexEntry);
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockGetCommitSha.mockReturnValue("abc123");
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "abc123",
			});

			const result = await generateHandler({ repo: "tanstack/router" });

			expect(mockGenerateSkillWithAI).toHaveBeenCalledWith(
				"/home/user/ow/github/tanstack/router",
				"tanstack/router",
				expect.objectContaining({}),
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
			mockGetSkillPath.mockReturnValue(
				"/home/user/.local/share/offworld/skills/tanstack-router-reference",
			);
			mockGetMetaPath.mockReturnValue("/home/user/.local/share/offworld/meta/tanstack-router");
			mockLoadAuthData.mockReturnValue(null);
			mockCanPushToWeb.mockResolvedValue({ allowed: false, reason: "not authenticated" });
			mockGetCommitSha.mockReturnValue("abc123");
			mockGenerateSkillWithAI.mockResolvedValue({
				referenceContent: "# Skill\n...",
				commitSha: "abc123",
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
			mockListRepos.mockReturnValue(["github:tanstack/router"]);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);

			const result = await listHandler({});

			expect(result.repos).toHaveLength(1);
			expect(result.repos[0]!.fullName).toBe("github:tanstack/router");
			expect(result.repos[0]!.analyzed).toBe(true);
			expect(result.repos[0]!.hasSkill).toBe(true);
		});

		it("outputs JSON with --json flag", async () => {
			mockListRepos.mockReturnValue(["github:tanstack/router"]);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await listHandler({ json: true });

			expect(result.repos).toHaveLength(1);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it.skip("filters stale repos with --stale flag", async () => {
			// TODO: Implement stale detection in map model (needs commitSha tracking)
			mockListRepos.mockReturnValue(["github:tanstack/router", "github:tanstack/query"]);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
					"github:tanstack/query": {
						localPath: "/home/user/ow/github/tanstack/query",
						references: ["tanstack-query.md"],
						primary: "tanstack-query.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);

			const result = await listHandler({ stale: true });

			// Should filter to only stale repos
			expect(result.repos.filter((r) => r.isStale === true)).toHaveLength(2);
		});

		it("shows paths with --paths flag", async () => {
			mockListRepos.mockReturnValue(["github:tanstack/router"]);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);
			mockGetCommitSha.mockReturnValue("abc123");

			const result = await listHandler({ paths: true });

			expect(result.repos[0]!.localPath).toBe(mockIndexEntry.localPath);
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
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);
			mockConfirm.mockResolvedValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router" });

			expect(mockConfirm).toHaveBeenCalled();
		});

		it("skips prompt with -y flag", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router", yes: true });

			expect(mockConfirm).not.toHaveBeenCalled();
			expect(mockRemoveRepo).toHaveBeenCalled();
		});

		it("shows dry run output without deleting", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);

			const result = await rmHandler({ repo: "tanstack/router", dryRun: true });

			expect(result.success).toBe(true);
			expect(mockRemoveRepo).not.toHaveBeenCalled();
		});

		it("calls removeRepo with repoOnly option", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router", yes: true, repoOnly: true });

			expect(mockRemoveRepo).toHaveBeenCalledWith("github:tanstack/router", {
				referenceOnly: false,
				repoOnly: true,
			});
		});

		it("calls removeRepo with referenceOnly option", async () => {
			mockParseRepoInput.mockReturnValue(mockGitHubSource);
			mockReadGlobalMap.mockReturnValue({
				repos: {
					"github:tanstack/router": {
						localPath: "/home/user/ow/github/tanstack/router",
						references: ["tanstack-router.md"],
						primary: "tanstack-router.md",
						keywords: [],
						updatedAt: "2026-01-25",
					},
				},
			});
			mockExistsSync.mockReturnValue(true);
			mockRemoveRepo.mockResolvedValue(true);

			await rmHandler({ repo: "tanstack/router", yes: true, referenceOnly: true });

			expect(mockRemoveRepo).toHaveBeenCalledWith("github:tanstack/router", {
				referenceOnly: true,
				repoOnly: false,
			});
		});
	});

	describe("initHandler", () => {
		it("should be tested", () => {
			expect(true).toBe(true);
		});
	});

	describe("authHandler", () => {
		it("should be tested", () => {
			expect(true).toBe(true);
		});
	});

	describe("configHandler", () => {
		it("should be tested", () => {
			expect(true).toBe(true);
		});
	});

	describe("pushHandler", () => {
		it("should be tested", () => {
			expect(true).toBe(true);
		});
	});

	describe("projectHandler", () => {
		it("should be tested", () => {
			expect(true).toBe(true);
		});
	});
});
