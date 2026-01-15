/**
 * Simplified AI-only skill generation
 *
 * This module provides a streamlined approach to generating SKILL.md files
 * by delegating all codebase exploration to the AI agent via OpenCode.
 */

import { mkdirSync, writeFileSync, lstatSync, unlinkSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { streamPrompt, type StreamPromptOptions } from "./ai/opencode.js";
import { loadConfig } from "./config.js";
import { getCommitSha } from "./clone.js";
import { agents, expandTilde } from "./agents.js";

// ============================================================================
// Types
// ============================================================================

export interface GenerateSkillOptions {
	/** AI provider ID (e.g., "anthropic", "openai"). Defaults to config value. */
	provider?: string;
	/** AI model ID. Defaults to config value. */
	model?: string;
	/** Debug callback for detailed logging */
	onDebug?: (message: string) => void;
	/** Stream callback for real-time AI output */
	onStream?: (text: string) => void;
}

export interface GenerateSkillResult {
	/** The generated SKILL.md content */
	skillContent: string;
	/** The commit SHA at the time of generation */
	commitSha: string;
}

export interface InstallSkillMeta {
	/** ISO timestamp when the skill was analyzed */
	analyzedAt: string;
	/** Git commit SHA at time of analysis */
	commitSha: string;
	/** SDK version used for generation */
	version: string;
}

// ============================================================================
// Skill Generation
// ============================================================================

const SKILL_GENERATION_PROMPT = `You are an expert at analyzing open source codebases and producing skill files for AI coding agents.

Your task is to explore this codebase thoroughly and generate a comprehensive SKILL.md file that will help AI agents understand how to work with this library/framework.

## Instructions

1. Use the available tools (Read, Grep, Glob) to explore the codebase:
   - Start with package.json or similar config files to understand the project
   - Look at README.md for high-level documentation
   - Explore src/ or lib/ directories for main source code
   - Check for examples/ or docs/ directories
   - Find the main entry points and public API

2. Generate a SKILL.md file with the following structure:

\`\`\`markdown
---
name: {Library Name}
description: {One-line description, max 100 chars}
allowed-tools: [Read, Grep, Glob]
---

# {Library Name}

{2-3 sentence overview of what this library does}

**See also:** [summary.md](references/summary.md) | [architecture.md](references/architecture.md)

## When to Use

- {Scenario 1 - when should an agent reach for this skill}
- {Scenario 2}
- {Scenario 3}
- {Scenario 4}
- {Scenario 5}

## Best Practices

1. {Best practice 1}
2. {Best practice 2}
3. {Best practice 3}

## Common Patterns

**{Pattern Name 1}:**
1. {Step 1}
2. {Step 2}

**{Pattern Name 2}:**
1. {Step 1}
2. {Step 2}

## Key Files & Directories

| Path | Purpose |
|------|---------|
| \`{path1}\` | {description} |
| \`{path2}\` | {description} |

## API Quick Reference

| Export | Type | Description |
|--------|------|-------------|
| \`{export1}\` | {function/class/const} | {brief description} |
| \`{export2}\` | {function/class/const} | {brief description} |
\`\`\`

3. Focus on practical, actionable information that helps agents:
   - Understand WHEN to use this library
   - Know WHERE to look for specific functionality
   - Follow BEST PRACTICES when writing code
   - Use COMMON PATTERNS correctly

4. Be accurate - only include information you've verified by reading the actual source code.

Now explore the codebase and generate the SKILL.md content. Output ONLY the markdown content, no explanations.`;

/**
 * Generate a SKILL.md file for a repository using AI.
 *
 * Opens an OpenCode session and instructs the AI agent to explore the codebase
 * using Read, Grep, and Glob tools, then produce a comprehensive skill file.
 *
 * @param repoPath - Path to the repository to analyze
 * @param repoName - Qualified name of the repo (e.g., "tanstack/query" or "my-local-repo")
 * @param options - Generation options (provider, model, callbacks)
 * @returns The generated skill content and commit SHA
 */
export async function generateSkillWithAI(
	repoPath: string,
	repoName: string,
	options: GenerateSkillOptions = {},
): Promise<GenerateSkillResult> {
	const { provider, model, onDebug, onStream } = options;
	const config = loadConfig();

	const aiProvider = provider ?? config.ai?.provider;
	const aiModel = model ?? config.ai?.model;

	onDebug?.(`Starting AI skill generation for ${repoName}`);
	onDebug?.(`Repo path: ${repoPath}`);
	onDebug?.(`Provider: ${aiProvider ?? "default"}, Model: ${aiModel ?? "default"}`);

	const commitSha = getCommitSha(repoPath);
	onDebug?.(`Commit SHA: ${commitSha}`);

	const promptOptions: StreamPromptOptions = {
		prompt: SKILL_GENERATION_PROMPT,
		cwd: repoPath,
		provider: aiProvider,
		model: aiModel,
		onDebug,
		onStream,
	};

	const result = await streamPrompt(promptOptions);

	onDebug?.(`Generation complete (${result.durationMs}ms, ${result.text.length} chars)`);

	return {
		skillContent: result.text,
		commitSha,
	};
}

// ============================================================================
// Skill Installation
// ============================================================================

/**
 * Convert owner/repo format to skill directory name.
 * Collapses owner==repo (e.g., better-auth/better-auth -> better-auth-reference)
 */
function toSkillDirName(repoName: string): string {
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
 */
function toMetaDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/") as [string, string];
		if (owner === repo) {
			return repo;
		}
		return `${owner}-${repo}`;
	}
	return repoName;
}

/**
 * Ensure a symlink exists, removing any existing file/directory at the path
 */
function ensureSymlink(target: string, linkPath: string): void {
	try {
		const stat = lstatSync(linkPath);
		if (stat.isSymbolicLink()) {
			unlinkSync(linkPath);
		} else if (stat.isDirectory()) {
			rmSync(linkPath, { recursive: true });
		} else {
			unlinkSync(linkPath);
		}
	} catch {
		// Path doesn't exist, which is fine
	}

	const linkDir = join(linkPath, "..");
	mkdirSync(linkDir, { recursive: true });
	symlinkSync(target, linkPath, "dir");
}



/**
 * Install a generated skill to the filesystem.
 *
 * Creates:
 * - ~/.config/offworld/skills/{name}-reference/SKILL.md
 * - ~/.config/offworld/meta/{name}/meta.json
 * - Symlinks to agent skill directories based on config.agents
 *
 * @param repoName - Qualified name (e.g., "tanstack/query" or "my-local-repo")
 * @param skillContent - The generated SKILL.md content
 * @param meta - Metadata about the generation (analyzedAt, commitSha, version)
 */
export function installSkill(repoName: string, skillContent: string, meta: InstallSkillMeta): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);
	const metaDirName = toMetaDirName(repoName);

	// Skill directory (agent-facing)
	const skillDir = expandTilde(join(config.metaRoot, "skills", skillDirName));
	mkdirSync(skillDir, { recursive: true });

	// Meta directory (internal)
	const metaDir = expandTilde(join(config.metaRoot, "meta", metaDirName));
	mkdirSync(metaDir, { recursive: true });

	// Write SKILL.md
	writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf-8");

	// Write meta.json
	const metaJson = JSON.stringify(meta, null, 2);
	writeFileSync(join(metaDir, "meta.json"), metaJson, "utf-8");

	// Create symlinks for configured agents
	const configuredAgents = config.agents ?? [];
	for (const agentName of configuredAgents) {
		const agentConfig = agents[agentName];
		if (agentConfig) {
			const agentSkillDir = expandTilde(join(agentConfig.globalSkillsDir, skillDirName));
			ensureSymlink(skillDir, agentSkillDir);
		}
	}
}
