/**
 * Integration tests for clone.ts
 *
 * These tests perform actual git clone operations to verify:
 * - Real repository cloning works
 * - .git directory is created
 * - Commit SHA is retrieved
 *
 * Note: These tests require network access and take longer than unit tests.
 * Run with: npm run test:integration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RemoteRepoSource } from "@offworld/types";

const TEST_TIMEOUT = 30000; // 30 seconds for network operations

let tempDir: string;
let tempRepoRoot: string;
let tempMetaRoot: string;

vi.mock("../../config.js", () => ({
	loadConfig: () => ({
		repoRoot: tempRepoRoot,
		offworldDir: join(tempDir, "offworld"),
	}),
	getMetaRoot: () => tempMetaRoot,
	getRepoPath: (fullName: string, provider: string) => join(tempRepoRoot, provider, fullName),
	getReferencePath: (fullName: string) =>
		join(tempMetaRoot, "references", fullName.replace("/", "-") + ".md"),
	getMetaPath: (fullName: string) => join(tempMetaRoot, "meta", fullName.replace("/", "-")),
	toReferenceFileName: (fullName: string) => fullName.replace("/", "-") + ".md",
}));

vi.mock("../../paths.js", () => ({
	Paths: {
		get offworldReferencesDir() {
			return join(tempDir, "offworld", "references");
		},
		get offworldAssetsDir() {
			return join(tempDir, "offworld", "assets");
		},
		get offworldGlobalMapPath() {
			return join(tempDir, "offworld", "assets", "map.json");
		},
		get offworldSkillDir() {
			return join(tempDir, "offworld");
		},
	},
	expandTilde: (path: string) => path,
}));

vi.mock("../../index-manager.js", () => ({
	getIndexEntry: vi.fn(() => null),
	listIndexedRepos: vi.fn(() => []),
	removeFromIndex: vi.fn(),
	updateIndex: vi.fn(),
	upsertGlobalMapEntry: vi.fn(),
	readGlobalMap: vi.fn(() => ({ repos: {} })),
}));

import { cloneRepo, getCommitSha, GitError } from "../../clone.js";

beforeEach(() => {
	vi.clearAllMocks();

	tempDir = mkdtempSync(join(tmpdir(), "clone-integration-test-"));
	tempRepoRoot = join(tempDir, "repos");
	tempMetaRoot = join(tempDir, ".ow");
});

afterEach(() => {
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch {}
});

describe("clone.integration", () => {
	describe("cloneRepo with real git operations", () => {
		it(
			"clones octocat/Hello-World repository",
			async () => {
				const source: RemoteRepoSource = {
					type: "remote",
					provider: "github",
					owner: "octocat",
					repo: "Hello-World",
					fullName: "octocat/Hello-World",
					qualifiedName: "github.com:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source);

				expect(repoPath).toBe(join(tempRepoRoot, "github", "octocat/Hello-World"));

				expect(existsSync(join(repoPath, ".git"))).toBe(true);

				expect(existsSync(join(repoPath, "README"))).toBe(true);
			},
			TEST_TIMEOUT,
		);

		it(
			"retrieves commit SHA after clone",
			async () => {
				const source: RemoteRepoSource = {
					type: "remote",
					provider: "github",
					owner: "octocat",
					repo: "Hello-World",
					fullName: "octocat/Hello-World",
					qualifiedName: "github.com:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source);

				const sha = getCommitSha(repoPath);

				expect(sha).toMatch(/^[a-f0-9]{40}$/);
			},
			TEST_TIMEOUT,
		);

		it(
			"handles non-existent repository",
			async () => {
				const source: RemoteRepoSource = {
					type: "remote",
					provider: "github",
					owner: "definitely-not-a-real-user",
					repo: "definitely-not-a-real-repo-12345",
					fullName: "definitely-not-a-real-user/definitely-not-a-real-repo-12345",
					qualifiedName: "github.com:definitely-not-a-real-user/definitely-not-a-real-repo-12345",
					cloneUrl:
						"https://github.com/definitely-not-a-real-user/definitely-not-a-real-repo-12345.git",
				};

				await expect(cloneRepo(source)).rejects.toThrow(GitError);
			},
			TEST_TIMEOUT,
		);

		it(
			"clones with specific branch",
			async () => {
				const source: RemoteRepoSource = {
					type: "remote",
					provider: "github",
					owner: "octocat",
					repo: "Hello-World",
					fullName: "octocat/Hello-World",
					qualifiedName: "github.com:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source, { branch: "master" });

				expect(existsSync(join(repoPath, ".git"))).toBe(true);
			},
			TEST_TIMEOUT,
		);
	});

	describe("getCommitSha with real repository", () => {
		it(
			"returns current HEAD commit",
			async () => {
				const source: RemoteRepoSource = {
					type: "remote",
					provider: "github",
					owner: "octocat",
					repo: "Hello-World",
					fullName: "octocat/Hello-World",
					qualifiedName: "github.com:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source);
				const sha = getCommitSha(repoPath);

				const sha2 = getCommitSha(repoPath);
				expect(sha).toBe(sha2);
			},
			TEST_TIMEOUT,
		);

		it("throws GitError for non-git directory", () => {
			expect(() => getCommitSha(tempDir)).toThrow(GitError);
		});
	});
});
