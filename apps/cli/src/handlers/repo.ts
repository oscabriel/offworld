import * as p from "@clack/prompts";
import {
	listRepos,
	getRepoStatus,
	updateAllRepos,
	pruneRepos,
	gcRepos,
	discoverRepos,
	getRepoRoot,
	loadConfig,
	readGlobalMap,
} from "@offworld/sdk/internal";
import { existsSync, rmSync } from "node:fs";
import { formatRepoForDisplay, type RepoListItem } from "./shared.js";

export interface RepoListOptions {
	json?: boolean;
	paths?: boolean;
	pattern?: string;
}

export type { RepoListItem };

export interface RepoListResult {
	repos: RepoListItem[];
}

export interface RepoUpdateOptions {
	all?: boolean;
	pattern?: string;
	dryRun?: boolean;
}

export interface RepoUpdateResult {
	updated: string[];
	skipped: string[];
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
	withReference: number;
	missing: number;
	diskMB: number;
}

export interface RepoGcOptions {
	olderThan?: string;
	withoutReference?: boolean;
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

export async function repoListHandler(options: RepoListOptions): Promise<RepoListResult> {
	const { json = false, paths = false, pattern } = options;

	const qualifiedNames = listRepos();
	const map = readGlobalMap();

	if (qualifiedNames.length === 0) {
		if (!json) {
			p.log.info("No repositories cloned yet.");
			p.log.info("Use 'ow pull <repo>' to clone and generate a reference.");
		}
		return { repos: [] };
	}

	const items: RepoListItem[] = [];
	for (const qName of qualifiedNames) {
		const entry = map.repos[qName];
		if (!entry) continue;
		if (pattern && !matchesPattern(qName, pattern)) continue;

		const exists = existsSync(entry.localPath);
		const hasReference = !!entry.primary;

		items.push({
			fullName: qName,
			qualifiedName: qName,
			localPath: entry.localPath,
			hasReference,
			referenceUpdatedAt: entry.updatedAt,
			exists,
		});
	}

	if (json) {
		console.log(JSON.stringify(items, null, 2));
	} else {
		if (items.length === 0) {
			if (pattern) {
				p.log.info(`No repositories matching "${pattern}".`);
			}
		} else {
			p.log.info(`Found ${items.length} repositories:\n`);
			for (const item of items) {
				console.log(formatRepoForDisplay(item, paths));
			}
		}
	}

	return { repos: items };
}

export async function repoUpdateHandler(options: RepoUpdateOptions): Promise<RepoUpdateResult> {
	const { all = false, pattern, dryRun = false } = options;

	if (!all && !pattern) {
		p.log.error("Specify --all or a pattern to update.");
		return { updated: [], skipped: [], errors: [] };
	}

	const qualifiedNames = listRepos();
	const filtered = pattern
		? qualifiedNames.filter((q) => matchesPattern(q, pattern))
		: qualifiedNames;
	const total = filtered.length;

	if (total === 0) {
		p.log.info(pattern ? `No repos matching "${pattern}"` : "No repos to update");
		return { updated: [], skipped: [], errors: [] };
	}

	let processed = 0;
	const outcomes: Array<{ repo: string; status: string; message?: string }> = [];

	const spinner = p.spinner();
	const action = "Updating";
	spinner.start(dryRun ? `Checking ${total} repos...` : `${action} ${total} repos...`);

	const result = await updateAllRepos({
		pattern,
		dryRun,
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
		withReference: status.withReference,
		missing: status.missing,
		diskMB: Math.round(status.diskBytes / (1024 * 1024)),
	};

	if (json) {
		console.log(JSON.stringify(output, null, 2));
	} else {
		p.log.info(`Managed repos: ${status.total}`);
		p.log.info(`  With reference: ${status.withReference}`);
		p.log.info(`  Missing: ${status.missing}`);
		p.log.info(`  Disk usage: ${formatBytes(status.diskBytes)}`);
	}

	return output;
}

export async function repoGcHandler(options: RepoGcOptions): Promise<RepoGcResult> {
	const { olderThan, withoutReference = false, dryRun = false, yes = false } = options;

	if (!olderThan && !withoutReference) {
		p.log.error("Specify at least one filter: --older-than or --without-reference");
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
		withoutReference,
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
			withoutReference,
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
		p.log.success(
			`Added ${result.discovered.length} repos to clone map (marked as not referenced)`,
		);
		return { discovered: result.discovered.length, alreadyIndexed: result.alreadyIndexed };
	}

	return { discovered: 0, alreadyIndexed: previewResult.alreadyIndexed };
}
