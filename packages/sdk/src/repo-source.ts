/**
 * Repository source parsing utilities
 */

import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { basename } from "node:path";
import type { GitProvider, LocalRepoSource, RemoteRepoSource, RepoSource } from "@offworld/types";
import { expandTilde } from "./paths.js";

// Custom error types for specific failure modes
export class RepoSourceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RepoSourceError";
	}
}

export class PathNotFoundError extends RepoSourceError {
	constructor(path: string) {
		super(`Path does not exist: ${path}`);
		this.name = "PathNotFoundError";
	}
}

export class NotGitRepoError extends RepoSourceError {
	constructor(path: string) {
		super(`Directory is not a git repository: ${path}`);
		this.name = "NotGitRepoError";
	}
}

// Provider hostname mappings
const PROVIDER_HOSTS: Record<string, GitProvider> = {
	"github.com": "github",
	"gitlab.com": "gitlab",
	"bitbucket.org": "bitbucket",
};

// Regex patterns for different URL formats
const HTTPS_URL_REGEX =
	/^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/([^/]+)\/([^/]+?)(?:\.git)?$/;
const SSH_URL_REGEX = /^git@(github\.com|gitlab\.com|bitbucket\.org):([^/]+)\/([^/]+?)(?:\.git)?$/;
const SHORT_FORMAT_REGEX = /^([^/:@]+)\/([^/:@]+)$/;

/**
 * Generates a short hash of a path for local repo identification
 */
function hashPath(path: string): string {
	return createHash("sha256").update(path).digest("hex").slice(0, 12);
}

/**
 * Builds a clone URL for a remote repository
 */
function buildCloneUrl(provider: GitProvider, owner: string, repo: string): string {
	const hosts: Record<GitProvider, string> = {
		github: "github.com",
		gitlab: "gitlab.com",
		bitbucket: "bitbucket.org",
	};
	return `https://${hosts[provider]}/${owner}/${repo}.git`;
}

/**
 * Parses a remote repository from HTTPS URL format
 */
function parseHttpsUrl(input: string): RemoteRepoSource | null {
	const match = input.match(HTTPS_URL_REGEX);
	if (!match) return null;

	const [, host, owner, repo] = match;
	if (!host || !owner || !repo) return null;

	const provider = PROVIDER_HOSTS[host];
	if (!provider) return null;

	return {
		type: "remote",
		provider,
		owner,
		repo,
		fullName: `${owner}/${repo}`,
		qualifiedName: `${provider}:${owner}/${repo}`,
		cloneUrl: buildCloneUrl(provider, owner, repo),
	};
}

/**
 * Parses a remote repository from SSH URL format
 */
function parseSshUrl(input: string): RemoteRepoSource | null {
	const match = input.match(SSH_URL_REGEX);
	if (!match) return null;

	const [, host, owner, repo] = match;
	if (!host || !owner || !repo) return null;

	const provider = PROVIDER_HOSTS[host];
	if (!provider) return null;

	return {
		type: "remote",
		provider,
		owner,
		repo,
		fullName: `${owner}/${repo}`,
		qualifiedName: `${provider}:${owner}/${repo}`,
		cloneUrl: buildCloneUrl(provider, owner, repo),
	};
}

/**
 * Parses a remote repository from short format (owner/repo)
 * Defaults to GitHub as provider
 */
function parseShortFormat(input: string): RemoteRepoSource | null {
	const match = input.match(SHORT_FORMAT_REGEX);
	if (!match) return null;

	const [, owner, repo] = match;
	if (!owner || !repo) return null;

	const provider: GitProvider = "github";

	return {
		type: "remote",
		provider,
		owner,
		repo,
		fullName: `${owner}/${repo}`,
		qualifiedName: `${provider}:${owner}/${repo}`,
		cloneUrl: buildCloneUrl(provider, owner, repo),
	};
}

/**
 * Parses a local repository path
 * Validates that the path exists and contains a .git directory
 */
function parseLocalPath(input: string): LocalRepoSource {
	// Expand ~ and resolve to absolute path
	const absolutePath = resolve(expandTilde(input));

	// Check if path exists
	if (!existsSync(absolutePath)) {
		throw new PathNotFoundError(absolutePath);
	}

	// Check if it's a directory
	const stats = statSync(absolutePath);
	if (!stats.isDirectory()) {
		throw new RepoSourceError(`Path is not a directory: ${absolutePath}`);
	}

	// Check for .git directory
	const gitPath = resolve(absolutePath, ".git");
	if (!existsSync(gitPath)) {
		throw new NotGitRepoError(absolutePath);
	}

	const name = basename(absolutePath);
	const hash = hashPath(absolutePath);

	return {
		type: "local",
		path: absolutePath,
		name,
		qualifiedName: `local:${hash}`,
	};
}

/**
 * Determines if input looks like a local path
 */
function isLocalPath(input: string): boolean {
	// Starts with . (current/relative), / (absolute), or ~ (home)
	return input.startsWith(".") || input.startsWith("/") || input.startsWith("~");
}

/**
 * Parses a repository input and returns a structured RepoSource
 *
 * Supported formats:
 * - owner/repo (short format, defaults to GitHub)
 * - https://github.com/owner/repo
 * - https://gitlab.com/owner/repo
 * - https://bitbucket.org/owner/repo
 * - git@github.com:owner/repo.git (SSH format)
 * - . (current directory as local repo)
 * - /absolute/path (local repo)
 *
 * @throws PathNotFoundError if local path doesn't exist
 * @throws NotGitRepoError if local path is not a git repository
 * @throws RepoSourceError for other parsing failures
 */
export function parseRepoInput(input: string): RepoSource {
	const trimmed = input.trim();

	// Try HTTPS URL first
	const httpsResult = parseHttpsUrl(trimmed);
	if (httpsResult) return httpsResult;

	// Try SSH URL
	const sshResult = parseSshUrl(trimmed);
	if (sshResult) return sshResult;

	// Check if it looks like a local path
	if (isLocalPath(trimmed)) {
		return parseLocalPath(trimmed);
	}

	// Try short format (owner/repo) - defaults to GitHub
	const shortResult = parseShortFormat(trimmed);
	if (shortResult) return shortResult;

	throw new RepoSourceError(
		`Unable to parse repository input: ${input}. ` +
			"Expected formats: owner/repo, https://github.com/owner/repo, git@github.com:owner/repo.git, or a local path",
	);
}

export function getAnalysisPathForSource(source: RepoSource): string {
	if (source.type === "remote") {
		return `${source.owner}-${source.repo}-reference`;
	}
	return `${source.name}-reference`;
}
