/**
 * Git clone and repository management utilities
 */

import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import type { Config, RemoteRepoSource } from "@offworld/types";
import { getRepoPath, loadConfig, toReferenceFileName } from "./config.js";
import { readGlobalMap, upsertGlobalMapEntry, removeGlobalMapEntry } from "./index-manager.js";
import { Paths } from "./paths.js";

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

export interface CloneOptions {
	/** Deprecated: shallow clones are no longer supported */
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

export function getCommitSha(repoPath: string): string {
	return execGit(["rev-parse", "HEAD"], repoPath);
}

export function getCommitDistance(
	repoPath: string,
	olderSha: string,
	newerSha = "HEAD",
): number | null {
	try {
		try {
			execGit(["cat-file", "-e", olderSha], repoPath);
		} catch {
			return null;
		}
		const count = execGit(["rev-list", "--count", `${olderSha}..${newerSha}`], repoPath);
		return Number.parseInt(count, 10);
	} catch {
		return null;
	}
}

const SPARSE_CHECKOUT_DIRS = ["src", "lib", "packages", "docs", "README.md", "package.json"];

/**
 * Clone a remote repository to the local repo root.
 *
 * @param source - Remote repo source from parseRepoInput()
 * @param options - Clone options (branch, config)
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

	const referenceFileName = toReferenceFileName(source.fullName);
	const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
	const hasReference = existsSync(referencePath);

	upsertGlobalMapEntry(source.qualifiedName, {
		localPath: repoPath,
		references: hasReference ? [referenceFileName] : [],
		primary: hasReference ? referenceFileName : "",
		keywords: [],
		updatedAt: new Date().toISOString(),
	});

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
		throw new CloneError("Shallow clones are no longer supported. Use a full clone.");
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
		throw new CloneError("Shallow clones are no longer supported. Use a full clone.");
	}

	if (options.branch) {
		args.push("--branch", options.branch);
	}

	args.push(cloneUrl, repoPath);
	await execGitAsync(args);

	await execGitAsync(["sparse-checkout", "set", ...SPARSE_CHECKOUT_DIRS], repoPath);
	await execGitAsync(["checkout"], repoPath);
}

export interface UpdateResult {
	/** Whether any updates were fetched */
	updated: boolean;
	/** Previous commit SHA before update */
	previousSha: string;
	/** Current commit SHA after update */
	currentSha: string;
}

export interface UpdateOptions {
	/** Skip fetching/pulling updates (useful when cache is valid). */
	skipFetch?: boolean;
}

/**
 * Update a cloned repository by running git fetch and pull.
 *
 * @param qualifiedName - The qualified name of the repo (e.g., "github.com:owner/repo")
 * @param options - Update options
 * @returns Update result with commit SHAs
 * @throws RepoNotFoundError if repo not in index
 * @throws GitError if fetch/pull fails
 */
export async function updateRepo(
	qualifiedName: string,
	options: UpdateOptions = {},
): Promise<UpdateResult> {
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];
	if (!entry) {
		throw new RepoNotFoundError(qualifiedName);
	}

	const repoPath = entry.localPath;

	if (!existsSync(repoPath)) {
		throw new RepoNotFoundError(qualifiedName);
	}

	const previousSha = getCommitSha(repoPath);
	if (!options.skipFetch) {
		await execGitAsync(["fetch"], repoPath);
		await execGitAsync(["pull", "--ff-only"], repoPath);
	}

	const currentSha = options.skipFetch ? previousSha : getCommitSha(repoPath);
	upsertGlobalMapEntry(qualifiedName, {
		...entry,
		updatedAt: new Date().toISOString(),
	});

	return {
		updated: previousSha !== currentSha,
		previousSha,
		currentSha,
	};
}

export interface RemoveOptions {
	referenceOnly?: boolean;
	repoOnly?: boolean;
}

export async function removeRepo(
	qualifiedName: string,
	options: RemoveOptions = {},
): Promise<boolean> {
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];
	if (!entry) {
		return false;
	}

	const { referenceOnly = false, repoOnly = false } = options;
	const removeRepoFiles = !referenceOnly;
	const removeReferenceFiles = !repoOnly;

	if (removeRepoFiles && existsSync(entry.localPath)) {
		rmSync(entry.localPath, { recursive: true, force: true });
		cleanupEmptyParentDirs(entry.localPath);
	}

	if (removeReferenceFiles) {
		for (const referenceFileName of entry.references) {
			const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
			if (existsSync(referencePath)) {
				rmSync(referencePath, { force: true });
			}
		}

		if (entry.primary) {
			const metaDirName = entry.primary.replace(/\.md$/, "");
			const metaPath = join(Paths.metaDir, metaDirName);
			if (existsSync(metaPath)) {
				rmSync(metaPath, { recursive: true, force: true });
			}
		}
	}

	if (removeRepoFiles) {
		removeGlobalMapEntry(qualifiedName);
	} else if (removeReferenceFiles) {
		upsertGlobalMapEntry(qualifiedName, {
			...entry,
			references: [],
			primary: "",
		});
	}

	return true;
}

export function listRepos(): string[] {
	const map = readGlobalMap();
	return Object.keys(map.repos);
}

export function isRepoCloned(qualifiedName: string): boolean {
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];
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
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];
	if (!entry) return undefined;
	if (!existsSync(entry.localPath)) return undefined;
	return entry.localPath;
}
