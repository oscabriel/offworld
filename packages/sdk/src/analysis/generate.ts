import { streamPrompt } from "../ai/index.js";
import type { Architecture, Skill } from "@offworld/types";
import type { GatheredContext } from "./context.js";
import { formatContextForPrompt } from "./context.js";
import { parseArchitectureMarkdown, parseSkillMarkdown } from "./parsers.js";

export interface GenerateOptions {
	onDebug?: (message: string) => void;
	onStream?: (text: string) => void;
}

const SUMMARY_TEMPLATE = `Based on the repository context provided, write a markdown summary using this format:

## Purpose
[1-2 sentences about what this project does]

## Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]

## Technologies
- [Language/Framework 1]
- [Language/Framework 2]

## Architecture Overview
[Brief overview of how the codebase is organized]

Keep the summary under 500 words. Focus on what's most useful for a developer trying to understand this project quickly.`;

const ARCHITECTURE_TEMPLATE = `Analyze the repository and extract structured architecture information using this EXACT format:

## Project Type
[ONE of: monorepo, library, cli, app, framework]

## Entities
[For each major module/package, use this subsection format:]

### [Entity Name]
- **Type**: [ONE of: package, module, feature, util, config]
- **Path**: [relative path]
- **Description**: [one sentence]
- **Responsibilities**:
  - [responsibility 1]
  - [responsibility 2]

## Relationships
- [from] -> [to]: [relationship type]
- [from] -> [to]: [relationship type]

## Key Files
- \`[path]\`: [role description]
- \`[path]\`: [role description]

## Patterns
- **Framework**: [detected framework or empty]
- **Build Tool**: [detected build tool or empty]
- **Test Framework**: [detected test framework or empty]
- **Language**: [primary language]

Be thorough but concise. Focus on the actual structure visible in the code.`;

const SKILL_TEMPLATE = `Generate a skill definition for an AI coding assistant using this EXACT format:

## Skill Info
- **Name**: [short-kebab-case-name]
- **Description**: [one sentence describing what this skill is for]

## Allowed Tools
- Read
- Glob
- Grep
- Bash
- Edit

## Repository Structure
- \`[path]\`: [purpose]
- \`[path]\`: [purpose]

## Key Files
- \`[path]\`: [description]
- \`[path]\`: [description]

## Search Strategies
- [Strategy 1: how to find X in this codebase]
- [Strategy 2: grep pattern for Y]
- [Strategy 3: file pattern for Z]

## When to Use
- [Trigger condition 1]
- [Trigger condition 2]
- [Trigger condition 3]

Make the skill practical and immediately usable without editing.`;

export async function generateSummary(
	context: GatheredContext,
	options: GenerateOptions = {},
): Promise<string> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are analyzing a software repository.

${contextPrompt}

${SUMMARY_TEMPLATE}`;

	const result = await streamPrompt({
		prompt,
		cwd: context.repoPath,
		systemPrompt: "You are a technical documentation expert. Write clear, concise summaries.",
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	return result.text;
}

export async function extractArchitecture(
	context: GatheredContext,
	options: GenerateOptions = {},
): Promise<Architecture> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are analyzing a software repository's architecture.

${contextPrompt}

${ARCHITECTURE_TEMPLATE}`;

	const result = await streamPrompt({
		prompt,
		cwd: context.repoPath,
		systemPrompt:
			"You are a software architect expert. Analyze codebases and extract architectural patterns.",
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	return parseArchitectureMarkdown(result.text);
}

export async function generateSkill(
	context: GatheredContext,
	summary: string,
	architecture: Architecture,
	options: GenerateOptions = {},
): Promise<Skill> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are creating a "skill" file for an AI coding assistant. This skill helps the AI understand and work with a specific codebase.

Repository context:
${contextPrompt}

Summary:
${summary}

Architecture:
${JSON.stringify(architecture, null, 2)}

${SKILL_TEMPLATE}`;

	const result = await streamPrompt({
		prompt,
		cwd: context.repoPath,
		systemPrompt:
			"You are an expert at creating AI assistant skills. Make them practical and immediately useful.",
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	return parseSkillMarkdown(result.text);
}

export function formatArchitectureMd(architecture: Architecture): string {
	const sections: string[] = [];

	sections.push(`# Architecture: ${architecture.projectType}`);
	sections.push("");

	sections.push("## Entity Relationships");
	sections.push("");
	sections.push("```mermaid");
	sections.push("flowchart TB");

	for (const entity of architecture.entities) {
		const id = sanitizeMermaidId(entity.name);
		const label = entity.name.replace(/"/g, "'");
		sections.push(`    ${id}["${label}"]`);
	}

	for (const rel of architecture.relationships) {
		const fromId = sanitizeMermaidId(rel.from);
		const toId = sanitizeMermaidId(rel.to);
		const label = rel.type.replace(/"/g, "'");
		sections.push(`    ${fromId} -->|${label}| ${toId}`);
	}

	sections.push("```");
	sections.push("");

	sections.push("## Entities");
	sections.push("");
	sections.push("| Name | Type | Path | Description |");
	sections.push("|------|------|------|-------------|");

	for (const entity of architecture.entities) {
		const row = [
			entity.name,
			entity.type,
			`\`${entity.path}\``,
			entity.description.replace(/\|/g, "\\|"),
		];
		sections.push(`| ${row.join(" | ")} |`);
	}

	sections.push("");

	sections.push("## Key Files");
	sections.push("");
	sections.push("| File | Role |");
	sections.push("|------|------|");

	for (const file of architecture.keyFiles) {
		sections.push(`| \`${file.path}\` | ${file.role} |`);
	}

	sections.push("");

	sections.push("## Detected Patterns");
	sections.push("");

	const patterns = architecture.patterns;
	if (patterns.framework) {
		sections.push(`- **Framework**: ${patterns.framework}`);
	}
	if (patterns.buildTool) {
		sections.push(`- **Build Tool**: ${patterns.buildTool}`);
	}
	if (patterns.testFramework) {
		sections.push(`- **Test Framework**: ${patterns.testFramework}`);
	}
	if (patterns.language) {
		sections.push(`- **Language**: ${patterns.language}`);
	}

	return sections.join("\n");
}

function sanitizeMermaidId(name: string): string {
	return (
		name
			.replace(/[^a-zA-Z0-9]/g, "_")
			.replace(/^_+|_+$/g, "")
			.toLowerCase() || "node"
	);
}

export function formatSkillMd(skill: Skill): string {
	const frontmatter = [
		"---",
		`name: "${escapeYaml(skill.name)}"`,
		`description: "${escapeYaml(skill.description)}"`,
		"allowed-tools:",
		...skill.allowedTools.map((tool) => `  - ${tool}`),
		"---",
	].join("\n");

	const sections: string[] = [];

	sections.push("## Repository Structure");
	sections.push("");
	for (const entry of skill.repositoryStructure) {
		sections.push(`- \`${entry.path}\`: ${entry.purpose}`);
	}
	sections.push("");

	sections.push("## Quick Reference Paths");
	sections.push("");
	for (const file of skill.keyFiles) {
		sections.push(`- \`${file.path}\`: ${file.description}`);
	}
	sections.push("");

	sections.push("## Search Strategies");
	sections.push("");
	for (const strategy of skill.searchStrategies) {
		sections.push(`- ${strategy}`);
	}
	sections.push("");

	sections.push("## When to Use");
	sections.push("");
	for (const condition of skill.whenToUse) {
		sections.push(`- ${condition}`);
	}

	return `${frontmatter}\n\n${sections.join("\n")}`;
}

function escapeYaml(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
