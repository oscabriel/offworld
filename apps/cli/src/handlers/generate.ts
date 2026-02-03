import * as p from "@clack/prompts";
import {
	parseRepoInput,
	cloneRepo,
	isRepoCloned,
	getClonedRepoPath,
	installReference,
	loadConfig,
	getReferencePath,
} from "@offworld/sdk/internal";
import { checkRemote } from "@offworld/sdk/sync";
import { generateReferenceWithAI } from "@offworld/sdk/ai";
import { createSpinner } from "../utils/spinner";

export interface GenerateOptions {
	repo: string;
	force?: boolean;
	/** Model override in provider/model format (e.g., "anthropic/claude-sonnet-4-20250514") */
	model?: string;
}

export interface GenerateResult {
	success: boolean;
	referencePath?: string;
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
			s.start("Checking for existing remote reference...");
			const remoteCheck = await checkRemote(source.fullName);

			if (remoteCheck.exists) {
				s.stop("Remote reference exists");
				return {
					success: false,
					message: "Remote reference exists. Use --force to override.",
				};
			}
			s.stop("No remote reference found");
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

		s.start("Generating reference with AI...");

		const qualifiedName = source.qualifiedName;
		const referenceRepoName = source.type === "remote" ? source.fullName : source.name;

		const result = await generateReferenceWithAI(repoPath, referenceRepoName, {
			provider,
			model,
			onDebug: (msg: string) => s.message(msg),
		});
		s.stop("Reference generated");

		const { referenceContent, commitSha } = result;
		const referenceUpdatedAt = new Date().toISOString();
		const meta = { referenceUpdatedAt, commitSha, version: "0.1.0" };

		const referencePath = getReferencePath(referenceRepoName);

		installReference(qualifiedName, referenceRepoName, repoPath, referenceContent, meta);

		p.log.success(`Reference saved to: ${referencePath}`);
		p.log.info(`Reference installed for: ${qualifiedName}`);

		return {
			success: true,
			referencePath,
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
