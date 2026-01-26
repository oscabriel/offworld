/**
 * Reference matching utilities for dependency resolution
 *
 * Maps dependencies to their reference status (installed, available, generate, unknown)
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { toReferenceFileName } from "./config.js";
import { Paths } from "./paths.js";
import type { ResolvedDep } from "./dep-mappings.js";

export type ReferenceStatus = "installed" | "available" | "generate" | "unknown";

export interface ReferenceMatch {
	/** Dependency name */
	dep: string;
	/** GitHub repo (owner/repo) or null if unknown */
	repo: string | null;
	/** Reference availability status */
	status: ReferenceStatus;
	/** Resolution source: 'known' | 'npm' | 'unknown' */
	source: "known" | "npm" | "unknown";
}

/**
 * Check if a reference is installed locally.
 * A reference is considered installed if {owner-repo}.md exists in offworld/references/.
 *
 * @param repo - Repo name in owner/repo format
 * @returns true if reference is installed locally
 */
export function isReferenceInstalled(repo: string): boolean {
	const referenceFileName = toReferenceFileName(repo);
	const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
	return existsSync(referencePath);
}

/**
 * Match dependencies to their reference availability status.
 *
 * Status logic:
 * - installed: {owner-repo}.md exists in offworld/references/
 * - available: Has valid GitHub repo (can be cloned)
 * - generate: Has valid GitHub repo but will need AI generation
 * - unknown: No GitHub repo found
 *
 * Note: Since we don't have a reference registry/index, "available" and "generate"
 * are the same. We use "available" for consistency and reserve "generate" for
 * future use when we can distinguish pre-existing vs needs-generation.
 *
 * @param resolvedDeps - Array of resolved dependencies with repo info
 * @returns Array of reference matches with status
 */
export function matchDependenciesToReferences(resolvedDeps: ResolvedDep[]): ReferenceMatch[] {
	return resolvedDeps.map((dep) => {
		// If no repo, mark as unknown
		if (!dep.repo) {
			return {
				dep: dep.dep,
				repo: null,
				status: "unknown",
				source: dep.source,
			};
		}

		// Check if reference is installed
		if (isReferenceInstalled(dep.repo)) {
			return {
				dep: dep.dep,
				repo: dep.repo,
				status: "installed",
				source: dep.source,
			};
		}

		// Has repo but not installed - mark as available (can be cloned and generated)
		return {
			dep: dep.dep,
			repo: dep.repo,
			status: "available",
			source: dep.source,
		};
	});
}
