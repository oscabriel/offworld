/**
 * Analysis Generation
 * PRD 5.2-5.5: Generate summary, architecture, and skill from context
 */

import { runAnalysis } from "../ai/index.js";
import type { Config, Architecture, Skill } from "@offworld/types";
import { ArchitectureSchema, SkillSchema } from "@offworld/types/schemas";
import { z } from "zod";
import type { GatheredContext } from "./context.js";
import { formatContextForPrompt } from "./context.js";

// ============================================================================
// Summary Generation (PRD 5.2)
// ============================================================================

/**
 * Generate a markdown summary of the repository.
 */
export async function generateSummary(
	context: GatheredContext,
	config?: Config
): Promise<string> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are analyzing a software repository. Based on the following context, write a concise markdown summary.

${contextPrompt}

Write a summary that includes:
1. **Purpose**: What this project does (1-2 sentences)
2. **Key Features**: Main capabilities (bullet points)
3. **Technologies**: Primary languages, frameworks, and tools used
4. **Architecture**: Brief overview of how the codebase is organized

Keep the summary under 500 words. Focus on what's most useful for a developer trying to understand this project quickly.

Output the summary in markdown format.`;

	const SummarySchema = z.object({
		summary: z.string().describe("The markdown summary of the repository"),
	});

	const result = await runAnalysis({
		prompt,
		cwd: process.cwd(),
		schema: SummarySchema,
		systemPrompt: "You are a technical documentation expert. Write clear, concise summaries.",
		config,
	});

	return result.output.summary;
}

// ============================================================================
// Architecture Extraction (PRD 5.3)
// ============================================================================

/**
 * Extract architecture information from the repository context.
 */
export async function extractArchitecture(
	context: GatheredContext,
	config?: Config
): Promise<Architecture> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are analyzing a software repository's architecture. Based on the following context, extract structured architecture information.

${contextPrompt}

Analyze the codebase and extract:
1. **projectType**: Classify as one of: monorepo, library, cli, app, framework
2. **entities**: List the main modules/packages with their responsibilities
3. **relationships**: How entities depend on each other
4. **keyFiles**: Most important files and their roles
5. **patterns**: Detected patterns (framework, build tool, test framework, language)

Be thorough but concise. Focus on the actual structure visible in the code.`;

	const result = await runAnalysis({
		prompt,
		cwd: process.cwd(),
		schema: ArchitectureSchema,
		systemPrompt: "You are a software architect expert. Analyze codebases and extract architectural patterns.",
		config,
	});

	return result.output;
}

// ============================================================================
// Skill Generation (PRD 5.5)
// ============================================================================

/**
 * Generate a skill definition for Claude Code / OpenCode.
 */
export async function generateSkill(
	context: GatheredContext,
	summary: string,
	architecture: Architecture,
	config?: Config
): Promise<Skill> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are creating a "skill" file for an AI coding assistant. This skill helps the AI understand and work with a specific codebase.

Repository context:
${contextPrompt}

Summary:
${summary}

Architecture:
${JSON.stringify(architecture, null, 2)}

Generate a skill definition that includes:
1. **name**: Short name for this skill (e.g., "tanstack-router" for tanstack/router)
2. **description**: One sentence describing what this skill is for
3. **allowedTools**: Which AI tools are useful (typically: Read, Glob, Grep, Bash, Edit)
4. **repositoryStructure**: Key directories with their purposes
5. **keyFiles**: 5-10 most important files with descriptions
6. **searchStrategies**: How to find things in this codebase (grep patterns, file patterns)
7. **whenToUse**: Trigger conditions for when the AI should use this skill

Make the skill practical and immediately usable without editing.`;

	const result = await runAnalysis({
		prompt,
		cwd: process.cwd(),
		schema: SkillSchema,
		systemPrompt: "You are an expert at creating AI assistant skills. Make them practical and immediately useful.",
		config,
	});

	return result.output;
}

// ============================================================================
// Architecture Formatting (PRD 5.4)
// ============================================================================

/**
 * Format architecture as markdown with Mermaid diagrams.
 */
export function formatArchitectureMd(architecture: Architecture): string {
	const sections: string[] = [];

	// Title
	sections.push(`# Architecture: ${architecture.projectType}`);
	sections.push("");

	// Mermaid diagram
	sections.push("## Entity Relationships");
	sections.push("");
	sections.push("```mermaid");
	sections.push("flowchart TB");

	// Add entity nodes
	for (const entity of architecture.entities) {
		const id = sanitizeMermaidId(entity.name);
		const label = entity.name.replace(/"/g, "'");
		sections.push(`    ${id}["${label}"]`);
	}

	// Add relationships
	for (const rel of architecture.relationships) {
		const fromId = sanitizeMermaidId(rel.from);
		const toId = sanitizeMermaidId(rel.to);
		const label = rel.type.replace(/"/g, "'");
		sections.push(`    ${fromId} -->|${label}| ${toId}`);
	}

	sections.push("```");
	sections.push("");

	// Entities table
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

	// Key files table
	sections.push("## Key Files");
	sections.push("");
	sections.push("| File | Role |");
	sections.push("|------|------|");

	for (const file of architecture.keyFiles) {
		sections.push(`| \`${file.path}\` | ${file.role} |`);
	}

	sections.push("");

	// Patterns section
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

/**
 * Sanitize a string for use as a Mermaid node ID.
 */
function sanitizeMermaidId(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9]/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase() || "node";
}

// ============================================================================
// Skill Formatting (PRD 5.5)
// ============================================================================

/**
 * Format skill as SKILL.md content with YAML frontmatter.
 */
export function formatSkillMd(skill: Skill): string {
	// Build YAML frontmatter
	const frontmatter = [
		"---",
		`name: "${escapeYaml(skill.name)}"`,
		`description: "${escapeYaml(skill.description)}"`,
		"allowed-tools:",
		...skill.allowedTools.map((tool) => `  - ${tool}`),
		"---",
	].join("\n");

	// Build body sections
	const sections: string[] = [];

	// Repository Structure
	sections.push("## Repository Structure");
	sections.push("");
	for (const entry of skill.repositoryStructure) {
		sections.push(`- \`${entry.path}\`: ${entry.purpose}`);
	}
	sections.push("");

	// Quick Reference Paths (Key Files)
	sections.push("## Quick Reference Paths");
	sections.push("");
	for (const file of skill.keyFiles) {
		sections.push(`- \`${file.path}\`: ${file.description}`);
	}
	sections.push("");

	// Search Strategies
	sections.push("## Search Strategies");
	sections.push("");
	for (const strategy of skill.searchStrategies) {
		sections.push(`- ${strategy}`);
	}
	sections.push("");

	// When to Use
	sections.push("## When to Use");
	sections.push("");
	for (const condition of skill.whenToUse) {
		sections.push(`- ${condition}`);
	}

	return `${frontmatter}\n\n${sections.join("\n")}`;
}

/**
 * Escape special characters for YAML string values.
 */
function escapeYaml(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n");
}
