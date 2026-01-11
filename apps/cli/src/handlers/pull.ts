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
	pushAnalysis,
	checkRemote,
	canPushToWeb,
	loadConfig,
	loadAuthData,
	getAnalysisPath,
	getMetaRoot,
	updateIndex,
	getIndexEntry,
	RepoExistsError,
	runAnalysisPipeline,
	isAnalysisStale,
	type PullResponse,
	type AnalysisData,
} from "@offworld/sdk";
import type { RepoSource, Skill } from "@offworld/types";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface PullOptions {
	repo: string;
	shallow?: boolean;
	sparse?: boolean;
	branch?: string;
	force?: boolean;
	verbose?: boolean;
	skipArchitecture?: boolean;
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

interface FormatSkillOptions {
	commitSha?: string;
	generated?: string;
}

function formatSkillMd(skill: Skill, options: FormatSkillOptions = {}): string {
	const lines = [
		"---",
		`name: "${skill.name}"`,
		`description: "${skill.description.replace(/"/g, '\\"')}"`,
	];

	if (options.commitSha) {
		lines.push(`commit: ${options.commitSha.slice(0, 7)}`);
	}
	if (options.generated) {
		lines.push(`generated: ${options.generated}`);
	}

	lines.push("---");
	const frontmatter = lines.join("\n");

	const sections = [];

	sections.push("## Repository Structure\n");
	for (const entry of skill.repositoryStructure) {
		sections.push(`- \`${entry.path}\`: ${entry.purpose}`);
	}
	sections.push("");

	sections.push("## Quick Reference Paths\n");
	for (const file of skill.keyFiles) {
		sections.push(`- \`${file.path}\`: ${file.description}`);
	}
	sections.push("");

	sections.push("## Search Strategies\n");
	for (const strategy of skill.searchStrategies) {
		sections.push(`- ${strategy}`);
	}
	sections.push("");

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

	const skillMd = formatSkillMd(analysis.skill, {
		commitSha: analysis.commitSha,
		generated: analysis.analyzedAt?.split("T")[0],
	});
	writeFileSync(join(analysisPath, "SKILL.md"), skillMd, "utf-8");

	const meta = {
		analyzedAt: analysis.analyzedAt,
		commitSha: analysis.commitSha,
		version: "0.1.0",
		pullCount: analysis.pullCount,
	};
	writeFileSync(join(analysisPath, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
}

function hasLocalAnalysis(source: RepoSource, repoPath: string): boolean {
	const analysisPath = getLocalAnalysisPath(source);
	const currentSha = getCommitSha(repoPath);
	const stalenessResult = isAnalysisStale(analysisPath, currentSha);
	return !stalenessResult.isStale;
}

function getLocalAnalysisPath(source: RepoSource): string {
	if (source.type === "remote") {
		return getAnalysisPath(source.fullName, source.provider);
	}
	const hash = source.qualifiedName.replace("local:", "");
	return join(getMetaRoot(), "analyses", `local--${hash}`);
}

function loadLocalSkill(source: RepoSource): Skill | null {
	const analysisPath = getLocalAnalysisPath(source);
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

function loadLocalMeta(source: RepoSource): { commitSha?: string; analyzedAt?: string } | null {
	const analysisPath = getLocalAnalysisPath(source);
	const metaPath = join(analysisPath, "meta.json");
	if (!existsSync(metaPath)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(metaPath, "utf-8"));
	} catch {
		return null;
	}
}

function timestamp(): string {
	return new Date().toISOString().slice(11, 23);
}

function verboseLog(message: string, verbose: boolean): void {
	if (verbose) {
		p.log.info(`[${timestamp()}] ${message}`);
	}
}

type RemoteSource = Extract<RepoSource, { type: "remote" }>;

async function tryUploadAnalysis(
	source: RemoteSource,
	commitSha: string,
	analyzedAt: string,
	verbose: boolean,
	spinner: ReturnType<typeof p.spinner>,
): Promise<void> {
	const authData = loadAuthData();
	if (!authData?.token) {
		verboseLog("Skipping upload: not authenticated", verbose);
		return;
	}

	const canPush = await canPushToWeb(source);
	if (!canPush.allowed) {
		verboseLog(`Skipping upload: ${canPush.reason}`, verbose);
		return;
	}

	const analysisPath = getAnalysisPath(source.fullName, source.provider);

	try {
		const summary = readFileSync(join(analysisPath, "summary.md"), "utf-8");
		const architecture = JSON.parse(readFileSync(join(analysisPath, "architecture.json"), "utf-8"));
		const skill = JSON.parse(readFileSync(join(analysisPath, "skill.json"), "utf-8"));
		const fileIndex = JSON.parse(readFileSync(join(analysisPath, "file-index.json"), "utf-8"));

		const analysisData: AnalysisData = {
			fullName: source.fullName,
			summary,
			architecture,
			skill,
			fileIndex,
			commitSha,
			analyzedAt,
		};

		spinner.start("Uploading to offworld.sh...");
		await pushAnalysis(analysisData, authData.token);
		spinner.stop("Uploaded to offworld.sh");
	} catch (err) {
		verboseLog(`Upload failed: ${err instanceof Error ? err.message : "Unknown"}`, verbose);
		spinner.stop("Upload failed (continuing)");
	}
}

export async function pullHandler(options: PullOptions): Promise<PullResult> {
	const {
		repo,
		shallow = true,
		sparse = false,
		branch,
		force = false,
		verbose = false,
		skipArchitecture = false,
	} = options;
	const config = loadConfig();

	const s = p.spinner();

	if (verbose) {
		p.log.info(
			`[verbose] Options: repo=${repo}, shallow=${shallow}, branch=${branch || "default"}, force=${force}`,
		);
	}

	try {
		// Parse repo input
		s.start("Parsing repository input...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");
		verboseLog(
			`Parsed source: type=${source.type}, qualifiedName=${source.qualifiedName}`,
			verbose,
		);

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
				s.start(`Cloning ${source.fullName}...`);
				try {
					repoPath = await cloneRepo(source, {
						shallow,
						sparse,
						branch,
						config,
						force,
					});
					s.stop("Repository cloned");
					verboseLog(`Cloned to: ${repoPath}`, verbose);
				} catch (err) {
					if (err instanceof RepoExistsError && !force) {
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

		const currentSha = getCommitSha(repoPath);

		// PRD-012: Check remote API FIRST for remote repos (with SHA comparison)
		if (source.type === "remote" && !force) {
			verboseLog(`Checking offworld.sh for analysis: ${source.fullName}`, verbose);
			s.start("Checking offworld.sh for analysis...");

			try {
				const remoteCheck = await checkRemote(source.fullName);

				if (remoteCheck.exists && remoteCheck.commitSha) {
					const remoteShaNorm = remoteCheck.commitSha.slice(0, 7);
					const currentShaNorm = currentSha.slice(0, 7);

					if (remoteShaNorm === currentShaNorm) {
						verboseLog(`Remote SHA matches (${remoteShaNorm}), downloading...`, verbose);
						s.message("Downloading remote analysis...");

						const remoteAnalysis = await pullAnalysis(source.fullName);

						if (remoteAnalysis) {
							s.stop("Downloaded remote analysis");

							// Save analysis locally
							s.start("Saving analysis...");
							saveAnalysisLocally(source, remoteAnalysis);
							s.stop("Analysis saved");

							s.start("Installing skill...");
							const skillMd = formatSkillMd(remoteAnalysis.skill, {
								commitSha: remoteAnalysis.commitSha,
								generated: remoteAnalysis.analyzedAt?.split("T")[0],
							});
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
					} else {
						verboseLog(
							`Remote SHA (${remoteShaNorm}) differs from current (${currentShaNorm}), skipping remote`,
							verbose,
						);
						s.stop("Remote analysis outdated");
					}
				} else {
					s.stop("No remote analysis found");
				}
			} catch (err) {
				// Graceful fallback - continue to local generation
				verboseLog(
					`Remote check failed: ${err instanceof Error ? err.message : "Unknown"}`,
					verbose,
				);
				s.stop("Remote check failed, continuing locally");
			}
		}

		verboseLog(`Checking for cached analysis at: ${repoPath}`, verbose);
		if (!force && hasLocalAnalysis(source, repoPath)) {
			const skill = loadLocalSkill(source);
			const meta = loadLocalMeta(source);
			if (skill) {
				s.start("Installing skill from cache...");
				const repoName = source.type === "remote" ? source.fullName : source.name;
				const skillMd = formatSkillMd(skill, {
					commitSha: meta?.commitSha,
					generated: meta?.analyzedAt?.split("T")[0],
				});
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

		// No remote analysis - generate locally using analysis pipeline
		verboseLog(`Starting local analysis pipeline for: ${repoPath}`, verbose);

		// Don't use spinner when verbose - the streaming output conflicts with spinner animation
		if (!verbose) {
			s.start("Generating local analysis...");
		}

		try {
			const onProgress = (step: string, message: string) => {
				if (verbose) {
					p.log.info(`[${timestamp()}] [${step}] ${message}`);
				} else {
					s.message(message);
				}
			};

			const onDebug = verbose
				? (message: string) => {
						p.log.info(`[${timestamp()}] [debug] ${message}`);
					}
				: undefined;

			const onStream = verbose
				? (text: string) => {
						process.stdout.write(text);
					}
				: undefined;

			const onTiming = verbose
				? (timing: { total: number; steps: Record<string, number> }) => {
						p.log.info(`\n[timing] Total: ${(timing.total / 1000).toFixed(2)}s`);
						for (const [step, ms] of Object.entries(timing.steps)) {
							p.log.info(`[timing]   ${step}: ${(ms / 1000).toFixed(2)}s`);
						}
					}
				: undefined;

			const pipelineOptions =
				source.type === "remote"
					? {
							config,
							provider: source.provider,
							fullName: source.fullName,
							includeArchitecture: !skipArchitecture,
							onProgress,
							onDebug,
							onStream,
							onTiming,
						}
					: {
							config,
							includeArchitecture: !skipArchitecture,
							onProgress,
							onDebug,
							onStream,
							onTiming,
						};

			await runAnalysisPipeline(repoPath, pipelineOptions);
			if (!verbose) {
				s.stop("Analysis complete");
			} else {
				p.log.success("Analysis complete");
			}

			const analysisCommitSha = getCommitSha(repoPath);
			const analyzedAt = new Date().toISOString();

			const entry = getIndexEntry(source.qualifiedName);
			if (entry) {
				updateIndex({
					...entry,
					analyzedAt,
					commitSha: analysisCommitSha,
					hasSkill: true,
				});
			}

			// PRD-013: Upload to offworld.sh after local generation
			if (source.type === "remote") {
				await tryUploadAnalysis(source, analysisCommitSha, analyzedAt, verbose, s);
			}

			return {
				success: true,
				repoPath,
				analysisSource: "local",
				skillInstalled: true,
			};
		} catch (err) {
			if (!verbose) {
				s.stop("Analysis failed");
			}
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
