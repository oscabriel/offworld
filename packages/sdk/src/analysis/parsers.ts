import type { Architecture, Skill } from "@offworld/types";

export class ParseError extends Error {
	constructor(
		message: string,
		public readonly section?: string,
	) {
		super(message);
		this.name = "ParseError";
	}
}

export function extractField(text: string, fieldName: string): string {
	const patterns = [
		new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\n|$)`, "i"),
		new RegExp(`-\\s*\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\n|$)`, "i"),
		new RegExp(`${fieldName}:\\s*(.+?)(?:\\n|$)`, "i"),
	];

	for (const pattern of patterns) {
		const match = pattern.exec(text);
		if (match?.[1]) {
			return match[1].trim();
		}
	}

	return "";
}

export function parseListSection(text: string, header: string): string[] {
	const headerPattern = new RegExp(`##\\s*${header}[\\s\\n]`, "i");
	const match = headerPattern.exec(text);
	if (!match) return [];

	const startIdx = match.index + match[0].length;
	const nextSectionMatch = /\n##(?!#)\s/.exec(text.slice(startIdx));
	const endIdx = nextSectionMatch ? startIdx + nextSectionMatch.index : text.length;
	const sectionContent = text.slice(startIdx, endIdx);

	const items: string[] = [];
	const lines = sectionContent.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- ")) {
			items.push(trimmed.slice(2).trim());
		}
	}

	return items;
}

export function parsePathDescSection(
	text: string,
	header: string,
): Array<{ path: string; description: string }> {
	const items = parseListSection(text, header);
	const results: Array<{ path: string; description: string }> = [];

	for (const item of items) {
		const backtickMatch = /`([^`]+)`:\s*(.+)/.exec(item);
		if (backtickMatch?.[1] && backtickMatch[2]) {
			results.push({
				path: backtickMatch[1].trim(),
				description: backtickMatch[2].trim(),
			});
			continue;
		}

		const colonMatch = /^([^:]+):\s*(.+)/.exec(item);
		if (colonMatch?.[1] && colonMatch[2]) {
			results.push({
				path: colonMatch[1].trim(),
				description: colonMatch[2].trim(),
			});
		}
	}

	return results;
}

export function parsePathPurposeSection(
	text: string,
	header: string,
): Array<{ path: string; purpose: string }> {
	const items = parsePathDescSection(text, header);
	return items.map((item) => ({
		path: item.path,
		purpose: item.description,
	}));
}

function extractSection(text: string, header: string): string {
	const headerPattern = new RegExp(`##\\s*${header}[\\s\\n]`, "i");
	const match = headerPattern.exec(text);
	if (!match) return "";

	const startIdx = match.index + match[0].length;
	const nextSectionMatch = /\n##(?!#)\s/.exec(text.slice(startIdx));
	const endIdx = nextSectionMatch ? startIdx + nextSectionMatch.index : text.length;

	return text.slice(startIdx, endIdx).trim();
}

function parseEntitiesSection(text: string): Architecture["entities"] {
	const entitiesSection = extractSection(text, "Entities");
	if (!entitiesSection) return [];

	const entities: Architecture["entities"] = [];
	const entityBlocks = entitiesSection.split(/(?:^|\n)###\s+/).filter((b) => b.trim());

	for (const block of entityBlocks) {
		const lines = block.trim().split("\n");
		const name = lines[0]?.trim() ?? "";
		if (!name) continue;

		const blockText = lines.slice(1).join("\n");
		const typeField = extractField(blockText, "Type");
		const pathField = extractField(blockText, "Path");
		const descField = extractField(blockText, "Description");

		const responsibilitiesMatch = /\*\*Responsibilities\*\*[:\s]*\n([\s\S]*)$/i.exec(blockText);
		const responsibilities: string[] = [];
		if (responsibilitiesMatch?.[1]) {
			const respLines = responsibilitiesMatch[1].split("\n");
			for (const line of respLines) {
				const trimmed = line.trim();
				if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
					responsibilities.push(trimmed.slice(2).trim());
				}
			}
		}

		entities.push({
			name,
			type: validateEntityType(typeField),
			path: pathField || name,
			description: descField || name,
			responsibilities,
		});
	}

	return entities;
}

function validateEntityType(type: string): Architecture["entities"][0]["type"] {
	const validTypes = ["package", "module", "feature", "util", "config"];
	const normalized = type.toLowerCase();
	if (validTypes.includes(normalized)) {
		return normalized as Architecture["entities"][0]["type"];
	}
	return "module";
}

function parseRelationshipsSection(text: string): Architecture["relationships"] {
	const items = parseListSection(text, "Relationships");
	const relationships: Architecture["relationships"] = [];

	for (const item of items) {
		const arrowMatch = /^(.+?)\s*->\s*([^:\s]+):?\s*(.*)$/.exec(item);
		if (arrowMatch?.[1] && arrowMatch[2]) {
			relationships.push({
				from: arrowMatch[1].trim(),
				to: arrowMatch[2].trim(),
				type: arrowMatch[3]?.trim() || "depends",
			});
			continue;
		}

		const toMatch = /^([^\s]+)\s+(?:uses|depends on|imports|calls)\s+([^\s]+)/i.exec(item);
		if (toMatch?.[1] && toMatch[2]) {
			relationships.push({
				from: toMatch[1].trim(),
				to: toMatch[2].trim(),
				type: "depends",
			});
		}
	}

	return relationships;
}

function parseKeyFilesSection(text: string): Architecture["keyFiles"] {
	const items = parsePathDescSection(text, "Key Files");
	return items.map((item) => ({
		path: item.path,
		role: item.description,
	}));
}

function parsePatternsSection(text: string): Architecture["patterns"] {
	const patternsSection = extractSection(text, "Patterns");

	return {
		framework: extractField(patternsSection, "Framework") || undefined,
		buildTool: extractField(patternsSection, "Build Tool") || undefined,
		testFramework: extractField(patternsSection, "Test Framework") || undefined,
		language: extractField(patternsSection, "Language") || undefined,
	};
}

function validateProjectType(type: string): Architecture["projectType"] {
	const validTypes = ["monorepo", "library", "cli", "app", "framework"];
	const normalized = type.toLowerCase();
	if (validTypes.includes(normalized)) {
		return normalized as Architecture["projectType"];
	}
	return "app";
}

export function parseArchitectureMarkdown(text: string): Architecture {
	const projectTypeSection = extractSection(text, "Project Type");
	const projectTypeRaw = projectTypeSection.trim().split("\n")[0] || "";
	const projectType = validateProjectType(projectTypeRaw);

	if (!projectTypeRaw) {
		throw new ParseError("Missing required section: Project Type", "Project Type");
	}

	const entities = parseEntitiesSection(text);
	const relationships = parseRelationshipsSection(text);
	const keyFiles = parseKeyFilesSection(text);
	const patterns = parsePatternsSection(text);

	return {
		projectType,
		entities,
		relationships,
		keyFiles,
		patterns,
	};
}

function parseFrontmatter(text: string): { frontmatter: Record<string, string>; body: string } {
	const frontmatterMatch = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.trim());
	if (!frontmatterMatch) {
		return { frontmatter: {}, body: text };
	}

	const frontmatterBlock = frontmatterMatch[1] ?? "";
	const body = frontmatterMatch[2] ?? "";
	const frontmatter: Record<string, string> = {};

	for (const line of frontmatterBlock.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;

		const key = line.slice(0, colonIdx).trim();
		let value = line.slice(colonIdx + 1).trim();

		const isQuoted =
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"));
		if (isQuoted) {
			value = value.slice(1, -1);
		}

		frontmatter[key] = value;
	}

	return { frontmatter, body };
}

export function parseSkillMarkdown(text: string): Skill {
	const { frontmatter, body } = parseFrontmatter(text);

	let name = frontmatter.name || "";
	let description = frontmatter.description || "";

	if (!name) {
		const skillInfoSection = extractSection(text, "Skill Info");
		name = extractField(skillInfoSection, "Name");
		description = extractField(skillInfoSection, "Description") || description;
	}

	if (!name) {
		throw new ParseError("Missing required field: name", "Skill Info");
	}

	const contentToParse = body || text;
	const quickPaths = parseQuickPathsSection(contentToParse);
	const searchPatterns = parseSearchPatternsTable(contentToParse);

	return {
		name,
		description,
		quickPaths,
		searchPatterns,
	};
}

/**
 * Parse Quick Paths section from skill markdown.
 * Expects format: - `/path/to/file.ts` - description
 */
function parseQuickPathsSection(text: string): Array<{ path: string; description: string }> {
	const section = extractSection(text, "Quick Paths");
	if (!section) return [];

	const results: Array<{ path: string; description: string }> = [];

	// Match: - `/path/to/file.ts` - description
	// Or:    - `path/to/file.ts` - description
	const lines = section.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("-")) continue;

		// Pattern: - `path` - description
		const match = /^-\s*`([^`]+)`\s*-\s*(.+)$/.exec(trimmed);
		if (match?.[1] && match[2]) {
			results.push({
				path: match[1].trim(),
				description: match[2].trim(),
			});
		}
	}

	return results;
}

/**
 * Parse Search Patterns table from skill markdown.
 * Expects markdown table with columns: Find | Pattern | Path
 */
function parseSearchPatternsTable(
	text: string,
): Array<{ find: string; pattern: string; path: string }> {
	const section = extractSection(text, "Search Patterns");
	if (!section) return [];

	const results: Array<{ find: string; pattern: string; path: string }> = [];
	const lines = section.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip header row and separator
		if (!trimmed.includes("|")) continue;
		if (trimmed.includes("---")) continue;
		if (/\|\s*Find\s*\|/i.test(trimmed)) continue;

		// Parse table row respecting backtick-escaped content
		const cells = parseTableRow(trimmed);

		if (cells.length >= 3 && cells[0] && cells[1] && cells[2]) {
			results.push({
				find: cells[0],
				pattern: cells[1].replace(/`/g, ""),
				path: cells[2].replace(/`/g, ""),
			});
		}
	}

	return results;
}

/**
 * Parse a markdown table row, respecting backtick-escaped content.
 * Pipes inside backticks are not treated as delimiters.
 */
function parseTableRow(row: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inBacktick = false;

	for (let i = 0; i < row.length; i++) {
		const char = row[i];

		if (char === "`") {
			inBacktick = !inBacktick;
			current += char;
		} else if (char === "|" && !inBacktick) {
			// End of cell
			const trimmed = current.trim();
			if (trimmed) {
				cells.push(trimmed);
			}
			current = "";
		} else {
			current += char;
		}
	}

	// Don't forget the last cell
	const trimmed = current.trim();
	if (trimmed) {
		cells.push(trimmed);
	}

	return cells;
}
