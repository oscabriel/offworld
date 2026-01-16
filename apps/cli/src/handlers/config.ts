/**
 * Config command handlers
 */

import * as p from "@clack/prompts";
import {
	loadConfig,
	saveConfig,
	getConfigPath,
	detectInstalledAgents,
	getAllAgentConfigs,
} from "@offworld/sdk";
import { ConfigSchema, AgentSchema } from "@offworld/types/schemas";
import type { Agent } from "@offworld/types";

// Valid config keys (supports dot notation for nested keys)
const VALID_KEYS = [
	"repoRoot",
	"metaRoot",
	"skillDir",
	"defaultShallow",
	"autoAnalyze",
	"agents",
	"ai.provider",
	"ai.model",
] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

function isValidKey(key: string): key is ConfigKey {
	return VALID_KEYS.includes(key as ConfigKey);
}

// ============================================================================
// Config Show
// ============================================================================

export interface ConfigShowOptions {
	json?: boolean;
}

export interface ConfigShowResult {
	config: Record<string, unknown>;
}

export async function configShowHandler(options: ConfigShowOptions): Promise<ConfigShowResult> {
	const config = loadConfig();

	if (options.json) {
		console.log(JSON.stringify(config, null, 2));
	} else {
		p.log.info("Current configuration:\n");
		for (const [key, value] of Object.entries(config)) {
			console.log(`  ${key}: ${JSON.stringify(value)}`);
		}
		console.log("");
		p.log.info(`Config file: ${getConfigPath()}`);
	}

	return { config };
}

// ============================================================================
// Config Set
// ============================================================================

export interface ConfigSetOptions {
	key: string;
	value: string;
}

export interface ConfigSetResult {
	success: boolean;
	key?: string;
	value?: unknown;
	message?: string;
}

export async function configSetHandler(options: ConfigSetOptions): Promise<ConfigSetResult> {
	const { key, value } = options;

	// Validate key
	if (!isValidKey(key)) {
		p.log.error(`Invalid config key: ${key}`);
		p.log.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
		return {
			success: false,
			message: `Invalid key: ${key}`,
		};
	}

	// Parse value based on key type
	let parsedValue: string | boolean | Agent[];

	if (key === "defaultShallow" || key === "autoAnalyze") {
		// Boolean values
		if (value === "true" || value === "1") {
			parsedValue = true;
		} else if (value === "false" || value === "0") {
			parsedValue = false;
		} else {
			p.log.error(`Invalid boolean value: ${value}. Use 'true' or 'false'.`);
			return {
				success: false,
				message: `Invalid boolean value: ${value}`,
			};
		}
	} else if (key === "agents") {
		// Array of agents (comma-separated)
		const agentValues = value
			.split(",")
			.map((a) => a.trim())
			.filter(Boolean);
		const validAgents = AgentSchema.options;
		const invalidAgents = agentValues.filter((a) => !validAgents.includes(a as Agent));

		if (invalidAgents.length > 0) {
			p.log.error(`Invalid agent(s): ${invalidAgents.join(", ")}`);
			p.log.info(`Valid agents: ${validAgents.join(", ")}`);
			return {
				success: false,
				message: `Invalid agents: ${invalidAgents.join(", ")}`,
			};
		}

		parsedValue = agentValues as Agent[];
	} else {
		// String values (including ai.provider, ai.model)
		parsedValue = value;
	}

	try {
		// Handle nested keys (e.g., ai.provider, ai.model)
		let updates: Record<string, unknown>;
		if (key.startsWith("ai.")) {
			const config = loadConfig();
			const aiKey = key.split(".")[1] as "provider" | "model";
			updates = {
				ai: {
					...config.ai,
					[aiKey]: parsedValue,
				},
			};
		} else {
			updates = { [key]: parsedValue };
		}

		saveConfig(updates);
		p.log.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);

		return {
			success: true,
			key,
			value: parsedValue,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			message,
		};
	}
}

// ============================================================================
// Config Get
// ============================================================================

export interface ConfigGetOptions {
	key: string;
}

export interface ConfigGetResult {
	key: string;
	value: unknown;
}

export async function configGetHandler(options: ConfigGetOptions): Promise<ConfigGetResult> {
	const { key } = options;
	const config = loadConfig();

	if (!isValidKey(key)) {
		p.log.error(`Invalid config key: ${key}`);
		p.log.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
		return { key, value: null };
	}

	// Handle nested keys (e.g., ai.provider, ai.model)
	let value: unknown;
	if (key.startsWith("ai.")) {
		const aiKey = key.split(".")[1] as "provider" | "model";
		value = config.ai[aiKey];
	} else {
		value = config[key as keyof Omit<typeof config, "ai">];
	}
	console.log(JSON.stringify(value));

	return { key, value };
}

// ============================================================================
// Config Reset
// ============================================================================

export interface ConfigResetResult {
	success: boolean;
}

export async function configResetHandler(): Promise<ConfigResetResult> {
	try {
		// Get default config from schema
		const defaults = ConfigSchema.parse({});

		// Save defaults (overwrites existing)
		saveConfig(defaults);

		p.log.success("Configuration reset to defaults:");
		for (const [key, value] of Object.entries(defaults)) {
			console.log(`  ${key}: ${JSON.stringify(value)}`);
		}

		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return { success: false };
	}
}

// ============================================================================
// Config Path
// ============================================================================

export interface ConfigPathResult {
	path: string;
}

export async function configPathHandler(): Promise<ConfigPathResult> {
	const path = getConfigPath();
	console.log(path);
	return { path };
}

// ============================================================================
// Config Agents
// ============================================================================

export interface ConfigAgentsResult {
	success: boolean;
	agents?: Agent[];
}

export async function configAgentsHandler(): Promise<ConfigAgentsResult> {
	const config = loadConfig();
	const detectedAgents = detectInstalledAgents();
	const allAgentConfigs = getAllAgentConfigs();

	if (detectedAgents.length > 0) {
		const detectedNames = detectedAgents
			.map((a) => allAgentConfigs.find((c) => c.name === a)?.displayName ?? a)
			.join(", ");
		p.log.info(`Detected agents: ${detectedNames}`);
	}

	// Build options from registry
	const agentOptions = allAgentConfigs.map((cfg) => ({
		value: cfg.name,
		label: cfg.displayName,
		hint: cfg.globalSkillsDir,
	}));

	// Use existing config if set, otherwise use detected agents
	const initialAgents = config.agents && config.agents.length > 0 ? config.agents : detectedAgents;

	const agentsResult = await p.multiselect({
		message: "Select agents to install skills to",
		options: agentOptions,
		initialValues: initialAgents,
		required: false,
	});

	if (p.isCancel(agentsResult)) {
		p.log.warn("Cancelled");
		return { success: false };
	}

	const agents = agentsResult as Agent[];

	try {
		saveConfig({ agents });
		p.log.success(`Agents set to: ${agents.join(", ") || "(none)"}`);
		return { success: true, agents };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return { success: false };
	}
}
