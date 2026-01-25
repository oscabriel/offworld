/**
 * Git clone and repository management utilities
 */

import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import type { Config, RemoteRepoSource, RepoIndexEntry } from "@offworld/types";
import { getRepoPath, getMetaPath, getSkillPath, loadConfig, toSkillDirName } from "./config.js";
import { getIndexEntry, listIndexedRepos, removeFromIndex, updateIndex } from "./index-manager.js";
import { getAllAgentConfigs } from "./agents.js";
import { expandTilde } from "./paths.js";

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
	/** Use sparse checkout for large repos (only src/, lib/, packages/, docs/) */
	sparse?: boolean;
}

// ============================================================================
// Git Command Execution
// ============================================================================

function execGit(args: string[], cwd?: string): string {
	try {
		const result = execFileSync("git", args, {
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
		throw new GitError(stderr.trim(), `git ${args.join(" ")}`, err.status ?? null);
	}
}

function execGitAsync(args: string[], cwd?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn("git", args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		proc.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new GitError(stderr.trim() || "Unknown error", `git ${args.join(" ")}`, code));
			}
		});

		proc.on("error", (err) => {
			reject(new GitError(err.message, `git ${args.join(" ")}`, null));
		});
	});
}

/**
 * Get the current commit SHA for a repository
 */
export function getCommitSha(repoPath: string): string {
	return execGit(["rev-parse", "HEAD"], repoPath);
}

/**
 * Get the number of commits between two SHAs.
 * Returns the number of commits from `olderSha` to `newerSha`.
 * Returns null if the distance cannot be determined (e.g., shallow clone without the commit).
 *
 * @param repoPath - Path to the git repository
 * @param olderSha - The older commit SHA (e.g., remote skill's commit)
 * @param newerSha - The newer commit SHA (e.g., current HEAD), defaults to HEAD
 */
export function getCommitDistance(
	repoPath: string,
	olderSha: string,
	newerSha = "HEAD",
): number | null {
	try {
		// Check if olderSha exists in the repo (may not exist in shallow clones)
		try {
			execGit(["cat-file", "-e", olderSha], repoPath);
		} catch {
			// Commit doesn't exist locally (shallow clone) - return null
			return null;
		}

		// Count commits between olderSha and newerSha
		const count = execGit(["rev-list", "--count", `${olderSha}..${newerSha}`], repoPath);
		return Number.parseInt(count, 10);
	} catch {
		return null;
	}
}

// ============================================================================
// Clone Operations
// ============================================================================

const SPARSE_CHECKOUT_DIRS = ["src", "lib", "packages", "docs", "README.md", "package.json"];

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

	if (existsSync(repoPath)) {
		if (options.force) {
			rmSync(repoPath, { recursive: true, force: true });
		} else {
			throw new RepoExistsError(repoPath);
		}
	}

	try {
		if (options.sparse) {
			await cloneSparse(source.cloneUrl, repoPath, options);
		} else {
			await cloneStandard(source.cloneUrl, repoPath, options);
		}
	} catch (err) {
		cleanupEmptyParentDirs(repoPath);
		throw err;
	}

	const commitSha = getCommitSha(repoPath);
	const skillPath = getSkillPath(source.fullName);
	const hasExistingSkill = existsSync(join(skillPath, "SKILL.md"));

	const indexEntry: RepoIndexEntry = {
		fullName: source.fullName,
		qualifiedName: source.qualifiedName,
		localPath: repoPath,
		commitSha,
		hasSkill: hasExistingSkill,
	};
	updateIndex(indexEntry);

	return repoPath;
}

function cleanupEmptyParentDirs(repoPath: string): void {
	const ownerDir = dirname(repoPath);
	if (existsSync(ownerDir) && readdirSync(ownerDir).length === 0) {
		rmSync(ownerDir, { recursive: true, force: true });
	}
}

async function cloneStandard(
	cloneUrl: string,
	repoPath: string,
	options: CloneOptions,
): Promise<void> {
	const args = ["clone"];

	if (options.shallow) {
		args.push("--depth", "1");
	}

	if (options.branch) {
		args.push("--branch", options.branch);
	}

	args.push(cloneUrl, repoPath);
	await execGitAsync(args);
}

async function cloneSparse(
	cloneUrl: string,
	repoPath: string,
	options: CloneOptions,
): Promise<void> {
	const args = ["clone", "--filter=blob:none", "--no-checkout", "--sparse"];

	if (options.shallow) {
		args.push("--depth", "1");
	}

	if (options.branch) {
		args.push("--branch", options.branch);
	}

	args.push(cloneUrl, repoPath);
	await execGitAsync(args);

	await execGitAsync(["sparse-checkout", "set", ...SPARSE_CHECKOUT_DIRS], repoPath);
	await execGitAsync(["checkout"], repoPath);
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Check if a repository is a shallow clone.
 */
export function isShallowClone(repoPath: string): boolean {
	try {
		const result = execGit(["rev-parse", "--is-shallow-repository"], repoPath);
		return result === "true";
	} catch {
		return false;
	}
}

/**
 * Convert a shallow clone to a full clone by fetching all history.
 * Returns true if the repo was shallow and is now unshallowed.
 * Returns false if the repo was already a full clone.
 */
export async function unshallowRepo(repoPath: string): Promise<boolean> {
	if (!isShallowClone(repoPath)) {
		return false;
	}

	await execGitAsync(["fetch", "--unshallow"], repoPath);
	return true;
}

export interface UpdateResult {
	/** Whether any updates were fetched */
	updated: boolean;
	/** Previous commit SHA before update */
	previousSha: string;
	/** Current commit SHA after update */
	currentSha: string;
	/** Whether the repo was unshallowed */
	unshallowed?: boolean;
}

export interface UpdateOptions {
	/** Convert shallow clone to full clone */
	unshallow?: boolean;
}

/**
 * Update a cloned repository by running git fetch and pull.
 *
 * @param qualifiedName - The qualified name of the repo (e.g., "github:owner/repo")
 * @param options - Update options
 * @returns Update result with commit SHAs
 * @throws RepoNotFoundError if repo not in index
 * @throws GitError if fetch/pull fails
 */
export async function updateRepo(
	qualifiedName: string,
	options: UpdateOptions = {},
): Promise<UpdateResult> {
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

	// Unshallow if requested
	let unshallowed = false;
	if (options.unshallow) {
		unshallowed = await unshallowRepo(repoPath);
	}

	await execGitAsync(["fetch"], repoPath);
	await execGitAsync(["pull", "--ff-only"], repoPath);

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
		unshallowed,
	};
}

// ============================================================================
// Remove Operations
// ============================================================================

export interface RemoveOptions {
	/** Only remove skill files (keep cloned repo) */
	skillOnly?: boolean;
	/** Only remove cloned repo (keep skill files) */
	repoOnly?: boolean;
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

	const { skillOnly = false, repoOnly = false } = options;
	const removeRepoFiles = !skillOnly;
	const removeSkillFiles = !repoOnly;

	if (removeRepoFiles && existsSync(entry.localPath)) {
		rmSync(entry.localPath, { recursive: true, force: true });
		cleanupEmptyParentDirs(entry.localPath);
	}

	if (removeSkillFiles) {
		const skillPath = getSkillPath(entry.fullName);
		if (existsSync(skillPath)) {
			rmSync(skillPath, { recursive: true, force: true });
		}

		const metaPath = getMetaPath(entry.fullName);
		if (existsSync(metaPath)) {
			rmSync(metaPath, { recursive: true, force: true });
		}

		if (entry.hasSkill) {
			removeAgentSymlinks(entry.fullName);
		}
	}

	if (removeRepoFiles) {
		removeFromIndex(qualifiedName);
	} else if (removeSkillFiles) {
		updateIndex({ ...entry, hasSkill: false });
	}

	return true;
}

function removeAgentSymlinks(repoName: string): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);

	const configuredAgents = config.agents ?? [];
	for (const agentName of configuredAgents) {
		const agentConfig = getAllAgentConfigs().find((c: { name: string }) => c.name === agentName);
		if (agentConfig) {
			const agentSkillPath = expandTilde(join(agentConfig.globalSkillsDir, skillDirName));
			if (existsSync(agentSkillPath)) {
				rmSync(agentSkillPath, { recursive: true, force: true });
			}
		}
	}
}

export function removeSkillByName(repoName: string): boolean {
	const skillPath = getSkillPath(repoName);
	const metaPath = getMetaPath(repoName);
	let removed = false;

	if (existsSync(skillPath)) {
		rmSync(skillPath, { recursive: true, force: true });
		removed = true;
	}

	if (existsSync(metaPath)) {
		rmSync(metaPath, { recursive: true, force: true });
		removed = true;
	}

	removeAgentSymlinks(repoName);

	return removed;
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
