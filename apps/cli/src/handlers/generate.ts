import * as p from "@clack/prompts";
import {
	parseRepoInput,
	cloneRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	checkRemote,
	runAnalysisPipeline,
	installSkillWithReferences,
	formatSkillMd,
	formatSummaryMd,
	formatArchitectureMd,
	loadConfig,
	getSkillPath,
	updateIndex,
	getIndexEntry,
} from "@offworld/sdk";

export interface GenerateOptions {
	repo: string;
	force?: boolean;
	/** AI provider ID (e.g., "anthropic", "openai"). Overrides config. */
	provider?: string;
	/** AI model ID. Overrides config. */
	model?: string;
}

export interface GenerateResult {
	success: boolean;
	analysisPath?: string;
	message?: string;
}

export async function generateHandler(options: GenerateOptions): Promise<GenerateResult> {
	const { repo, force = false, provider, model } = options;
	const config = loadConfig();

	const s = p.spinner();

	try {
		s.start("Parsing repository input...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");

		let repoPath: string;

		if (source.type === "remote" && !force) {
			s.start("Checking for existing remote analysis...");
			const remoteCheck = await checkRemote(source.fullName);

			if (remoteCheck.exists) {
				s.stop("Remote analysis exists");
				p.log.warn(
					`Remote analysis already exists for ${source.fullName} (commit: ${remoteCheck.commitSha?.slice(0, 7)})`,
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
			repoPath = source.path;
		}

		s.start("Running analysis pipeline...");

		// Use fullName for remote repos (e.g. 'tanstack/query'), name for local repos
		const qualifiedName = source.type === "remote" ? source.fullName : source.name;
		const pipelineOptions = {
			onProgress: (_step: string, message: string) => {
				s.message(message);
			},
			qualifiedName,
			provider,
			model,
		};

		const result = await runAnalysisPipeline(repoPath, pipelineOptions);
		s.stop("Analysis complete");

		const { skill: mergedSkill, graph, architectureGraph } = result;
		const skill = mergedSkill.skill;
		const { entities, prose } = mergedSkill;

		const commitSha = getCommitSha(repoPath);
		const analyzedAt = new Date().toISOString();
		const generated = analyzedAt.split("T")[0];
		const repoName = source.type === "remote" ? source.fullName : source.name;

		const summaryMd = formatSummaryMd(prose, { repoName });
		const architectureMd = formatArchitectureMd(architectureGraph, entities, graph);
		const skillMd = formatSkillMd(skill, { commitSha, generated });
		const meta = { analyzedAt, commitSha, version: "0.1.0" };

		const skillPath = getSkillPath(repoName);

		installSkillWithReferences(repoName, {
			skillContent: skillMd,
			summaryContent: summaryMd,
			architectureContent: architectureMd,
			skillJson: JSON.stringify(skill, null, 2),
			metaJson: JSON.stringify(meta, null, 2),
		});

		const entry = getIndexEntry(source.qualifiedName);
		if (entry) {
			updateIndex({
				...entry,
				analyzedAt,
				commitSha,
				hasSkill: true,
			});
		}

		p.log.success(`Skill saved to: ${skillPath}`);
		p.log.info(`Skill installed for: ${repoName}`);
		p.log.info(
			`Files parsed: ${result.stats.filesParsed}, Symbols: ${result.stats.symbolsExtracted}`,
		);

		return {
			success: true,
			analysisPath: skillPath,
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
