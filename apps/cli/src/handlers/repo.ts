import * as p from "@clack/prompts";
import {
	listRepos,
	getCommitSha,
	getRepoStatus,
	updateAllRepos,
	pruneRepos,
	gcRepos,
	discoverRepos,
	getRepoRoot,
	loadConfig,
} from "@offworld/sdk";
import type { RepoIndexEntry } from "@offworld/types";
import { existsSync, rmSync } from "node:fs";

export interface RepoListOptions {
	json?: boolean;
	paths?: boolean;
	stale?: boolean;
	pattern?: string;
}

export interface RepoListItem {
	fullName: string;
	qualifiedName: string;
	localPath: string;
	analyzed: boolean;
	analyzedAt?: string;
	commitSha?: string;
	hasSkill: boolean;
	isStale?: boolean;
	exists: boolean;
}

export interface RepoListResult {
	repos: RepoListItem[];
}

export interface RepoUpdateOptions {
	all?: boolean;
	stale?: boolean;
	pattern?: string;
	dryRun?: boolean;
	/** Convert shallow clones to full clones */
	unshallow?: boolean;
}

export interface RepoUpdateResult {
	updated: string[];
	skipped: string[];
	unshallowed: string[];
	errors: Array<{ repo: string; error: string }>;
}

export interface RepoPruneOptions {
	dryRun?: boolean;
	yes?: boolean;
	removeOrphans?: boolean;
}

export interface RepoPruneResult {
	removedFromIndex: string[];
	orphanedDirs: string[];
	removedOrphans: string[];
}

export interface RepoStatusOptions {
	json?: boolean;
}

export interface RepoStatusResult {
	total: number;
	analyzed: number;
	withSkill: number;
	stale: number;
	missing: number;
	diskMB: number;
}

export interface RepoGcOptions {
	olderThan?: string;
	unanalyzed?: boolean;
	withoutSkill?: boolean;
	dryRun?: boolean;
	yes?: boolean;
}

export interface RepoGcResult {
	removed: Array<{ repo: string; reason: string; sizeMB: number }>;
	freedMB: number;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function parseDays(olderThan: string): number | null {
	const match = olderThan.match(/^(\d+)d$/);
	if (match?.[1]) return parseInt(match[1], 10);
	return null;
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

async function entryToListItem(entry: RepoIndexEntry, checkStale: boolean): Promise<RepoListItem> {
	const exists = existsSync(entry.localPath);
	const analyzed = !!entry.analyzedAt;

	let isStale: boolean | undefined;

	if (checkStale && analyzed && exists && entry.commitSha) {
		try {
			const currentSha = getCommitSha(entry.localPath);
			isStale = currentSha !== entry.commitSha;
		} catch {
			isStale = undefined;
		}
	}

	return {
		fullName: entry.fullName,
		qualifiedName: entry.qualifiedName,
		localPath: entry.localPath,
		analyzed,
		analyzedAt: entry.analyzedAt,
		commitSha: entry.commitSha,
		hasSkill: entry.hasSkill,
		isStale,
		exists,
	};
}

function formatRepoForDisplay(item: RepoListItem, showPaths: boolean): string {
	const parts: string[] = [item.fullName];

	if (item.analyzed) {
		parts.push("[analyzed]");
		if (item.hasSkill) parts.push("[skill]");
		if (item.isStale) parts.push("[stale]");
	} else {
		parts.push("[not analyzed]");
	}

	if (showPaths) parts.push(`(${item.localPath})`);
	if (!item.exists) parts.push("[missing]");

	return parts.join(" ");
}

export async function repoListHandler(options: RepoListOptions): Promise<RepoListResult> {
	const { json = false, paths = false, stale = false, pattern } = options;

	const entries = listRepos();

	if (entries.length === 0) {
		if (!json) {
			p.log.info("No repositories cloned yet.");
			p.log.info("Use 'ow pull <repo>' to clone and analyze a repository.");
		}
		return { repos: [] };
	}

	const items: RepoListItem[] = [];
	for (const entry of entries) {
		if (pattern && !matchesPattern(entry.fullName, pattern)) continue;
		const item = await entryToListItem(entry, stale);
		items.push(item);
	}

	let filteredItems = items;
	if (stale) {
		filteredItems = items.filter((item) => item.isStale === true);
	}

	if (json) {
		console.log(JSON.stringify(filteredItems, null, 2));
	} else {
		if (filteredItems.length === 0) {
			if (stale) {
				p.log.info("No stale repositories found.");
			} else if (pattern) {
				p.log.info(`No repositories matching "${pattern}".`);
			}
		} else {
			p.log.info(`Found ${filteredItems.length} ${stale ? "stale " : ""}repositories:\n`);
			for (const item of filteredItems) {
				console.log(formatRepoForDisplay(item, paths));
			}
		}
	}

	return { repos: filteredItems };
}

export async function repoUpdateHandler(options: RepoUpdateOptions): Promise<RepoUpdateResult> {
	const { all = false, stale = false, pattern, dryRun = false, unshallow = false } = options;

	if (!all && !stale && !pattern) {
		p.log.error("Specify --all, --stale, or a pattern to update.");
		return { updated: [], skipped: [], unshallowed: [], errors: [] };
	}

	const entries = listRepos();
	const filtered = pattern ? entries.filter((e) => matchesPattern(e.fullName, pattern)) : entries;
	const total = filtered.length;

	if (total === 0) {
		p.log.info(pattern ? `No repos matching "${pattern}"` : "No repos to update");
		return { updated: [], skipped: [], unshallowed: [], errors: [] };
	}

	let processed = 0;
	const outcomes: Array<{ repo: string; status: string; message?: string }> = [];

	const spinner = p.spinner();
	const action = unshallow ? "Unshallowing" : "Updating";
	spinner.start(dryRun ? `Checking ${total} repos...` : `${action} ${total} repos...`);

	const result = await updateAllRepos({
		staleOnly: stale,
		pattern,
		dryRun,
		unshallow,
		onProgress: (repo: string, status: string, message?: string) => {
			if (status === "updating") {
				processed++;
				spinner.message(`[${processed}/${total}] ${repo}`);
			} else {
				outcomes.push({ repo, status, message });
			}
		},
	});

	spinner.stop(dryRun ? "Dry run complete" : `${action} complete`);

	for (const { repo, status, message } of outcomes) {
		if (status === "updated") {
			p.log.success(`${repo}${message ? ` (${message})` : ""}`);
		} else if (status === "unshallowed") {
			p.log.success(`${repo}: ${message}`);
		} else if (status === "error") {
			p.log.error(`${repo}: ${message}`);
		} else if (
			status === "skipped" &&
			message !== "up to date" &&
			message !== "already up to date"
		) {
			p.log.warn(`${repo}: ${message}`);
		}
	}

	const parts: string[] = [];
	if (result.updated.length > 0)
		parts.push(`${result.updated.length} ${dryRun ? "would update" : "updated"}`);
	if (result.unshallowed.length > 0) parts.push(`${result.unshallowed.length} unshallowed`);
	if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
	if (result.errors.length > 0) parts.push(`${result.errors.length} failed`);

	if (parts.length > 0) {
		p.log.info(`Summary: ${parts.join(", ")}`);
	}

	return result;
}

export async function repoPruneHandler(options: RepoPruneOptions): Promise<RepoPruneResult> {
	const { dryRun = false, yes = false, removeOrphans = false } = options;

	const result = await pruneRepos({ dryRun: true });
	const removedOrphans: string[] = [];

	if (result.removedFromIndex.length === 0 && result.orphanedDirs.length === 0) {
		p.log.info("Nothing to prune. Index and filesystem are in sync.");
		return { removedFromIndex: [], orphanedDirs: [], removedOrphans: [] };
	}

	if (result.removedFromIndex.length > 0) {
		p.log.info(`Found ${result.removedFromIndex.length} repos in index but missing on disk:`);
		for (const repo of result.removedFromIndex) {
			console.log(`  - ${repo}`);
		}
	}

	if (result.orphanedDirs.length > 0) {
		p.log.info(`Found ${result.orphanedDirs.length} directories not in index:`);
		for (const dir of result.orphanedDirs) {
			console.log(`  - ${dir}`);
		}
	}

	if (dryRun) {
		p.log.info("Dry run - no changes made.");
		return { ...result, removedOrphans: [] };
	}

	let shouldProceed = yes;
	if (!yes) {
		const confirm = await p.confirm({ message: "Remove stale index entries?" });
		if (p.isCancel(confirm)) {
			p.log.info("Cancelled.");
			return { removedFromIndex: [], orphanedDirs: result.orphanedDirs, removedOrphans: [] };
		}
		shouldProceed = confirm;
	}

	if (shouldProceed) {
		await pruneRepos({ dryRun: false });
		p.log.success(`Removed ${result.removedFromIndex.length} stale index entries.`);
	}

	if (removeOrphans && result.orphanedDirs.length > 0) {
		let shouldRemoveOrphans = yes;
		if (!yes) {
			const confirm = await p.confirm({ message: "Also remove orphaned directories?" });
			if (!p.isCancel(confirm) && confirm) {
				shouldRemoveOrphans = true;
			}
		}

		if (shouldRemoveOrphans) {
			for (const dir of result.orphanedDirs) {
				rmSync(dir, { recursive: true, force: true });
				removedOrphans.push(dir);
			}
			p.log.success(`Removed ${removedOrphans.length} orphaned directories.`);
		}
	}

	return { ...result, removedOrphans };
}

export async function repoStatusHandler(options: RepoStatusOptions): Promise<RepoStatusResult> {
	const { json = false } = options;

	const spinner = p.spinner();
	spinner.start("Calculating repo status...");

	const status = await getRepoStatus({
		onProgress: (current, total, repo) => {
			spinner.message(`[${current}/${total}] ${repo}`);
		},
	});

	spinner.stop("Status complete");

	const output: RepoStatusResult = {
		total: status.total,
		analyzed: status.analyzed,
		withSkill: status.withSkill,
		stale: status.stale,
		missing: status.missing,
		diskMB: Math.round(status.diskBytes / (1024 * 1024)),
	};

	if (json) {
		console.log(JSON.stringify(output, null, 2));
	} else {
		p.log.info(`Managed repos: ${status.total}`);
		p.log.info(
			`  Analyzed: ${status.analyzed} (${status.total ? Math.round((status.analyzed / status.total) * 100) : 0}%)`,
		);
		p.log.info(`  With skill: ${status.withSkill}`);
		p.log.info(`  Stale: ${status.stale}`);
		p.log.info(`  Missing: ${status.missing}`);
		p.log.info(`  Disk usage: ${formatBytes(status.diskBytes)}`);
	}

	return output;
}

export async function repoGcHandler(options: RepoGcOptions): Promise<RepoGcResult> {
	const {
		olderThan,
		unanalyzed = false,
		withoutSkill = false,
		dryRun = false,
		yes = false,
	} = options;

	if (!olderThan && !unanalyzed && !withoutSkill) {
		p.log.error("Specify at least one filter: --older-than, --unanalyzed, or --without-skill");
		return { removed: [], freedMB: 0 };
	}

	let olderThanDays: number | undefined;
	if (olderThan) {
		const days = parseDays(olderThan);
		if (days === null) {
			p.log.error("Invalid --older-than format. Use e.g. '30d' for 30 days.");
			return { removed: [], freedMB: 0 };
		}
		olderThanDays = days;
	}

	const previewResult = await gcRepos({
		olderThanDays,
		unanalyzed,
		withoutSkill,
		dryRun: true,
	});

	if (previewResult.removed.length === 0) {
		p.log.info("No repos match the criteria.");
		return { removed: [], freedMB: 0 };
	}

	p.log.info(
		`Found ${previewResult.removed.length} repos to remove (${formatBytes(previewResult.freedBytes)}):`,
	);
	for (const { repo, reason, sizeBytes } of previewResult.removed) {
		console.log(`  - ${repo} (${formatBytes(sizeBytes)}) - ${reason}`);
	}

	if (dryRun) {
		p.log.info("Dry run - no changes made.");
		return {
			removed: previewResult.removed.map(
				(r: { repo: string; reason: string; sizeBytes: number }) => ({
					repo: r.repo,
					reason: r.reason,
					sizeMB: Math.round(r.sizeBytes / (1024 * 1024)),
				}),
			),
			freedMB: Math.round(previewResult.freedBytes / (1024 * 1024)),
		};
	}

	let shouldProceed = yes;
	if (!yes) {
		const confirm = await p.confirm({ message: "Proceed with removal?" });
		if (p.isCancel(confirm) || !confirm) {
			p.log.info("Cancelled.");
			return { removed: [], freedMB: 0 };
		}
		shouldProceed = true;
	}

	if (shouldProceed) {
		const result = await gcRepos({
			olderThanDays,
			unanalyzed,
			withoutSkill,
			dryRun: false,
		});

		p.log.success(
			`Removed ${result.removed.length} repos, freed ${formatBytes(result.freedBytes)}`,
		);

		return {
			removed: result.removed.map((r: { repo: string; reason: string; sizeBytes: number }) => ({
				repo: r.repo,
				reason: r.reason,
				sizeMB: Math.round(r.sizeBytes / (1024 * 1024)),
			})),
			freedMB: Math.round(result.freedBytes / (1024 * 1024)),
		};
	}

	return { removed: [], freedMB: 0 };
}

export interface RepoDiscoverOptions {
	dryRun?: boolean;
	yes?: boolean;
}

export interface RepoDiscoverResult {
	discovered: number;
	alreadyIndexed: number;
}

export async function repoDiscoverHandler(
	options: RepoDiscoverOptions,
): Promise<RepoDiscoverResult> {
	const { dryRun = false, yes = false } = options;

	const config = loadConfig();
	const repoRoot = getRepoRoot(config);

	if (!existsSync(repoRoot)) {
		p.log.error(`Repo root does not exist: ${repoRoot}`);
		return { discovered: 0, alreadyIndexed: 0 };
	}

	const previewResult = await discoverRepos({ repoRoot, dryRun: true });

	if (previewResult.discovered.length === 0) {
		if (previewResult.alreadyIndexed > 0) {
			p.log.info(`All ${previewResult.alreadyIndexed} repos already indexed.`);
		} else {
			p.log.info("No repos found to discover.");
		}
		return { discovered: 0, alreadyIndexed: previewResult.alreadyIndexed };
	}

	p.log.info(`Found ${previewResult.discovered.length} unindexed repos:`);
	for (const repo of previewResult.discovered.slice(0, 20)) {
		console.log(`  + ${repo.fullName}`);
	}
	if (previewResult.discovered.length > 20) {
		console.log(`  ... and ${previewResult.discovered.length - 20} more`);
	}

	if (dryRun) {
		p.log.info("Dry run - no changes made.");
		return {
			discovered: previewResult.discovered.length,
			alreadyIndexed: previewResult.alreadyIndexed,
		};
	}

	let shouldProceed = yes;
	if (!yes) {
		const confirm = await p.confirm({ message: "Add these repos to the index?" });
		if (p.isCancel(confirm) || !confirm) {
			p.log.info("Cancelled.");
			return { discovered: 0, alreadyIndexed: previewResult.alreadyIndexed };
		}
		shouldProceed = true;
	}

	if (shouldProceed) {
		const result = await discoverRepos({ repoRoot });
		p.log.success(`Added ${result.discovered.length} repos to index (marked as not analyzed)`);
		return { discovered: result.discovered.length, alreadyIndexed: result.alreadyIndexed };
	}

	return { discovered: 0, alreadyIndexed: previewResult.alreadyIndexed };
}
