/**
 * Sync utilities for CLI-Convex communication
 * Uses ConvexHttpClient for direct type-safe API calls
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@offworld/backend/api";
import type { Architecture, FileIndex, RepoSource, Skill } from "@offworld/types";

// ============================================================================
// Configuration
// ============================================================================

// CONVEX_URL can be injected at build time (production) or runtime (dev)
// For local dev, it's loaded from .env via CLI's env-loader
// Using a getter to ensure it's evaluated AFTER env is loaded, not at module init
function getConvexUrl(): string {
	return process.env.CONVEX_URL || "";
}

const GITHUB_API_BASE = "https://api.github.com";
const MIN_STARS_FOR_PUSH = 5;

// ============================================================================
// Error Types
// ============================================================================

export class SyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SyncError";
	}
}

export class NetworkError extends SyncError {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message);
		this.name = "NetworkError";
	}
}

export class AuthenticationError extends SyncError {
	constructor(message = "Authentication required. Please run 'ow auth login' first.") {
		super(message);
		this.name = "AuthenticationError";
	}
}

export class RateLimitError extends SyncError {
	constructor(message = "Rate limit exceeded. You can push up to 3 times per repo per day.") {
		super(message);
		this.name = "RateLimitError";
	}
}

export class ConflictError extends SyncError {
	constructor(
		message = "A newer analysis already exists on the server.",
		public readonly remoteCommitSha?: string,
	) {
		super(message);
		this.name = "ConflictError";
	}
}

export class PushNotAllowedError extends SyncError {
	constructor(
		message: string,
		public readonly reason: "local" | "not-github" | "low-stars",
	) {
		super(message);
		this.name = "PushNotAllowedError";
	}
}

// ============================================================================
// Types
// ============================================================================

/** Analysis data structure for sync operations */
export interface AnalysisData {
	fullName: string;
	summary: string;
	architecture: Architecture;
	skill: Skill;
	fileIndex: FileIndex;
	commitSha: string;
	analyzedAt: string;
}

/** Response from pull query */
export interface PullResponse {
	fullName: string;
	summary: string;
	architecture: Architecture;
	skill: Skill;
	fileIndex: FileIndex;
	commitSha: string;
	analyzedAt: string;
}

/** Response from check query */
export interface CheckResponse {
	exists: boolean;
	commitSha?: string;
	analyzedAt?: string;
}

/** Response from push mutation */
export interface PushResponse {
	success: boolean;
	message?: string;
}

/** Staleness check result */
export interface StalenessResult {
	isStale: boolean;
	localCommitSha?: string;
	remoteCommitSha?: string;
}

/** Can push result */
export interface CanPushResult {
	allowed: boolean;
	reason?: string;
	stars?: number;
}

// ============================================================================
// Convex Client
// ============================================================================

function createClient(token?: string): ConvexHttpClient {
	const convexUrl = getConvexUrl();
	if (!convexUrl) {
		throw new SyncError(
			"CONVEX_URL not configured. " +
				"For local development, ensure apps/cli/.env contains CONVEX_URL=your_convex_url",
		);
	}
	const client = new ConvexHttpClient(convexUrl);
	if (token) client.setAuth(token);
	return client;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches analysis from the remote server
 * @param fullName - Repository full name (owner/repo)
 * @returns Analysis data or null if not found
 */
export async function pullAnalysis(fullName: string): Promise<PullResponse | null> {
	const client = createClient();
	try {
		const result = await client.query(api.analyses.pull, { fullName });
		if (!result) return null;
		// Cast to match PullResponse interface (Convex types use any for complex objects)
		return result as unknown as PullResponse;
	} catch (error) {
		throw new NetworkError(
			`Failed to pull analysis: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Pushes analysis to the remote server
 * @param analysis - Analysis data to push
 * @param token - Authentication token
 * @returns Push result
 */
export async function pushAnalysis(analysis: AnalysisData, token: string): Promise<PushResponse> {
	const client = createClient(token);
	try {
		const result = await client.mutation(api.analyses.push, {
			fullName: analysis.fullName,
			summary: analysis.summary,
			architecture: analysis.architecture,
			skill: analysis.skill,
			fileIndex: analysis.fileIndex,
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
		});

		if (!result.success) {
			if (result.error === "auth_required") {
				throw new AuthenticationError();
			}
			if (result.error === "rate_limit") {
				throw new RateLimitError();
			}
			if (result.error === "conflict") {
				throw new ConflictError(
					"A newer analysis already exists",
					"remoteCommitSha" in result ? result.remoteCommitSha : undefined,
				);
			}
		}

		return { success: true };
	} catch (error) {
		if (error instanceof SyncError) throw error;
		throw new NetworkError(
			`Failed to push analysis: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Checks if analysis exists on remote server (lightweight check)
 * @param fullName - Repository full name (owner/repo)
 * @returns Check result
 */
export async function checkRemote(fullName: string): Promise<CheckResponse> {
	const client = createClient();
	try {
		const result = await client.query(api.analyses.check, { fullName });
		if (!result.exists) {
			return { exists: false };
		}
		return {
			exists: true,
			commitSha: result.commitSha,
			analyzedAt: result.analyzedAt,
		};
	} catch (error) {
		throw new NetworkError(
			`Failed to check remote: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Compares local vs remote commit SHA to check staleness
 * @param fullName - Repository full name (owner/repo)
 * @param localCommitSha - Local commit SHA
 * @returns Staleness result
 */
export async function checkStaleness(
	fullName: string,
	localCommitSha: string,
): Promise<StalenessResult> {
	const remote = await checkRemote(fullName);

	if (!remote.exists || !remote.commitSha) {
		// No remote analysis, not stale (nothing to compare)
		return {
			isStale: false,
			localCommitSha,
			remoteCommitSha: undefined,
		};
	}

	// Stale if commit SHAs differ
	return {
		isStale: localCommitSha !== remote.commitSha,
		localCommitSha,
		remoteCommitSha: remote.commitSha,
	};
}

// ============================================================================
// Push Validation Functions
// ============================================================================

/**
 * Fetches GitHub repository stars
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Number of stars, or 0 on error
 */
export async function fetchRepoStars(owner: string, repo: string): Promise<number> {
	try {
		const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				// User-Agent required by GitHub API
				"User-Agent": "offworld-cli",
			},
		});

		if (!response.ok) {
			return 0;
		}

		const data = (await response.json()) as { stargazers_count?: number };
		return data.stargazers_count ?? 0;
	} catch {
		return 0;
	}
}

/**
 * Checks if a repository can be pushed to offworld.sh
 * V1 Restrictions:
 * - Must be a remote repository (not local)
 * - Must be hosted on GitHub (GitLab/Bitbucket coming later)
 * - Must have at least 5 stars (quality gate)
 *
 * @param source - Repository source
 * @returns Can push result
 */
export async function canPushToWeb(source: RepoSource): Promise<CanPushResult> {
	// Reject local repositories
	if (source.type === "local") {
		return {
			allowed: false,
			reason:
				"Local repositories cannot be pushed to offworld.sh. " +
				"Only remote repositories with a public URL are supported.",
		};
	}

	// Reject non-GitHub repos (V1 restriction)
	if (source.provider !== "github") {
		return {
			allowed: false,
			reason:
				`${source.provider} repositories are not yet supported. ` +
				"GitHub support only for now - GitLab and Bitbucket coming soon!",
		};
	}

	// Check star count
	const stars = await fetchRepoStars(source.owner, source.repo);

	if (stars < MIN_STARS_FOR_PUSH) {
		return {
			allowed: false,
			reason:
				`Repository has ${stars} stars, but ${MIN_STARS_FOR_PUSH}+ required for push. ` +
				"This helps ensure quality analyses on offworld.sh.",
			stars,
		};
	}

	return {
		allowed: true,
		stars,
	};
}

/**
 * Validates that a source can be pushed and throws appropriate error if not
 * @param source - Repository source
 * @throws PushNotAllowedError if push is not allowed
 */
export async function validatePushAllowed(source: RepoSource): Promise<void> {
	const result = await canPushToWeb(source);

	if (!result.allowed) {
		let reason: "local" | "not-github" | "low-stars";

		if (source.type === "local") {
			reason = "local";
		} else if (source.provider !== "github") {
			reason = "not-github";
		} else {
			reason = "low-stars";
		}

		throw new PushNotAllowedError(result.reason!, reason);
	}
}
