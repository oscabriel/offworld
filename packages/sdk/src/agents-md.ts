/**
 * AGENTS.md manipulation utilities
 *
 * Manages updating project AGENTS.md and agent-specific files with skill information.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface InstalledSkill {
	/** Dependency name */
	dependency: string;
	/** Skill identifier (matches skill directory name) */
	skill: string;
	/** Absolute path to skill directory */
	path: string;
}

/**
 * Generate markdown table for project skills section.
 *
 * @param skills - Array of installed skills
 * @returns Markdown string with table
 */
function generateSkillsTable(skills: InstalledSkill[]): string {
	const lines = [
		"## Project Skills",
		"",
		"Skills installed for this project's dependencies:",
		"",
		"| Dependency | Skill | Path |",
		"| --- | --- | --- |",
	];

	for (const skill of skills) {
		lines.push(`| ${skill.dependency} | ${skill.skill} | ${skill.path} |`);
	}

	lines.push("");
	lines.push("To update skills, run: `ow pull <dependency>`");
	lines.push("To regenerate all: `ow project init --all --generate`");
	lines.push("");

	return lines.join("\n");
}

/**
 * Update or append Project Skills section in a markdown file.
 * If the section exists, replaces its content. Otherwise, appends to end.
 *
 * @param filePath - Path to markdown file
 * @param skills - Array of installed skills
 */
export function appendSkillsSection(filePath: string, skills: InstalledSkill[]): void {
	const content = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
	const skillsMarkdown = generateSkillsTable(skills);

	// Look for existing "## Project Skills" section
	const sectionRegex = /^## Project Skills\n(?:.*\n)*?(?=^## |$)/m;
	const match = content.match(sectionRegex);

	let updatedContent: string;
	if (match) {
		// Replace existing section
		updatedContent = content.replace(sectionRegex, skillsMarkdown);
	} else {
		// Append new section
		updatedContent = content.trim() + "\n\n" + skillsMarkdown;
	}

	writeFileSync(filePath, updatedContent, "utf-8");
}

/**
 * Update AGENTS.md and agent-specific files with project skills.
 * Creates files if they don't exist.
 *
 * @param projectRoot - Project root directory
 * @param skills - Array of installed skills to document
 */
export function updateAgentFiles(projectRoot: string, skills: InstalledSkill[]): void {
	const agentsMdPath = join(projectRoot, "AGENTS.md");
	const claudeMdPath = join(projectRoot, "CLAUDE.md");

	// Always update AGENTS.md
	appendSkillsSection(agentsMdPath, skills);

	// Update CLAUDE.md if it exists
	if (existsSync(claudeMdPath)) {
		appendSkillsSection(claudeMdPath, skills);
	}
}
