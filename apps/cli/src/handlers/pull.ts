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
	installSkillWithReferences,
	isAnalysisStale,
	formatSkillMd,
	formatSummaryMd,
	formatArchitectureMd,
	type PullResponse,
	type AnalysisData,
} from "@offworld/sdk";
import type { RepoSource, Skill } from "@offworld/types";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PullOptions {
	repo: string;
	shallow?: boolean;
	sparse?: boolean;
	branch?: string;
	force?: boolean;
	verbose?: boolean;
	/** AI provider ID (e.g., "anthropic", "openai"). Overrides config. */
	provider?: string;
	/** AI model ID. Overrides config. */
	model?: string;
}

export interface PullResult {
	success: boolean;
	repoPath: string;
	analysisSource: "remote" | "local" | "cached";
	skillInstalled: boolean;
	message?: string;
}

export interface InstallSkillInput {
	repoName: string;
	skillContent: string;
	summaryContent: string;
	architectureContent: string;
}

export async function installSkill(input: InstallSkillInput): Promise<void> {
	installSkillWithReferences(input.repoName, {
		skillContent: input.skillContent,
		summaryContent: input.summaryContent,
		architectureContent: input.architectureContent,
	});
}

/**
 * Rewrite skill paths from remote analysis to use local paths.
 * Replaces ${REPO} and ${ANALYSIS} variables with actual local values.
 */
function rewriteSkillPaths(skill: Skill, localRepoPath: string, localAnalysisPath: string): Skill {
	const rewritePath = (path: string): string => {
		return path.replace(/\$\{REPO\}/g, localRepoPath).replace(/\$\{ANALYSIS\}/g, localAnalysisPath);
	};

	return {
		...skill,
		basePaths: {
			repo: localRepoPath,
			analysis: localAnalysisPath,
		},
		quickPaths: skill.quickPaths.map((qp) => ({
			...qp,
			path: rewritePath(qp.path),
		})),
		searchPatterns: skill.searchPatterns.map((sp) => ({
			...sp,
			path: rewritePath(sp.path),
		})),
		// commonPatterns steps may contain paths too
		commonPatterns: skill.commonPatterns?.map((cp: { name: string; steps: string[] }) => ({
			...cp,
			steps: cp.steps.map(rewritePath),
		})),
	};
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
		provider,
		model,
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

							// Rewrite skill paths for local environment
							const localAnalysisPath = getAnalysisPath(source.fullName, source.provider);
							const rewrittenSkill = rewriteSkillPaths(
								remoteAnalysis.skill,
								repoPath,
								localAnalysisPath,
							);

							// Save analysis locally with rewritten skill
							s.start("Saving analysis...");
							saveAnalysisLocally(source, {
								...remoteAnalysis,
								skill: rewrittenSkill,
							});
							s.stop("Analysis saved");

							s.start("Installing skill...");
							const skillMd = formatSkillMd(rewrittenSkill, {
								commitSha: remoteAnalysis.commitSha,
								generated: remoteAnalysis.analyzedAt?.split("T")[0],
							});
							const architectureMd = `# Architecture\n\n\`\`\`json\n${JSON.stringify(remoteAnalysis.architecture, null, 2)}\n\`\`\``;
							await installSkill({
								repoName: source.fullName,
								skillContent: skillMd,
								summaryContent: remoteAnalysis.summary,
								architectureContent: architectureMd,
							});
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

		verboseLog(`Checking for cached analysis at: ${getLocalAnalysisPath(source)}`, verbose);
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
				const analysisPath = getLocalAnalysisPath(source);
				const summaryContent = existsSync(join(analysisPath, "summary.md"))
					? readFileSync(join(analysisPath, "summary.md"), "utf-8")
					: "";
				const architectureContent = existsSync(join(analysisPath, "architecture.md"))
					? readFileSync(join(analysisPath, "architecture.md"), "utf-8")
					: "";
				await installSkill({
					repoName,
					skillContent: skillMd,
					summaryContent,
					architectureContent,
				});
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

			const qualifiedName = source.type === "remote" ? source.fullName : source.name;
			const pipelineOptions = { onProgress, onDebug, qualifiedName, provider, model };
			const result = await runAnalysisPipeline(repoPath, pipelineOptions);

			const { skill: mergedSkill, graph, architectureGraph } = result;
			const skill = mergedSkill.skill;
			const { entities, prose } = mergedSkill;

			const analysisCommitSha = getCommitSha(repoPath);
			const analyzedAt = new Date().toISOString();
			const generated = analyzedAt.split("T")[0];
			const repoName = source.type === "remote" ? source.fullName : source.name;

			const analysisPath =
				source.type === "remote"
					? getAnalysisPath(source.fullName, source.provider)
					: join(getMetaRoot(), "analyses", `local--${source.qualifiedName.replace("local:", "")}`);

			mkdirSync(analysisPath, { recursive: true });

			const summaryMd = formatSummaryMd(prose, { repoName });
			writeFileSync(join(analysisPath, "summary.md"), summaryMd, "utf-8");

			const architectureMd = formatArchitectureMd(architectureGraph, entities, graph);
			writeFileSync(join(analysisPath, "architecture.md"), architectureMd, "utf-8");

			writeFileSync(join(analysisPath, "skill.json"), JSON.stringify(skill), "utf-8");

			const skillMd = formatSkillMd(skill, { commitSha: analysisCommitSha, generated });
			writeFileSync(join(analysisPath, "SKILL.md"), skillMd, "utf-8");

			const meta = { analyzedAt, commitSha: analysisCommitSha, version: "0.1.0" };
			writeFileSync(join(analysisPath, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

			installSkillWithReferences(repoName, {
				skillContent: skillMd,
				summaryContent: summaryMd,
				architectureContent: architectureMd,
			});

			if (!verbose) {
				s.stop("Analysis complete");
			} else {
				p.log.success("Analysis complete");
			}

			const entry = getIndexEntry(source.qualifiedName);
			if (entry) {
				updateIndex({
					...entry,
					analyzedAt,
					commitSha: analysisCommitSha,
					hasSkill: true,
				});
			}

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
