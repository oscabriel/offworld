/**
 * Generate command handler
 * PRD 4.4: Run full analysis pipeline locally
 */

import * as p from "@clack/prompts";
import {
	parseRepoInput,
	cloneRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	checkRemote,
	runAnalysisPipeline,
	loadConfig,
	updateIndex,
	getIndexEntry,
} from "@offworld/sdk";

export interface GenerateOptions {
	repo: string;
	force?: boolean;
}

export interface GenerateResult {
	success: boolean;
	analysisPath?: string;
	message?: string;
}

/**
 * Generate command handler - runs full local analysis
 */
export async function generateHandler(options: GenerateOptions): Promise<GenerateResult> {
	const { repo, force = false } = options;
	const config = loadConfig();

	const s = p.spinner();

	try {
		// Parse repo input
		s.start("Parsing repository input...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");

		let repoPath: string;

		// For remote repos, check if analysis exists on remote
		if (source.type === "remote" && !force) {
			s.start("Checking for existing remote analysis...");
			const remoteCheck = await checkRemote(source.fullName);

			if (remoteCheck.exists) {
				s.stop("Remote analysis exists");
				p.log.warn(
					`Remote analysis already exists for ${source.fullName} (commit: ${remoteCheck.commitSha?.slice(0, 7)})`
				);
				p.log.info("Use --force to generate a new local analysis anyway.");
				p.log.info("Or use 'ow pull' to fetch the existing analysis.");

				return {
					success: false,
					message: "Remote analysis exists. Use --force to override.",
				};
			}
			s.stop("No remote analysis found");
		}

		// Clone repo if not already cloned (remote only)
		if (source.type === "remote") {
			const qualifiedName = source.qualifiedName;

			if (isRepoCloned(qualifiedName)) {
				repoPath = getClonedRepoPath(qualifiedName)!;
				p.log.info(`Using existing clone at ${repoPath}`);
			} else {
				s.start(`Cloning ${source.fullName}...`);
				repoPath = await cloneRepo(source, {
					shallow: config.defaultShallow,
					config,
				});
				s.stop("Repository cloned");
			}
		} else {
			// Local repo - use the path directly
			repoPath = source.path;
		}

		// Run the analysis pipeline
		s.start("Running analysis pipeline...");

		const pipelineOptions = source.type === "remote"
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

		const result = await runAnalysisPipeline(repoPath, pipelineOptions);
		s.stop("Analysis complete");

		// Update index
		const entry = getIndexEntry(source.qualifiedName);
		if (entry) {
			updateIndex({
				...entry,
				analyzedAt: result.meta.analyzedAt,
				commitSha: result.meta.commitSha,
				hasSkill: true,
			});
		}

		// Show results
		p.log.success(`Analysis saved to: ${result.analysisPath}`);
		p.log.info(`Skill installed for: ${source.type === "remote" ? source.fullName : source.name}`);

		if (result.meta.estimatedTokens) {
			p.log.info(`Estimated tokens used: ${result.meta.estimatedTokens}`);
		}

		return {
			success: true,
			analysisPath: result.analysisPath,
		};
	} catch (error) {
		s.stop("Failed");
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			message,
		};
	}
}
