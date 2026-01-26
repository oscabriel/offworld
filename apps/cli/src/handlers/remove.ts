/**
 * Remove command handler
 */

import * as p from "@clack/prompts";
import {
	parseRepoInput,
	removeRepo,
	toReferenceFileName,
	readGlobalMap,
	getMetaPath,
	Paths,
} from "@offworld/sdk";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";

export interface RmOptions {
	repo: string;
	yes?: boolean;
	referenceOnly?: boolean;
	repoOnly?: boolean;
	dryRun?: boolean;
}

export interface RmResult {
	success: boolean;
	removed?: {
		repoPath?: string;
		referencePath?: string;
		symlinkPaths?: string[];
	};
	message?: string;
}

function getAffectedPathsFromMap(qualifiedName: string): {
	repoPath?: string;
	referencePath?: string;
	symlinkPaths: string[];
} | null {
	const map = readGlobalMap();
	const entry = map.repos[qualifiedName];
	if (!entry) {
		return null;
	}

	const repoPath = entry.localPath;
	const referenceFileName = entry.primary || "";
	const referencePath = referenceFileName
		? join(Paths.offworldReferencesDir, referenceFileName)
		: undefined;

	return {
		repoPath: existsSync(repoPath) ? repoPath : undefined,
		referencePath: referencePath && existsSync(referencePath) ? referencePath : undefined,
		symlinkPaths: [],
	};
}

export async function rmHandler(options: RmOptions): Promise<RmResult> {
	const { repo, yes = false, referenceOnly = false, repoOnly = false, dryRun = false } = options;

	try {
		const source = parseRepoInput(repo);
		const qualifiedName = source.qualifiedName;
		const repoName = source.type === "remote" ? source.fullName : source.name;

		if (referenceOnly && repoOnly) {
			p.log.error("Cannot use --reference-only and --repo-only together");
			return {
				success: false,
				message: "Invalid options",
			};
		}

		const map = readGlobalMap();
		const entry = map.repos[qualifiedName];

		if (!entry && !referenceOnly) {
			p.log.warn(`Repository not found in map: ${repo}`);
			return {
				success: false,
				message: "Repository not found",
			};
		}

		if (referenceOnly && !entry) {
			return handleReferenceOnlyRemoval(repoName, yes, dryRun);
		}

		const affected = getAffectedPathsFromMap(qualifiedName)!;

		if (dryRun || !yes) {
			p.log.info("The following will be removed:");

		if (!referenceOnly && affected.repoPath) {
			console.log(`  Repository: ${affected.repoPath}`);
		}
		if (!repoOnly && affected.referencePath) {
			console.log(`  Reference: ${affected.referencePath}`);
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
			const what = referenceOnly ? "reference files" : repoOnly ? "repository" : qualifiedName;
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
		const action = referenceOnly
			? "Removing reference files..."
			: repoOnly
				? "Removing repository..."
				: "Removing...";
		s.start(action);

		const removed = await removeRepo(qualifiedName, { referenceOnly, repoOnly });

		if (removed) {
			const doneMsg = referenceOnly
				? "Reference files removed"
				: repoOnly
					? "Repository removed"
					: "Removed";
			s.stop(doneMsg);
			p.log.success(`Removed: ${qualifiedName}`);

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

async function handleReferenceOnlyRemoval(
	repoName: string,
	yes: boolean,
	dryRun: boolean,
): Promise<RmResult> {
	const referenceFileName = toReferenceFileName(repoName);
	const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
	const metaPath = getMetaPath(repoName);

	if (!existsSync(referencePath) && !existsSync(metaPath)) {
		p.log.warn(`No reference files found for: ${repoName}`);
		return {
			success: false,
			message: "No reference files found",
		};
	}

	if (dryRun || !yes) {
		p.log.info("The following will be removed:");
		if (existsSync(referencePath)) {
			console.log(`  Reference: ${referencePath}`);
		}
		if (existsSync(metaPath)) {
			console.log(`  Meta: ${metaPath}`);
		}
		console.log("");
	}

	if (dryRun) {
		p.log.info("Dry run - no files were deleted.");
		return {
			success: true,
			removed: { referencePath },
		};
	}

	if (!yes) {
		const confirm = await p.confirm({
			message: `Are you sure you want to remove reference files for ${repoName}?`,
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
	s.start("Removing reference files...");

	if (existsSync(referencePath)) rmSync(referencePath, { force: true });
	if (existsSync(metaPath)) rmSync(metaPath, { recursive: true, force: true });

	s.stop("Reference files removed");
	p.log.success(`Removed reference files for: ${repoName}`);
	return {
		success: true,
		removed: { referencePath },
	};
}
