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
	generateSkillWithAI,
	installSkill as installSkillToFS,
	type AnalysisData,
} from "@offworld/sdk";
import type { RepoSource } from "@offworld/types";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSpinner, type SpinnerLike } from "../utils/spinner";

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

function timestamp(): string {
	return new Date().toISOString().slice(11, 23);
}

function verboseLog(message: string, verbose: boolean): void {
	if (verbose) {
		p.log.info(`[${timestamp()}] ${message}`);
	}
}

function getLocalMetaDir(source: RepoSource): string {
	const name = source.type === "remote" ? source.fullName : source.name;
	return getMetaPath(name);
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

function hasValidCache(source: RepoSource, currentSha: string): boolean {
	const meta = loadLocalMeta(source);
	return meta?.commitSha?.slice(0, 7) === currentSha.slice(0, 7);
}

type RemoteSource = Extract<RepoSource, { type: "remote" }>;

async function tryUploadAnalysis(
	source: RemoteSource,
	commitSha: string,
	analyzedAt: string,
	verbose: boolean,
	spinner: SpinnerLike,
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

	try {
		const skillContent = readFileSync(join(skillDir, "SKILL.md"), "utf-8");

		// Simplified analysis data for new format
		const analysisData: AnalysisData = {
			fullName: source.fullName,
			summary: skillContent,
			architecture: { projectType: "library", entities: [], relationships: [], keyFiles: [], patterns: {} },
			skill: { name: source.fullName, description: "", quickPaths: [], searchPatterns: [], whenToUse: [] },
			fileIndex: [],
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

/**
 * Save remote analysis to local filesystem.
 * Remote analysis comes with pre-generated skill/summary content.
 */
function saveRemoteAnalysis(
	repoName: string,
	summary: string,
	commitSha: string,
	analyzedAt: string,
): void {
	const meta = { analyzedAt, commitSha, version: "0.1.0" };
	installSkillToFS(repoName, summary, meta);
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

	const s = createSpinner();

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
		const qualifiedName = source.type === "remote" ? source.fullName : source.name;

		// Check for cached analysis first
		if (!force && hasValidCache(source, currentSha)) {
			verboseLog("Using cached analysis", verbose);
			s.stop("Using cached skill");

			return {
				success: true,
				repoPath,
				analysisSource: "cached",
				skillInstalled: true,
			};
		}

		// Check remote API for remote repos (with SHA comparison)
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

							// Save the remote analysis locally
							saveRemoteAnalysis(
								source.fullName,
								remoteAnalysis.summary,
								remoteAnalysis.commitSha,
								remoteAnalysis.analyzedAt ?? new Date().toISOString(),
							);

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

							p.log.success(`Skill installed for: ${qualifiedName}`);

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

		// Generate locally using AI
		verboseLog(`Starting AI skill generation for: ${repoPath}`, verbose);

		if (!verbose) {
			s.start("Generating skill with AI...");
		}

		try {
			const onDebug = verbose
				? (message: string) => {
						p.log.info(`[${timestamp()}] [debug] ${message}`);
					}
				: (msg: string) => s.message(msg);

			const result = await generateSkillWithAI(repoPath, qualifiedName, {
				provider,
				model,
				onDebug,
			});

			const { skillContent, commitSha: analysisCommitSha } = result;
			const analyzedAt = new Date().toISOString();
			const meta = { analyzedAt, commitSha: analysisCommitSha, version: "0.1.0" };

			installSkillToFS(qualifiedName, skillContent, meta);

			if (!verbose) {
				s.stop("Skill generated");
			} else {
				p.log.success("Skill generated");
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

			p.log.success(`Skill installed for: ${qualifiedName}`);

			return {
				success: true,
				repoPath,
				analysisSource: "local",
				skillInstalled: true,
			};
		} catch (err) {
			if (!verbose) {
				s.stop("Skill generation failed");
			}
			const errMessage = err instanceof Error ? err.message : "Unknown error";
			p.log.error(`Failed to generate skill: ${errMessage}`);

			return {
				success: true,
				repoPath,
				analysisSource: "local",
				skillInstalled: false,
				message: `Repository cloned but skill generation failed: ${errMessage}`,
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
