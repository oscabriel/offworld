/**
 * Remove command handler
 */

import * as p from "@clack/prompts";
import {
	parseRepoInput,
	removeRepo,
	removeSkillByName,
	getIndexEntry,
	getSkillPath,
	getMetaPath,
	getAllAgentConfigs,
	expandTilde,
	toSkillDirName,
} from "@offworld/sdk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";

export interface RmOptions {
	repo: string;
	yes?: boolean;
	skillOnly?: boolean;
	repoOnly?: boolean;
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

function getAffectedPathsFromIndex(qualifiedName: string): {
	repoPath?: string;
	skillPath?: string;
	symlinkPaths: string[];
} | null {
	const entry = getIndexEntry(qualifiedName);
	if (!entry) {
		return null;
	}

	const repoPath = entry.localPath;
	const skillDirName = toSkillDirName(entry.fullName);
	const skillPath = getSkillPath(entry.fullName);

	const symlinkPaths: string[] = [];
	for (const agentConfig of getAllAgentConfigs()) {
		const agentSkillPath = expandTilde(join(agentConfig.globalSkillsDir, skillDirName));
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

function getSkillPathsFromName(repoName: string): {
	skillPath?: string;
	metaPath?: string;
	symlinkPaths: string[];
} {
	const skillDirName = toSkillDirName(repoName);
	const skillPath = getSkillPath(repoName);
	const metaPath = getMetaPath(repoName);

	const symlinkPaths: string[] = [];
	for (const agentConfig of getAllAgentConfigs()) {
		const agentSkillPath = expandTilde(join(agentConfig.globalSkillsDir, skillDirName));
		if (existsSync(agentSkillPath)) {
			symlinkPaths.push(agentSkillPath);
		}
	}

	return {
		skillPath: existsSync(skillPath) ? skillPath : undefined,
		metaPath: existsSync(metaPath) ? metaPath : undefined,
		symlinkPaths,
	};
}

export async function rmHandler(options: RmOptions): Promise<RmResult> {
	const { repo, yes = false, skillOnly = false, repoOnly = false, dryRun = false } = options;

	try {
		const source = parseRepoInput(repo);
		const qualifiedName = source.qualifiedName;
		const repoName = source.type === "remote" ? source.fullName : source.name;

		if (skillOnly && repoOnly) {
			p.log.error("Cannot use --skill-only and --repo-only together");
			return {
				success: false,
				message: "Invalid options",
			};
		}

		const entry = getIndexEntry(qualifiedName);

		if (!entry && !skillOnly) {
			p.log.warn(`Repository not found in index: ${repo}`);
			return {
				success: false,
				message: "Repository not found",
			};
		}

		if (skillOnly && !entry) {
			return handleSkillOnlyRemoval(repoName, yes, dryRun);
		}

		const affected = getAffectedPathsFromIndex(qualifiedName)!;

		if (dryRun || !yes) {
			p.log.info("The following will be removed:");

			if (!skillOnly && affected.repoPath) {
				console.log(`  Repository: ${affected.repoPath}`);
			}
			if (!repoOnly && affected.skillPath) {
				console.log(`  Skill: ${affected.skillPath}`);
			}
			if (!repoOnly && affected.symlinkPaths.length > 0) {
				for (const symlinkPath of affected.symlinkPaths) {
					console.log(`  Symlink: ${symlinkPath}`);
				}
			}
			console.log("");
		}

		if (dryRun) {
			p.log.info("Dry run - no files were deleted.");
			return {
				success: true,
				removed: affected,
			};
		}

		if (!yes) {
			const what = skillOnly ? "skill files" : repoOnly ? "repository" : entry!.fullName;
			const confirm = await p.confirm({
				message: `Are you sure you want to remove ${what}?`,
			});

			if (p.isCancel(confirm) || !confirm) {
				p.log.info("Aborted.");
				return {
					success: false,
					message: "Aborted by user",
				};
			}
		}

		const s = createSpinner();
		const action = skillOnly
			? "Removing skill files..."
			: repoOnly
				? "Removing repository..."
				: "Removing...";
		s.start(action);

		const removed = await removeRepo(qualifiedName, { skillOnly, repoOnly });

		if (removed) {
			const doneMsg = skillOnly
				? "Skill files removed"
				: repoOnly
					? "Repository removed"
					: "Removed";
			s.stop(doneMsg);
			p.log.success(`Removed: ${entry!.fullName}`);

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

async function handleSkillOnlyRemoval(
	repoName: string,
	yes: boolean,
	dryRun: boolean,
): Promise<RmResult> {
	const affected = getSkillPathsFromName(repoName);

	if (!affected.skillPath && !affected.metaPath && affected.symlinkPaths.length === 0) {
		p.log.warn(`No skill files found for: ${repoName}`);
		return {
			success: false,
			message: "No skill files found",
		};
	}

	if (dryRun || !yes) {
		p.log.info("The following will be removed:");
		if (affected.skillPath) {
			console.log(`  Skill: ${affected.skillPath}`);
		}
		if (affected.metaPath) {
			console.log(`  Meta: ${affected.metaPath}`);
		}
		for (const symlinkPath of affected.symlinkPaths) {
			console.log(`  Symlink: ${symlinkPath}`);
		}
		console.log("");
	}

	if (dryRun) {
		p.log.info("Dry run - no files were deleted.");
		return {
			success: true,
			removed: { skillPath: affected.skillPath, symlinkPaths: affected.symlinkPaths },
		};
	}

	if (!yes) {
		const confirm = await p.confirm({
			message: `Are you sure you want to remove skill files for ${repoName}?`,
		});

		if (p.isCancel(confirm) || !confirm) {
			p.log.info("Aborted.");
			return {
				success: false,
				message: "Aborted by user",
			};
		}
	}

	const s = createSpinner();
	s.start("Removing skill files...");

	const removed = removeSkillByName(repoName);

	if (removed) {
		s.stop("Skill files removed");
		p.log.success(`Removed skill files for: ${repoName}`);
		return {
			success: true,
			removed: { skillPath: affected.skillPath, symlinkPaths: affected.symlinkPaths },
		};
	} else {
		s.stop("Failed to remove");
		return {
			success: false,
			message: "Failed to remove skill files",
		};
	}
}
