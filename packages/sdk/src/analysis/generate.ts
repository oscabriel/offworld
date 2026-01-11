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
	const archDelimiter = "=== ARCHITECTURE ===";

	// Use lastIndexOf - the prompt may be echoed before the AI's actual response
	const summaryStart = text.lastIndexOf(summaryDelimiter);
	const archStart = text.lastIndexOf(archDelimiter);

	const summaryText =
		summaryStart !== -1 && archStart !== -1 && summaryStart < archStart
			? text.slice(summaryStart + summaryDelimiter.length, archStart).trim()
			: "";

	const archText =
		archStart !== -1 ? text.slice(archStart + archDelimiter.length).trim() : text.trim();

	return {
		summary: summaryText,
		architecture: parseArchitectureMarkdown(archText),
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
		systemPrompt: `You generate navigation skills for AI coding assistants.
Output ONLY valid SKILL.md content. No preamble, no commentary, no explanations.
Start your response by completing the YAML frontmatter that was started for you.
Include 15-20 Quick Paths with full absolute paths and a Search Patterns markdown table.`,
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
	// The prompt ends with "---\nname: skillname\ndescription:"
	// So the AI's response continues from mid-frontmatter
	// We need to find the complete frontmatter and extract the skill

	// Strategy: Find the LAST complete frontmatter block
	// (The prompt may be echoed earlier, so take the last one)
	const frontmatterPattern = /---\s*\nname:\s*[^\n]+\ndescription:/g;
	const matches = [...text.matchAll(frontmatterPattern)];

	let result: string;

	const lastMatch = matches.at(-1);
	if (lastMatch?.index !== undefined) {
		// Take from the last frontmatter match
		result = text.slice(lastMatch.index);
	} else {
		// Fallback: try code block extraction
		const codeBlockMatch = text.match(/```markdown\n([\s\S]*?)\n```/);
		if (codeBlockMatch?.[1]) {
			return codeBlockMatch[1].trim();
		}
		// Last resort: return as-is
		result = text;
	}

	// Find end of skill: after "## Deep Context" section
	// Stop at any obvious non-skill content (AI commentary)
	const deepContextIdx = result.indexOf("## Deep Context");
	if (deepContextIdx !== -1) {
		// Find the end of Deep Context section
		const afterDeepContext = result.slice(deepContextIdx);
		// Look for end markers: blank line followed by non-markdown content, or code fence
		const endMatch = afterDeepContext.match(/\n\n(?=[^-#\s`|*])|(\n```)/);
		if (endMatch) {
			const endOffset = endMatch.index! + (endMatch[1] ? 0 : 2); // Don't include trailing content
			result = result.slice(0, deepContextIdx + endOffset);
		}
	}

	// Clean up
	return result
		.trim()
		.replace(/\n```[\s\S]*$/, "") // Remove trailing code fences and anything after
		.replace(/\n\n\n+/g, "\n\n") // Normalize excessive blank lines
		.trim();
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
	const lines = ["---", `name: ${skill.name}`, `description: ${skill.description}`];

	if (options.commitSha) {
		lines.push(`commit: ${options.commitSha.slice(0, 7)}`);
	}
	if (options.generated) {
		lines.push(`generated: ${options.generated}`);
	}

	lines.push("---");
	lines.push("");
	lines.push(`# ${skill.name}`);
	lines.push("");
	lines.push(skill.description);
	lines.push("");

	// Quick Paths
	lines.push("## Quick Paths");
	lines.push("");
	for (const qp of skill.quickPaths) {
		lines.push(`- \`${qp.path}\` - ${qp.description}`);
	}
	lines.push("");

	// Search Patterns
	lines.push("## Search Patterns");
	lines.push("");
	lines.push("| Find | Pattern | Path |");
	lines.push("|------|---------|------|");
	for (const sp of skill.searchPatterns) {
		lines.push(`| ${sp.find} | \`${sp.pattern}\` | \`${sp.path}\` |`);
	}
	lines.push("");

	// Deep Context
	lines.push("## Deep Context");
	lines.push("");
	lines.push("- Architecture: Read analysis/architecture.md");
	lines.push("- Summary: Read analysis/summary.md");

	return lines.join("\n");
}
