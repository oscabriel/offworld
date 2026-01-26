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
	/** Model override in provider/model format (e.g., "anthropic/claude-sonnet-4-20250514") */
	model?: string;
}

export interface GenerateResult {
	success: boolean;
	analysisPath?: string;
	message?: string;
}

function parseModelFlag(model?: string): { provider?: string; model?: string } {
	if (!model) return {};
	const parts = model.split("/");
	if (parts.length === 2) {
		return { provider: parts[0], model: parts[1] };
	}
	return { model };
}

export async function generateHandler(options: GenerateOptions): Promise<GenerateResult> {
	const { repo, force = false } = options;
	const { provider, model } = parseModelFlag(options.model);
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
			s.stop("Remote reference exists");
			// Always use --force to override if desired
			return {
				success: false,
				message: "Remote reference exists. Use --force to override.",
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
			onDebug: (msg: string) => s.message(msg),
		});
		s.stop("Skill generated");

		const { referenceContent, commitSha } = result;
		const analyzedAt = new Date().toISOString();
		const meta = { analyzedAt, commitSha, version: "0.1.0" };

		const skillPath = getSkillPath(qualifiedName);

		installSkill(qualifiedName, referenceContent, meta);

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
