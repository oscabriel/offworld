import { streamPrompt } from "../ai/index.js";
import type { Architecture, Skill } from "@offworld/types";
import type { GatheredContext } from "./context.js";
import { formatContextForPrompt } from "./context.js";
import { parseArchitectureMarkdown, parseSkillMarkdown } from "./parsers.js";
import {
	createSkillPrompt,
	SUMMARY_TEMPLATE,
	ARCHITECTURE_TEMPLATE,
	SUMMARY_ARCHITECTURE_TEMPLATE,
} from "./prompts.js";

export interface GenerateOptions {
	onDebug?: (message: string) => void;
	onStream?: (text: string) => void;
}

export interface SkillGenerateOptions extends GenerateOptions {
	fullName?: string;
	commitSha?: string;
	generated?: string;
	analysisPath?: string;
}

export interface RichSkillResult {
	skill: Skill;
	skillMd: string;
}

export interface SummaryAndArchitectureResult {
	summary: string;
	architecture: Architecture;
}

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

export async function generateSummaryAndArchitecture(
	context: GatheredContext,
	options: GenerateOptions = {},
): Promise<SummaryAndArchitectureResult> {
	const contextPrompt = formatContextForPrompt(context);

	const prompt = `You are analyzing a software repository.

${contextPrompt}

${SUMMARY_ARCHITECTURE_TEMPLATE}`;

	const result = await streamPrompt({
		prompt,
		cwd: context.repoPath,
		systemPrompt:
			"You are a technical documentation expert and software architect. Analyze codebases thoroughly.",
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	return parseSummaryAndArchitecture(result.text);
}

function parseSummaryAndArchitecture(text: string): SummaryAndArchitectureResult {
	const summaryDelimiter = "=== SUMMARY ===";
	const architectureDelimiter = "=== ARCHITECTURE ===";

	// Use lastIndexOf to find the AI's actual response, not the template in the prompt
	// The prompt may be echoed back before the actual response, so we need the last occurrence
	const summaryStart = text.lastIndexOf(summaryDelimiter);
	const architectureStart = text.lastIndexOf(architectureDelimiter);

	let summaryText: string;
	let architectureText: string;

	if (summaryStart !== -1 && architectureStart !== -1 && summaryStart < architectureStart) {
		summaryText = text.slice(summaryStart + summaryDelimiter.length, architectureStart).trim();
		architectureText = text.slice(architectureStart + architectureDelimiter.length).trim();
	} else {
		const midpoint = Math.floor(text.length / 2);
		summaryText = text.slice(0, midpoint).trim();
		architectureText = text.slice(midpoint).trim();
	}

	const architecture = parseArchitectureMarkdown(architectureText);

	return {
		summary: summaryText,
		architecture,
	};
}

export async function generateSkill(
	context: GatheredContext,
	summary: string,
	architecture: Architecture | null,
	options: SkillGenerateOptions = {},
): Promise<Skill> {
	const result = await generateRichSkill(context, summary, architecture, options);
	return result.skill;
}

export async function generateRichSkill(
	context: GatheredContext,
	summary: string,
	architecture: Architecture | null,
	options: SkillGenerateOptions = {},
): Promise<RichSkillResult> {
	const prompt = createSkillPrompt({
		repoPath: context.repoPath,
		repoName: context.repoName,
		fullName: options.fullName,
		readme: context.readme,
		packageConfig: context.packageConfig,
		fileTree: context.fileTree,
		topFiles: context.topFiles,
		summary,
		architectureJson: architecture ? JSON.stringify(architecture, null, 2) : null,
		analysisPath: options.analysisPath,
	});

	const result = await streamPrompt({
		prompt,
		cwd: context.repoPath,
		systemPrompt:
			"Generate slim, dense skills (~100 lines). Include 15-20 Quick Paths, Search Patterns table, and Deep Context. Full absolute paths. No prose.",
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	let skillMd = extractSkillMarkdown(result.text);
	skillMd = injectSkillMetadata(skillMd, options.commitSha, options.generated);
	const skill = parseSkillMarkdown(skillMd);

	return { skill, skillMd };
}

function injectSkillMetadata(skillMd: string, commitSha?: string, generated?: string): string {
	if (!commitSha && !generated) return skillMd;

	const endOfFrontmatter = skillMd.indexOf("---", 3);
	if (endOfFrontmatter === -1) return skillMd;

	const newFields: string[] = [];
	if (commitSha) {
		newFields.push(`commit: ${commitSha.slice(0, 7)}`);
	}
	if (generated) {
		newFields.push(`generated: ${generated}`);
	}

	return (
		skillMd.slice(0, endOfFrontmatter) +
		newFields.join("\n") +
		"\n" +
		skillMd.slice(endOfFrontmatter)
	);
}

function extractSkillMarkdown(text: string): string {
	// Find ALL markdown code blocks
	const codeBlockMatches = [...text.matchAll(/```markdown\n([\s\S]*?)\n```/g)];

	// If there are multiple code blocks, use the LAST one (AI's response, not template)
	// If there's only one, it's likely the template example - skip to fallback
	if (codeBlockMatches.length > 1) {
		const lastMatch = codeBlockMatches[codeBlockMatches.length - 1];
		if (lastMatch?.[1]) {
			return lastMatch[1].trim();
		}
	}

	// Primary extraction: find the last skill frontmatter (--- followed by name:)
	// This handles when the AI outputs skill markdown directly without code fences
	const skillFrontmatterMatches = [...text.matchAll(/---\s*\nname:/g)];
	const lastFrontmatterMatch = skillFrontmatterMatches[skillFrontmatterMatches.length - 1];
	if (lastFrontmatterMatch?.index !== undefined) {
		return text.slice(lastFrontmatterMatch.index).trim();
	}

	// Fallback: if there's exactly one code block and no frontmatter found, use it
	if (codeBlockMatches.length === 1 && codeBlockMatches[0]?.[1]) {
		return codeBlockMatches[0][1].trim();
	}

	// Final fallback: look for any --- near the end of the text
	const lastDashIndex = text.lastIndexOf("---");
	if (lastDashIndex !== -1 && lastDashIndex > text.length / 2) {
		return text.slice(lastDashIndex).trim();
	}

	return text.trim();
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

export interface FormatSkillOptions {
	commitSha?: string;
	generated?: string;
}

export function formatSkillMd(skill: Skill, options: FormatSkillOptions = {}): string {
	const lines = [
		"---",
		`name: "${escapeYaml(skill.name)}"`,
		`description: "${escapeYaml(skill.description)}"`,
	];

	if (options.commitSha) {
		lines.push(`commit: ${options.commitSha.slice(0, 7)}`);
	}
	if (options.generated) {
		lines.push(`generated: ${options.generated}`);
	}

	lines.push("---");
	const frontmatter = lines.join("\n");

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
