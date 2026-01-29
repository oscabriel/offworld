/**
 * Reference matching utilities for dependency resolution
 *
 * Maps dependencies to their reference status (installed, remote, generate, unknown)
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { toReferenceFileName } from "./config.js";
import { Paths } from "./paths.js";
import type { ResolvedDep } from "./dep-mappings.js";
import { checkRemote } from "./sync.js";

export type ReferenceStatus = "installed" | "remote" | "generate" | "unknown";

export interface ReferenceMatch {
	/** Dependency name */
	dep: string;
	/** GitHub repo (owner/repo) or null if unknown */
	repo: string | null;
	/** Reference availability status */
	status: ReferenceStatus;
	/** Resolution source: 'npm' | 'fallback' | 'unknown' */
	source: "npm" | "fallback" | "unknown";
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
 * - remote: Reference exists on offworld.sh (quick pull)
 * - generate: Has valid GitHub repo but needs AI generation (slow, uses tokens)
 * - unknown: No GitHub repo found
 *
 * @param resolvedDeps - Array of resolved dependencies with repo info
 * @returns Array of reference matches with status
 */
export function matchDependenciesToReferences(resolvedDeps: ResolvedDep[]): ReferenceMatch[] {
	return resolvedDeps.map((dep) => {
		if (!dep.repo) {
			return {
				dep: dep.dep,
				repo: null,
				status: "unknown",
				source: dep.source,
			};
		}

		if (isReferenceInstalled(dep.repo)) {
			return {
				dep: dep.dep,
				repo: dep.repo,
				status: "installed",
				source: dep.source,
			};
		}

		return {
			dep: dep.dep,
			repo: dep.repo,
			status: "generate",
			source: dep.source,
		};
	});
}

/**
 * Match dependencies to their reference availability status with remote check.
 * This is async because it checks the remote server for each dependency.
 *
 * Status logic:
 * - installed: {owner-repo}.md exists in offworld/references/
 * - remote: Reference exists on offworld.sh (quick pull)
 * - generate: Has valid GitHub repo but needs AI generation (slow, uses tokens)
 * - unknown: No GitHub repo found
 *
 * @param resolvedDeps - Array of resolved dependencies with repo info
 * @returns Promise of array of reference matches with status
 */
export async function matchDependenciesToReferencesWithRemoteCheck(
	resolvedDeps: ResolvedDep[],
): Promise<ReferenceMatch[]> {
	const results = await Promise.all(
		resolvedDeps.map(async (dep) => {
			if (!dep.repo) {
				return {
					dep: dep.dep,
					repo: null,
					status: "unknown" as const,
					source: dep.source,
				};
			}

			if (isReferenceInstalled(dep.repo)) {
				return {
					dep: dep.dep,
					repo: dep.repo,
					status: "installed" as const,
					source: dep.source,
				};
			}

			try {
				const remote = await checkRemote(dep.repo);
				if (remote.exists) {
					return {
						dep: dep.dep,
						repo: dep.repo,
						status: "remote" as const,
						source: dep.source,
					};
				}
			} catch {
				// Network error - fall through to generate
			}

			return {
				dep: dep.dep,
				repo: dep.repo,
				status: "generate" as const,
				source: dep.source,
			};
		}),
	);

	return results;
}
