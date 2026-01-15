/**
 * Agent Registry & Auto-Detection
 *
 * Centralized registry of supported AI coding agents with their
 * skill directory locations and detection functions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Agent } from "@offworld/types";

// ============================================================================
// Types
// ============================================================================

export interface AgentConfig {
	/** Agent identifier (matches AgentSchema enum) */
	name: Agent;
	/** Human-readable name for display */
	displayName: string;
	/** Project-level skill directory (relative path) */
	skillsDir: string;
	/** User-level skill directory (absolute with ~) */
	globalSkillsDir: string;
	/** Check if this agent is installed on the system */
	detectInstalled: () => boolean;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Expand ~ to user's home directory
 */
export function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

// ============================================================================
// Agent Registry
// ============================================================================

export const agents: Record<Agent, AgentConfig> = {
	opencode: {
		name: "opencode",
		displayName: "OpenCode",
		skillsDir: ".opencode/skill",
		globalSkillsDir: "~/.config/opencode/skill",
		detectInstalled: () => existsSync(expandTilde("~/.config/opencode")),
	},
	"claude-code": {
		name: "claude-code",
		displayName: "Claude Code",
		skillsDir: ".claude/skills",
		globalSkillsDir: "~/.claude/skills",
		detectInstalled: () => existsSync(expandTilde("~/.claude")),
	},
	codex: {
		name: "codex",
		displayName: "Codex (OpenAI)",
		skillsDir: ".codex/skills",
		globalSkillsDir: "~/.codex/skills",
		detectInstalled: () => existsSync(expandTilde("~/.codex")),
	},
	amp: {
		name: "amp",
		displayName: "Amp",
		skillsDir: ".agents/skills",
		globalSkillsDir: "~/.config/agents/skills",
		detectInstalled: () => existsSync(expandTilde("~/.config/amp")),
	},
	antigravity: {
		name: "antigravity",
		displayName: "Antigravity",
		skillsDir: ".agent/skills",
		globalSkillsDir: "~/.gemini/antigravity/skills",
		detectInstalled: () => existsSync(expandTilde("~/.gemini/antigravity")),
	},
	cursor: {
		name: "cursor",
		displayName: "Cursor",
		skillsDir: ".cursor/skills",
		globalSkillsDir: "~/.cursor/skills",
		detectInstalled: () => existsSync(expandTilde("~/.cursor")),
	},
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect which agents are installed on the system.
 * Checks for the existence of each agent's config directory.
 *
 * @returns Array of installed agent identifiers
 */
export function detectInstalledAgents(): Agent[] {
	const installed: Agent[] = [];

	for (const config of Object.values(agents)) {
		if (config.detectInstalled()) {
			installed.push(config.name);
		}
	}

	return installed;
}

/**
 * Get the configuration for a specific agent.
 *
 * @param type - Agent identifier
 * @returns AgentConfig for the specified agent
 */
export function getAgentConfig(type: Agent): AgentConfig {
	return agents[type];
}

/**
 * Get all agent configurations as an array.
 *
 * @returns Array of all agent configurations
 */
export function getAllAgentConfigs(): AgentConfig[] {
	return Object.values(agents);
}
