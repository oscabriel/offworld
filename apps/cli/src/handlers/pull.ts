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
	reference?: string;
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
	const referenceName = options.reference?.trim() || undefined;
	const { provider, model } = parseModelFlag(options.model);
	const config = loadConfig();
	const isReferenceOverride = Boolean(referenceName);

	const s = createSpinner();

	if (verbose) {
		p.log.info(
			`[verbose] Options: repo=${repo}, reference=${referenceName ?? "default"}, shallow=${shallow}, branch=${branch || "default"}, force=${force}`,
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

		if (isReferenceOverride && source.type !== "remote") {
			throw new Error("--reference can only be used with remote repositories");
		}
		if (isReferenceOverride && !referenceName) {
			throw new Error("--reference requires a reference name");
		}
		const requiredReferenceName = referenceName ?? "";

		// Check for cached analysis first
		if (!force && !isReferenceOverride && hasValidCache(source, currentSha)) {
			verboseLog("Using cached analysis", verbose);
			s.stop("Using cached reference");

			return {
				success: true,
				repoPath,
				analysisSource: "cached",
				skillInstalled: true,
			};
		}

		// Check remote API for remote repos (with SHA comparison)
		if (source.type === "remote" && (!force || isReferenceOverride)) {
			verboseLog(`Checking offworld.sh for analysis: ${source.fullName}`, verbose);
			s.start("Checking offworld.sh for analysis...");

			try {
				const remoteCheck = isReferenceOverride
					? await checkRemoteByName(source.fullName, requiredReferenceName)
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

					const shouldDownload = isReferenceOverride || isWithinThreshold;

					if (shouldDownload) {
						if (!isReferenceOverride) {
							if (commitDistance === 0 || remoteShaNorm === currentShaNorm) {
								verboseLog(`Remote SHA matches (${remoteShaNorm})`, verbose);
								s.stop("Remote reference found (exact match)");
							} else if (commitDistance !== null) {
								verboseLog(
									`Remote reference is ${commitDistance} commits behind (within ${MAX_COMMIT_DISTANCE} threshold)`,
									verbose,
								);
								s.stop(`Remote reference found (${commitDistance} commits behind)`);
							} else {
								verboseLog("Remote reference found (commit distance unknown)", verbose);
								s.stop("Remote reference found");
							}
						} else {
							s.stop("Remote reference found");
						}

						const previewUrl = referenceName
							? `https://offworld.sh/${source.fullName}/${encodeURIComponent(referenceName)}`
							: `https://offworld.sh/${source.fullName}`;
						p.log.info(`Preview: ${previewUrl}`);

						const useRemote = await p.confirm({
							message: "Download this reference from offworld.sh?",
							initialValue: true,
						});

						if (p.isCancel(useRemote)) {
							throw new Error("Operation cancelled");
						}

						if (!useRemote) {
							if (isReferenceOverride) {
								throw new Error("Remote reference download declined");
							}
							p.log.info("Skipping remote reference, generating locally...");
						} else {
							s.start("Downloading remote reference...");
							const remoteAnalysis = isReferenceOverride
								? await pullAnalysisByName(source.fullName, requiredReferenceName)
								: await pullAnalysis(source.fullName);

							if (remoteAnalysis) {
								s.stop("Downloaded remote reference");

								saveRemoteAnalysis(
									source.fullName,
									remoteAnalysis.referenceContent,
									remoteAnalysis.commitSha,
									remoteAnalysis.generatedAt ?? new Date().toISOString(),
								);

								const entry = getIndexEntry(source.qualifiedName);
								if (entry) {
									updateIndex({
										...entry,
										analyzedAt: remoteAnalysis.generatedAt,
										commitSha: remoteAnalysis.commitSha,
										hasSkill: true,
									});
								}

								p.log.success(
									referenceName
										? `Reference installed (${referenceName}) for: ${qualifiedName}`
										: `Reference installed for: ${qualifiedName}`,
								);

								return {
									success: true,
									repoPath,
									analysisSource: "remote",
									skillInstalled: true,
								};
							}
							if (isReferenceOverride) {
								throw new Error("Remote reference download failed");
							}
							s.stop("Remote download failed, generating locally...");
						}
					} else {
						const distanceInfo =
							commitDistance !== null ? ` (${commitDistance} commits behind)` : "";
						verboseLog(
							`Remote reference too outdated${distanceInfo}, threshold is ${MAX_COMMIT_DISTANCE}`,
							verbose,
						);
						s.stop(`Remote reference outdated${distanceInfo}`);
					}
				} else {
					s.stop("No remote analysis found");
				}
			} catch (err) {
				verboseLog(
					`Remote check failed: ${err instanceof Error ? err.message : "Unknown"}`,
					verbose,
				);
				if (isReferenceOverride) {
					throw err instanceof Error ? err : new Error("Remote check failed");
				}
				s.stop("Remote check failed, continuing locally");
			}
		}

		if (isReferenceOverride) {
			throw new Error(`Reference not found on offworld.sh: ${referenceName}`);
		}

		// Generate locally using AI
		verboseLog(`Starting AI reference generation for: ${repoPath}`, verbose);

		if (!verbose) {
			s.start("Generating reference with AI...");
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

			const { referenceContent, commitSha: analysisCommitSha } = result;
			const analyzedAt = new Date().toISOString();
			const meta = { analyzedAt, commitSha: analysisCommitSha, version: "0.1.0" };

			installSkillToFS(qualifiedName, referenceContent, meta);

			if (!verbose) {
				s.stop("Reference generated");
			} else {
				p.log.success("Reference generated");
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

			p.log.success(`Reference installed for: ${qualifiedName}`);

			if (source.type === "remote") {
				const authData = loadAuthData();
				if (authData?.token) {
					p.log.info(
						`Run 'ow push ${source.fullName}' to share this reference to https://offworld.sh.`,
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
				s.stop("Reference generation failed");
			}
			const errMessage = err instanceof Error ? err.message : "Unknown error";
			p.log.error(`Failed to generate reference: ${errMessage}`);

			// Local generation failure should be a hard failure (exit 1)
			throw new Error(`Reference generation failed: ${errMessage}`);
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
