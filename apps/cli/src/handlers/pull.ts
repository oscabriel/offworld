import * as p from "@clack/prompts";
import {
	cloneRepo,
	updateRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	getCommitDistance,
	parseRepoInput,
	pullAnalysis,
	pullAnalysisByName,
	checkRemote,
	checkRemoteByName,
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
	skill?: string;
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
 * Save remote skill to local filesystem.
 * Remote skill comes with pre-generated skill content.
 */
function saveRemoteAnalysis(
	repoName: string,
	skillContent: string,
	commitSha: string,
	analyzedAt: string,
): void {
	const meta = { analyzedAt, commitSha, version: "0.1.0" };
	installSkillToFS(repoName, skillContent, meta);
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
	const { repo, shallow = false, sparse = false, branch, force = false, verbose = false } = options;
	const skillName = options.skill?.trim() || undefined;
	const { provider, model } = parseModelFlag(options.model);
	const config = loadConfig();
	const isSkillOverride = Boolean(skillName);

	const s = createSpinner();

	if (verbose) {
		p.log.info(
			`[verbose] Options: repo=${repo}, skill=${skillName ?? "default"}, shallow=${shallow}, branch=${branch || "default"}, force=${force}`,
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

		if (isSkillOverride && source.type !== "remote") {
			throw new Error("--skill can only be used with remote repositories");
		}
		if (isSkillOverride && !skillName) {
			throw new Error("--skill requires a skill name");
		}
		const requiredSkillName = skillName ?? "";

		// Check for cached analysis first
		if (!force && !isSkillOverride && hasValidCache(source, currentSha)) {
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
		if (source.type === "remote" && (!force || isSkillOverride)) {
			verboseLog(`Checking offworld.sh for analysis: ${source.fullName}`, verbose);
			s.start("Checking offworld.sh for analysis...");

			try {
				const remoteCheck = isSkillOverride
					? await checkRemoteByName(source.fullName, requiredSkillName)
					: await checkRemote(source.fullName);

				if (remoteCheck.exists && remoteCheck.commitSha) {
					const remoteSha = remoteCheck.commitSha;
					const remoteShaNorm = remoteSha.slice(0, 7);
					const currentShaNorm = currentSha.slice(0, 7);

					// Check commit distance - accept if within threshold
					const MAX_COMMIT_DISTANCE = 20;
					const commitDistance = getCommitDistance(repoPath, remoteSha, currentSha);
					const isWithinThreshold =
						remoteShaNorm === currentShaNorm ||
						(commitDistance !== null && commitDistance <= MAX_COMMIT_DISTANCE);

					const shouldDownload = isSkillOverride || isWithinThreshold;

					if (shouldDownload) {
						if (!isSkillOverride) {
							if (commitDistance === 0 || remoteShaNorm === currentShaNorm) {
								verboseLog(`Remote SHA matches (${remoteShaNorm})`, verbose);
								s.stop("Remote skill found (exact match)");
							} else if (commitDistance !== null) {
								verboseLog(
									`Remote skill is ${commitDistance} commits behind (within ${MAX_COMMIT_DISTANCE} threshold)`,
									verbose,
								);
								s.stop(`Remote skill found (${commitDistance} commits behind)`);
							} else {
								verboseLog("Remote skill found (commit distance unknown)", verbose);
								s.stop("Remote skill found");
							}
						} else {
							s.stop("Remote skill found");
						}

						const previewUrl = skillName
							? `https://offworld.sh/${source.fullName}/${encodeURIComponent(skillName)}`
							: `https://offworld.sh/${source.fullName}`;
						p.log.info(`Preview: ${previewUrl}`);

						const useRemote = await p.confirm({
							message: "Download this skill from offworld.sh?",
							initialValue: true,
						});

						if (p.isCancel(useRemote)) {
							throw new Error("Operation cancelled");
						}

						if (!useRemote) {
							if (isSkillOverride) {
								throw new Error("Remote skill download declined");
							}
							p.log.info("Skipping remote skill, generating locally...");
						} else {
							s.start("Downloading remote skill...");
							const remoteAnalysis = isSkillOverride
								? await pullAnalysisByName(source.fullName, requiredSkillName)
								: await pullAnalysis(source.fullName);

							if (remoteAnalysis) {
								s.stop("Downloaded remote skill");

								saveRemoteAnalysis(
									source.fullName,
									remoteAnalysis.skillContent,
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

								p.log.success(
									skillName
										? `Skill installed (${skillName}) for: ${qualifiedName}`
										: `Skill installed for: ${qualifiedName}`,
								);

								return {
									success: true,
									repoPath,
									analysisSource: "remote",
									skillInstalled: true,
								};
							}
							if (isSkillOverride) {
								throw new Error("Remote skill download failed");
							}
							s.stop("Remote download failed, generating locally...");
						}
					} else {
						const distanceInfo =
							commitDistance !== null ? ` (${commitDistance} commits behind)` : "";
						verboseLog(
							`Remote skill too outdated${distanceInfo}, threshold is ${MAX_COMMIT_DISTANCE}`,
							verbose,
						);
						s.stop(`Remote skill outdated${distanceInfo}`);
					}
				} else {
					s.stop("No remote analysis found");
				}
			} catch (err) {
				verboseLog(
					`Remote check failed: ${err instanceof Error ? err.message : "Unknown"}`,
					verbose,
				);
				if (isSkillOverride) {
					throw err instanceof Error ? err : new Error("Remote check failed");
				}
				s.stop("Remote check failed, continuing locally");
			}
		}

		if (isSkillOverride) {
			throw new Error(`Skill not found on offworld.sh: ${skillName}`);
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
