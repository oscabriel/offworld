/**
 * AGENTS.md manipulation utilities
 *
 * Manages updating project AGENTS.md and agent-specific files with reference information.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const referencesSectionRegex = /^## Project References\n(?:.*\n)*?(?=^## |$)/m;

export interface InstalledReference {
	/** Dependency name */
	dependency: string;
	/** Reference identifier (matches reference file name without .md) */
	reference: string;
	/** Absolute path to reference file */
	path: string;
}

/**
 * Generate single-line project reference guidance.
 *
 * @param _references - Installed references (unused; reserved for future context)
 * @returns Markdown string with one-line guidance
 */
function generateReferencesTable(_references: InstalledReference[]): string {
	const lines = [
		"## Project References",
		"",
		"Use the Offworld CLI to find and read directly from local codebases for any repo in `.offworld/map.json` whenever the user asks about a specific open source project.",
		"",
	];

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

	const match = content.match(referencesSectionRegex);

	let updatedContent: string;
	if (match) {
		updatedContent = content.replace(referencesSectionRegex, referencesMarkdown);
	} else {
		updatedContent = content.trim() + "\n\n" + referencesMarkdown;
	}

	writeFileSync(filePath, updatedContent, "utf-8");
}

/**
 * Update AGENTS.md with project references if the section is missing.
 *
 * @param projectRoot - Project root directory
 * @param references - Array of installed references to document
 */
export function updateAgentFiles(projectRoot: string, references: InstalledReference[]): void {
	const agentsMdPath = join(projectRoot, "AGENTS.md");
	const referencesMarkdown = generateReferencesTable(references);

	if (!existsSync(agentsMdPath)) {
		writeFileSync(agentsMdPath, referencesMarkdown, "utf-8");
		return;
	}

	const content = readFileSync(agentsMdPath, "utf-8");
	if (referencesSectionRegex.test(content)) {
		return;
	}

	const separator = content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
	const updatedContent =
		content.trim().length === 0
			? referencesMarkdown
			: `${content}${separator}${referencesMarkdown}`;
	writeFileSync(agentsMdPath, updatedContent, "utf-8");
}
