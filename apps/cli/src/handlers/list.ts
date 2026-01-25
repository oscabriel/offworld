/**
 * List command handler
 */

import * as p from "@clack/prompts";
import { listRepos } from "@offworld/sdk";
import { entryToListItem, formatRepoForDisplay, type RepoListItem } from "./shared.js";

export interface ListOptions {
	json?: boolean;
	paths?: boolean;
	stale?: boolean;
}

export interface ListResult {
	repos: RepoListItem[];
}

export type { RepoListItem };

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
		const item = await entryToListItem(entry, stale);
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
