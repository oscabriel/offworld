import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
	loadConfig,
	saveConfig,
	getConfigPath,
	detectInstalledAgents,
	getAllAgentConfigs,
} from "@offworld/sdk";
import type { Agent } from "@offworld/types";

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
		agents: Agent[];
	};
}

const PROVIDER_OPTIONS = [
	{
		value: "opencode",
		label: "OpenCode Zen (Recommended)",
		hint: "Curated models, no extra keys needed",
	},
	{ value: "anthropic", label: "Anthropic", hint: "Direct API - Claude models" },
	{ value: "openai", label: "OpenAI", hint: "Direct API - GPT/o-series" },
] as const;

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string; hint?: string }>> = {
	opencode: [
		// Claude models via Zen
		{ value: "claude-opus-4-5", label: "Claude Opus 4.5", hint: "most capable" },
		{ value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", hint: "balanced" },
		{ value: "claude-sonnet-4", label: "Claude Sonnet 4" },
		{ value: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "fast" },
		// GPT models via Zen
		{ value: "gpt-5.2-codex", label: "GPT 5.2 Codex", hint: "latest" },
		{ value: "gpt-5.1-codex", label: "GPT 5.1 Codex" },
		{ value: "gpt-5-codex", label: "GPT 5 Codex" },
		// Other models via Zen
		{ value: "gemini-3-pro", label: "Gemini 3 Pro" },
		{ value: "qwen3-coder", label: "Qwen3 Coder 480B" },
		{ value: "kimi-k2", label: "Kimi K2" },
		{ value: "glm-4.7-free", label: "GLM 4.7", hint: "free" },
		{ value: "grok-code", label: "Grok Code Fast 1", hint: "free" },
	],
	anthropic: [
		{ value: "claude-opus-4-5", label: "Claude Opus 4.5", hint: "most capable" },
		{ value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", hint: "balanced" },
		{ value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
		{ value: "claude-opus-4-20250514", label: "Claude Opus 4" },
		{ value: "claude-haiku-4-5-20250929", label: "Claude Haiku 4.5", hint: "fast" },
		{ value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
	],
	openai: [
		{ value: "gpt-5.2", label: "GPT 5.2", hint: "latest" },
		{ value: "gpt-5.1-codex", label: "GPT 5.1 Codex" },
		{ value: "gpt-5.1", label: "GPT 5.1" },
		{ value: "gpt-5", label: "GPT 5" },
		{ value: "gpt-4o", label: "GPT-4o", hint: "balanced" },
		{ value: "o3", label: "o3", hint: "reasoning" },
		{ value: "o3-mini", label: "o3-mini", hint: "fast reasoning" },
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

	// Agent selection with auto-detection
	const detectedAgents = detectInstalledAgents();
	const allAgentConfigs = getAllAgentConfigs();

	if (detectedAgents.length > 0) {
		const detectedNames = detectedAgents
			.map((a) => allAgentConfigs.find((c) => c.name === a)?.displayName ?? a)
			.join(", ");
		p.log.info(`Detected agents: ${detectedNames}`);
	}

	// Build options from registry
	const agentOptions = allAgentConfigs.map((config) => ({
		value: config.name,
		label: config.displayName,
		hint: config.globalSkillsDir,
	}));

	// Use existing config if set, otherwise use detected agents
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

	const agents = agentsResult as Agent[];

	const newConfig = {
		repoRoot,
		metaRoot,
		ai: { provider, model },
		agents,
	};

	try {
		saveConfig(newConfig);

		p.log.success("Configuration saved!");
		p.log.info(`  Config file: ${configPath}`);
		p.log.info(`  Repo root: ${repoRoot}`);
		p.log.info(`  Meta root: ${metaRoot}`);
		p.log.info(`  AI: ${provider}/${model}`);
		p.log.info(`  Agents: ${agents.join(", ")}`);

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
