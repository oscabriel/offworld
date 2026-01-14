import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { loadConfig, saveConfig, getConfigPath } from "@offworld/sdk";

export interface InitOptions {
	yes?: boolean;
}

export interface InitResult {
	success: boolean;
	configPath: string;
	config?: {
		repoRoot: string;
		metaRoot: string;
		ai: { provider: string; model: string };
	};
}

const PROVIDER_OPTIONS = [
	{ value: "anthropic", label: "Anthropic", hint: "Claude models" },
	{ value: "openai", label: "OpenAI", hint: "GPT models" },
	{ value: "opencode", label: "OpenCode Zen", hint: "OpenCode's hosted service" },
] as const;

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string; hint?: string }>> = {
	anthropic: [
		{ value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", hint: "balanced" },
		{ value: "claude-opus-4-20250514", label: "Claude Opus 4", hint: "most capable" },
	],
	openai: [
		{ value: "gpt-4o", label: "GPT-4o", hint: "balanced" },
		{ value: "gpt-4-turbo", label: "GPT-4 Turbo" },
		{ value: "o3", label: "o3", hint: "reasoning model" },
	],
	opencode: [
		{ value: "claude-opus-4-5", label: "Claude Opus 4.5", hint: "default" },
		{ value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
	],
};

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

export async function initHandler(options: InitOptions = {}): Promise<InitResult> {
	const configPath = getConfigPath();
	const existingConfig = loadConfig();
	const configExists = existsSync(configPath);

	p.intro("ow init");

	if (configExists && !options.yes) {
		p.log.info(`Existing config found at ${configPath}`);
		const shouldContinue = await p.confirm({
			message: "Overwrite existing configuration?",
			initialValue: false,
		});

		if (p.isCancel(shouldContinue) || !shouldContinue) {
			p.outro("Setup cancelled");
			return { success: false, configPath };
		}
	}

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

	const repoRoot = collapseTilde(expandTilde(repoRootResult));

	const metaRootResult = await p.text({
		message: "Where should analysis metadata be stored?",
		placeholder: "~/.config/offworld",
		initialValue: existingConfig.metaRoot,
		validate: validatePath,
	});

	if (p.isCancel(metaRootResult)) {
		p.outro("Setup cancelled");
		return { success: false, configPath };
	}

	const metaRoot = collapseTilde(expandTilde(metaRootResult));

	const providerResult = await p.select({
		message: "Select your AI provider for analysis",
		options: [...PROVIDER_OPTIONS],
		initialValue: existingConfig.ai?.provider ?? "anthropic",
	});

	if (p.isCancel(providerResult)) {
		p.outro("Setup cancelled");
		return { success: false, configPath };
	}

	const provider = providerResult as string;

	const modelOptions = MODEL_OPTIONS[provider] ?? MODEL_OPTIONS.anthropic!;
	const modelResult = await p.select({
		message: "Select your default model",
		options: modelOptions,
		initialValue: existingConfig.ai?.model,
	});

	if (p.isCancel(modelResult)) {
		p.outro("Setup cancelled");
		return { success: false, configPath };
	}

	const model = modelResult as string;

	const newConfig = {
		repoRoot,
		metaRoot,
		ai: { provider, model },
	};

	try {
		saveConfig(newConfig);

		p.log.success("Configuration saved!");
		p.log.info(`  Config file: ${configPath}`);
		p.log.info(`  Repo root: ${repoRoot}`);
		p.log.info(`  Meta root: ${metaRoot}`);
		p.log.info(`  AI: ${provider}/${model}`);

		p.outro("Setup complete. Run 'ow pull <repo>' to get started.");

		return {
			success: true,
			configPath,
			config: newConfig,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(`Failed to save configuration: ${message}`);
		p.outro("Setup failed");
		return { success: false, configPath };
	}
}
