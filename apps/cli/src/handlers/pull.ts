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
	getSkillPath,
	getMetaPath,
	updateIndex,
	getIndexEntry,
	RepoExistsError,
	runAnalysisPipeline,
	installSkillWithReferences,
	isAnalysisStale,
	formatSkillMd,
	formatSummaryMd,
	formatArchitectureMdLegacy,
	type PullResponse,
	type AnalysisData,
} from "@offworld/sdk";
import type { RepoSource, Skill } from "@offworld/types";
import { existsSync, readFileSync } from "node:fs";
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

function saveAnalysisLocally(source: RepoSource, analysis: PullResponse): void {
	const repoName = source.type === "remote" ? source.fullName : source.name;

	const skillMd = formatSkillMd(analysis.skill, {
		commitSha: analysis.commitSha,
		generated: analysis.analyzedAt?.split("T")[0],
	});

	const meta = {
		analyzedAt: analysis.analyzedAt,
		commitSha: analysis.commitSha,
		version: "0.1.0",
		pullCount: analysis.pullCount,
	};

	installSkillWithReferences(repoName, {
		skillContent: skillMd,
		summaryContent: analysis.summary,
		architectureContent: `# Architecture\n\n\`\`\`json\n${JSON.stringify(analysis.architecture, null, 2)}\n\`\`\``,
		skillJson: JSON.stringify(analysis.skill, null, 2),
		metaJson: JSON.stringify(meta, null, 2),
		architectureJson: JSON.stringify(analysis.architecture, null, 2),
		fileIndexJson: JSON.stringify(analysis.fileIndex, null, 2),
	});
}

function hasLocalAnalysis(source: RepoSource, repoPath: string): boolean {
	const metaDir = getLocalMetaDir(source);
	const currentSha = getCommitSha(repoPath);
	const stalenessResult = isAnalysisStale(metaDir, currentSha);
	return !stalenessResult.isStale;
}

function getLocalSkillDir(source: RepoSource): string {
	const name = source.type === "remote" ? source.fullName : source.name;
	return getSkillPath(name);
}

function getLocalMetaDir(source: RepoSource): string {
	const name = source.type === "remote" ? source.fullName : source.name;
	return getMetaPath(name);
}

function loadLocalSkill(source: RepoSource): Skill | null {
	const metaDir = getLocalMetaDir(source);
	const skillPath = join(metaDir, "skill.json");
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
	const metaDir = getLocalMetaDir(source);
	const metaPath = join(metaDir, "meta.json");
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

	const skillDir = getSkillPath(source.fullName);
	const metaDir = getMetaPath(source.fullName);
	const refsDir = join(skillDir, "references");

	try {
		const summary = readFileSync(join(refsDir, "summary.md"), "utf-8");
		const architecture = JSON.parse(readFileSync(join(metaDir, "architecture.json"), "utf-8"));
		const skill = JSON.parse(readFileSync(join(metaDir, "skill.json"), "utf-8"));
		const fileIndex = JSON.parse(readFileSync(join(metaDir, "file-index.json"), "utf-8"));

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

		// Check remote API first for remote repos (with SHA comparison)
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
							const localSkillDir = getSkillPath(source.fullName);
							const rewrittenSkill = rewriteSkillPaths(
								remoteAnalysis.skill,
								repoPath,
								localSkillDir,
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

		verboseLog(`Checking for cached analysis at: ${getLocalMetaDir(source)}`, verbose);
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
				const skillDir = getLocalSkillDir(source);
				const refsDir = join(skillDir, "references");
				const summaryContent = existsSync(join(refsDir, "summary.md"))
					? readFileSync(join(refsDir, "summary.md"), "utf-8")
					: "";
				const architectureContent = existsSync(join(refsDir, "architecture.md"))
					? readFileSync(join(refsDir, "architecture.md"), "utf-8")
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

			const summaryMd = formatSummaryMd(prose, { repoName });
			const architectureMd = formatArchitectureMdLegacy(architectureGraph, entities, graph);
			const skillMd = formatSkillMd(skill, { commitSha: analysisCommitSha, generated });
			const meta = { analyzedAt, commitSha: analysisCommitSha, version: "0.1.0" };

			installSkillWithReferences(repoName, {
				skillContent: skillMd,
				summaryContent: summaryMd,
				architectureContent: architectureMd,
				skillJson: JSON.stringify(skill, null, 2),
				metaJson: JSON.stringify(meta, null, 2),
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
