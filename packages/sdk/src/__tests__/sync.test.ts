/**
 * Unit tests for sync.ts API communication
 *
 * NOTE: Tests for pullReference, pushReference, checkRemote, and checkStaleness
 * are removed because they now use ConvexHttpClient which is difficult to mock
 * in vitest. These functions are tested via integration tests against real Convex.
 *
 * The remaining tests cover validation and GitHub API functions that use fetch().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteRepoSource, LocalRepoSource } from "@offworld/types";

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
		qualifiedName: "github.com:tanstack/router",
		cloneUrl: "https://github.com/tanstack/router.git",
	};

	const mockGitLabSource: RemoteRepoSource = {
		type: "remote",
		provider: "gitlab",
		owner: "group",
		repo: "project",
		fullName: "group/project",
		qualifiedName: "gitlab.com:group/project",
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

	describe("canPushToWeb", () => {
		it("rejects local sources", () => {
			const result = canPushToWeb(mockLocalSource);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Local repositories");
		});

		it("rejects non-github providers", () => {
			const result = canPushToWeb(mockGitLabSource);

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("not yet supported");
		});

		it("allows github repos (star validation happens server-side)", () => {
			const result = canPushToWeb(mockGitHubSource);

			expect(result.allowed).toBe(true);
		});
	});

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

	describe("validatePushAllowed", () => {
		it("throws PushNotAllowedError with reason local for local sources", () => {
			expect(() => validatePushAllowed(mockLocalSource)).toThrow(PushNotAllowedError);

			try {
				validatePushAllowed(mockLocalSource);
			} catch (error) {
				expect((error as PushNotAllowedError).reason).toBe("local");
			}
		});

		it("throws PushNotAllowedError with reason not-github for gitlab", () => {
			expect(() => validatePushAllowed(mockGitLabSource)).toThrow(PushNotAllowedError);

			try {
				validatePushAllowed(mockGitLabSource);
			} catch (error) {
				expect((error as PushNotAllowedError).reason).toBe("not-github");
			}
		});

		it("does not throw for github source (star validation happens server-side)", () => {
			expect(() => validatePushAllowed(mockGitHubSource)).not.toThrow();
		});
	});
});
