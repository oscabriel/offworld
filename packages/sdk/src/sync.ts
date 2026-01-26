/**
 * Sync utilities for CLI-Convex communication
 * Uses ConvexHttpClient for direct type-safe API calls
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@offworld/backend/api";
import { toSkillDirName } from "./config.js";
import type { RepoSource } from "@offworld/types";

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

export class CommitExistsError extends SyncError {
	constructor(message = "A skill already exists for this commit SHA.") {
		super(message);
		this.name = "CommitExistsError";
	}
}

export class InvalidInputError extends SyncError {
	constructor(message: string) {
		super(message);
		this.name = "InvalidInputError";
	}
}

export class InvalidSkillError extends SyncError {
	constructor(message: string) {
		super(message);
		this.name = "InvalidSkillError";
	}
}

export class RepoNotFoundError extends SyncError {
	constructor(message = "Repository not found on GitHub.") {
		super(message);
		this.name = "RepoNotFoundError";
	}
}

export class LowStarsError extends SyncError {
	constructor(message = "Repository has less than 5 stars.") {
		super(message);
		this.name = "LowStarsError";
	}
}

export class PrivateRepoError extends SyncError {
	constructor(message = "Private repositories are not supported.") {
		super(message);
		this.name = "PrivateRepoError";
	}
}

export class CommitNotFoundError extends SyncError {
	constructor(message = "Commit not found in repository.") {
		super(message);
		this.name = "CommitNotFoundError";
	}
}

export class GitHubError extends SyncError {
	constructor(message = "GitHub API error.") {
		super(message);
		this.name = "GitHubError";
	}
}

export class PushNotAllowedError extends SyncError {
	constructor(
		message: string,
		public readonly reason: "local" | "not-github",
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
	skillName: string;
	skillDescription: string;
	skillContent: string;
	commitSha: string;
	analyzedAt: string;
}

/** Response from pull query */
export interface PullResponse {
	fullName: string;
	skillName: string;
	skillDescription: string;
	skillContent: string;
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
		let result = await client.query(api.analyses.pull, {
			fullName,
			skillName: toSkillDirName(fullName),
		});
		if (!result) {
			result = await client.query(api.analyses.pull, { fullName });
		}
		if (!result) return null;

		client
			.mutation(api.analyses.recordPull, { fullName, skillName: result.skillName })
			.catch(() => {});

		return result as unknown as PullResponse;
	} catch (error) {
		throw new NetworkError(
			`Failed to pull analysis: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Fetches a specific skill by name from the remote server
 * @param fullName - Repository full name (owner/repo)
 * @param skillName - Specific skill name to pull
 * @returns Analysis data or null if not found
 */
export async function pullAnalysisByName(
	fullName: string,
	skillName: string,
): Promise<PullResponse | null> {
	const client = createClient();
	try {
		const result = await client.query(api.analyses.pull, { fullName, skillName });
		if (!result) return null;

		client.mutation(api.analyses.recordPull, { fullName, skillName }).catch(() => {});

		return result as unknown as PullResponse;
	} catch (error) {
		throw new NetworkError(
			`Failed to pull analysis: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Pushes analysis to the remote server
 * All validation happens server-side
 * @param analysis - Analysis data to push
 * @param token - Authentication token
 * @returns Push result
 */
export async function pushAnalysis(analysis: AnalysisData, token: string): Promise<PushResponse> {
	const client = createClient(token);
	try {
		const result = await client.action(api.analyses.push, {
			fullName: analysis.fullName,
			skillName: analysis.skillName,
			skillDescription: analysis.skillDescription,
			skillContent: analysis.skillContent,
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
		});

		if (!result.success) {
			switch (result.error) {
				case "auth_required":
					throw new AuthenticationError();
				case "rate_limit":
					throw new RateLimitError("Rate limit exceeded. You can push up to 20 times per day.");
				case "commit_already_exists":
					throw new CommitExistsError(result.message);
				case "invalid_input":
					throw new InvalidInputError(result.message ?? "Invalid input");
				case "invalid_skill":
					throw new InvalidSkillError(result.message ?? "Invalid skill content");
				case "repo_not_found":
					throw new RepoNotFoundError(result.message);
				case "low_stars":
					throw new LowStarsError(result.message);
				case "private_repo":
					throw new PrivateRepoError(result.message);
				case "commit_not_found":
					throw new CommitNotFoundError(result.message);
				case "github_error":
					throw new GitHubError(result.message);
				default:
					throw new SyncError(result.message ?? "Unknown error");
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
		let result = await client.query(api.analyses.check, {
			fullName,
			skillName: toSkillDirName(fullName),
		});
		if (!result.exists) {
			result = await client.query(api.analyses.check, { fullName });
		}
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
 * Checks if a specific skill exists on the remote server
 * @param fullName - Repository full name (owner/repo)
 * @param skillName - Specific skill name to check
 * @returns Check result
 */
export async function checkRemoteByName(
	fullName: string,
	skillName: string,
): Promise<CheckResponse> {
	const client = createClient();
	try {
		const result = await client.query(api.analyses.check, { fullName, skillName });
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

/** GitHub repository metadata */
export interface GitHubRepoMetadata {
	stars: number;
	description?: string;
	language?: string;
	defaultBranch: string;
}

/**
 * Fetches GitHub repository metadata
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Repository metadata or null on error
 */
export async function fetchGitHubMetadata(
	owner: string,
	repo: string,
): Promise<GitHubRepoMetadata | null> {
	try {
		const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "offworld-cli",
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as {
			stargazers_count?: number;
			description?: string | null;
			language?: string | null;
			default_branch?: string;
		};

		return {
			stars: data.stargazers_count ?? 0,
			description: data.description ?? undefined,
			language: data.language ?? undefined,
			defaultBranch: data.default_branch ?? "main",
		};
	} catch {
		return null;
	}
}

/**
 * Fetches GitHub repository stars
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Number of stars, or 0 on error
 */
export async function fetchRepoStars(owner: string, repo: string): Promise<number> {
	const metadata = await fetchGitHubMetadata(owner, repo);
	return metadata?.stars ?? 0;
}

/**
 * Checks if a repository can be pushed to offworld.sh (client-side quick checks)
 * Note: Star count and other validations happen server-side
 *
 * @param source - Repository source
 * @returns Can push result
 */
export function canPushToWeb(source: RepoSource): CanPushResult {
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

	// Star count and other validations happen server-side
	return {
		allowed: true,
	};
}

/**
 * Validates that a source can be pushed and throws appropriate error if not
 * Note: This only does quick client-side checks. Full validation happens server-side.
 * @param source - Repository source
 * @throws PushNotAllowedError if push is not allowed
 */
export function validatePushAllowed(source: RepoSource): void {
	const result = canPushToWeb(source);

	if (!result.allowed) {
		const reason: "local" | "not-github" = source.type === "local" ? "local" : "not-github";

		throw new PushNotAllowedError(result.reason!, reason);
	}
}
