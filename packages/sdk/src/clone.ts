/**
 * Git clone and repository management utilities
 * PRD 3.3: Git operations for cloning, updating, and removing repos
 */

import { existsSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import type { Config, RemoteRepoSource, RepoIndexEntry } from "@offworld/types";
import { getMetaRoot, getRepoPath, loadConfig } from "./config.js";
import { getIndexEntry, listIndexedRepos, removeFromIndex, updateIndex } from "./index-manager.js";

// ============================================================================
// Custom Error Types
// ============================================================================

export class CloneError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CloneError";
	}
}

export class RepoExistsError extends CloneError {
	constructor(path: string) {
		super(`Repository already exists at: ${path}`);
		this.name = "RepoExistsError";
	}
}

export class RepoNotFoundError extends CloneError {
	constructor(qualifiedName: string) {
		super(`Repository not found in index: ${qualifiedName}`);
		this.name = "RepoNotFoundError";
	}
}

export class GitError extends CloneError {
	constructor(
		message: string,
		public readonly command: string,
		public readonly exitCode: number | null,
	) {
		super(`Git command failed: ${message}`);
		this.name = "GitError";
	}
}

// ============================================================================
// Clone Options
// ============================================================================

export interface CloneOptions {
	/** Use shallow clone (--depth 1) */
	shallow?: boolean;
	/** Clone specific branch */
	branch?: string;
	/** Custom config for repo root path */
	config?: Config;
	/** Force clone even if directory exists (removes existing) */
	force?: boolean;
}

// ============================================================================
// Git Command Execution
// ============================================================================

/**
 * Execute a git command and return stdout
 */
function execGit(args: string[], cwd?: string): string {
	const command = `git ${args.join(" ")}`;
	try {
		const result = execSync(command, {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return result.trim();
	} catch (error) {
		const err = error as { status?: number; stderr?: Buffer | string; message?: string };
		const stderr = err.stderr
			? typeof err.stderr === "string"
				? err.stderr
				: err.stderr.toString()
			: err.message || "Unknown error";
		throw new GitError(stderr.trim(), command, err.status ?? null);
	}
}

/**
 * Get the current commit SHA for a repository
 */
export function getCommitSha(repoPath: string): string {
	return execGit(["rev-parse", "HEAD"], repoPath);
}

// ============================================================================
// Clone Operations
// ============================================================================

/**
 * Clone a remote repository to the local repo root.
 *
 * @param source - Remote repo source from parseRepoInput()
 * @param options - Clone options (shallow, branch, config)
 * @returns The local path where the repo was cloned
 * @throws RepoExistsError if repo already exists (unless force is true)
 * @throws GitError if clone fails
 */
export async function cloneRepo(
	source: RemoteRepoSource,
	options: CloneOptions = {},
): Promise<string> {
	const config = options.config ?? loadConfig();
	const repoPath = getRepoPath(source.fullName, source.provider, config);

	// Check if already exists
	if (existsSync(repoPath)) {
		if (options.force) {
			rmSync(repoPath, { recursive: true, force: true });
		} else {
			throw new RepoExistsError(repoPath);
		}
	}

	// Ensure parent directory exists
	const parentDir = dirname(repoPath);
	await mkdir(parentDir, { recursive: true });

	// Build git clone command
	const args = ["clone"];

	if (options.shallow) {
		args.push("--depth", "1");
	}

	if (options.branch) {
		args.push("--branch", options.branch);
	}

	args.push(source.cloneUrl, repoPath);

	// Execute clone
	execGit(args);

	// Get commit SHA for index entry
	const commitSha = getCommitSha(repoPath);

	// Update index
	const indexEntry: RepoIndexEntry = {
		fullName: source.fullName,
		qualifiedName: source.qualifiedName,
		localPath: repoPath,
		commitSha,
		hasSkill: false,
	};
	updateIndex(indexEntry);

	return repoPath;
}

// ============================================================================
// Update Operations
// ============================================================================

export interface UpdateResult {
	/** Whether any updates were fetched */
	updated: boolean;
	/** Previous commit SHA before update */
	previousSha: string;
	/** Current commit SHA after update */
	currentSha: string;
}

/**
 * Update a cloned repository by running git fetch and pull.
 *
 * @param qualifiedName - The qualified name of the repo (e.g., "github:owner/repo")
 * @returns Update result with commit SHAs
 * @throws RepoNotFoundError if repo not in index
 * @throws GitError if fetch/pull fails
 */
export async function updateRepo(qualifiedName: string): Promise<UpdateResult> {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) {
		throw new RepoNotFoundError(qualifiedName);
	}

	const repoPath = entry.localPath;

	if (!existsSync(repoPath)) {
		throw new RepoNotFoundError(qualifiedName);
	}

	// Get current SHA before update
	const previousSha = getCommitSha(repoPath);

	// Fetch and pull
	execGit(["fetch"], repoPath);
	execGit(["pull"], repoPath);

	// Get new SHA after update
	const currentSha = getCommitSha(repoPath);

	// Update index with new commit
	updateIndex({
		...entry,
		commitSha: currentSha,
	});

	return {
		updated: previousSha !== currentSha,
		previousSha,
		currentSha,
	};
}

// ============================================================================
// Remove Operations
// ============================================================================

export interface RemoveOptions {
	/** Keep skill files in skill directories */
	keepSkill?: boolean;
}

/**
 * Remove a cloned repository and its analysis data.
 *
 * @param qualifiedName - The qualified name of the repo
 * @param options - Remove options
 * @returns true if removed, false if not found
 */
export async function removeRepo(
	qualifiedName: string,
	options: RemoveOptions = {},
): Promise<boolean> {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) {
		return false;
	}

	// Remove repo directory
	if (existsSync(entry.localPath)) {
		rmSync(entry.localPath, { recursive: true, force: true });
	}

	// Remove analysis directory
	const analysisPath = join(
		getMetaRoot(),
		"analyses",
		getAnalysisPathFromQualifiedName(qualifiedName),
	);
	if (existsSync(analysisPath)) {
		rmSync(analysisPath, { recursive: true, force: true });
	}

	// Optionally remove skill files
	if (!options.keepSkill && entry.hasSkill) {
		removeSkillFiles(entry.fullName);
	}

	// Remove from index
	removeFromIndex(qualifiedName);

	return true;
}

/**
 * Derive analysis path suffix from qualified name
 */
function getAnalysisPathFromQualifiedName(qualifiedName: string): string {
	// Format: "provider:owner/repo" or "local:hash"
	if (qualifiedName.startsWith("local:")) {
		const hash = qualifiedName.replace("local:", "");
		return `local--${hash}`;
	}

	// Remote: "github:owner/repo" -> "github--owner--repo"
	const [provider, fullName] = qualifiedName.split(":");
	const [owner, repo] = fullName?.split("/") ?? [];
	return `${provider}--${owner}--${repo}`;
}

/**
 * Remove skill files from skill directories
 */
function removeSkillFiles(repoName: string): void {
	const config = loadConfig();
	const skillDirs = [
		join(config.skillDir, repoName),
		join(getMetaRoot().replace(".ow", ".claude"), "skills", repoName),
	];

	for (const skillDir of skillDirs) {
		// Expand ~ in skillDir
		const expanded = skillDir.startsWith("~/")
			? join(process.env.HOME || "", skillDir.slice(2))
			: skillDir;

		if (existsSync(expanded)) {
			rmSync(expanded, { recursive: true, force: true });
		}
	}
}

// ============================================================================
// List Operations
// ============================================================================

/**
 * List all cloned repositories from the index.
 *
 * @returns Array of repo index entries
 */
export function listRepos(): RepoIndexEntry[] {
	return listIndexedRepos();
}

/**
 * Check if a repository is cloned and in the index.
 *
 * @param qualifiedName - The qualified name of the repo
 * @returns true if repo exists in index and on disk
 */
export function isRepoCloned(qualifiedName: string): boolean {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) return false;
	return existsSync(entry.localPath);
}

/**
 * Get the local path for a cloned repository.
 *
 * @param qualifiedName - The qualified name of the repo
 * @returns The local path or undefined if not cloned
 */
export function getClonedRepoPath(qualifiedName: string): string | undefined {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) return undefined;
	if (!existsSync(entry.localPath)) return undefined;
	return entry.localPath;
}
