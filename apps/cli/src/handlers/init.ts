import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import {
	loadConfig,
	saveConfig,
	getConfigPath,
	getMetaRoot,
	Paths,
	detectInstalledAgents,
	getAllAgentConfigs,
	getAuthStatus,
	installGlobalSkill,
	listProviders,
	getProvider,
	validateProviderModel,
	discoverRepos,
	type ProviderInfo,
	type ModelInfo,
} from "@offworld/sdk";
import type { Config, Agent } from "@offworld/types";
import { authLoginHandler } from "./auth.js";

export interface InitOptions {
	yes?: boolean;
	/** Reconfigure even if config exists */
	force?: boolean;
	/** Skip auth check (useful for testing) */
	skipAuth?: boolean;
	/** AI provider and model (e.g., opencode/claude-sonnet-4-5) */
	model?: string;
	/** Where to clone repos */
	repoRoot?: string;
	/** Comma-separated agents */
	agents?: string;
}

export interface InitResult {
	success: boolean;
	configPath: string;
}

const DEFAULT_PROVIDER = "anthropic";
const MAX_SELECT_ITEMS = 15;

function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return resolve(homedir(), path.slice(2));
	}
	return resolve(path);
}

function collapseTilde(path: string): string {
	const home = homedir();
	if (path.startsWith(home)) {
		return "~" + path.slice(home.length);
	}
	return path;
}

function validatePath(value: string): string | undefined {
	if (!value.trim()) {
		return "Path cannot be empty";
	}
	return undefined;
}

function detectProjectRoot(): string | null {
	let currentDir = process.cwd();
	while (currentDir !== homedir()) {
		const packageJsonPath = join(currentDir, "package.json");
		if (existsSync(packageJsonPath)) {
			return currentDir;
		}
		const parent = dirname(currentDir);
		if (parent === currentDir) {
			break;
		}
		currentDir = parent;
	}
	return null;
}

export async function initHandler(options: InitOptions = {}): Promise<InitResult> {
	const configPath = getConfigPath();
	const existingConfig = loadConfig();
	const configExists = existsSync(configPath);
	const projectRoot = detectProjectRoot();

	p.intro("ow init");

	if (!options.skipAuth) {
		const authStatus = await getAuthStatus();
		if (!authStatus.isLoggedIn) {
			p.log.info("You are not logged in");
			const shouldLogin = await p.confirm({
				message: "Do you want to log in now?",
				initialValue: true,
			});

			if (!p.isCancel(shouldLogin) && shouldLogin) {
				await authLoginHandler();
			}
		}
	}

	if (configExists) {
		if (!options.force) {
			if (projectRoot) {
				p.log.warn(`Global config already exists at ${configPath}`);
				p.log.info("");
				p.log.info("Did you mean to run project setup? Use:");
				p.log.info("  ow project init");
				p.log.info("");
				p.log.info("To reconfigure global settings, use:");
				p.log.info("  ow init --force");
				p.outro("");
				return { success: false, configPath };
			}
			p.log.warn("Already configured. Use --force to reconfigure.");
			p.outro("");
			return { success: false, configPath };
		}
		p.log.info("Reconfiguring global settings...");
	}

	let repoRoot: string;
	if (options.repoRoot) {
		repoRoot = collapseTilde(expandTilde(options.repoRoot));
	} else {
		const repoRootResult = await p.text({
			message: "Where should repositories be cloned?",
			placeholder: "~/ow",
			initialValue: existingConfig.repoRoot,
			validate: validatePath,
		});

		if (p.isCancel(repoRootResult)) {
			p.outro("Setup cancelled");
			return { success: false, configPath };
		}

		repoRoot = collapseTilde(expandTilde(repoRootResult));
	}

	let provider: string;
	let model: string;

	if (options.model) {
		const parts = options.model.split("/");
		if (parts.length !== 2) {
			p.log.error(`Invalid model format. Expected 'provider/model', got '${options.model}'`);
			p.outro("Setup failed");
			return { success: false, configPath };
		}
		provider = parts[0]!;
		model = parts[1]!;

		const validation = await validateProviderModel(provider, model);
		if (!validation.valid) {
			p.log.error(validation.error!);
			p.outro("Setup failed");
			return { success: false, configPath };
		}
	} else {
		const spin = p.spinner();
		spin.start("Fetching available providers...");

		let providers;
		try {
			providers = await listProviders();
		} catch (err) {
			spin.stop("Failed to fetch providers");
			p.log.error(err instanceof Error ? err.message : "Network error");
			p.outro("Setup failed");
			return { success: false, configPath };
		}

		spin.stop("Loaded providers from models.dev");

		const priorityProviders = ["opencode", "anthropic", "openai", "google"];
		const sortedProviders = [
			...providers.filter((p: ProviderInfo) => priorityProviders.includes(p.id)),
			...providers
				.filter((p: ProviderInfo) => !priorityProviders.includes(p.id))
				.sort((a: ProviderInfo, b: ProviderInfo) => a.name.localeCompare(b.name)),
		];

		const providerOptions = sortedProviders.map((prov: ProviderInfo) => ({
			value: prov.id,
			label: prov.name,
		}));

		const currentProvider = existingConfig.defaultModel?.split("/")[0];
		const providerResult = await p.select({
			message: "Select your AI provider",
			options: providerOptions,
			initialValue: currentProvider ?? DEFAULT_PROVIDER,
			maxItems: MAX_SELECT_ITEMS,
		});

		if (p.isCancel(providerResult)) {
			p.outro("Setup cancelled");
			return { success: false, configPath };
		}

		provider = providerResult as string;

		spin.start("Fetching models...");
		const providerData = await getProvider(provider);
		spin.stop(`Loaded ${providerData?.models.length ?? 0} models`);

		if (!providerData || providerData.models.length === 0) {
			p.log.error(`No models found for provider "${provider}"`);
			p.outro("Setup failed");
			return { success: false, configPath };
		}

		const modelOptions = providerData.models.map((m: ModelInfo) => ({
			value: m.id,
			label: m.name,
			hint: m.reasoning ? "reasoning" : m.status === "beta" ? "beta" : undefined,
		}));

		const currentModel = existingConfig.defaultModel?.split("/")[1];
		const modelResult = await p.select({
			message: "Select your default model",
			options: modelOptions,
			initialValue: currentModel,
			maxItems: MAX_SELECT_ITEMS,
		});

		if (p.isCancel(modelResult)) {
			p.outro("Setup cancelled");
			return { success: false, configPath };
		}

		model = modelResult as string;
	}

	const detectedAgents = detectInstalledAgents();
	const allAgentConfigs = getAllAgentConfigs();

	if (detectedAgents.length > 0) {
		const detectedNames = detectedAgents
			.map((a) => allAgentConfigs.find((c) => c.name === a)?.displayName ?? a)
			.join(", ");
		p.log.info(`Detected agents: ${detectedNames}`);
	}

	const agentOptions = allAgentConfigs.map((config) => ({
		value: config.name,
		label: config.displayName,
		hint: config.globalSkillsDir,
	}));

	let agents: Agent[];
	if (options.agents) {
		const agentNames = options.agents.split(",").map((a) => a.trim());
		const validAgents = allAgentConfigs
			.filter((c) => agentNames.includes(c.name))
			.map((c) => c.name);
		if (validAgents.length === 0) {
			p.log.error("No valid agent names provided");
			p.outro("Setup failed");
			return { success: false, configPath };
		}
		agents = validAgents as Agent[];
	} else {
		const initialAgents =
			existingConfig.agents && existingConfig.agents.length > 0
				? existingConfig.agents
				: detectedAgents;

		const agentsResult = await p.multiselect({
			message: "Select agents to install skills to",
			options: agentOptions,
			initialValues: initialAgents,
			required: false,
		});

		if (p.isCancel(agentsResult)) {
			p.outro("Setup cancelled");
			return { success: false, configPath };
		}

		agents = agentsResult as Agent[];
	}

	const defaultModel = `${provider}/${model}`;
	const newConfig: Partial<Config> = {
		repoRoot,
		defaultModel,
		agents,
	};

	try {
		saveConfig(newConfig);
		installGlobalSkill();

		p.log.success("Configuration saved!");
		p.log.info(`  Config file: ${configPath}`);
		p.log.info(`  Repo root: ${repoRoot}`);
		p.log.info(`  Meta root: ${getMetaRoot()}`);
		p.log.info(`  State root: ${Paths.state}`);
		p.log.info(`  Model: ${defaultModel}`);
		p.log.info(`  Agents: ${agents.join(", ")}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(`Failed to save configuration: ${message}`);
		p.outro("Setup failed");
		return { success: false, configPath };
	}

	const expandedRepoRoot = expandTilde(repoRoot);
	if (existsSync(expandedRepoRoot)) {
		const previewResult = await discoverRepos({ repoRoot: expandedRepoRoot, dryRun: true });

		if (previewResult.discovered.length > 0) {
			p.log.info("");
			p.log.info(`Found ${previewResult.discovered.length} existing repos in ${repoRoot}`);

			let shouldDiscover = options.yes;
			if (!options.yes) {
				const confirmDiscover = await p.confirm({
					message: "Add them to your index? (they will be marked as not referenced)",
					initialValue: true,
				});
				if (!p.isCancel(confirmDiscover)) {
					shouldDiscover = confirmDiscover;
				}
			}

			if (shouldDiscover) {
				const result = await discoverRepos({ repoRoot: expandedRepoRoot });
				p.log.success(`Added ${result.discovered.length} repos to index`);
			}
		}
	}

	p.outro("Setup complete. Run 'ow pull <repo>' to get started.");
	return { success: true, configPath };
}
