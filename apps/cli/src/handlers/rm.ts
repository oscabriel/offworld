/**
 * Remove command handler
 */

import * as p from "@clack/prompts";
import { parseRepoInput, removeRepo, getIndexEntry, getMetaRoot } from "@offworld/sdk";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";

/**
 * Agent skill directory paths (must match generate.ts)
 */
const AGENT_SKILL_DIRS: Record<string, string> = {
	opencode: "~/.config/opencode/skill",
	"claude-code": "~/.claude/skills",
	codex: "~/.codex/skills",
};

function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

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
		skillPath?: string;
		symlinkPaths?: string[];
	};
	message?: string;
}

function toSkillDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/");
		return `${owner}-${repo}-reference`;
	}
	return `${repoName}-reference`;
}

function getAffectedPaths(qualifiedName: string): {
	repoPath?: string;
	skillPath?: string;
	symlinkPaths: string[];
} {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) {
		return { symlinkPaths: [] };
	}

	const repoPath = entry.localPath;
	const skillDirName = toSkillDirName(entry.fullName);

	const skillPath = join(getMetaRoot(), "skills", skillDirName);

	// Check all possible agent symlink paths (not just configured ones)
	// This ensures cleanup works even if config changed
	const symlinkPaths: string[] = [];
	for (const agentSkillBase of Object.values(AGENT_SKILL_DIRS)) {
		const agentSkillPath = expandTilde(join(agentSkillBase, skillDirName));
		if (existsSync(agentSkillPath)) {
			symlinkPaths.push(agentSkillPath);
		}
	}

	return {
		repoPath: existsSync(repoPath) ? repoPath : undefined,
		skillPath: existsSync(skillPath) ? skillPath : undefined,
		symlinkPaths,
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

		if (dryRun || !yes) {
			p.log.info("The following will be removed:");

			if (affected.repoPath) {
				console.log(`  Repository: ${affected.repoPath}`);
			}
			if (!keepSkill && affected.skillPath) {
				console.log(`  Skill: ${affected.skillPath}`);
			}
			if (!keepSkill && affected.symlinkPaths.length > 0) {
				for (const symlinkPath of affected.symlinkPaths) {
					console.log(`  Symlink: ${symlinkPath}`);
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
		const s = createSpinner();
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
