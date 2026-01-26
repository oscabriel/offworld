/**
 * Shared utilities for CLI handlers
 */

import { readGlobalMap } from "@offworld/sdk";
import { existsSync } from "node:fs";

export interface RepoListItem {
	fullName: string;
	qualifiedName: string;
	localPath: string;
	hasReference: boolean;
	referenceUpdatedAt?: string;
	commitSha?: string;
	exists: boolean;
}

/**
 * Format a repo entry for display
 */
export function formatRepoForDisplay(item: RepoListItem, showPaths: boolean): string {
	const parts: string[] = [item.fullName];

	if (item.hasReference) {
		parts.push("[reference]");
	} else {
		parts.push("[no-reference]");
	}

	if (showPaths) parts.push(`(${item.localPath})`);
	if (!item.exists) parts.push("[missing]");

	return parts.join(" ");
}

/**
 * Convert qualified name to list item
 */
export async function entryToListItem(qualifiedName: string): Promise<RepoListItem> {
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];

	if (!entry) {
		return {
			fullName: qualifiedName,
			qualifiedName,
			localPath: "",
			hasReference: false,
			exists: false,
		};
	}

	const exists = existsSync(entry.localPath);
	const hasReference = !!entry.references && entry.references.length > 0;

	return {
		fullName: qualifiedName,
		qualifiedName,
		localPath: entry.localPath,
		hasReference,
		referenceUpdatedAt: entry.updatedAt,
		commitSha: undefined, // Map doesn't store commitSha yet
		exists,
	};
}
