import * as p from "@clack/prompts";
import {
	parseRepoInput,
	cloneRepo,
	isRepoCloned,
	getClonedRepoPath,
	checkRemote,
	generateSkillWithAI,
	installSkill,
	loadConfig,
	getSkillPath,
	updateIndex,
	getIndexEntry,
} from "@offworld/sdk";
import { createSpinner } from "../utils/spinner";

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

	const s = createSpinner();

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

		s.start("Generating skill with AI...");

		// Use fullName for remote repos (e.g. 'tanstack/query'), name for local repos
		const qualifiedName = source.type === "remote" ? source.fullName : source.name;

		const result = await generateSkillWithAI(repoPath, qualifiedName, {
			provider,
			model,
			onDebug: (msg) => s.message(msg),
		});
		s.stop("Skill generated");

		const { skillContent, commitSha } = result;
		const analyzedAt = new Date().toISOString();
		const meta = { analyzedAt, commitSha, version: "0.1.0" };

		const skillPath = getSkillPath(qualifiedName);

		installSkill(qualifiedName, skillContent, meta);

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
		p.log.info(`Skill installed for: ${qualifiedName}`);

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
