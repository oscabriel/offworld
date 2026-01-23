import { existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { RepoIndexEntry } from "@offworld/types";
import { listRepos, updateRepo, getCommitSha, GitError } from "./clone.js";
import { removeFromIndex, getIndex, updateIndex } from "./index-manager.js";
import { getSkillPath, getMetaPath, loadConfig, getRepoRoot, toSkillDirName } from "./config.js";
import { getAllAgentConfigs } from "./agents.js";
import { expandTilde } from "./paths.js";

export interface RepoStatusSummary {
	total: number;
	analyzed: number;
	withSkill: number;
	stale: number;
	missing: number;
	diskBytes: number;
}

export interface RepoStatusOptions {
	onProgress?: (current: number, total: number, repo: string) => void;
}

export interface UpdateAllOptions {
	staleOnly?: boolean;
	pattern?: string;
	dryRun?: boolean;
	onProgress?: (
		repo: string,
		status: "updating" | "updated" | "skipped" | "error",
		message?: string,
	) => void;
}

export interface UpdateAllResult {
	updated: string[];
	skipped: string[];
	errors: Array<{ repo: string; error: string }>;
}

export interface PruneOptions {
	dryRun?: boolean;
	onProgress?: (repo: string, reason: string) => void;
}

export interface PruneResult {
	removedFromIndex: string[];
	orphanedDirs: string[];
}

export interface GcOptions {
	olderThanDays?: number;
	unanalyzed?: boolean;
	withoutSkill?: boolean;
	dryRun?: boolean;
	onProgress?: (repo: string, reason: string, sizeBytes?: number) => void;
}

export interface GcResult {
	removed: Array<{ repo: string; reason: string; sizeBytes: number }>;
	freedBytes: number;
}

function isRepoStale(entry: RepoIndexEntry): boolean {
	if (!entry.commitSha || !existsSync(entry.localPath)) {
		return false;
	}
	try {
		const currentSha = getCommitSha(entry.localPath);
		return currentSha !== entry.commitSha;
	} catch {
		return false;
	}
}

function getDirSize(dirPath: string): number {
	if (!existsSync(dirPath)) return 0;

	let size = 0;
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				size += getDirSize(fullPath);
			} else if (entry.isFile()) {
				try {
					size += statSync(fullPath).size;
				} catch {
					// Can't stat file
				}
			}
		}
	} catch {
		// Can't read directory
	}
	return size;
}

function getLastAccessTime(dirPath: string): Date | null {
	if (!existsSync(dirPath)) return null;

	let latestTime: Date | null = null;
	try {
		const stat = statSync(dirPath);
		latestTime = stat.mtime;

		const fetchHead = join(dirPath, ".git", "FETCH_HEAD");
		if (existsSync(fetchHead)) {
			const fetchStat = statSync(fetchHead);
			if (!latestTime || fetchStat.mtime > latestTime) {
				latestTime = fetchStat.mtime;
			}
		}
	} catch {
		// Can't stat
	}
	return latestTime;
}

function matchesPattern(name: string, pattern: string): boolean {
	if (!pattern || pattern === "*") return true;

	const regex = new RegExp(
		"^" +
			pattern
				.replace(/[.+^${}()|[\]\\]/g, "\\$&")
				.replace(/\*/g, ".*")
				.replace(/\?/g, ".") +
			"$",
		"i",
	);
	return regex.test(name);
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

export async function getRepoStatus(options: RepoStatusOptions = {}): Promise<RepoStatusSummary> {
	const { onProgress } = options;
	const repos = listRepos();
	const total = repos.length;

	let analyzed = 0;
	let withSkill = 0;
	let stale = 0;
	let missing = 0;
	let diskBytes = 0;

	for (let i = 0; i < repos.length; i++) {
		const repo = repos[i]!;
		onProgress?.(i + 1, total, repo.fullName);

		// Yield to event loop to allow Ctrl+C
		await yieldToEventLoop();

		const exists = existsSync(repo.localPath);

		if (!exists) {
			missing++;
			continue;
		}

		if (repo.analyzedAt) {
			analyzed++;
		}

		if (repo.hasSkill) {
			withSkill++;
		}

		if (isRepoStale(repo)) {
			stale++;
		}

		diskBytes += getDirSize(repo.localPath);
	}

	return {
		total,
		analyzed,
		withSkill,
		stale,
		missing,
		diskBytes,
	};
}

export async function updateAllRepos(options: UpdateAllOptions = {}): Promise<UpdateAllResult> {
	const { staleOnly = false, pattern, dryRun = false, onProgress } = options;

	const repos = listRepos();
	const updated: string[] = [];
	const skipped: string[] = [];
	const errors: Array<{ repo: string; error: string }> = [];

	for (const repo of repos) {
		if (pattern && !matchesPattern(repo.fullName, pattern)) {
			continue;
		}

		if (!existsSync(repo.localPath)) {
			skipped.push(repo.qualifiedName);
			onProgress?.(repo.fullName, "skipped", "missing on disk");
			continue;
		}

		if (staleOnly && !isRepoStale(repo)) {
			skipped.push(repo.qualifiedName);
			onProgress?.(repo.fullName, "skipped", "up to date");
			continue;
		}

		if (dryRun) {
			updated.push(repo.qualifiedName);
			onProgress?.(repo.fullName, "updated", "would update");
			continue;
		}

		onProgress?.(repo.fullName, "updating");
		try {
			const result = await updateRepo(repo.qualifiedName);
			if (result.updated) {
				updated.push(repo.qualifiedName);
				onProgress?.(
					repo.fullName,
					"updated",
					`${result.previousSha.slice(0, 7)} → ${result.currentSha.slice(0, 7)}`,
				);
			} else {
				skipped.push(repo.qualifiedName);
				onProgress?.(repo.fullName, "skipped", "already up to date");
			}
		} catch (err) {
			const message = err instanceof GitError ? err.message : String(err);
			errors.push({ repo: repo.qualifiedName, error: message });
			onProgress?.(repo.fullName, "error", message);
		}
	}

	return { updated, skipped, errors };
}

export async function pruneRepos(options: PruneOptions = {}): Promise<PruneResult> {
	const { dryRun = false, onProgress } = options;

	const repos = listRepos();
	const removedFromIndex: string[] = [];
	const orphanedDirs: string[] = [];

	for (const repo of repos) {
		await yieldToEventLoop();

		if (!existsSync(repo.localPath)) {
			onProgress?.(repo.fullName, "missing on disk");
			removedFromIndex.push(repo.qualifiedName);

			if (!dryRun) {
				removeFromIndex(repo.qualifiedName);
			}
		}
	}

	const config = loadConfig();
	const repoRoot = getRepoRoot(config);

	if (existsSync(repoRoot)) {
		const index = getIndex();
		const indexedPaths = new Set(Object.values(index.repos).map((r) => r.localPath));

		try {
			const providers = readdirSync(repoRoot, { withFileTypes: true });
			for (const provider of providers) {
				if (!provider.isDirectory()) continue;
				const providerPath = join(repoRoot, provider.name);

				const owners = readdirSync(providerPath, { withFileTypes: true });
				for (const owner of owners) {
					if (!owner.isDirectory()) continue;
					const ownerPath = join(providerPath, owner.name);

					const repoNames = readdirSync(ownerPath, { withFileTypes: true });
					for (const repoName of repoNames) {
						await yieldToEventLoop();

						if (!repoName.isDirectory()) continue;
						const repoPath = join(ownerPath, repoName.name);

						if (!existsSync(join(repoPath, ".git"))) continue;

						if (!indexedPaths.has(repoPath)) {
							const fullName = `${owner.name}/${repoName.name}`;
							onProgress?.(fullName, "not in index");
							orphanedDirs.push(repoPath);
						}
					}
				}
			}
		} catch {
			// Can't read repo root
		}
	}

	return { removedFromIndex, orphanedDirs };
}

export async function gcRepos(options: GcOptions = {}): Promise<GcResult> {
	const {
		olderThanDays,
		unanalyzed = false,
		withoutSkill = false,
		dryRun = false,
		onProgress,
	} = options;

	const repos = listRepos();
	const removed: Array<{ repo: string; reason: string; sizeBytes: number }> = [];
	let freedBytes = 0;

	const now = new Date();
	const cutoffDate = olderThanDays
		? new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000)
		: null;

	for (const repo of repos) {
		await yieldToEventLoop();

		if (!existsSync(repo.localPath)) continue;

		let shouldRemove = false;
		let reason = "";

		if (cutoffDate) {
			const lastAccess = getLastAccessTime(repo.localPath);
			if (lastAccess && lastAccess < cutoffDate) {
				shouldRemove = true;
				reason = `not accessed in ${olderThanDays}+ days`;
			}
		}

		if (unanalyzed && !repo.analyzedAt) {
			shouldRemove = true;
			reason = reason ? `${reason}, unanalyzed` : "unanalyzed";
		}

		if (withoutSkill && !repo.hasSkill) {
			shouldRemove = true;
			reason = reason ? `${reason}, no skill` : "no skill";
		}

		if (!shouldRemove) continue;

		const sizeBytes = getDirSize(repo.localPath);
		onProgress?.(repo.fullName, reason, sizeBytes);

		if (!dryRun) {
			rmSync(repo.localPath, { recursive: true, force: true });

			const skillPath = getSkillPath(repo.fullName);
			if (existsSync(skillPath)) {
				rmSync(skillPath, { recursive: true, force: true });
			}

			const metaPath = getMetaPath(repo.fullName);
			if (existsSync(metaPath)) {
				rmSync(metaPath, { recursive: true, force: true });
			}

			removeAgentSymlinks(repo.fullName);
			removeFromIndex(repo.qualifiedName);
		}

		removed.push({ repo: repo.qualifiedName, reason, sizeBytes });
		freedBytes += sizeBytes;
	}

	return { removed, freedBytes };
}

function removeAgentSymlinks(repoName: string): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);

	const configuredAgents = config.agents ?? [];
	for (const agentName of configuredAgents) {
		const agentConfig = getAllAgentConfigs().find((c) => c.name === agentName);
		if (agentConfig) {
			const agentSkillPath = expandTilde(join(agentConfig.globalSkillsDir, skillDirName));
			if (existsSync(agentSkillPath)) {
				rmSync(agentSkillPath, { recursive: true, force: true });
			}
		}
	}
}

export interface DiscoverOptions {
	repoRoot?: string;
	dryRun?: boolean;
	onProgress?: (repo: string, provider: string) => void;
}

export interface DiscoverResult {
	discovered: Array<{ fullName: string; qualifiedName: string; localPath: string }>;
	alreadyIndexed: number;
}

export async function discoverRepos(options: DiscoverOptions = {}): Promise<DiscoverResult> {
	const { dryRun = false, onProgress } = options;

	const config = loadConfig();
	const repoRoot = options.repoRoot ?? getRepoRoot(config);
	const discovered: Array<{ fullName: string; qualifiedName: string; localPath: string }> = [];
	let alreadyIndexed = 0;

	if (!existsSync(repoRoot)) {
		return { discovered, alreadyIndexed };
	}

	const index = getIndex();
	const indexedPaths = new Set(Object.values(index.repos).map((r) => r.localPath));

	try {
		const providers = readdirSync(repoRoot, { withFileTypes: true });
		for (const provider of providers) {
			if (!provider.isDirectory()) continue;
			const providerPath = join(repoRoot, provider.name);

			const owners = readdirSync(providerPath, { withFileTypes: true });
			for (const owner of owners) {
				if (!owner.isDirectory()) continue;
				const ownerPath = join(providerPath, owner.name);

				const repoNames = readdirSync(ownerPath, { withFileTypes: true });
				for (const repoName of repoNames) {
					await yieldToEventLoop();

					if (!repoName.isDirectory()) continue;
					const repoPath = join(ownerPath, repoName.name);

					if (!existsSync(join(repoPath, ".git"))) continue;

					if (indexedPaths.has(repoPath)) {
						alreadyIndexed++;
						continue;
					}

					const fullName = `${owner.name}/${repoName.name}`;
					const qualifiedName = `${provider.name}:${fullName}`;

					onProgress?.(fullName, provider.name);

					if (!dryRun) {
						let commitSha: string | undefined;
						try {
							commitSha = getCommitSha(repoPath);
						} catch {
							// Can't get commit SHA
						}

						const entry: RepoIndexEntry = {
							fullName,
							qualifiedName,
							localPath: repoPath,
							commitSha,
							hasSkill: false,
						};
						updateIndex(entry);
					}

					discovered.push({ fullName, qualifiedName, localPath: repoPath });
				}
			}
		}
	} catch {
		// Can't read repo root
	}

	return { discovered, alreadyIndexed };
}
