/**
 * Map command handlers for fast repo routing
 */

import * as p from "@clack/prompts";
import { getMapEntry, searchMap, Paths, type SearchResult } from "@offworld/sdk";
import type { GlobalMapRepoEntry, ProjectMapRepoEntry } from "@offworld/types";

// ============================================================================
// Map Show
// ============================================================================

export interface MapShowOptions {
	repo: string;
	json?: boolean;
	path?: boolean;
	ref?: boolean;
}

export interface MapShowResult {
	found: boolean;
	scope?: "project" | "global";
	qualifiedName?: string;
	localPath?: string;
	primary?: string;
	keywords?: string[];
}

export async function mapShowHandler(options: MapShowOptions): Promise<MapShowResult> {
	const { repo, json, path, ref } = options;

	const result = getMapEntry(repo);

	if (!result) {
		if (json) {
			console.log(JSON.stringify({ found: false }));
		} else if (!path && !ref) {
			p.log.error(`Repo not found: ${repo}`);
		}
		return { found: false };
	}

	const { scope, qualifiedName, entry } = result;

	// Get primary reference - structure differs between global and project maps
	const primary =
		"primary" in entry
			? (entry as GlobalMapRepoEntry).primary
			: (entry as ProjectMapRepoEntry).reference;

	// Get keywords
	const keywords = entry.keywords ?? [];

	// Build full reference path
	const refPath = `${Paths.offworldReferencesDir}/${primary}`;

	// Output based on flags
	if (path) {
		console.log(entry.localPath);
		return {
			found: true,
			scope,
			qualifiedName,
			localPath: entry.localPath,
			primary,
			keywords,
		};
	}

	if (ref) {
		console.log(refPath);
		return {
			found: true,
			scope,
			qualifiedName,
			localPath: entry.localPath,
			primary,
			keywords,
		};
	}

	if (json) {
		console.log(
			JSON.stringify(
				{
					found: true,
					scope,
					qualifiedName,
					localPath: entry.localPath,
					primary,
					referencePath: refPath,
					keywords,
				},
				null,
				2,
			),
		);
	} else {
		console.log(`Repo:      ${qualifiedName}`);
		console.log(`Scope:     ${scope}`);
		console.log(`Path:      ${entry.localPath}`);
		console.log(`Reference: ${refPath}`);
		if (keywords.length > 0) {
			console.log(`Keywords:  ${keywords.join(", ")}`);
		}
	}

	return {
		found: true,
		scope,
		qualifiedName,
		localPath: entry.localPath,
		primary,
		keywords,
	};
}

// ============================================================================
// Map Search
// ============================================================================

export interface MapSearchOptions {
	term: string;
	limit?: number;
	json?: boolean;
}

export interface MapSearchResult {
	results: SearchResult[];
}

export async function mapSearchHandler(options: MapSearchOptions): Promise<MapSearchResult> {
	const { term, limit = 10, json } = options;

	const results = searchMap(term, { limit });

	if (json) {
		console.log(JSON.stringify(results, null, 2));
	} else if (results.length === 0) {
		p.log.warn(`No matches found for: ${term}`);
	} else {
		for (const r of results) {
			const refPath = `${Paths.offworldReferencesDir}/${r.primary}`;
			console.log(`${r.fullName}`);
			console.log(`  path: ${r.localPath}`);
			console.log(`  ref:  ${refPath}`);
			if (r.keywords.length > 0) {
				console.log(`  keywords: ${r.keywords.join(", ")}`);
			}
			console.log("");
		}
	}

	return { results };
}
