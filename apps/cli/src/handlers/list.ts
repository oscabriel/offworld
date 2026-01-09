/**
 * List command handler
 * PRD 4.6: List all cloned repositories with analysis status
 */

import * as p from "@clack/prompts";
import {
	listRepos,
	getCommitSha,
	checkStaleness,
	loadConfig,
} from "@offworld/sdk";
import type { RepoIndexEntry } from "@offworld/types";
import { existsSync } from "node:fs";

export interface ListOptions {
	json?: boolean;
	paths?: boolean;
	stale?: boolean;
}

export interface ListResult {
	repos: RepoListItem[];
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

/**
 * Format a repo entry for display
 */
function formatRepoForDisplay(
	item: RepoListItem,
	showPaths: boolean
): string {
	const parts: string[] = [];

	// Name
	parts.push(item.fullName);

	// Analysis status
	if (item.analyzed) {
		parts.push("[analyzed]");
		if (item.hasSkill) {
			parts.push("[skill]");
		}
		if (item.isStale) {
			parts.push("[stale]");
		}
	} else {
		parts.push("[not analyzed]");
	}

	// Path (optional)
	if (showPaths) {
		parts.push(`(${item.localPath})`);
	}

	// Existence check
	if (!item.exists) {
		parts.push("[missing]");
	}

	return parts.join(" ");
}

/**
 * Convert index entry to list item with staleness check
 */
async function entryToListItem(
	entry: RepoIndexEntry,
	checkStale: boolean
): Promise<RepoListItem> {
	const exists = existsSync(entry.localPath);
	const analyzed = !!entry.analyzedAt;

	let isStale: boolean | undefined;

	if (checkStale && analyzed && exists && entry.commitSha) {
		try {
			const currentSha = getCommitSha(entry.localPath);
			isStale = currentSha !== entry.commitSha;
		} catch {
			// Can't determine staleness
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

/**
 * List command handler
 */
export async function listHandler(options: ListOptions): Promise<ListResult> {
	const { json = false, paths = false, stale = false } = options;

	// Get all repos from index
	const entries = listRepos();

	if (entries.length === 0) {
		if (!json) {
			p.log.info("No repositories cloned yet.");
			p.log.info("Use 'ow pull <repo>' to clone and analyze a repository.");
		}
		return { repos: [] };
	}

	// Convert entries to list items with staleness check
	const items: RepoListItem[] = [];
	for (const entry of entries) {
		const item = await entryToListItem(entry, true);
		items.push(item);
	}

	// Filter to stale only if requested
	let filteredItems = items;
	if (stale) {
		filteredItems = items.filter((item) => item.isStale === true);
	}

	// Output
	if (json) {
		console.log(JSON.stringify(filteredItems, null, 2));
	} else {
		if (filteredItems.length === 0) {
			if (stale) {
				p.log.info("No stale repositories found.");
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
