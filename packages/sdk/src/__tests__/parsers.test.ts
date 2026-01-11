import { describe, expect, it } from "vitest";
import {
	extractField,
	parseListSection,
	parsePathDescSection,
	parsePathPurposeSection,
	parseArchitectureMarkdown,
	parseSkillMarkdown,
	ParseError,
} from "../analysis/parsers.js";

describe("extractField", () => {
	it("extracts bold field values", () => {
		expect(extractField("**Name**: my-skill", "Name")).toBe("my-skill");
	});

	it("extracts field with leading dash", () => {
		expect(extractField("- **Type**: package", "Type")).toBe("package");
	});

	it("extracts plain field without formatting", () => {
		expect(extractField("Name: my-skill", "Name")).toBe("my-skill");
	});

	it("returns empty string when field not found", () => {
		expect(extractField("no match here", "Name")).toBe("");
	});

	it("handles multiline text", () => {
		const text = `**Name**: first-value
**Other**: second-value`;
		expect(extractField(text, "Name")).toBe("first-value");
		expect(extractField(text, "Other")).toBe("second-value");
	});

	it("trims whitespace", () => {
		expect(extractField("**Name**:   spaced value   ", "Name")).toBe("spaced value");
	});

	it("is case insensitive for field names", () => {
		expect(extractField("**NAME**: value", "name")).toBe("value");
	});
});

describe("parseListSection", () => {
	it("parses bullet list from section", () => {
		const text = `## Header
- item1
- item2
- item3

## Next`;
		expect(parseListSection(text, "Header")).toEqual(["item1", "item2", "item3"]);
	});

	it("stops at next section", () => {
		const text = `## First
- a
- b
## Second
- c`;
		expect(parseListSection(text, "First")).toEqual(["a", "b"]);
	});

	it("returns empty array for missing section", () => {
		const text = "## Other\n- item";
		expect(parseListSection(text, "Missing")).toEqual([]);
	});

	it("handles empty sections", () => {
		const text = `## Empty

## Next`;
		expect(parseListSection(text, "Empty")).toEqual([]);
	});

	it("trims whitespace from items", () => {
		const text = `## List
-   spaced item   `;
		expect(parseListSection(text, "List")).toEqual(["spaced item"]);
	});

	it("ignores non-bullet lines", () => {
		const text = `## Header
Some text
- actual item
more text`;
		expect(parseListSection(text, "Header")).toEqual(["actual item"]);
	});
});

describe("parsePathDescSection", () => {
	it("parses backtick paths with descriptions", () => {
		const text = `## Key Files
- \`src/index.ts\`: Main entry point
- \`package.json\`: Package manifest`;
		const result = parsePathDescSection(text, "Key Files");
		expect(result).toEqual([
			{ path: "src/index.ts", description: "Main entry point" },
			{ path: "package.json", description: "Package manifest" },
		]);
	});

	it("parses paths without backticks", () => {
		const text = `## Files
- src/index.ts: Entry point`;
		const result = parsePathDescSection(text, "Files");
		expect(result).toEqual([{ path: "src/index.ts", description: "Entry point" }]);
	});

	it("returns empty array for missing section", () => {
		expect(parsePathDescSection("## Other", "Files")).toEqual([]);
	});
});

describe("parsePathPurposeSection", () => {
	it("parses paths with purposes", () => {
		const text = `## Repository Structure
- \`src/\`: Source code
- \`tests/\`: Test files`;
		const result = parsePathPurposeSection(text, "Repository Structure");
		expect(result).toEqual([
			{ path: "src/", purpose: "Source code" },
			{ path: "tests/", purpose: "Test files" },
		]);
	});
});

describe("parseArchitectureMarkdown", () => {
	const validArchitecture = `## Project Type
monorepo

## Entities

### core-package
- **Type**: package
- **Path**: packages/core
- **Description**: Core functionality
- **Responsibilities**:
  - Handle main logic
  - Provide utilities

### ui-package
- **Type**: module
- **Path**: packages/ui
- **Description**: UI components

## Relationships
- core-package -> ui-package: depends
- ui-package uses core-package

## Key Files
- \`package.json\`: Root manifest
- \`tsconfig.json\`: TypeScript config

## Patterns
- **Framework**: React
- **Build Tool**: Vite
- **Test Framework**: Vitest
- **Language**: TypeScript`;

	it("parses valid architecture markdown", () => {
		const result = parseArchitectureMarkdown(validArchitecture);
		expect(result.projectType).toBe("monorepo");
		expect(result.entities).toHaveLength(2);
		expect(result.relationships).toHaveLength(2);
		expect(result.keyFiles).toHaveLength(2);
		expect(result.patterns.framework).toBe("React");
	});

	it("extracts project type", () => {
		const result = parseArchitectureMarkdown(validArchitecture);
		expect(result.projectType).toBe("monorepo");
	});

	it("parses entities with responsibilities", () => {
		const result = parseArchitectureMarkdown(validArchitecture);
		const coreEntity = result.entities.find((e) => e.name === "core-package");
		expect(coreEntity?.responsibilities).toContain("Handle main logic");
		expect(coreEntity?.responsibilities).toContain("Provide utilities");
	});

	it("parses arrow-style relationships", () => {
		const result = parseArchitectureMarkdown(validArchitecture);
		const arrowRel = result.relationships.find((r) => r.from === "core-package");
		expect(arrowRel?.to).toBe("ui-package");
		expect(arrowRel?.type).toBe("depends");
	});

	it("parses natural language relationships", () => {
		const result = parseArchitectureMarkdown(validArchitecture);
		const nlRel = result.relationships.find((r) => r.from === "ui-package");
		expect(nlRel?.to).toBe("core-package");
	});

	it("throws on missing project type", () => {
		const noProjectType = `## Entities
### module
- **Type**: module`;
		expect(() => parseArchitectureMarkdown(noProjectType)).toThrow(ParseError);
		expect(() => parseArchitectureMarkdown(noProjectType)).toThrow("Project Type");
	});

	it("normalizes invalid project type to 'app'", () => {
		const text = `## Project Type
invalid-type`;
		const result = parseArchitectureMarkdown(text);
		expect(result.projectType).toBe("app");
	});

	it("handles missing optional sections", () => {
		const minimal = `## Project Type
library`;
		const result = parseArchitectureMarkdown(minimal);
		expect(result.projectType).toBe("library");
		expect(result.entities).toEqual([]);
		expect(result.relationships).toEqual([]);
		expect(result.keyFiles).toEqual([]);
	});
});

describe("parseSkillMarkdown", () => {
	const validSkill = `## Skill Info
- **Name**: my-skill
- **Description**: A useful skill for testing

## Allowed Tools
- Read
- Glob
- Grep

## Repository Structure
- \`src/\`: Source code
- \`tests/\`: Test files

## Key Files
- \`src/index.ts\`: Main entry
- \`README.md\`: Documentation

## Search Strategies
- Use Grep for 'export function'
- Use Glob for '**/*.test.ts'

## When to Use
- When working with this codebase
- When debugging issues`;

	it("parses valid skill markdown", () => {
		const result = parseSkillMarkdown(validSkill);
		expect(result.name).toBe("my-skill");
		expect(result.description).toBe("A useful skill for testing");
		expect(result.allowedTools).toContain("Read");
		expect(result.repositoryStructure).toHaveLength(2);
		expect(result.keyFiles).toHaveLength(2);
		expect(result.searchStrategies).toHaveLength(2);
		expect(result.whenToUse).toHaveLength(2);
	});

	it("throws on missing name", () => {
		const noName = `## Skill Info
- **Description**: No name provided`;
		expect(() => parseSkillMarkdown(noName)).toThrow(ParseError);
		expect(() => parseSkillMarkdown(noName)).toThrow("name");
	});

	it("provides default allowed tools when missing", () => {
		const minimal = `## Skill Info
- **Name**: minimal-skill`;
		const result = parseSkillMarkdown(minimal);
		expect(result.allowedTools).toEqual(["Read", "Glob", "Grep"]);
	});

	it("handles empty optional sections", () => {
		const minimal = `## Skill Info
- **Name**: minimal-skill
- **Description**: Minimal`;
		const result = parseSkillMarkdown(minimal);
		expect(result.repositoryStructure).toEqual([]);
		expect(result.keyFiles).toEqual([]);
		expect(result.searchStrategies).toEqual([]);
		expect(result.whenToUse).toEqual([]);
	});

	it("extracts name from different formats", () => {
		const boldName = `## Skill Info
**Name**: bold-skill`;
		expect(parseSkillMarkdown(boldName).name).toBe("bold-skill");

		const plainName = `## Skill Info
Name: plain-skill`;
		expect(parseSkillMarkdown(plainName).name).toBe("plain-skill");
	});

	it("parses YAML frontmatter format", () => {
		const frontmatterSkill = `---
name: zod
description: TypeScript-first schema validation
---

# colinhacks/zod

## Repository Structure
- \`packages/zod/src/\`: Core source code

## Key Files
- \`packages/zod/src/index.ts\`: Main entry point

## Search Strategies
- Use Grep for schema definitions

## When to Use
- When validating data schemas`;

		const result = parseSkillMarkdown(frontmatterSkill);
		expect(result.name).toBe("zod");
		expect(result.description).toBe("TypeScript-first schema validation");
		expect(result.repositoryStructure).toHaveLength(1);
		expect(result.keyFiles).toHaveLength(1);
	});

	it("parses frontmatter with quoted values", () => {
		const quotedFrontmatter = `---
name: "test-skill"
description: 'A skill with quotes'
---

## Key Files
- \`index.ts\`: Entry`;

		const result = parseSkillMarkdown(quotedFrontmatter);
		expect(result.name).toBe("test-skill");
		expect(result.description).toBe("A skill with quotes");
	});

	it("prefers frontmatter over section format", () => {
		const mixedSkill = `---
name: frontmatter-name
description: frontmatter-desc
---

## Skill Info
- **Name**: section-name
- **Description**: section-desc`;

		const result = parseSkillMarkdown(mixedSkill);
		expect(result.name).toBe("frontmatter-name");
		expect(result.description).toBe("frontmatter-desc");
	});
});
