/**
 * Shared utilities for CLI handlers
 */

import { getCommitSha } from "@offworld/sdk";
import type { RepoIndexEntry } from "@offworld/types";
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
 * Convert index entry to list item with staleness check
 */
export async function entryToListItem(
	entry: RepoIndexEntry,
	checkStale: boolean,
): Promise<RepoListItem> {
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
