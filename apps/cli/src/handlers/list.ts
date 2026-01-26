/**
 * List command handler
 */

import * as p from "@clack/prompts";
import { listRepos } from "@offworld/sdk";
import { entryToListItem, formatRepoForDisplay, type RepoListItem } from "./shared.js";

export interface ListOptions {
	json?: boolean;
	paths?: boolean;
}

export interface ListResult {
	repos: RepoListItem[];
}

export type { RepoListItem };

/**
 * List command handler
 */
export async function listHandler(options: ListOptions): Promise<ListResult> {
	const { json = false, paths = false } = options;

	// Get all repos from index
	const entries = listRepos();

	if (entries.length === 0) {
		if (!json) {
			p.log.info("No repositories cloned yet.");
			p.log.info("Use 'ow pull <repo>' to clone and generate a reference.");
		}
		return { repos: [] };
	}

	// Convert entries to list items
	const items: RepoListItem[] = [];
	for (const entry of entries) {
		const item = await entryToListItem(entry);
		items.push(item);
	}

	// Output
	if (json) {
		console.log(JSON.stringify(items, null, 2));
	} else {
		p.log.info(`Found ${items.length} repositories:\n`);
		for (const item of items) {
			console.log(formatRepoForDisplay(item, paths));
		}
	}

	return { repos: items };
}
