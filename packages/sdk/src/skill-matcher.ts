/**
 * Skill matching utilities for dependency resolution
 *
 * Maps dependencies to their skill status (installed, available, generate, unknown)
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { getSkillPath } from "./config.js";
import type { ResolvedDep } from "./dep-mappings.js";

export type SkillStatus = "installed" | "available" | "generate" | "unknown";

export interface SkillMatch {
	/** Dependency name */
	dep: string;
	/** GitHub repo (owner/repo) or null if unknown */
	repo: string | null;
	/** Skill availability status */
	status: SkillStatus;
	/** Resolution source: 'known' | 'npm' | 'unknown' */
	source: "known" | "npm" | "unknown";
}

/**
 * Check if a skill is installed locally.
 * A skill is considered installed if SKILL.md exists at the expected path.
 *
 * @param repo - Repo name in owner/repo format
 * @returns true if skill is installed locally
 */
export function isSkillInstalled(repo: string): boolean {
	const skillPath = getSkillPath(repo);
	const skillFile = join(skillPath, "SKILL.md");
	return existsSync(skillFile);
}

/**
 * Match dependencies to their skill availability status.
 *
 * Status logic:
 * - installed: SKILL.md exists locally
 * - available: Has valid GitHub repo (can be cloned)
 * - generate: Has valid GitHub repo but will need AI generation
 * - unknown: No GitHub repo found
 *
 * Note: Since we don't have a skill registry/index, "available" and "generate"
 * are the same. We use "available" for consistency and reserve "generate" for
 * future use when we can distinguish pre-existing vs needs-generation.
 *
 * @param resolvedDeps - Array of resolved dependencies with repo info
 * @returns Array of skill matches with status
 */
export function matchDependenciesToSkills(resolvedDeps: ResolvedDep[]): SkillMatch[] {
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

		// Check if skill is installed
		if (isSkillInstalled(dep.repo)) {
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
