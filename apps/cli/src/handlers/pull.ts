/**
 * Pull command handler
 * PRD 4.3: Clone repo, fetch/generate analysis, install skill
 */

import * as p from "@clack/prompts";
import {
	cloneRepo,
	updateRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	parseRepoInput,
	pullAnalysis,
	loadConfig,
	getAnalysisPath,
	getMetaRoot,
	updateIndex,
	getIndexEntry,
	RepoExistsError,
	runAnalysisPipeline,
	type PullResponse,
} from "@offworld/sdk";
import type { RepoSource, Skill } from "@offworld/types";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface PullOptions {
	repo: string;
	shallow?: boolean;
	branch?: string;
	force?: boolean;
}

export interface PullResult {
	success: boolean;
	repoPath: string;
	analysisSource: "remote" | "local" | "cached";
	skillInstalled: boolean;
	message?: string;
}

/**
 * Expands ~ to user's home directory
 */
function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

/**
 * Install SKILL.md to both OpenCode and Claude Code skill directories
 */
export async function installSkill(repoName: string, skillContent: string): Promise<void> {
	const config = loadConfig();

	// OpenCode skill directory
	const openCodeSkillDir = expandTilde(join(config.skillDir, repoName));
	// Claude Code skill directory (~/.claude/skills/{repo})
	const claudeSkillDir = expandTilde(join("~/.claude/skills", repoName));

	// Ensure directories exist and write SKILL.md
	for (const skillDir of [openCodeSkillDir, claudeSkillDir]) {
		const expanded = expandTilde(skillDir);
		mkdirSync(expanded, { recursive: true });
		writeFileSync(join(expanded, "SKILL.md"), skillContent, "utf-8");
	}
}

/**
 * Format SKILL.md content from Skill object
 */
function formatSkillMd(skill: Skill): string {
	// Build YAML frontmatter
	const frontmatter = [
		"---",
		`name: "${skill.name}"`,
		`description: "${skill.description.replace(/"/g, '\\"')}"`,
		"allowed-tools:",
		...skill.allowedTools.map((tool) => `  - ${tool}`),
		"---",
	].join("\n");

	// Build body sections
	const sections = [];

	// Repository Structure
	sections.push("## Repository Structure\n");
	for (const entry of skill.repositoryStructure) {
		sections.push(`- \`${entry.path}\`: ${entry.purpose}`);
	}
	sections.push("");

	// Quick Reference Paths (Key Files)
	sections.push("## Quick Reference Paths\n");
	for (const file of skill.keyFiles) {
		sections.push(`- \`${file.path}\`: ${file.description}`);
	}
	sections.push("");

	// Search Strategies
	sections.push("## Search Strategies\n");
	for (const strategy of skill.searchStrategies) {
		sections.push(`- ${strategy}`);
	}
	sections.push("");

	// When to Use
	sections.push("## When to Use\n");
	for (const condition of skill.whenToUse) {
		sections.push(`- ${condition}`);
	}

	return `${frontmatter}\n\n${sections.join("\n")}`;
}

/**
 * Save pulled analysis to local analysis directory
 */
function saveAnalysisLocally(source: RepoSource, analysis: PullResponse): void {
	let analysisPath: string;
	if (source.type === "remote") {
		analysisPath = getAnalysisPath(source.fullName, source.provider);
	} else {
		// For local repos, use meta root with hash
		const hash = source.qualifiedName.replace("local:", "");
		analysisPath = join(getMetaRoot(), "analyses", `local--${hash}`);
	}

	// Ensure directory exists
	mkdirSync(analysisPath, { recursive: true });

	// Write analysis files
	writeFileSync(join(analysisPath, "summary.md"), analysis.summary, "utf-8");
	writeFileSync(
		join(analysisPath, "architecture.json"),
		JSON.stringify(analysis.architecture, null, 2),
		"utf-8",
	);
	writeFileSync(
		join(analysisPath, "file-index.json"),
		JSON.stringify(analysis.fileIndex, null, 2),
		"utf-8",
	);
	writeFileSync(join(analysisPath, "skill.json"), JSON.stringify(analysis.skill, null, 2), "utf-8");

	// Write SKILL.md
	const skillMd = formatSkillMd(analysis.skill);
	writeFileSync(join(analysisPath, "SKILL.md"), skillMd, "utf-8");

	// Write meta.json
	const meta = {
		analyzedAt: analysis.analyzedAt,
		commitSha: analysis.commitSha,
		version: "0.1.0",
		pullCount: analysis.pullCount,
	};
	writeFileSync(join(analysisPath, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * Check if local analysis exists and is current
 */
function hasLocalAnalysis(source: RepoSource, repoPath: string): boolean {
	let analysisPath: string;
	if (source.type === "remote") {
		analysisPath = getAnalysisPath(source.fullName, source.provider);
	} else {
		const hash = source.qualifiedName.replace("local:", "");
		analysisPath = join(getMetaRoot(), "analyses", `local--${hash}`);
	}

	// Check if analysis files exist
	const metaPath = join(analysisPath, "meta.json");
	if (!existsSync(metaPath)) {
		return false;
	}

	// Check if analysis is for current commit
	try {
		const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
		const currentSha = getCommitSha(repoPath);
		return meta.commitSha === currentSha;
	} catch {
		return false;
	}
}

/**
 * Load local skill content if available
 */
function loadLocalSkill(source: RepoSource): Skill | null {
	let analysisPath: string;
	if (source.type === "remote") {
		analysisPath = getAnalysisPath(source.fullName, source.provider);
	} else {
		const hash = source.qualifiedName.replace("local:", "");
		analysisPath = join(getMetaRoot(), "analyses", `local--${hash}`);
	}

	const skillPath = join(analysisPath, "skill.json");
	if (!existsSync(skillPath)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(skillPath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Main pull handler
 */
export async function pullHandler(options: PullOptions): Promise<PullResult> {
	const { repo, shallow = true, branch, force = false } = options;
	const config = loadConfig();

	const s = p.spinner();

	try {
		// Parse repo input
		s.start("Parsing repository input...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");

		let repoPath: string;

		// Handle cloning/updating for remote repos
		if (source.type === "remote") {
			const qualifiedName = source.qualifiedName;

			if (isRepoCloned(qualifiedName)) {
				// Repo exists, update it
				s.start("Updating repository...");
				const result = await updateRepo(qualifiedName);
				repoPath = getClonedRepoPath(qualifiedName)!;

				if (result.updated) {
					s.stop(`Updated (${result.previousSha.slice(0, 7)} → ${result.currentSha.slice(0, 7)})`);
				} else {
					s.stop("Already up to date");
				}
			} else {
				// Clone repo
				s.start(`Cloning ${source.fullName}...`);
				try {
					repoPath = await cloneRepo(source, {
						shallow,
						branch,
						config,
						force,
					});
					s.stop("Repository cloned");
				} catch (err) {
					if (err instanceof RepoExistsError && !force) {
						// This shouldn't happen since we checked isRepoCloned
						s.stop("Repository exists");
						throw err;
					}
					throw err;
				}
			}
		} else {
			// Local repo - just use the path
			repoPath = source.path;
		}

		// Check for cached local analysis (if not forcing)
		if (!force && hasLocalAnalysis(source, repoPath)) {
			const skill = loadLocalSkill(source);
			if (skill) {
				s.start("Installing skill from cache...");
				const repoName = source.type === "remote" ? source.fullName : source.name;
				const skillMd = formatSkillMd(skill);
				await installSkill(repoName, skillMd);
				s.stop("Skill installed from cache");

				return {
					success: true,
					repoPath,
					analysisSource: "cached",
					skillInstalled: true,
				};
			}
		}

		// Try to pull remote analysis (for remote repos only)
		if (source.type === "remote") {
			s.start("Checking offworld.sh for analysis...");
			const remoteAnalysis = await pullAnalysis(source.fullName);

			if (remoteAnalysis) {
				s.stop("Found remote analysis");

				// Save analysis locally
				s.start("Saving analysis...");
				saveAnalysisLocally(source, remoteAnalysis);
				s.stop("Analysis saved");

				// Install skill
				s.start("Installing skill...");
				const skillMd = formatSkillMd(remoteAnalysis.skill);
				await installSkill(source.fullName, skillMd);
				s.stop("Skill installed");

				// Update index
				const entry = getIndexEntry(source.qualifiedName);
				if (entry) {
					updateIndex({
						...entry,
						analyzedAt: remoteAnalysis.analyzedAt,
						commitSha: remoteAnalysis.commitSha,
						hasSkill: true,
					});
				}

				return {
					success: true,
					repoPath,
					analysisSource: "remote",
					skillInstalled: true,
				};
			}
			s.stop("No remote analysis found");
		}

		// No remote analysis - generate locally using analysis pipeline
		s.start("Generating local analysis...");

		try {
			const pipelineOptions =
				source.type === "remote"
					? {
							config,
							provider: source.provider,
							fullName: source.fullName,
							onProgress: (_step: string, message: string) => {
								s.message(message);
							},
						}
					: {
							config,
							onProgress: (_step: string, message: string) => {
								s.message(message);
							},
						};

			await runAnalysisPipeline(repoPath, pipelineOptions);
			s.stop("Analysis complete");

			// Update index
			const entry = getIndexEntry(source.qualifiedName);
			if (entry) {
				updateIndex({
					...entry,
					analyzedAt: new Date().toISOString(),
					commitSha: getCommitSha(repoPath),
					hasSkill: true,
				});
			}

			return {
				success: true,
				repoPath,
				analysisSource: "local",
				skillInstalled: true,
			};
		} catch (err) {
			s.stop("Analysis failed");
			const errMessage = err instanceof Error ? err.message : "Unknown error";
			p.log.error(`Failed to generate analysis: ${errMessage}`);

			return {
				success: true,
				repoPath,
				analysisSource: "local",
				skillInstalled: false,
				message: `Repository cloned but analysis failed: ${errMessage}`,
			};
		}
	} catch (error) {
		s.stop("Failed");
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			repoPath: "",
			analysisSource: "local",
			skillInstalled: false,
			message,
		};
	}
}
