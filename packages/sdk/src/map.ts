/**
 * Map query helpers for fast routing without reading full map.json
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
	GlobalMap,
	GlobalMapRepoEntry,
	ProjectMap,
	ProjectMapRepoEntry,
} from "@offworld/types";
import { GlobalMapSchema, ProjectMapSchema } from "@offworld/types/schemas";
import { Paths } from "./paths.js";

// ============================================================================
// Types
// ============================================================================

export interface MapEntry {
	scope: "project" | "global";
	qualifiedName: string;
	entry: GlobalMapRepoEntry | ProjectMapRepoEntry;
}

export interface SearchResult {
	qualifiedName: string;
	fullName: string;
	localPath: string;
	primary: string;
	keywords: string[];
	score: number;
}

export interface GetMapEntryOptions {
	preferProject?: boolean;
	cwd?: string;
}

export interface SearchMapOptions {
	limit?: number;
	cwd?: string;
}

// ============================================================================
// Internal helpers
// ============================================================================

function readGlobalMapSafe(): GlobalMap | null {
	const mapPath = Paths.offworldGlobalMapPath;
	if (!existsSync(mapPath)) return null;

	try {
		const content = readFileSync(mapPath, "utf-8");
		return GlobalMapSchema.parse(JSON.parse(content));
	} catch {
		return null;
	}
}

function readProjectMapSafe(cwd: string): ProjectMap | null {
	const mapPath = resolve(cwd, ".offworld/map.json");
	if (!existsSync(mapPath)) return null;

	try {
		const content = readFileSync(mapPath, "utf-8");
		return ProjectMapSchema.parse(JSON.parse(content));
	} catch {
		return null;
	}
}

/**
 * Normalize input to match against repo keys.
 * Accepts: github.com:owner/repo, owner/repo, repo
 */
function normalizeInput(input: string): { provider?: string; fullName: string; repoName: string } {
	const trimmed = input.trim().toLowerCase();

	// Handle provider:owner/repo format (e.g., github.com:tanstack/query)
	if (trimmed.includes(":")) {
		const parts = trimmed.split(":", 2);
		const provider = parts[0];
		const fullName = parts[1] ?? "";
		const repoName = fullName.split("/").pop() ?? fullName;
		return { provider, fullName, repoName };
	}

	// Handle owner/repo format
	if (trimmed.includes("/")) {
		const repoName = trimmed.split("/").pop() ?? trimmed;
		return { fullName: trimmed, repoName };
	}

	// Just repo name
	return { fullName: trimmed, repoName: trimmed };
}

/**
 * Tokenize a string for search matching.
 * Lowercase, strip @, split on /_- and whitespace.
 */
function tokenize(str: string): string[] {
	return str
		.toLowerCase()
		.replace(/@/g, "")
		.split(/[/_\-\s]+/)
		.filter(Boolean);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve an input string to a qualified repo key in a map.
 *
 * @param input - Accepts github.com:owner/repo, owner/repo, or repo name
 * @param map - A global or project map
 * @returns The matching qualified name or null
 */
export function resolveRepoKey(input: string, map: GlobalMap | ProjectMap): string | null {
	const { provider, fullName, repoName } = normalizeInput(input);
	const keys = Object.keys(map.repos);

	// Exact match on qualified name (github.com:owner/repo)
	if (provider) {
		const qualifiedKey = `${provider}:${fullName}`;
		if (keys.includes(qualifiedKey)) {
			return qualifiedKey;
		}
	}

	// Match by fullName (owner/repo suffix after colon)
	for (const key of keys) {
		const keyFullName = key.includes(":") ? key.split(":")[1] : key;
		if (keyFullName?.toLowerCase() === fullName) {
			return key;
		}
	}

	// Match by repo name only (last segment)
	for (const key of keys) {
		const keyRepoName = key.split("/").pop()?.toLowerCase();
		if (keyRepoName === repoName) {
			return key;
		}
	}

	return null;
}

/**
 * Get a map entry for a repo, preferring project map if available.
 *
 * @param input - Repo identifier (github.com:owner/repo, owner/repo, or repo)
 * @param options - Options for lookup
 * @returns Entry with scope and qualified name, or null if not found
 */
export function getMapEntry(input: string, options: GetMapEntryOptions = {}): MapEntry | null {
	const { preferProject = true, cwd = process.cwd() } = options;

	const projectMap = preferProject ? readProjectMapSafe(cwd) : null;
	const globalMap = readGlobalMapSafe();

	// Try project map first if preferred
	if (projectMap) {
		const key = resolveRepoKey(input, projectMap);
		if (key && projectMap.repos[key]) {
			return {
				scope: "project",
				qualifiedName: key,
				entry: projectMap.repos[key],
			};
		}
	}

	// Fall back to global map
	if (globalMap) {
		const key = resolveRepoKey(input, globalMap);
		if (key && globalMap.repos[key]) {
			return {
				scope: "global",
				qualifiedName: key,
				entry: globalMap.repos[key],
			};
		}
	}

	return null;
}

/**
 * Search the map for repos matching a term.
 *
 * Scoring:
 * - Exact fullName match: 100
 * - Keyword hit: 50 per keyword
 * - Partial contains in fullName: 25
 * - Partial contains in keywords: 10
 *
 * @param term - Search term
 * @param options - Search options
 * @returns Sorted list of matches
 */
export function searchMap(term: string, options: SearchMapOptions = {}): SearchResult[] {
	const { limit = 10 } = options;

	const globalMap = readGlobalMapSafe();
	if (!globalMap) return [];

	const termTokens = tokenize(term);
	const termLower = term.toLowerCase();
	const results: SearchResult[] = [];

	for (const qualifiedName of Object.keys(globalMap.repos)) {
		const entry = globalMap.repos[qualifiedName];
		if (!entry) continue;

		const fullName = qualifiedName.includes(":")
			? (qualifiedName.split(":")[1] ?? qualifiedName)
			: qualifiedName;
		const fullNameLower = fullName.toLowerCase();
		const keywords = entry.keywords ?? [];
		const keywordsLower = keywords.map((k) => k.toLowerCase());

		let score = 0;

		// Exact fullName match
		if (fullNameLower === termLower) {
			score += 100;
		}

		// Keyword exact hits
		for (const token of termTokens) {
			if (keywordsLower.includes(token)) {
				score += 50;
			}
		}

		// Partial contains in fullName
		if (fullNameLower.includes(termLower) && score < 100) {
			score += 25;
		}

		// Partial contains in keywords
		for (const kw of keywordsLower) {
			if (kw.includes(termLower)) {
				score += 10;
			}
		}

		// Token matching in fullName
		const fullNameTokens = tokenize(fullName);
		for (const token of termTokens) {
			if (fullNameTokens.includes(token)) {
				score += 30;
			}
		}

		if (score > 0) {
			results.push({
				qualifiedName,
				fullName,
				localPath: entry.localPath,
				primary: entry.primary,
				keywords,
				score,
			});
		}
	}

	// Sort by score descending, then alphabetically
	results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.fullName.localeCompare(b.fullName);
	});

	return results.slice(0, limit);
}

/**
 * Get the project map path if it exists in cwd.
 */
export function getProjectMapPath(cwd: string = process.cwd()): string | null {
	const mapPath = resolve(cwd, ".offworld/map.json");
	return existsSync(mapPath) ? mapPath : null;
}
