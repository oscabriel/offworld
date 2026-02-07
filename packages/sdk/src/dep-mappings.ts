/**
 * Dependency name to GitHub repo resolution:
 * 1. Query npm registry for repository.url
 * 2. Fall back to FALLBACK_MAPPINGS for packages missing repository field
 * 3. Return unknown (caller handles)
 */

import { NpmPackageResponseSchema } from "@offworld/types";

export type ResolvedDep = {
	dep: string;
	repo: string | null;
	source: "npm" | "fallback" | "unknown";
};

/**
 * Fallback mappings for packages where npm registry doesn't have repository.url.
 * Only add packages here that genuinely don't have the field set.
 */
export const FALLBACK_MAPPINGS: Record<string, string> = {
	"@convex-dev/react-query": "get-convex/convex-react-query",
	"@opencode-ai/sdk": "anomalyco/opencode-sdk-js",
};

/**
 * Parse GitHub repo from various git URL formats.
 * Handles:
 * - git+https://github.com/owner/repo.git
 * - https://github.com/owner/repo
 * - git://github.com/owner/repo.git
 * - github:owner/repo
 */
function parseGitHubUrl(url: string): string | null {
	const patterns = [
		/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?$/,
		/^github:([\w-]+)\/([\w.-]+)$/,
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) {
			return `${match[1]}/${match[2]}`;
		}
	}

	return null;
}

async function fetchNpmPackage(packageName: string): Promise<{
	repository?: string | { url?: string };
	keywords?: string[];
} | null> {
	try {
		const res = await fetch(`https://registry.npmjs.org/${packageName}`);
		if (!res.ok) return null;

		const json = await res.json();
		const result = NpmPackageResponseSchema.safeParse(json);
		if (!result.success) return null;

		return result.data;
	} catch {
		return null;
	}
}

/**
 * Fallback to npm registry to extract repository.url.
 * Returns null if package not found, no repo field, or not a GitHub repo.
 */
export async function resolveFromNpm(packageName: string): Promise<string | null> {
	const pkg = await fetchNpmPackage(packageName);
	if (!pkg?.repository) return null;

	const repoUrl = typeof pkg.repository === "string" ? pkg.repository : pkg.repository.url;
	if (!repoUrl) return null;

	return parseGitHubUrl(repoUrl);
}

export async function getNpmKeywords(packageName: string): Promise<string[]> {
	const pkg = await fetchNpmPackage(packageName);
	if (!pkg?.keywords || pkg.keywords.length === 0) return [];

	const seen = new Set<string>();
	for (const keyword of pkg.keywords) {
		const normalized = keyword.trim().toLowerCase();
		if (normalized.length < 2) continue;
		seen.add(normalized);
	}

	return Array.from(seen);
}

/**
 * Resolution order:
 * 1. Query npm registry for repository.url
 * 2. Check FALLBACK_MAPPINGS for packages missing repository field
 * 3. Return unknown
 */
export async function resolveDependencyRepo(dep: string): Promise<ResolvedDep> {
	const npmRepo = await resolveFromNpm(dep);
	if (npmRepo) {
		return { dep, repo: npmRepo, source: "npm" };
	}

	if (dep in FALLBACK_MAPPINGS) {
		return { dep, repo: FALLBACK_MAPPINGS[dep] ?? null, source: "fallback" };
	}

	return { dep, repo: null, source: "unknown" };
}
