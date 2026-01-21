/**
 * Config utilities for path management and configuration loading
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ConfigSchema } from "@offworld/types";
import type { Config } from "@offworld/types";
import { Paths, expandTilde } from "./paths";

/**
 * Returns the repository root directory.
 * Uses configured repoRoot or defaults to ~/ow
 */
export function getMetaRoot(): string {
	return Paths.data;
}

export function getStateRoot(): string {
	return Paths.state;
}

export function getRepoRoot(config?: Config): string {
	const root = config?.repoRoot ?? Paths.defaultRepoRoot;
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

/**
 * Convert owner/repo format to skill directory name.
 * Collapses owner==repo (e.g., better-auth/better-auth -> better-auth-reference)
 */
export function toSkillDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/") as [string, string];
		if (owner === repo) {
			return `${repo}-reference`;
		}
		return `${owner}-${repo}-reference`;
	}
	return `${repoName}-reference`;
}

/**
 * Convert owner/repo format to meta directory name.
 * Collapses owner==repo (e.g., better-auth/better-auth -> better-auth)
 */
export function toMetaDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/") as [string, string];
		if (owner === repo) {
			return repo;
		}
		return `${owner}-${repo}`;
	}
	return repoName;
}

export function getSkillPath(fullName: string): string {
	return join(Paths.data, "skills", toSkillDirName(fullName));
}

export function getMetaPath(fullName: string): string {
	return join(Paths.data, "meta", toMetaDirName(fullName));
}

/** @deprecated Use getSkillPath instead */
export function getAnalysisPath(
	fullName: string,
	_provider: "github" | "gitlab" | "bitbucket" = "github",
): string {
	return getSkillPath(fullName);
}

/**
 * Returns the path to the configuration file
 * Uses XDG Base Directory specification
 */
export function getConfigPath(): string {
	return Paths.configFile;
}

/**
 * Loads configuration from ~/.config/offworld/offworld.json
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
 * Saves configuration to ~/.config/offworld/offworld.json
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
