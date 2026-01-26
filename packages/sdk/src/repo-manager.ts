import { existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { updateRepo, GitError } from "./clone.js";
import { readGlobalMap, removeGlobalMapEntry, upsertGlobalMapEntry } from "./index-manager.js";
import { getMetaPath, loadConfig, getRepoRoot } from "./config.js";
import { Paths } from "./paths.js";

export interface RepoStatusSummary {
	total: number;
	withReference: number;
	missing: number;
	diskBytes: number;
}

export interface RepoStatusOptions {
	onProgress?: (current: number, total: number, repo: string) => void;
}

export interface UpdateAllOptions {
	pattern?: string;
	dryRun?: boolean;
	/** Convert shallow clones to full clones */
	unshallow?: boolean;
	onProgress?: (
		repo: string,
		status: "updating" | "updated" | "skipped" | "error" | "unshallowed",
		message?: string,
	) => void;
}

export interface UpdateAllResult {
	updated: string[];
	skipped: string[];
	unshallowed: string[];
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
	withoutReference?: boolean;
	dryRun?: boolean;
	onProgress?: (repo: string, reason: string, sizeBytes?: number) => void;
}

export interface GcResult {
	removed: Array<{ repo: string; reason: string; sizeBytes: number }>;
	freedBytes: number;
}

// Removed: stale check no longer uses commitSha in map

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
	const map = readGlobalMap();
	const qualifiedNames = Object.keys(map.repos);
	const total = qualifiedNames.length;

	let withReference = 0;
	let missing = 0;
	let diskBytes = 0;

	for (let i = 0; i < qualifiedNames.length; i++) {
		const qualifiedName = qualifiedNames[i]!;
		const entry = map.repos[qualifiedName]!;
		onProgress?.(i + 1, total, qualifiedName);

		// Yield to event loop to allow Ctrl+C
		await yieldToEventLoop();

		const exists = existsSync(entry.localPath);

		if (!exists) {
			missing++;
			continue;
		}

		if (entry.references.length > 0) {
			withReference++;
		}

		// Stale check removed (no commitSha tracking in map)

		diskBytes += getDirSize(entry.localPath);
	}

	return {
		total,
		withReference,
		missing,
		diskBytes,
	};
}

export async function updateAllRepos(options: UpdateAllOptions = {}): Promise<UpdateAllResult> {
	const { pattern, dryRun = false, unshallow = false, onProgress } = options;

	const map = readGlobalMap();
	const qualifiedNames = Object.keys(map.repos);
	const updated: string[] = [];
	const skipped: string[] = [];
	const unshallowed: string[] = [];
	const errors: Array<{ repo: string; error: string }> = [];

	for (const qualifiedName of qualifiedNames) {
		const entry = map.repos[qualifiedName]!;

		if (pattern && !matchesPattern(qualifiedName, pattern)) {
			continue;
		}

		if (!existsSync(entry.localPath)) {
			skipped.push(qualifiedName);
			onProgress?.(qualifiedName, "skipped", "missing on disk");
			continue;
		}

		if (dryRun) {
			updated.push(qualifiedName);
			onProgress?.(qualifiedName, "updated", "would update");
			continue;
		}

		onProgress?.(qualifiedName, "updating");
		try {
			const result = await updateRepo(qualifiedName, { unshallow });
			if (result.unshallowed) {
				unshallowed.push(qualifiedName);
				onProgress?.(qualifiedName, "unshallowed", "converted to full clone");
			}
			if (result.updated) {
				updated.push(qualifiedName);
				onProgress?.(
					qualifiedName,
					"updated",
					`${result.previousSha.slice(0, 7)} → ${result.currentSha.slice(0, 7)}`,
				);
			} else if (!result.unshallowed) {
				skipped.push(qualifiedName);
				onProgress?.(qualifiedName, "skipped", "already up to date");
			}
		} catch (err) {
			const message = err instanceof GitError ? err.message : String(err);
			errors.push({ repo: qualifiedName, error: message });
			onProgress?.(qualifiedName, "error", message);
		}
	}

	return { updated, skipped, unshallowed, errors };
}

export async function pruneRepos(options: PruneOptions = {}): Promise<PruneResult> {
	const { dryRun = false, onProgress } = options;

	const map = readGlobalMap();
	const qualifiedNames = Object.keys(map.repos);
	const removedFromIndex: string[] = [];
	const orphanedDirs: string[] = [];

	for (const qualifiedName of qualifiedNames) {
		const entry = map.repos[qualifiedName]!;
		await yieldToEventLoop();

		if (!existsSync(entry.localPath)) {
			onProgress?.(qualifiedName, "missing on disk");
			removedFromIndex.push(qualifiedName);

			if (!dryRun) {
				removeGlobalMapEntry(qualifiedName);
			}
		}
	}

	const config = loadConfig();
	const repoRoot = getRepoRoot(config);

	if (existsSync(repoRoot)) {
		const indexedPaths = new Set(Object.values(map.repos).map((r) => r.localPath));

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
							onProgress?.(fullName, "not in map");
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
	const { olderThanDays, withoutReference = false, dryRun = false, onProgress } = options;

	const map = readGlobalMap();
	const qualifiedNames = Object.keys(map.repos);
	const removed: Array<{ repo: string; reason: string; sizeBytes: number }> = [];
	let freedBytes = 0;

	const now = new Date();
	const cutoffDate = olderThanDays
		? new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000)
		: null;

	for (const qualifiedName of qualifiedNames) {
		const entry = map.repos[qualifiedName]!;
		await yieldToEventLoop();

		if (!existsSync(entry.localPath)) continue;

		let shouldRemove = false;
		let reason = "";

		if (cutoffDate) {
			const lastAccess = getLastAccessTime(entry.localPath);
			if (lastAccess && lastAccess < cutoffDate) {
				shouldRemove = true;
				reason = `not accessed in ${olderThanDays}+ days`;
			}
		}

		if (withoutReference && entry.references.length === 0) {
			shouldRemove = true;
			reason = reason ? `${reason}, no reference` : "no reference";
		}

		if (!shouldRemove) continue;

		const sizeBytes = getDirSize(entry.localPath);
		onProgress?.(qualifiedName, reason, sizeBytes);

		if (!dryRun) {
			// Remove repo
			rmSync(entry.localPath, { recursive: true, force: true });

			// Remove reference files
			for (const refFile of entry.references) {
				const refPath = join(Paths.offworldReferencesDir, refFile);
				if (existsSync(refPath)) {
					rmSync(refPath, { force: true });
				}
			}

			// Remove meta
			const metaPath = getMetaPath(qualifiedName);
			if (existsSync(metaPath)) {
				rmSync(metaPath, { recursive: true, force: true });
			}

			removeGlobalMapEntry(qualifiedName);
		}

		removed.push({ repo: qualifiedName, reason, sizeBytes });
		freedBytes += sizeBytes;
	}

	return { removed, freedBytes };
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

	const map = readGlobalMap();
	const indexedPaths = new Set(Object.values(map.repos).map((r) => r.localPath));

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
						// Add to map with empty references
						upsertGlobalMapEntry(qualifiedName, {
							localPath: repoPath,
							references: [],
							primary: "",
							keywords: [],
							updatedAt: new Date().toISOString(),
						});
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
