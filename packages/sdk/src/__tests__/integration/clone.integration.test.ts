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

// ============================================================================
// Test configuration
// ============================================================================

const TEST_TIMEOUT = 30000; // 30 seconds for network operations

let tempDir: string;
let tempRepoRoot: string;
let tempMetaRoot: string;

// ============================================================================
// Mock config to use temp directories (but NOT git operations)
// ============================================================================

vi.mock("../../config.js", () => ({
	loadConfig: () => ({
		repoRoot: tempRepoRoot,
		skillDir: join(tempDir, "skill"),
	}),
	getMetaRoot: () => tempMetaRoot,
	getRepoPath: (fullName: string, provider: string) => join(tempRepoRoot, provider, fullName),
	getSkillPath: (fullName: string) => join(tempMetaRoot, "skills", fullName.replace("/", "-")),
	getMetaPath: (fullName: string) => join(tempMetaRoot, "meta", fullName.replace("/", "-")),
}));

// Mock index-manager to avoid polluting real index
vi.mock("../../index-manager.js", () => ({
	getIndexEntry: vi.fn(() => null),
	listIndexedRepos: vi.fn(() => []),
	removeFromIndex: vi.fn(),
	updateIndex: vi.fn(),
}));

// Import after mocking
import { cloneRepo, getCommitSha, GitError } from "../../clone.js";

// ============================================================================
// Setup and teardown
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();

	// Create fresh temp directories
	tempDir = mkdtempSync(join(tmpdir(), "clone-integration-test-"));
	tempRepoRoot = join(tempDir, "repos");
	tempMetaRoot = join(tempDir, ".ow");
});

afterEach(() => {
	// Cleanup temp directory
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
});

// ============================================================================
// Integration tests
// ============================================================================

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
					qualifiedName: "github:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source, { shallow: true });

				// Verify path is correct
				expect(repoPath).toBe(join(tempRepoRoot, "github", "octocat/Hello-World"));

				// Verify .git directory exists
				expect(existsSync(join(repoPath, ".git"))).toBe(true);

				// Verify README.md exists (Hello-World has a README)
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
					qualifiedName: "github:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source, { shallow: true });

				// Get commit SHA
				const sha = getCommitSha(repoPath);

				// Verify SHA is a valid git commit hash (40 hex chars)
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
					qualifiedName: "github:definitely-not-a-real-user/definitely-not-a-real-repo-12345",
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
				// octocat/Hello-World has a 'test' branch
				const source: RemoteRepoSource = {
					type: "remote",
					provider: "github",
					owner: "octocat",
					repo: "Hello-World",
					fullName: "octocat/Hello-World",
					qualifiedName: "github:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source, { shallow: true, branch: "master" });

				// Verify clone succeeded
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
					qualifiedName: "github:octocat/Hello-World",
					cloneUrl: "https://github.com/octocat/Hello-World.git",
				};

				const repoPath = await cloneRepo(source, { shallow: true });
				const sha = getCommitSha(repoPath);

				// SHA should be consistent between calls
				const sha2 = getCommitSha(repoPath);
				expect(sha).toBe(sha2);
			},
			TEST_TIMEOUT,
		);

		it("throws GitError for non-git directory", () => {
			// tempDir exists but is not a git repository
			expect(() => getCommitSha(tempDir)).toThrow(GitError);
		});
	});
});
