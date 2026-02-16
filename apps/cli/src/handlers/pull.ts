import * as p from "@clack/prompts";
import {
	cloneRepo,
	updateRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	getCommitDistance,
	parseRepoInput,
	loadConfig,
	loadAuthData,
	getMetaPath,
	RepoExistsError,
	installReference,
	toReferenceFileName,
	Paths,
} from "@offworld/sdk/internal";
import {
	pullReference,
	pullReferenceByName,
	checkRemote,
	checkRemoteByName,
} from "@offworld/sdk/sync";
import { generateReferenceWithAI, type OpenCodeContext } from "@offworld/sdk/ai";
import { ReferenceMetaSchema, type RepoSource } from "@offworld/types";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";
import { resolveReferenceKeywordsForRepo } from "./shared";

export interface PullOptions {
	repo: string;
	reference?: string;
	sparse?: boolean;
	branch?: string;
	force?: boolean;
	verbose?: boolean;
	/** Clone/update repository only; skip reference download/generation. */
	cloneOnly?: boolean;
	/** Allow local AI generation when remote reference is unavailable/outdated. */
	allowGenerate?: boolean;
	/** Skip git fetch/pull (assumes repo is already up to date). */
	skipUpdate?: boolean;
	/** Shared OpenCode server context for batch generation. */
	openCodeContext?: OpenCodeContext;
	/** Suppress all output except errors (for batch operations) */
	quiet?: boolean;
	/** Model override in provider/model format (e.g., "anthropic/claude-sonnet-4-20250514") */
	model?: string;
	/** Skip confirmation prompts (auto-accept remote references) */
	skipConfirm?: boolean;
	/** Progress callback for external spinner updates */
	onProgress?: (message: string) => void;
}

export interface PullResult {
	success: boolean;
	repoPath: string;
	referenceSource: "remote" | "local" | "cached" | "none";
	referenceInstalled: boolean;
	message?: string;
}

function timestamp(): string {
	return new Date().toISOString().slice(11, 23);
}

function toTildePath(absolutePath: string): string {
	const home = homedir();
	if (absolutePath.startsWith(home)) {
		return "~" + absolutePath.slice(home.length);
	}
	return absolutePath;
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

function loadLocalMeta(
	source: RepoSource,
): { commitSha?: string; referenceUpdatedAt?: string } | null {
	const metaDir = getLocalMetaDir(source);
	const metaPath = join(metaDir, "meta.json");
	if (!existsSync(metaPath)) {
		return null;
	}

	try {
		const json = JSON.parse(readFileSync(metaPath, "utf-8"));
		const parsed = ReferenceMetaSchema.safeParse(json);
		if (!parsed.success) {
			return null;
		}
		return parsed.data;
	} catch {
		return null;
	}
}

function hasValidCache(source: RepoSource, currentSha: string): boolean {
	const meta = loadLocalMeta(source);
	return meta?.commitSha?.slice(0, 7) === currentSha.slice(0, 7);
}

/**
 * Save remote reference to local filesystem.
 * Remote reference comes with pre-generated reference content.
 */
async function saveRemoteReference(
	qualifiedName: string,
	referenceRepoName: string,
	localPath: string,
	referenceContent: string,
	commitSha: string,
	referenceUpdatedAt: string,
): Promise<void> {
	const meta = { referenceUpdatedAt, commitSha, version: "0.1.0" };
	const keywords = await resolveReferenceKeywordsForRepo(localPath, referenceRepoName);
	installReference(qualifiedName, referenceRepoName, localPath, referenceContent, meta, keywords);
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
	const {
		repo,
		sparse = false,
		branch,
		force = false,
		cloneOnly = false,
		verbose = false,
		allowGenerate = true,
		skipUpdate = false,
		quiet = false,
		skipConfirm = false,
		onProgress,
	} = options;
	const referenceName = options.reference?.trim() || undefined;
	const { provider, model } = parseModelFlag(options.model);
	const config = loadConfig();
	const isReferenceOverride = Boolean(referenceName);

	// If onProgress is provided, use a callback-based spinner that updates in place
	const s = onProgress
		? {
				start: (msg?: string) => onProgress(msg ?? ""),
				stop: (_msg?: string) => {},
				message: (msg: string) => onProgress(msg),
			}
		: createSpinner({ silent: quiet });

	// Helper to conditionally log
	const log = quiet ? () => {} : (msg: string) => p.log.info(msg);
	const logSuccess = quiet ? () => {} : (msg: string) => p.log.success(msg);

	if (verbose && !quiet) {
		p.log.info(
			`[verbose] Options: repo=${repo}, reference=${referenceName ?? "default"}, branch=${branch || "default"}, force=${force}, cloneOnly=${cloneOnly}`,
		);
	}

	try {
		s.start("Parsing repository input...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");
		verboseLog(
			`Parsed source: type=${source.type}, qualifiedName=${source.qualifiedName}`,
			verbose,
		);

		let repoPath: string;

		if (source.type === "remote") {
			const qualifiedName = source.qualifiedName;

			if (isRepoCloned(qualifiedName)) {
				if (skipUpdate) {
					repoPath = getClonedRepoPath(qualifiedName)!;
					s.stop("Using existing clone");
				} else {
					s.start("Updating repository...");
					const result = await updateRepo(qualifiedName);
					repoPath = getClonedRepoPath(qualifiedName)!;

					if (result.updated) {
						s.stop(
							`Updated (${result.previousSha.slice(0, 7)} → ${result.currentSha.slice(0, 7)})`,
						);
					} else {
						s.stop("Already up to date");
					}
				}
			} else {
				s.start(`Cloning ${source.fullName}...`);
				try {
					repoPath = await cloneRepo(source, {
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

		if (cloneOnly && isReferenceOverride) {
			throw new Error("--clone-only cannot be combined with --reference");
		}

		if (cloneOnly) {
			s.stop("Clone ready; reference generation skipped (--clone-only)");
			return {
				success: true,
				repoPath,
				referenceSource: "none",
				referenceInstalled: false,
				message: "Clone ready; reference generation skipped (--clone-only).",
			};
		}

		if (!force && !isReferenceOverride && hasValidCache(source, currentSha)) {
			verboseLog("Using cached reference", verbose);
			s.stop("Using cached reference");

			return {
				success: true,
				repoPath,
				referenceSource: "cached",
				referenceInstalled: true,
			};
		}

		if (source.type === "remote" && (!force || isReferenceOverride)) {
			verboseLog(`Checking offworld.sh for reference: ${source.fullName}`, verbose);
			s.start("Checking offworld.sh for reference...");

			try {
				const remoteCheck = isReferenceOverride
					? await checkRemoteByName(source.fullName, requiredReferenceName)
					: await checkRemote(source.fullName);

				if (remoteCheck.exists && remoteCheck.commitSha) {
					const remoteSha = remoteCheck.commitSha;
					const remoteShaNorm = remoteSha.slice(0, 7);
					const currentShaNorm = currentSha.slice(0, 7);

					const maxCommitDistance = config.maxCommitDistance ?? 20;
					const acceptUnknownDistance = config.acceptUnknownDistance ?? false;
					const commitDistance = getCommitDistance(repoPath, remoteSha, currentSha);
					const isExactMatch = remoteShaNorm === currentShaNorm || commitDistance === 0;
					const isWithinDistance = commitDistance !== null && commitDistance <= maxCommitDistance;
					const hasUnknownDistance = commitDistance === null;
					const isWithinThreshold =
						isExactMatch || isWithinDistance || (acceptUnknownDistance && hasUnknownDistance);

					const shouldDownload = isReferenceOverride || isWithinThreshold;

					if (shouldDownload) {
						if (!isReferenceOverride) {
							if (isExactMatch) {
								verboseLog(`Remote SHA matches (${remoteShaNorm})`, verbose);
								s.stop("Remote reference found (exact match)");
							} else if (isWithinDistance) {
								verboseLog(
									`Remote reference is ${commitDistance} commits behind (within ${maxCommitDistance} threshold)`,
									verbose,
								);
								s.stop(`Remote reference found (${commitDistance} commits behind)`);
							} else if (hasUnknownDistance) {
								const fallbackStatus = acceptUnknownDistance
									? "Remote reference found (distance unknown, accepted)"
									: "Remote reference found (commit distance unknown)";
								verboseLog(fallbackStatus, verbose);
								s.stop("Remote reference found");
							} else {
								s.stop("Remote reference found");
							}
						} else {
							s.stop("Remote reference found");
						}

						const previewUrl = referenceName
							? `https://offworld.sh/${source.fullName}/${encodeURIComponent(referenceName)}`
							: `https://offworld.sh/${source.fullName}`;
						log(`Preview: ${previewUrl}`);

						// In quiet mode or skipConfirm, auto-accept remote references
						let useRemote = true;
						if (!quiet && !skipConfirm) {
							const confirmResult = await p.confirm({
								message: "Download this reference from offworld.sh?",
								initialValue: true,
							});

							if (p.isCancel(confirmResult)) {
								throw new Error("Operation cancelled");
							}
							useRemote = confirmResult;
						}

						if (!useRemote) {
							if (isReferenceOverride) {
								throw new Error("Remote reference download declined");
							}
							log("Skipping remote reference, generating locally...");
						} else {
							s.start("Downloading remote reference...");
							const remoteReference = isReferenceOverride
								? await pullReferenceByName(source.fullName, requiredReferenceName)
								: await pullReference(source.fullName);

							if (remoteReference) {
								s.stop("Downloaded remote reference");

								await saveRemoteReference(
									source.qualifiedName,
									source.fullName,
									repoPath,
									remoteReference.referenceContent,
									remoteReference.commitSha,
									remoteReference.generatedAt ?? new Date().toISOString(),
								);

								const remoteReferenceFileName = toReferenceFileName(qualifiedName);
								const remoteReferencePath = join(
									Paths.offworldReferencesDir,
									remoteReferenceFileName,
								);
								const remoteRelativePath = toTildePath(remoteReferencePath);
								logSuccess(
									referenceName
										? `Reference file (${referenceName}) at: ${remoteRelativePath}`
										: `Reference file at: ${remoteRelativePath}`,
								);

								return {
									success: true,
									repoPath,
									referenceSource: "remote",
									referenceInstalled: true,
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
							`Remote reference too outdated${distanceInfo}, threshold is ${maxCommitDistance}`,
							verbose,
						);
						s.stop(`Remote reference outdated${distanceInfo}`);
					}
				} else {
					s.stop("No remote reference found");
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

		if (!allowGenerate && source.type === "remote") {
			const message =
				"Remote reference unavailable, outdated, or declined; local generation is disabled.";
			s.stop(message);
			return {
				success: false,
				repoPath,
				referenceSource: "local",
				referenceInstalled: false,
				message,
			};
		}

		verboseLog(`Starting AI reference generation for: ${repoPath}`, verbose);

		if (!verbose) {
			s.start("Generating reference with OpenCode...");
		}

		try {
			const onDebug = verbose
				? (message: string) => {
						p.log.info(`[${timestamp()}] [debug] ${message}`);
					}
				: (msg: string) => {
						// Filter out internal debug messages (prefixed with [) from spinner
						if (!msg.startsWith("[")) {
							s.message(msg);
						}
					};

			const result = await generateReferenceWithAI(repoPath, qualifiedName, {
				provider,
				model,
				openCodeContext: options.openCodeContext,
				onDebug,
			});

			const { referenceContent, commitSha: referenceCommitSha } = result;
			const referenceUpdatedAt = new Date().toISOString();
			const meta = { referenceUpdatedAt, commitSha: referenceCommitSha, version: "0.1.0" };
			const referenceRepoName = source.type === "remote" ? source.fullName : source.name;
			const keywords = await resolveReferenceKeywordsForRepo(repoPath, referenceRepoName);

			installReference(
				source.qualifiedName,
				referenceRepoName,
				repoPath,
				referenceContent,
				meta,
				keywords,
			);

			const referenceFileName = toReferenceFileName(qualifiedName);
			const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
			const relativePath = toTildePath(referencePath);

			if (!verbose) {
				s.stop("Reference file created");
			} else {
				logSuccess("Reference file created");
			}

			logSuccess(`Reference file at: ${relativePath}`);

			if (source.type === "remote") {
				const authData = loadAuthData();
				if (authData?.token) {
					log(`Run 'ow push ${source.fullName}' to share this reference to https://offworld.sh.`);
				}
			}

			return {
				success: true,
				repoPath,
				referenceSource: "local",
				referenceInstalled: true,
			};
		} catch (err) {
			if (!verbose) {
				s.stop("Reference generation failed");
			}
			const errMessage = err instanceof Error ? err.message : "Unknown error";
			p.log.error(`Failed to generate reference: ${errMessage}`);

			throw new Error(`Reference generation failed: ${errMessage}`);
		}
	} catch (error) {
		s.stop("Failed");
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			repoPath: "",
			referenceSource: "local",
			referenceInstalled: false,
			message,
		};
	}
}
