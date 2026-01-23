import * as p from "@clack/prompts";
import {
	cloneRepo,
	updateRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	parseRepoInput,
	pullAnalysis,
	checkRemote,
	loadConfig,
	loadAuthData,
	getMetaPath,
	updateIndex,
	getIndexEntry,
	RepoExistsError,
	generateSkillWithAI,
	installSkill as installSkillToFS,
} from "@offworld/sdk";
import type { RepoSource } from "@offworld/types";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";

export interface PullOptions {
	repo: string;
	shallow?: boolean;
	sparse?: boolean;
	branch?: string;
	force?: boolean;
	verbose?: boolean;
	/** Model override in provider/model format (e.g., "anthropic/claude-sonnet-4-20250514") */
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

function parseModelFlag(model?: string): { provider?: string; model?: string } {
	if (!model) return {};
	const parts = model.split("/");
	if (parts.length === 2) {
		return { provider: parts[0], model: parts[1] };
	}
	return { model };
}

export async function pullHandler(options: PullOptions): Promise<PullResult> {
	const { repo, shallow = true, sparse = false, branch, force = false, verbose = false } = options;
	const { provider, model } = parseModelFlag(options.model);
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
						verboseLog(`Remote SHA matches (${remoteShaNorm})`, verbose);
						s.stop("Remote skill found");

						const previewUrl = `https://offworld.sh/${source.fullName}`;
						p.log.info(`Preview: ${previewUrl}`);

						const useRemote = await p.confirm({
							message: "Download this skill from offworld.sh?",
							initialValue: true,
						});

						if (p.isCancel(useRemote)) {
							throw new Error("Operation cancelled");
						}

						if (!useRemote) {
							p.log.info("Skipping remote skill, generating locally...");
						} else {
							s.start("Downloading remote skill...");
							const remoteAnalysis = await pullAnalysis(source.fullName);

							if (remoteAnalysis) {
								s.stop("Downloaded remote skill");

								saveRemoteAnalysis(
									source.fullName,
									remoteAnalysis.summary,
									remoteAnalysis.commitSha,
									remoteAnalysis.analyzedAt ?? new Date().toISOString(),
								);

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
							s.stop("Remote download failed, generating locally...");
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

			p.log.success(`Skill installed for: ${qualifiedName}`);

			if (source.type === "remote") {
				const authData = loadAuthData();
				if (authData?.token) {
					p.log.info(
						`Run 'ow push ${source.fullName}' to share this skill to https://offworld.sh.`,
					);
				}
			}

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

			// Local generation failure should be a hard failure (exit 1)
			throw new Error(`Skill generation failed: ${errMessage}`);
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
