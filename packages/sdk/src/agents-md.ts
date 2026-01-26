/**
 * AGENTS.md manipulation utilities
 *
 * Manages updating project AGENTS.md and agent-specific files with reference information.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface InstalledReference {
	/** Dependency name */
	dependency: string;
	/** Reference identifier (matches reference file name without .md) */
	reference: string;
	/** Absolute path to reference file */
	path: string;
}

/**
 * Generate markdown table for project references section.
 *
 * @param references - Array of installed references
 * @returns Markdown string with table
 */
function generateReferencesTable(references: InstalledReference[]): string {
	const lines = [
		"## Project References",
		"",
		"References installed for this project's dependencies:",
		"",
		"| Dependency | Reference | Path |",
		"| --- | --- | --- |",
	];

	for (const reference of references) {
		lines.push(`| ${reference.dependency} | ${reference.reference} | ${reference.path} |`);
	}

	lines.push("");
	lines.push("To update references: `ow pull <dependency>`");
	lines.push("To regenerate all: `ow project init --all --generate`");
	lines.push("");

	return lines.join("\n");
}

/**
 * Update or append Project References section in a markdown file.
 * If the section exists, replaces its content. Otherwise, appends to end.
 *
 * @param filePath - Path to markdown file
 * @param references - Array of installed references
 */
export function appendReferencesSection(filePath: string, references: InstalledReference[]): void {
	const content = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
	const referencesMarkdown = generateReferencesTable(references);

	// Look for existing "## Project References" section
	const sectionRegex = /^## Project References\n(?:.*\n)*?(?=^## |$)/m;
	const match = content.match(sectionRegex);

	let updatedContent: string;
	if (match) {
		// Replace existing section
		updatedContent = content.replace(sectionRegex, referencesMarkdown);
	} else {
		// Append new section
		updatedContent = content.trim() + "\n\n" + referencesMarkdown;
	}

	writeFileSync(filePath, updatedContent, "utf-8");
}

/**
 * Update AGENTS.md and agent-specific files with project references.
 * Creates files if they don't exist.
 *
 * @param projectRoot - Project root directory
 * @param references - Array of installed references to document
 */
export function updateAgentFiles(projectRoot: string, references: InstalledReference[]): void {
	const agentsMdPath = join(projectRoot, "AGENTS.md");
	const claudeMdPath = join(projectRoot, "CLAUDE.md");

	// Always update AGENTS.md
	appendReferencesSection(agentsMdPath, references);

	// Update CLAUDE.md if it exists
	if (existsSync(claudeMdPath)) {
		appendReferencesSection(claudeMdPath, references);
	}
}
