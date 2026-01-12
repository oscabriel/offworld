/**
 * Config command handlers
 * PRD 4.9: Manage CLI configuration
 */

import * as p from "@clack/prompts";
import { loadConfig, saveConfig, getConfigPath, updateSkillPaths } from "@offworld/sdk";
import { ConfigSchema } from "@offworld/types/schemas";

// Valid config keys
const VALID_KEYS = ["repoRoot", "metaRoot", "skillDir", "defaultShallow", "autoAnalyze"] as const;
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
	let parsedValue: string | boolean;

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
	} else {
		// String values
		parsedValue = value;
	}

	try {
		const updates = { [key]: parsedValue };
		const newConfig = saveConfig(updates);
		p.log.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);

		if (key === "repoRoot" || key === "metaRoot") {
			const result = updateSkillPaths(newConfig.repoRoot, newConfig.metaRoot);
			if (result.updated.length > 0) {
				p.log.info(`Updated ${result.updated.length} skill file(s) with new paths`);
			}
			if (result.failed.length > 0) {
				p.log.warn(`Failed to update ${result.failed.length} skill file(s)`);
			}
		}

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

	const value = config[key];
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
