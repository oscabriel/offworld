/**
 * Shared utilities for CLI handlers
 */

import { getCommitSha, readGlobalMap } from "@offworld/sdk";
import { existsSync } from "node:fs";

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
export function formatRepoForDisplay(item: RepoListItem, showPaths: boolean): string {
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

/**
 * Convert qualified name to list item with staleness check
 */
export async function entryToListItem(
	qualifiedName: string,
	checkStale: boolean,
): Promise<RepoListItem> {
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];

	if (!entry) {
		return {
			fullName: qualifiedName,
			qualifiedName,
			localPath: "",
			analyzed: false,
			hasSkill: false,
			isStale: false,
			exists: false,
		};
	}

	const exists = existsSync(entry.localPath);
	const analyzed = !!entry.references && entry.references.length > 0;
	const hasSkill = analyzed;

	let isStale: boolean | undefined;

	// TODO: Implement stale check based on map's updatedAt vs current commit
	if (checkStale && analyzed && exists) {
		try {
			getCommitSha(entry.localPath); // Check if repo is git-valid
			// For now, assume not stale (no commitSha in map yet)
			isStale = false;
		} catch {
			isStale = undefined;
		}
	}

	return {
		fullName: qualifiedName,
		qualifiedName,
		localPath: entry.localPath,
		analyzed,
		analyzedAt: entry.updatedAt,
		commitSha: undefined, // Map doesn't store commitSha yet
		hasSkill,
		isStale,
		exists,
	};
}
