/**
 * Remove command handler
 * PRD 4.7: Remove a cloned repository and its analysis
 */

import * as p from "@clack/prompts";
import {
	parseRepoInput,
	removeRepo,
	getIndexEntry,
	getClonedRepoPath,
	getAnalysisPath,
	getMetaRoot,
} from "@offworld/sdk";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface RmOptions {
	repo: string;
	yes?: boolean;
	keepSkill?: boolean;
	dryRun?: boolean;
}

export interface RmResult {
	success: boolean;
	removed?: {
		repoPath?: string;
		analysisPath?: string;
		skillPaths?: string[];
	};
	message?: string;
}

/**
 * Get paths that would be affected by removal
 */
function getAffectedPaths(qualifiedName: string): {
	repoPath?: string;
	analysisPath?: string;
	skillPaths: string[];
} {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) {
		return { skillPaths: [] };
	}

	const repoPath = entry.localPath;

	// Derive analysis path from qualified name
	let analysisPath: string;
	if (qualifiedName.startsWith("local:")) {
		const hash = qualifiedName.replace("local:", "");
		analysisPath = join(getMetaRoot(), "analyses", `local--${hash}`);
	} else {
		const [provider, fullName] = qualifiedName.split(":");
		const [owner, repo] = fullName.split("/");
		analysisPath = join(getMetaRoot(), "analyses", `${provider}--${owner}--${repo}`);
	}

	// Skill paths
	const skillPaths: string[] = [];
	const repoName = entry.fullName;

	// OpenCode skill path
	const openCodeSkillPath = join(
		process.env.HOME || "",
		".config",
		"opencode",
		"skill",
		repoName,
		"SKILL.md"
	);
	if (existsSync(openCodeSkillPath)) {
		skillPaths.push(openCodeSkillPath);
	}

	// Claude Code skill path
	const claudeSkillPath = join(
		process.env.HOME || "",
		".claude",
		"skills",
		repoName,
		"SKILL.md"
	);
	if (existsSync(claudeSkillPath)) {
		skillPaths.push(claudeSkillPath);
	}

	return {
		repoPath: existsSync(repoPath) ? repoPath : undefined,
		analysisPath: existsSync(analysisPath) ? analysisPath : undefined,
		skillPaths,
	};
}

/**
 * Remove command handler
 */
export async function rmHandler(options: RmOptions): Promise<RmResult> {
	const { repo, yes = false, keepSkill = false, dryRun = false } = options;

	try {
		// Parse repo input
		const source = parseRepoInput(repo);
		const qualifiedName = source.qualifiedName;

		// Check if repo is in index
		const entry = getIndexEntry(qualifiedName);
		if (!entry) {
			p.log.warn(`Repository not found in index: ${repo}`);
			return {
				success: false,
				message: "Repository not found",
			};
		}

		// Get affected paths
		const affected = getAffectedPaths(qualifiedName);

		// Show what would be deleted
		if (dryRun || !yes) {
			p.log.info("The following will be removed:");

			if (affected.repoPath) {
				console.log(`  Repository: ${affected.repoPath}`);
			}
			if (affected.analysisPath) {
				console.log(`  Analysis: ${affected.analysisPath}`);
			}
			if (!keepSkill && affected.skillPaths.length > 0) {
				for (const skillPath of affected.skillPaths) {
					console.log(`  Skill: ${skillPath}`);
				}
			}
			console.log("");
		}

		// Dry run - exit without deleting
		if (dryRun) {
			p.log.info("Dry run - no files were deleted.");
			return {
				success: true,
				removed: affected,
			};
		}

		// Confirm deletion
		if (!yes) {
			const confirm = await p.confirm({
				message: `Are you sure you want to remove ${entry.fullName}?`,
			});

			if (p.isCancel(confirm) || !confirm) {
				p.log.info("Aborted.");
				return {
					success: false,
					message: "Aborted by user",
				};
			}
		}

		// Perform removal
		const s = p.spinner();
		s.start("Removing repository...");

		const removed = await removeRepo(qualifiedName, { keepSkill });

		if (removed) {
			s.stop("Repository removed");
			p.log.success(`Removed: ${entry.fullName}`);

			return {
				success: true,
				removed: affected,
			};
		} else {
			s.stop("Failed to remove");
			return {
				success: false,
				message: "Failed to remove repository",
			};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			message,
		};
	}
}
