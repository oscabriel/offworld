/**
 * Shared utilities for CLI handlers
 */

import { readGlobalMap } from "@offworld/sdk/internal";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

function normalizeKeywords(values: string[]): string[] {
	const seen = new Set<string>();
	for (const value of values) {
		const normalized = value.trim().toLowerCase();
		if (normalized.length < 2) continue;
		seen.add(normalized);
	}
	return Array.from(seen);
}

function deriveMinimalKeywords(fullName: string): string[] {
	const normalized = fullName.trim().toLowerCase();
	if (!normalized) return [];
	const repoName = normalized.split("/").pop() ?? normalized;
	return normalizeKeywords([normalized, repoName]);
}

function readPackageName(repoPath: string): string | null {
	const packageJsonPath = join(repoPath, "package.json");
	if (!existsSync(packageJsonPath)) return null;

	try {
		const content = readFileSync(packageJsonPath, "utf-8");
		const json = JSON.parse(content) as { name?: unknown };
		return typeof json.name === "string" ? json.name : null;
	} catch {
		return null;
	}
}

async function fetchNpmKeywords(packageName: string): Promise<string[]> {
	try {
		const response = await fetch(`https://registry.npmjs.org/${packageName}`);
		if (!response.ok) return [];

		const json = (await response.json()) as { keywords?: unknown };
		if (!Array.isArray(json.keywords)) return [];

		return normalizeKeywords(
			json.keywords.filter((value): value is string => typeof value === "string"),
		);
	} catch {
		return [];
	}
}

export async function resolveReferenceKeywordsForRepo(
	repoPath: string,
	fullName: string,
): Promise<string[]> {
	const packageName = readPackageName(repoPath);
	if (!packageName) return deriveMinimalKeywords(fullName);

	const npmKeywords = await fetchNpmKeywords(packageName);
	if (npmKeywords.length > 0) {
		return normalizeKeywords([packageName, ...npmKeywords]);
	}

	return normalizeKeywords([packageName]);
}
