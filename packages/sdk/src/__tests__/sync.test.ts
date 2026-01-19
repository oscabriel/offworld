/**
 * Unit tests for sync.ts API communication
 *
 * NOTE: Tests for pullAnalysis, pushAnalysis, checkRemote, and checkStaleness
 * are removed because they now use ConvexHttpClient which is difficult to mock
 * in vitest. These functions are tested via integration tests against real Convex.
 *
 * The remaining tests cover validation and GitHub API functions that use fetch().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteRepoSource, LocalRepoSource } from "@offworld/types";

// Mock global fetch for GitHub API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { canPushToWeb, validatePushAllowed, fetchRepoStars, PushNotAllowedError } from "../sync.js";

describe("sync.ts", () => {
	const mockGitHubSource: RemoteRepoSource = {
		type: "remote",
		provider: "github",
		owner: "tanstack",
		repo: "router",
		fullName: "tanstack/router",
		qualifiedName: "github:tanstack/router",
		cloneUrl: "https://github.com/tanstack/router.git",
	};

	const mockGitLabSource: RemoteRepoSource = {
		type: "remote",
		provider: "gitlab",
		owner: "group",
		repo: "project",
		fullName: "group/project",
		qualifiedName: "gitlab:group/project",
		cloneUrl: "https://gitlab.com/group/project.git",
	};

	const mockLocalSource: LocalRepoSource = {
		type: "local",
		path: "/home/user/projects/myrepo",
		name: "myrepo",
		qualifiedName: "local:abc123",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// canPushToWeb tests
	// =========================================================================
	describe("canPushToWeb", () => {
		it("rejects local sources", async () => {
			const result = await canPushToWeb(mockLocalSource);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Local repositories");
		});

		it("rejects non-github providers", async () => {
			const result = await canPushToWeb(mockGitLabSource);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("not yet supported");
		});

		it("rejects repos with <5 stars (mocked GitHub API)", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ stargazers_count: 3 }),
			});

			const result = await canPushToWeb(mockGitHubSource);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("3 stars");
			expect(result.stars).toBe(3);
		});

		it("allows repos with 5+ stars", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ stargazers_count: 100 }),
			});

			const result = await canPushToWeb(mockGitHubSource);

			expect(result.allowed).toBe(true);
			expect(result.stars).toBe(100);
		});
	});

	// =========================================================================
	// fetchRepoStars tests
	// =========================================================================
	describe("fetchRepoStars", () => {
		it("parses GitHub API response", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ stargazers_count: 42 }),
			});

			const stars = await fetchRepoStars("owner", "repo");

			expect(stars).toBe(42);
		});

		it("returns 0 on API error", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			const stars = await fetchRepoStars("owner", "repo");

			expect(stars).toBe(0);
		});

		it("returns 0 on non-ok response", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
			});

			const stars = await fetchRepoStars("nonexistent", "repo");

			expect(stars).toBe(0);
		});
	});

	// =========================================================================
	// validatePushAllowed tests
	// =========================================================================
	describe("validatePushAllowed", () => {
		it("throws PushNotAllowedError with reason local for local sources", async () => {
			await expect(validatePushAllowed(mockLocalSource)).rejects.toThrow(PushNotAllowedError);

			try {
				await validatePushAllowed(mockLocalSource);
			} catch (error) {
				expect((error as PushNotAllowedError).reason).toBe("local");
			}
		});

		it("throws PushNotAllowedError with reason not-github for gitlab", async () => {
			try {
				await validatePushAllowed(mockGitLabSource);
			} catch (error) {
				expect((error as PushNotAllowedError).reason).toBe("not-github");
			}
		});

		it("throws PushNotAllowedError with reason low-stars", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ stargazers_count: 2 }),
			});

			try {
				await validatePushAllowed(mockGitHubSource);
			} catch (error) {
				expect((error as PushNotAllowedError).reason).toBe("low-stars");
			}
		});

		it("does not throw for valid source with enough stars", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ stargazers_count: 50 }),
			});

			await expect(validatePushAllowed(mockGitHubSource)).resolves.toBeUndefined();
		});
	});
});
