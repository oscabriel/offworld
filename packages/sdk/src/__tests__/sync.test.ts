/**
 * Unit tests for sync.ts API communication
 * PRD T3.8
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
	pullAnalysis,
	pushAnalysis,
	checkRemote,
	checkStaleness,
	canPushToWeb,
	validatePushAllowed,
	fetchRepoStars,
	NetworkError,
	AuthenticationError,
	RateLimitError,
	ConflictError,
	PushNotAllowedError,
} from "../sync.js";
import type { RemoteRepoSource, LocalRepoSource } from "@offworld/types";

describe("sync.ts", () => {
	const mockAnalysisData = {
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
			repositoryStructure: [],
			keyFiles: [],
			searchStrategies: [],
			whenToUse: [],
		},
		fileIndex: [],
		commitSha: "abc123",
		analyzedAt: "2026-01-09T12:00:00Z",
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
	// pullAnalysis tests
	// =========================================================================
	describe("pullAnalysis", () => {
		it("calls correct endpoint with POST", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockAnalysisData),
			});

			await pullAnalysis("tanstack/router");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/analyses/pull"),
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ fullName: "tanstack/router" }),
				}),
			);
		});

		it("returns null on 404", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
			});

			const result = await pullAnalysis("nonexistent/repo");

			expect(result).toBeNull();
		});

		it("returns parsed analysis on success", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockAnalysisData),
			});

			const result = await pullAnalysis("tanstack/router");

			expect(result).toEqual(mockAnalysisData);
		});

		it("throws NetworkError on connection failure", async () => {
			mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

			await expect(pullAnalysis("tanstack/router")).rejects.toThrow(NetworkError);
		});
	});

	// =========================================================================
	// pushAnalysis tests
	// =========================================================================
	describe("pushAnalysis", () => {
		it("includes Authorization header", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			});

			await pushAnalysis(mockAnalysisData, "test-token");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
				}),
			);
		});

		it("sends correct JSON body", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			});

			await pushAnalysis(mockAnalysisData, "test-token");

			const call = mockFetch.mock.calls[0]!;
			const body = JSON.parse(call[1].body as string);
			expect(body.fullName).toBe("tanstack/router");
			expect(body.commitSha).toBe("abc123");
		});

		it("returns success:true on 200", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			});

			const result = await pushAnalysis(mockAnalysisData, "test-token");

			expect(result.success).toBe(true);
		});

		it("throws AuthenticationError on 401", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
			});

			await expect(pushAnalysis(mockAnalysisData, "bad-token")).rejects.toThrow(
				AuthenticationError,
			);
		});

		it("throws RateLimitError on 429", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 429,
			});

			await expect(pushAnalysis(mockAnalysisData, "test-token")).rejects.toThrow(RateLimitError);
		});

		it("throws ConflictError on 409", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 409,
				json: () =>
					Promise.resolve({
						message: "Newer analysis exists",
						remoteCommitSha: "def456",
					}),
			});

			await expect(pushAnalysis(mockAnalysisData, "test-token")).rejects.toThrow(ConflictError);
		});
	});

	// =========================================================================
	// checkRemote tests
	// =========================================================================
	describe("checkRemote", () => {
		it("returns exists:false on 404", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
			});

			const result = await checkRemote("nonexistent/repo");

			expect(result.exists).toBe(false);
		});

		it("returns commitSha and analyzedAt on success", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						exists: true,
						commitSha: "abc123",
						analyzedAt: "2026-01-09T12:00:00Z",
					}),
			});

			const result = await checkRemote("tanstack/router");

			expect(result.exists).toBe(true);
			expect(result.commitSha).toBe("abc123");
			expect(result.analyzedAt).toBe("2026-01-09T12:00:00Z");
		});

		it("does not increment pullCount (lightweight check)", async () => {
			// Check endpoint is different from pull endpoint
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ exists: true }),
			});

			await checkRemote("tanstack/router");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/analyses/check"),
				expect.any(Object),
			);
			expect(mockFetch).not.toHaveBeenCalledWith(
				expect.stringContaining("/api/analyses/pull"),
				expect.any(Object),
			);
		});
	});

	// =========================================================================
	// checkStaleness tests
	// =========================================================================
	describe("checkStaleness", () => {
		it("returns isStale:false when no remote exists", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
			});

			const result = await checkStaleness("tanstack/router", "local123");

			expect(result.isStale).toBe(false);
		});

		it("returns isStale:true when SHAs differ", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						exists: true,
						commitSha: "remote456",
					}),
			});

			const result = await checkStaleness("tanstack/router", "local123");

			expect(result.isStale).toBe(true);
			expect(result.localCommitSha).toBe("local123");
			expect(result.remoteCommitSha).toBe("remote456");
		});

		it("returns isStale:false when SHAs match", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						exists: true,
						commitSha: "same123",
					}),
			});

			const result = await checkStaleness("tanstack/router", "same123");

			expect(result.isStale).toBe(false);
		});
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
