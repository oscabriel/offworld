/**
 * Config utilities for path management and configuration loading
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ConfigSchema } from "@offworld/types";
import type { Config } from "@offworld/types";

/**
 * Expands ~ to user's home directory
 */
function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

export function getMetaRoot(): string {
	return expandTilde("~/.config/offworld");
}

/**
 * Returns the repository root directory.
 * Uses configured repoRoot or defaults to ~/ow
 */
export function getRepoRoot(config?: Config): string {
	const root = config?.repoRoot ?? "~/ow";
	return expandTilde(root);
}

/**
 * Returns the path for a specific repository.
 * Format: {repoRoot}/{provider}/{owner}/{repo}
 *
 * @param fullName - The repo identifier in "owner/repo" format
 * @param provider - Git provider (defaults to "github")
 * @param config - Optional config for custom repoRoot
 */
export function getRepoPath(
	fullName: string,
	provider: "github" | "gitlab" | "bitbucket" = "github",
	config?: Config,
): string {
	const root = getRepoRoot(config);
	const [owner, repo] = fullName.split("/");
	if (!owner || !repo) {
		throw new Error(`Invalid fullName format: ${fullName}. Expected "owner/repo"`);
	}
	return join(root, provider, owner, repo);
}

function toSkillDirName(fullName: string): string {
	const [owner, repo] = fullName.split("/");
	if (!owner || !repo) {
		throw new Error(`Invalid fullName format: ${fullName}. Expected "owner/repo"`);
	}
	return `${owner}-${repo}-reference`;
}

function toMetaDirName(fullName: string): string {
	const [owner, repo] = fullName.split("/");
	if (!owner || !repo) {
		throw new Error(`Invalid fullName format: ${fullName}. Expected "owner/repo"`);
	}
	return `${owner}-${repo}`;
}

export function getSkillPath(fullName: string): string {
	return join(getMetaRoot(), "skills", toSkillDirName(fullName));
}

export function getMetaPath(fullName: string): string {
	return join(getMetaRoot(), "meta", toMetaDirName(fullName));
}

/** @deprecated Use getSkillPath instead */
export function getAnalysisPath(
	fullName: string,
	_provider: "github" | "gitlab" | "bitbucket" = "github",
): string {
	return getSkillPath(fullName);
}

export function getConfigPath(): string {
	return join(homedir(), ".config", "offworld", "offworld.json");
}

/**
 * Loads configuration from ~/.ow/config.json
 * Returns defaults if file doesn't exist
 */
export function loadConfig(): Config {
	const configPath = getConfigPath();

	if (!existsSync(configPath)) {
		return ConfigSchema.parse({});
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const data = JSON.parse(content);
		return ConfigSchema.parse(data);
	} catch {
		// If parsing fails, return defaults
		return ConfigSchema.parse({});
	}
}

/**
 * Saves configuration to ~/.ow/config.json
 * Creates directory if it doesn't exist
 * Merges with existing config
 */
export function saveConfig(updates: Partial<Config>): Config {
	const configPath = getConfigPath();
	const configDir = dirname(configPath);

	// Ensure directory exists
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}

	// Load existing config and merge
	const existing = loadConfig();
	const merged = { ...existing, ...updates };

	// Validate merged config
	const validated = ConfigSchema.parse(merged);

	// Write to file
	writeFileSync(configPath, JSON.stringify(validated, null, 2), "utf-8");

	return validated;
}
