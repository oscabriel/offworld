/**
 * Sync utilities for CLI-Convex communication
 * PRD 3.14: Implements pull/push/check for remote analysis storage
 */

import type { Architecture, FileIndex, RepoSource, Skill } from "@offworld/types";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_API_BASE = "https://offworld.sh";
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

/** Response from /api/analyses/pull */
export interface PullResponse {
	fullName: string;
	summary: string;
	architecture: Architecture;
	skill: Skill;
	fileIndex: FileIndex;
	commitSha: string;
	analyzedAt: string;
	pullCount: number;
}

/** Response from /api/analyses/check */
export interface CheckResponse {
	exists: boolean;
	commitSha?: string;
	analyzedAt?: string;
}

/** Response from /api/analyses/push */
export interface PushResponse {
	success: boolean;
	message?: string;
}

/** Options for sync operations */
export interface SyncOptions {
	apiBase?: string;
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
// API Functions
// ============================================================================

/**
 * Fetches analysis from the remote server
 * @param fullName - Repository full name (owner/repo)
 * @param options - Sync options
 * @returns Analysis data or null if not found
 */
export async function pullAnalysis(
	fullName: string,
	options: SyncOptions = {},
): Promise<PullResponse | null> {
	const apiBase = options.apiBase ?? DEFAULT_API_BASE;
	const url = `${apiBase}/api/analyses/pull`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ fullName }),
		});

		if (response.status === 404) {
			return null;
		}

		if (response.status === 400) {
			const errorData = (await response.json()) as { message?: string };
			throw new SyncError(errorData.message || "Invalid request");
		}

		if (!response.ok) {
			throw new NetworkError(`Failed to pull analysis: ${response.statusText}`, response.status);
		}

		return (await response.json()) as PullResponse;
	} catch (error) {
		if (error instanceof SyncError) throw error;
		throw new NetworkError(
			`Failed to connect to ${apiBase}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Pushes analysis to the remote server
 * @param analysis - Analysis data to push
 * @param token - Authentication token
 * @param options - Sync options
 * @returns Push result
 */
export async function pushAnalysis(
	analysis: AnalysisData,
	token: string,
	options: SyncOptions = {},
): Promise<PushResponse> {
	const apiBase = options.apiBase ?? DEFAULT_API_BASE;
	const url = `${apiBase}/api/analyses/push`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(analysis),
		});

		if (response.status === 401) {
			throw new AuthenticationError();
		}

		if (response.status === 429) {
			throw new RateLimitError();
		}

		if (response.status === 409) {
			const errorData = (await response.json()) as { message?: string; remoteCommitSha?: string };
			throw new ConflictError(errorData.message, errorData.remoteCommitSha);
		}

		if (response.status === 400) {
			const errorData = (await response.json()) as { message?: string };
			throw new SyncError(errorData.message || "Invalid request");
		}

		if (!response.ok) {
			throw new NetworkError(`Failed to push analysis: ${response.statusText}`, response.status);
		}

		return (await response.json()) as PushResponse;
	} catch (error) {
		if (error instanceof SyncError) throw error;
		throw new NetworkError(
			`Failed to connect to ${apiBase}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Checks if analysis exists on remote server (lightweight check)
 * @param fullName - Repository full name (owner/repo)
 * @param options - Sync options
 * @returns Check result
 */
export async function checkRemote(
	fullName: string,
	options: SyncOptions = {},
): Promise<CheckResponse> {
	const apiBase = options.apiBase ?? DEFAULT_API_BASE;
	const url = `${apiBase}/api/analyses/check`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ fullName }),
		});

		if (response.status === 404) {
			return { exists: false };
		}

		if (!response.ok) {
			throw new NetworkError(`Failed to check remote: ${response.statusText}`, response.status);
		}

		return (await response.json()) as CheckResponse;
	} catch (error) {
		if (error instanceof SyncError) throw error;
		throw new NetworkError(
			`Failed to connect to ${apiBase}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Compares local vs remote commit SHA to check staleness
 * @param fullName - Repository full name (owner/repo)
 * @param localCommitSha - Local commit SHA
 * @param options - Sync options
 * @returns Staleness result
 */
export async function checkStaleness(
	fullName: string,
	localCommitSha: string,
	options: SyncOptions = {},
): Promise<StalenessResult> {
	const remote = await checkRemote(fullName, options);

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
