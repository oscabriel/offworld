/**
 * Index manager for global repo index
 * PRD 3.6: Global repo index management
 *
 * Manages ~/.ow/index.json which tracks all cloned repositories
 * and their analysis status.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RepoIndexSchema } from "@offworld/types";
import type { RepoIndex, RepoIndexEntry } from "@offworld/types";
import { getMetaRoot } from "./config.js";
import { VERSION } from "./constants.js";

/**
 * Returns the path to the global index file (~/.ow/index.json)
 */
export function getIndexPath(): string {
	return join(getMetaRoot(), "index.json");
}

/**
 * Reads the global repo index from ~/.ow/index.json
 * Returns empty index if file doesn't exist or is invalid
 */
export function getIndex(): RepoIndex {
	const indexPath = getIndexPath();

	if (!existsSync(indexPath)) {
		return { version: VERSION, repos: {} };
	}

	try {
		const content = readFileSync(indexPath, "utf-8");
		const data = JSON.parse(content);
		return RepoIndexSchema.parse(data);
	} catch {
		// If parsing fails, return empty index
		return { version: VERSION, repos: {} };
	}
}

/**
 * Saves the repo index to ~/.ow/index.json
 * Creates directory if it doesn't exist
 */
export function saveIndex(index: RepoIndex): void {
	const indexPath = getIndexPath();
	const indexDir = dirname(indexPath);

	// Ensure directory exists
	if (!existsSync(indexDir)) {
		mkdirSync(indexDir, { recursive: true });
	}

	// Validate and write
	const validated = RepoIndexSchema.parse(index);
	writeFileSync(indexPath, JSON.stringify(validated, null, 2), "utf-8");
}

/**
 * Adds or updates a repo entry in the index
 *
 * @param entry - The repo entry to add/update (must include qualifiedName)
 */
export function updateIndex(entry: RepoIndexEntry): void {
	const index = getIndex();

	// Update the entry keyed by qualifiedName
	index.repos[entry.qualifiedName] = entry;

	// Update version to current
	index.version = VERSION;

	saveIndex(index);
}

/**
 * Removes a repo from the index
 *
 * @param qualifiedName - The qualified name of the repo to remove
 * @returns true if repo was removed, false if not found
 */
export function removeFromIndex(qualifiedName: string): boolean {
	const index = getIndex();

	if (!(qualifiedName in index.repos)) {
		return false;
	}

	delete index.repos[qualifiedName];
	saveIndex(index);
	return true;
}

/**
 * Gets a specific repo entry from the index
 *
 * @param qualifiedName - The qualified name of the repo
 * @returns The repo entry or undefined if not found
 */
export function getIndexEntry(qualifiedName: string): RepoIndexEntry | undefined {
	const index = getIndex();
	return index.repos[qualifiedName];
}

/**
 * Lists all repos in the index
 *
 * @returns Array of all repo entries
 */
export function listIndexedRepos(): RepoIndexEntry[] {
	const index = getIndex();
	return Object.values(index.repos);
}
