import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getConfigPath: vi.fn(),
	loadConfig: vi.fn(),
	parseDependencies: vi.fn(),
	resolveDependencyRepo: vi.fn(),
	matchDependenciesToReferencesWithRemoteCheck: vi.fn(),
	updateAgentFiles: vi.fn(),
	getReferencePath: vi.fn(),
	toReferenceFileName: vi.fn(),
	readGlobalMap: vi.fn(),
	writeProjectMap: vi.fn(),
	pullHandler: vi.fn(),
	logWarn: vi.fn(),
}));

vi.mock("@offworld/sdk/internal", () => ({
	getConfigPath: mocks.getConfigPath,
	loadConfig: mocks.loadConfig,
	parseDependencies: mocks.parseDependencies,
	resolveDependencyRepo: mocks.resolveDependencyRepo,
	matchDependenciesToReferencesWithRemoteCheck: mocks.matchDependenciesToReferencesWithRemoteCheck,
	updateAgentFiles: mocks.updateAgentFiles,
	getReferencePath: mocks.getReferencePath,
	toReferenceFileName: mocks.toReferenceFileName,
	readGlobalMap: mocks.readGlobalMap,
	writeProjectMap: mocks.writeProjectMap,
}));

vi.mock("../handlers/pull", () => ({
	pullHandler: mocks.pullHandler,
}));

vi.mock("@clack/prompts", () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn(() => false),
	confirm: vi.fn(async () => true),
	multiselect: vi.fn(async () => []),
	spinner: vi.fn(() => ({
		start: vi.fn(),
		stop: vi.fn(),
		message: vi.fn(),
	})),
	log: {
		info: vi.fn(),
		warn: mocks.logWarn,
		error: vi.fn(),
		step: vi.fn(),
		success: vi.fn(),
	},
}));

import { projectInitHandler } from "../handlers/project";

describe("projectInitHandler map write behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.getConfigPath.mockReturnValue(`${process.cwd()}/package.json`);
		mocks.loadConfig.mockReturnValue({ defaultModel: "anthropic/claude-sonnet-4-20250514" });
		mocks.getReferencePath.mockImplementation((repo: string) => `/tmp/${repo}.md`);
		mocks.toReferenceFileName.mockImplementation((repo: string) => `${repo.replace("/", "-")}.md`);
		mocks.updateAgentFiles.mockImplementation(() => {});
	});

	it("does not update project map when all installs fail", async () => {
		mocks.parseDependencies.mockReturnValue([{ name: "foo", version: "^1.0.0", dev: false }]);
		mocks.resolveDependencyRepo.mockResolvedValue({
			dep: "foo",
			repo: "owner/repo-a",
			source: "npm",
		});
		mocks.matchDependenciesToReferencesWithRemoteCheck.mockResolvedValue([
			{ dep: "foo", repo: "owner/repo-a", status: "remote", source: "npm" },
		]);
		mocks.pullHandler.mockResolvedValue({
			success: false,
			referenceInstalled: false,
			referenceSource: "local",
			repoPath: "",
			message: "failed",
		});

		await projectInitHandler({ all: true, yes: true });

		expect(mocks.pullHandler).toHaveBeenCalledWith(
			expect.objectContaining({ repo: "owner/repo-a", allowGenerate: false }),
		);
		expect(mocks.writeProjectMap).not.toHaveBeenCalled();
		expect(mocks.logWarn).toHaveBeenCalledWith(
			"No references were installed. Project map was not updated.",
		);
	});

	it("writes project map only for successfully installed repos", async () => {
		mocks.parseDependencies.mockReturnValue([
			{ name: "pkg-a", version: "^1.0.0", dev: false },
			{ name: "pkg-a-dup", version: "^2.0.0", dev: false },
			{ name: "pkg-b", version: "^3.0.0", dev: false },
		]);

		mocks.resolveDependencyRepo
			.mockResolvedValueOnce({ dep: "pkg-a", repo: "owner/repo-a", source: "npm" })
			.mockResolvedValueOnce({ dep: "pkg-a-dup", repo: "owner/repo-a", source: "npm" })
			.mockResolvedValueOnce({ dep: "pkg-b", repo: "owner/repo-b", source: "npm" });

		mocks.matchDependenciesToReferencesWithRemoteCheck.mockResolvedValue([
			{ dep: "pkg-a", repo: "owner/repo-a", status: "installed", source: "npm" },
			{ dep: "pkg-a-dup", repo: "owner/repo-a", status: "installed", source: "npm" },
			{ dep: "pkg-b", repo: "owner/repo-b", status: "remote", source: "npm" },
		]);

		mocks.pullHandler.mockImplementation(async ({ repo }: { repo: string }) => {
			if (repo === "owner/repo-b") {
				return {
					success: false,
					referenceInstalled: false,
					referenceSource: "local",
					repoPath: "",
					message: "failed",
				};
			}

			return {
				success: true,
				referenceInstalled: true,
				referenceSource: "remote",
				repoPath: "/tmp/repo-a",
			};
		});

		mocks.readGlobalMap.mockReturnValue({
			repos: {
				"github.com:owner/repo-a": {
					localPath: "/repos/repo-a",
					reference: "owner-repo-a.md",
					keywords: ["alpha"],
				},
				"github.com:owner/repo-b": {
					localPath: "/repos/repo-b",
					reference: "owner-repo-b.md",
					keywords: ["beta"],
				},
			},
		});

		await projectInitHandler({ all: true, yes: true });

		expect(mocks.pullHandler).toHaveBeenCalledTimes(1);
		expect(mocks.pullHandler).toHaveBeenCalledWith(
			expect.objectContaining({ repo: "owner/repo-b", allowGenerate: false }),
		);
		expect(mocks.writeProjectMap).toHaveBeenCalledTimes(1);
		const [, entries] = mocks.writeProjectMap.mock.calls[0] as [string, Record<string, unknown>];
		expect(Object.keys(entries)).toEqual(["github.com:owner/repo-a"]);
		expect(entries["github.com:owner/repo-a"]).toEqual({
			localPath: "/repos/repo-a",
			reference: "owner-repo-a.md",
			keywords: ["alpha"],
		});
	});
});
