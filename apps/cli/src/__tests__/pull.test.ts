import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	class MockRepoExistsError extends Error {}

	return {
		cloneRepo: vi.fn(),
		updateRepo: vi.fn(),
		isRepoCloned: vi.fn(),
		getClonedRepoPath: vi.fn(),
		getCommitSha: vi.fn(),
		getCommitDistance: vi.fn(),
		parseRepoInput: vi.fn(),
		loadConfig: vi.fn(),
		loadAuthData: vi.fn(),
		getMetaPath: vi.fn(),
		installReference: vi.fn(),
		toReferenceFileName: vi.fn(),
		checkRemote: vi.fn(),
		checkRemoteByName: vi.fn(),
		pullReference: vi.fn(),
		pullReferenceByName: vi.fn(),
		generateReferenceWithAI: vi.fn(),
		resolveReferenceKeywordsForRepo: vi.fn(),
		createSpinner: vi.fn(),
		confirm: vi.fn(async () => true),
		isCancel: vi.fn(() => false),
		logInfo: vi.fn(),
		logSuccess: vi.fn(),
		logError: vi.fn(),
		safeParse: vi.fn(() => ({ success: false })),
		RepoExistsError: MockRepoExistsError,
	};
});

vi.mock("@offworld/sdk/internal", () => ({
	cloneRepo: mocks.cloneRepo,
	updateRepo: mocks.updateRepo,
	isRepoCloned: mocks.isRepoCloned,
	getClonedRepoPath: mocks.getClonedRepoPath,
	getCommitSha: mocks.getCommitSha,
	getCommitDistance: mocks.getCommitDistance,
	parseRepoInput: mocks.parseRepoInput,
	loadConfig: mocks.loadConfig,
	loadAuthData: mocks.loadAuthData,
	getMetaPath: mocks.getMetaPath,
	RepoExistsError: mocks.RepoExistsError,
	installReference: mocks.installReference,
	toReferenceFileName: mocks.toReferenceFileName,
	Paths: { offworldReferencesDir: "/tmp/offworld-refs" },
}));

vi.mock("@offworld/sdk/sync", () => ({
	pullReference: mocks.pullReference,
	pullReferenceByName: mocks.pullReferenceByName,
	checkRemote: mocks.checkRemote,
	checkRemoteByName: mocks.checkRemoteByName,
}));

vi.mock("@offworld/sdk/ai", () => ({
	generateReferenceWithAI: mocks.generateReferenceWithAI,
}));

vi.mock("@offworld/types", () => ({
	ReferenceMetaSchema: {
		safeParse: mocks.safeParse,
	},
}));

vi.mock("../utils/spinner", () => ({
	createSpinner: mocks.createSpinner,
}));

vi.mock("../handlers/shared", () => ({
	resolveReferenceKeywordsForRepo: mocks.resolveReferenceKeywordsForRepo,
}));

vi.mock("@clack/prompts", () => ({
	confirm: mocks.confirm,
	isCancel: mocks.isCancel,
	log: {
		info: mocks.logInfo,
		success: mocks.logSuccess,
		error: mocks.logError,
	},
}));

import { pullHandler } from "../handlers/pull";

describe("pullHandler --clone-only", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.createSpinner.mockReturnValue({
			start: vi.fn(),
			stop: vi.fn(),
			message: vi.fn(),
		});

		mocks.parseRepoInput.mockReturnValue({
			type: "remote",
			provider: "github",
			owner: "owner",
			repo: "repo",
			fullName: "owner/repo",
			qualifiedName: "github.com:owner/repo",
			cloneUrl: "https://github.com/owner/repo.git",
		});
		mocks.loadConfig.mockReturnValue({
			maxCommitDistance: 20,
			acceptUnknownDistance: false,
		});
		mocks.loadAuthData.mockReturnValue(null);
		mocks.getMetaPath.mockReturnValue("/tmp/does-not-exist");
		mocks.getCommitSha.mockReturnValue("abcdef0123456789");
		mocks.toReferenceFileName.mockImplementation((name: string) => `${name.replace("/", "-")}.md`);
		mocks.getCommitDistance.mockReturnValue(0);
		mocks.resolveReferenceKeywordsForRepo.mockResolvedValue([]);
		mocks.checkRemote.mockResolvedValue({ exists: false, commitSha: undefined });
		mocks.checkRemoteByName.mockResolvedValue({ exists: false, commitSha: undefined });
		mocks.pullReference.mockResolvedValue(null);
		mocks.pullReferenceByName.mockResolvedValue(null);
		mocks.generateReferenceWithAI.mockResolvedValue({
			referenceContent: "# ref",
			commitSha: "abcdef0123456789",
		});
	});

	it("returns success after clone/update and skips remote/generation when cloneOnly is true", async () => {
		mocks.isRepoCloned.mockReturnValue(false);
		mocks.cloneRepo.mockResolvedValue("/tmp/repos/owner-repo");

		const result = await pullHandler({
			repo: "owner/repo",
			cloneOnly: true,
			quiet: true,
		});

		expect(result).toEqual({
			success: true,
			repoPath: "/tmp/repos/owner-repo",
			referenceSource: "none",
			referenceInstalled: false,
			message: "Clone ready; reference generation skipped (--clone-only).",
		});
		expect(mocks.cloneRepo).toHaveBeenCalledTimes(1);
		expect(mocks.checkRemote).not.toHaveBeenCalled();
		expect(mocks.pullReference).not.toHaveBeenCalled();
		expect(mocks.generateReferenceWithAI).not.toHaveBeenCalled();
	});

	it("does not change existing non-clone-only behavior when generation is disabled", async () => {
		mocks.isRepoCloned.mockReturnValue(true);
		mocks.getClonedRepoPath.mockReturnValue("/tmp/repos/owner-repo");

		const result = await pullHandler({
			repo: "owner/repo",
			skipUpdate: true,
			allowGenerate: false,
			quiet: true,
		});

		expect(result.success).toBe(false);
		expect(result.referenceSource).toBe("local");
		expect(result.referenceInstalled).toBe(false);
		expect(result.message).toContain("local generation is disabled");
		expect(mocks.checkRemote).toHaveBeenCalledTimes(1);
		expect(mocks.generateReferenceWithAI).not.toHaveBeenCalled();
	});

	it("rejects --clone-only combined with --reference", async () => {
		mocks.isRepoCloned.mockReturnValue(true);
		mocks.getClonedRepoPath.mockReturnValue("/tmp/repos/owner-repo");

		const result = await pullHandler({
			repo: "owner/repo",
			reference: "custom-ref",
			cloneOnly: true,
			skipUpdate: true,
			quiet: true,
		});

		expect(result.success).toBe(false);
		expect(result.message).toBe("--clone-only cannot be combined with --reference");
		expect(mocks.checkRemoteByName).not.toHaveBeenCalled();
		expect(mocks.generateReferenceWithAI).not.toHaveBeenCalled();
	});
});
