/**
 * Sync utilities for CLI-Convex communication
 * Uses ConvexHttpClient for direct type-safe API calls
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@offworld/backend/api";
import { toReferenceName } from "./config.js";
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
		message = "A newer reference already exists on the server.",
		public readonly remoteCommitSha?: string,
	) {
		super(message);
		this.name = "ConflictError";
	}
}

export class CommitExistsError extends SyncError {
	constructor(message = "A reference already exists for this commit SHA.") {
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

export class InvalidReferenceError extends SyncError {
	constructor(message: string) {
		super(message);
		this.name = "InvalidReferenceError";
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

/** Reference data structure for sync operations */
export interface ReferenceData {
	fullName: string;
	referenceName: string;
	referenceDescription: string;
	referenceContent: string;
	commitSha: string;
	generatedAt: string;
}

/** Response from pull query */
export interface PullResponse {
	fullName: string;
	referenceName: string;
	referenceDescription: string;
	referenceContent: string;
	commitSha: string;
	generatedAt: string;
}

/** Response from check query */
export interface CheckResponse {
	exists: boolean;
	commitSha?: string;
	generatedAt?: string;
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
 * Fetches reference from the remote server
 * @param fullName - Repository full name (owner/repo)
 * @returns Reference data or null if not found
 */
export async function pullReference(fullName: string): Promise<PullResponse | null> {
	const client = createClient();
	try {
		let result = await client.query(api.references.pull, {
			fullName,
			referenceName: toReferenceName(fullName),
		});
		if (!result) {
			result = await client.query(api.references.pull, { fullName });
		}
		if (!result) return null;

		client
			.mutation(api.references.recordPull, { fullName, referenceName: result.referenceName })
			.catch(() => {});

		return {
			fullName: result.fullName,
			referenceName: result.referenceName,
			referenceDescription: result.referenceDescription,
			referenceContent: result.referenceContent,
			commitSha: result.commitSha,
			generatedAt: result.generatedAt,
		};
	} catch (error) {
		throw new NetworkError(
			`Failed to pull reference: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Fetches a specific reference by name from the remote server
 * @param fullName - Repository full name (owner/repo)
 * @param referenceName - Specific reference name to pull
 * @returns Reference data or null if not found
 */
export async function pullReferenceByName(
	fullName: string,
	referenceName: string,
): Promise<PullResponse | null> {
	const client = createClient();
	try {
		const result = await client.query(api.references.pull, { fullName, referenceName });
		if (!result) return null;

		client.mutation(api.references.recordPull, { fullName, referenceName }).catch(() => {});

		return {
			fullName: result.fullName,
			referenceName: result.referenceName,
			referenceDescription: result.referenceDescription,
			referenceContent: result.referenceContent,
			commitSha: result.commitSha,
			generatedAt: result.generatedAt,
		};
	} catch (error) {
		throw new NetworkError(
			`Failed to pull reference: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Pushes reference to the remote server
 * All validation happens server-side
 * @param reference - Reference data to push
 * @param token - Authentication token
 * @returns Push result
 */
export async function pushReference(
	reference: ReferenceData,
	token: string,
): Promise<PushResponse> {
	const client = createClient(token);
	try {
		const result = await client.action(api.references.push, {
			fullName: reference.fullName,
			referenceName: reference.referenceName,
			referenceDescription: reference.referenceDescription,
			referenceContent: reference.referenceContent,
			commitSha: reference.commitSha,
			generatedAt: reference.generatedAt,
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
				case "invalid_reference":
					throw new InvalidReferenceError(result.message ?? "Invalid reference content");
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
			`Failed to push reference: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Checks if reference exists on remote server (lightweight check)
 * @param fullName - Repository full name (owner/repo)
 * @returns Check result
 */
export async function checkRemote(fullName: string): Promise<CheckResponse> {
	const client = createClient();
	try {
		let result = await client.query(api.references.check, {
			fullName,
			referenceName: toReferenceName(fullName),
		});
		if (!result.exists) {
			result = await client.query(api.references.check, { fullName });
		}
		if (!result.exists) {
			return { exists: false };
		}
		return {
			exists: true,
			commitSha: result.commitSha,
			generatedAt: result.generatedAt,
		};
	} catch (error) {
		throw new NetworkError(
			`Failed to check remote: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Checks if a specific reference exists on the remote server
 * @param fullName - Repository full name (owner/repo)
 * @param referenceName - Specific reference name to check
 * @returns Check result
 */
export async function checkRemoteByName(
	fullName: string,
	referenceName: string,
): Promise<CheckResponse> {
	const client = createClient();
	try {
		const result = await client.query(api.references.check, { fullName, referenceName });
		if (!result.exists) {
			return { exists: false };
		}
		return {
			exists: true,
			commitSha: result.commitSha,
			generatedAt: result.generatedAt,
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
		// No remote reference, not stale (nothing to compare)
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
