/**
 * Unit tests for repo-source.ts input parsing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs before importing repo-source module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	statSync: vi.fn(),
}));

import { existsSync, statSync } from "node:fs";
import {
	parseRepoInput,
	getReferenceFileNameForSource,
	PathNotFoundError,
	NotGitRepoError,
	RepoSourceError,
} from "../repo-source.js";

describe("repo-source.ts", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockStatSync = statSync as ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// Short format (owner/repo) parsing
	// =========================================================================
	describe("parseRepoInput - short format (owner/repo)", () => {
		it("returns github remote with correct fields", () => {
			const result = parseRepoInput("tanstack/router");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("github");
				expect(result.owner).toBe("tanstack");
				expect(result.repo).toBe("router");
				expect(result.fullName).toBe("tanstack/router");
				expect(result.qualifiedName).toBe("github.com:tanstack/router");
				expect(result.cloneUrl).toBe("https://github.com/tanstack/router.git");
			}
		});

		it("handles various owner/repo combinations", () => {
			const cases = [
				["vercel/ai", "vercel", "ai"],
				["facebook/react", "facebook", "react"],
				["a/b", "a", "b"],
				["my-org/my-repo", "my-org", "my-repo"],
				["Org123/Repo_456", "Org123", "Repo_456"],
			];

			for (const [input, expectedOwner, expectedRepo] of cases) {
				const result = parseRepoInput(input!);
				expect(result.type).toBe("remote");
				if (result.type === "remote") {
					expect(result.owner).toBe(expectedOwner);
					expect(result.repo).toBe(expectedRepo);
				}
			}
		});
	});

	// =========================================================================
	// HTTPS URL parsing
	// =========================================================================
	describe("parseRepoInput - HTTPS URLs", () => {
		it("extracts owner and repo from https://github.com/o/r", () => {
			const result = parseRepoInput("https://github.com/tanstack/router");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("github");
				expect(result.owner).toBe("tanstack");
				expect(result.repo).toBe("router");
				expect(result.fullName).toBe("tanstack/router");
			}
		});

		it("handles .git suffix in https://github.com/o/r.git", () => {
			const result = parseRepoInput("https://github.com/tanstack/router.git");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.owner).toBe("tanstack");
				expect(result.repo).toBe("router");
			}
		});

		it("returns gitlab provider for https://gitlab.com/o/r", () => {
			const result = parseRepoInput("https://gitlab.com/group/project");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("gitlab");
				expect(result.owner).toBe("group");
				expect(result.repo).toBe("project");
				expect(result.qualifiedName).toBe("gitlab.com:group/project");
				expect(result.cloneUrl).toBe("https://gitlab.com/group/project.git");
			}
		});

		it("returns bitbucket provider for https://bitbucket.org/o/r", () => {
			const result = parseRepoInput("https://bitbucket.org/team/repo");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("bitbucket");
				expect(result.owner).toBe("team");
				expect(result.repo).toBe("repo");
				expect(result.qualifiedName).toBe("bitbucket.org:team/repo");
				expect(result.cloneUrl).toBe("https://bitbucket.org/team/repo.git");
			}
		});

		it("handles http:// (non-https) URLs", () => {
			const result = parseRepoInput("http://github.com/owner/repo");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("github");
				expect(result.owner).toBe("owner");
				expect(result.repo).toBe("repo");
			}
		});
	});

	// =========================================================================
	// SSH URL parsing
	// =========================================================================
	describe("parseRepoInput - SSH URLs", () => {
		it("parses git@github.com:o/r.git SSH URL", () => {
			const result = parseRepoInput("git@github.com:tanstack/router.git");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("github");
				expect(result.owner).toBe("tanstack");
				expect(result.repo).toBe("router");
				expect(result.fullName).toBe("tanstack/router");
				expect(result.qualifiedName).toBe("github.com:tanstack/router");
			}
		});

		it("parses SSH URL without .git suffix", () => {
			const result = parseRepoInput("git@github.com:owner/repo");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.owner).toBe("owner");
				expect(result.repo).toBe("repo");
			}
		});

		it("parses git@gitlab.com SSH URL", () => {
			const result = parseRepoInput("git@gitlab.com:group/project.git");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("gitlab");
				expect(result.owner).toBe("group");
				expect(result.repo).toBe("project");
			}
		});

		it("parses git@bitbucket.org SSH URL", () => {
			const result = parseRepoInput("git@bitbucket.org:team/repo.git");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.provider).toBe("bitbucket");
				expect(result.owner).toBe("team");
				expect(result.repo).toBe("repo");
			}
		});
	});

	// =========================================================================
	// Local path parsing
	// =========================================================================
	describe("parseRepoInput - local paths", () => {
		it("returns local source for '.' (mocked fs)", () => {
			mockExistsSync.mockImplementation((_path: string) => {
				// Both the dir and .git should exist
				return true;
			});
			mockStatSync.mockReturnValue({ isDirectory: () => true });

			const result = parseRepoInput(".");

			expect(result.type).toBe("local");
			if (result.type === "local") {
				expect(result.path).toBeTruthy();
				expect(result.name).toBeTruthy();
				expect(result.qualifiedName).toMatch(/^local:/);
			}
		});

		it("returns local with hashed qualifiedName for /path", () => {
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ isDirectory: () => true });

			const result = parseRepoInput("/home/user/projects/myrepo");

			expect(result.type).toBe("local");
			if (result.type === "local") {
				expect(result.path).toBe("/home/user/projects/myrepo");
				expect(result.name).toBe("myrepo");
				expect(result.qualifiedName).toMatch(/^local:[a-f0-9]{12}$/);
			}
		});

		it("throws PathNotFoundError for non-existent path", () => {
			mockExistsSync.mockReturnValue(false);

			expect(() => parseRepoInput("/nonexistent/path")).toThrow(PathNotFoundError);
		});

		it("throws NotGitRepoError for directory without .git", () => {
			mockExistsSync.mockImplementation((path: string) => {
				// Dir exists, but .git doesn't
				return !path.endsWith(".git");
			});
			mockStatSync.mockReturnValue({ isDirectory: () => true });

			expect(() => parseRepoInput("/some/dir")).toThrow(NotGitRepoError);
		});

		it("throws RepoSourceError if path is not a directory", () => {
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			expect(() => parseRepoInput("/path/to/file.txt")).toThrow(RepoSourceError);
		});
	});

	// =========================================================================
	// qualifiedName format verification
	// =========================================================================
	describe("qualifiedName format", () => {
		it("is 'host:owner/repo' for remote", () => {
			const github = parseRepoInput("tanstack/router");
			expect(github.qualifiedName).toBe("github.com:tanstack/router");

			const gitlab = parseRepoInput("https://gitlab.com/group/proj");
			expect(gitlab.qualifiedName).toBe("gitlab.com:group/proj");

			const bitbucket = parseRepoInput("https://bitbucket.org/team/repo");
			expect(bitbucket.qualifiedName).toBe("bitbucket.org:team/repo");
		});

		it("is 'local:hash' for local", () => {
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ isDirectory: () => true });

			const result = parseRepoInput("/some/path");

			expect(result.qualifiedName).toMatch(/^local:[a-f0-9]{12}$/);
		});
	});

	// =========================================================================
	// getReferenceFileNameForSource tests
	// =========================================================================
	describe("getReferenceFileNameForSource", () => {
		it("returns owner-repo.md format for remote", () => {
			const source = parseRepoInput("tanstack/router");
			const result = getReferenceFileNameForSource(source);

			expect(result).toBe("tanstack-router.md");
		});

		it("returns owner-repo.md format for gitlab", () => {
			const source = parseRepoInput("https://gitlab.com/group/project");
			const result = getReferenceFileNameForSource(source);

			expect(result).toBe("group-project.md");
		});

		it("returns name.md format for local", () => {
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ isDirectory: () => true });

			const source = parseRepoInput("/some/path");
			const result = getReferenceFileNameForSource(source);

			expect(result).toMatch(/^path\.md$/);
		});
	});

	// =========================================================================
	// Edge cases and error handling
	// =========================================================================
	describe("error handling", () => {
		it("throws for completely invalid input", () => {
			expect(() => parseRepoInput("not-a-valid-input")).toThrow(RepoSourceError);
		});

		it("throws for empty string", () => {
			expect(() => parseRepoInput("")).toThrow(RepoSourceError);
		});

		it("trims whitespace from input", () => {
			const result = parseRepoInput("  tanstack/router  ");

			expect(result.type).toBe("remote");
			if (result.type === "remote") {
				expect(result.fullName).toBe("tanstack/router");
			}
		});

		it("throws for URL with unsupported host", () => {
			expect(() => parseRepoInput("https://codeberg.org/owner/repo")).toThrow(RepoSourceError);
		});
	});
});
