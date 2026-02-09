/**
 * Dependency name to GitHub repo resolution:
 * 1. Parse repo from dependency spec (git/https/github shorthand)
 * 2. Query npm registry for repository.url
 * 3. Fall back to FALLBACK_MAPPINGS for packages missing repository field
 * 4. Return unknown (caller handles)
 */

import { NpmPackageResponseSchema } from "@offworld/types";

export type ResolvedDep = {
	dep: string;
	repo: string | null;
	source: "spec" | "npm" | "fallback" | "unknown";
};

export interface ResolveDependencyRepoOptions {
	allowNpm?: boolean;
	npmTimeoutMs?: number;
}

const DEFAULT_NPM_FETCH_TIMEOUT_MS = 5000;

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
 * - https://github.com/owner/repo/tree/main
 * - git@github.com:owner/repo.git
 * - github:owner/repo
 */
function parseGitHubUrl(url: string): string | null {
	const cleaned = url
		.trim()
		.replace(/^git\+/, "")
		.split("#")[0]
		?.split("?")[0]
		?.trim();

	if (!cleaned) return null;

	const patterns = [
		/github\.com[/:]([\w.-]+)\/([\w.-]+)(?:\.git)?(?:[/?#].*)?$/,
		/^github:([\w.-]+)\/([\w.-]+)(?:[/?#].*)?$/,
	];

	for (const pattern of patterns) {
		const match = cleaned.match(pattern);
		if (match) {
			const owner = match[1];
			const repo = match[2]?.replace(/\.git$/i, "");
			if (!owner || !repo) return null;
			return `${owner}/${repo}`;
		}
	}

	return null;
}

function resolveFromSpec(spec?: string): string | null {
	if (!spec) return null;

	const trimmed = spec.trim();
	if (!trimmed) return null;

	const isGitSpec =
		trimmed.startsWith("github:") ||
		trimmed.startsWith("git+") ||
		trimmed.startsWith("git://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("http://") ||
		trimmed.startsWith("ssh://") ||
		trimmed.startsWith("git@");

	if (!isGitSpec) return null;

	return parseGitHubUrl(trimmed);
}

async function fetchNpmPackage(
	packageName: string,
	timeoutMs = DEFAULT_NPM_FETCH_TIMEOUT_MS,
): Promise<{
	repository?: string | { url?: string };
	keywords?: string[];
} | null> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(`https://registry.npmjs.org/${packageName}`, {
			signal: controller.signal,
		});
		if (!res.ok) return null;

		const json = await res.json();
		const result = NpmPackageResponseSchema.safeParse(json);
		if (!result.success) return null;

		return result.data;
	} catch {
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Fallback to npm registry to extract repository.url.
 * Returns null if package not found, no repo field, or not a GitHub repo.
 */
export async function resolveFromNpm(
	packageName: string,
	timeoutMs?: number,
): Promise<string | null> {
	const pkg = await fetchNpmPackage(packageName, timeoutMs);
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
 * 1. Parse repo from dependency spec (git/https/github shorthand)
 * 2. Query npm registry for repository.url
 * 3. Check FALLBACK_MAPPINGS for packages missing repository field
 * 4. Return unknown
 */
export async function resolveDependencyRepo(
	dep: string,
	spec?: string,
	options: ResolveDependencyRepoOptions = {},
): Promise<ResolvedDep> {
	const { allowNpm = true, npmTimeoutMs } = options;

	const specRepo = resolveFromSpec(spec);
	if (specRepo) {
		return { dep, repo: specRepo, source: "spec" };
	}

	if (allowNpm) {
		const npmRepo = await resolveFromNpm(dep, npmTimeoutMs);
		if (npmRepo) {
			return { dep, repo: npmRepo, source: "npm" };
		}

		if (dep in FALLBACK_MAPPINGS) {
			return { dep, repo: FALLBACK_MAPPINGS[dep] ?? null, source: "fallback" };
		}
	}

	return { dep, repo: null, source: "unknown" };
}
