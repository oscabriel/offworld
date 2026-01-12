import * as p from "@clack/prompts";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	parseRepoInput,
	cloneRepo,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	checkRemote,
	runAnalysisPipeline,
	installSkill,
	formatSkillMd,
	formatSummaryMd,
	formatArchitectureMd,
	loadConfig,
	getAnalysisPath,
	getMetaRoot,
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

export async function generateHandler(options: GenerateOptions): Promise<GenerateResult> {
	const { repo, force = false } = options;
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

		const pipelineOptions = {
			onProgress: (_step: string, message: string) => {
				s.message(message);
			},
		};

		const result = await runAnalysisPipeline(repoPath, pipelineOptions);
		s.stop("Analysis complete");

		const { skill: mergedSkill, graph } = result;
		const skill = mergedSkill.skill;
		const { entities, relationships, keyFiles } = mergedSkill;

		const commitSha = getCommitSha(repoPath);
		const analyzedAt = new Date().toISOString();
		const generated = analyzedAt.split("T")[0];
		const repoName = source.type === "remote" ? source.fullName : source.name;

		const analysisPath =
			source.type === "remote"
				? getAnalysisPath(source.fullName, source.provider)
				: join(getMetaRoot(), "analyses", `local--${source.qualifiedName.replace("local:", "")}`);

		mkdirSync(analysisPath, { recursive: true });

		const summaryMd = formatSummaryMd(skill.description, entities, keyFiles, { repoName });
		writeFileSync(join(analysisPath, "summary.md"), summaryMd, "utf-8");

		const architectureMd = formatArchitectureMd(entities, relationships, graph);
		writeFileSync(join(analysisPath, "architecture.md"), architectureMd, "utf-8");

		writeFileSync(join(analysisPath, "skill.json"), JSON.stringify(skill), "utf-8");

		const skillMd = formatSkillMd(skill, { commitSha, generated });
		writeFileSync(join(analysisPath, "SKILL.md"), skillMd, "utf-8");

		const meta = { analyzedAt, commitSha, version: "0.1.0" };
		writeFileSync(join(analysisPath, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

		installSkill(repoName, skillMd);

		const entry = getIndexEntry(source.qualifiedName);
		if (entry) {
			updateIndex({
				...entry,
				analyzedAt,
				commitSha,
				hasSkill: true,
			});
		}

		p.log.success(`Analysis saved to: ${analysisPath}`);
		p.log.info(`Skill installed for: ${repoName}`);
		p.log.info(
			`Files parsed: ${result.stats.filesParsed}, Symbols: ${result.stats.symbolsExtracted}`,
		);

		return {
			success: true,
			analysisPath,
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
