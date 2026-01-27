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
	Paths,
} from "@offworld/sdk";
import { ConfigSchema, AgentSchema } from "@offworld/types/schemas";
import type { Agent } from "@offworld/types";
import { z } from "zod";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const VALID_KEYS = ["repoRoot", "defaultShallow", "defaultModel", "agents"] as const;
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
	paths: {
		skillDir: string;
		referencesDir: string;
		globalMap: string;
		projectMap?: string;
	};
}

export async function configShowHandler(options: ConfigShowOptions): Promise<ConfigShowResult> {
	const config = loadConfig();

	// Check for project map in cwd
	const projectMapPath = resolve(process.cwd(), ".offworld/map.json");
	const hasProjectMap = existsSync(projectMapPath);

	const paths: ConfigShowResult["paths"] = {
		skillDir: join(Paths.data, "skill", "offworld"),
		referencesDir: join(Paths.data, "skill", "offworld", "references"),
		globalMap: join(Paths.data, "skill", "offworld", "assets", "map.json"),
	};

	// Only include projectMap if it exists
	if (hasProjectMap) {
		paths.projectMap = projectMapPath;
	}

	if (options.json) {
		const output = {
			...config,
			paths,
		};
		console.log(JSON.stringify(output, null, 2));
	} else {
		p.log.info("Current configuration:\n");
		for (const [key, value] of Object.entries(config)) {
			console.log(`  ${key}: ${JSON.stringify(value)}`);
		}
		console.log("");
		p.log.info(`Config file: ${getConfigPath()}`);
		if (hasProjectMap) {
			p.log.info(`Project map: ${projectMapPath}`);
		}
	}

	return { config, paths };
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

	if (key === "defaultShallow") {
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
		const agentsResult = z.array(AgentSchema).safeParse(agentValues);

		if (!agentsResult.success) {
			const invalidAgents = agentValues.filter((a) => !AgentSchema.options.includes(a as Agent));
			p.log.error(`Invalid agent(s): ${invalidAgents.join(", ")}`);
			p.log.info(`Valid agents: ${AgentSchema.options.join(", ")}`);
			return {
				success: false,
				message: `Invalid agents: ${invalidAgents.join(", ")}`,
			};
		}

		parsedValue = agentsResult.data;
	} else {
		parsedValue = value;
	}

	try {
		const updates = { [key]: parsedValue };
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

	const value = config[key as keyof typeof config];
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

	const parsedAgents = z.array(AgentSchema).safeParse(agentsResult);
	const agents = parsedAgents.success ? parsedAgents.data : [];

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
