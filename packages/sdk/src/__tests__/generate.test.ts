/**
 * Unit tests for analysis/generate.ts pure functions
 * PRD T1.1: Tests for sanitizeMermaidId, escapeYaml, formatArchitectureMd, formatSkillMd
 */

import { describe, expect, it } from "vitest";
import { formatArchitectureMd, formatSkillMd } from "../analysis/generate.js";
import type { Architecture, Skill } from "@offworld/types";

// ============================================================================
// Test fixtures
// ============================================================================

function createMinimalArchitecture(overrides: Partial<Architecture> = {}): Architecture {
	return {
		projectType: "library",
		entities: [],
		relationships: [],
		keyFiles: [],
		patterns: {},
		...overrides,
	};
}

function createMinimalSkill(overrides: Partial<Skill> = {}): Skill {
	return {
		name: "test-skill",
		description: "A test skill",
		quickPaths: [],
		searchPatterns: [],
		...overrides,
	};
}

// ============================================================================
// sanitizeMermaidId tests (via formatArchitectureMd)
// ============================================================================

describe("sanitizeMermaidId (via formatArchitectureMd)", () => {
	it("handles empty string by producing 'node' as fallback", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "",
					type: "module",
					path: "/empty",
					description: "Empty name entity",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Empty string should produce 'node' as the ID
		expect(result).toContain('node[""]');
	});

	it("replaces special characters with underscores", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "@scope/package-name",
					type: "package",
					path: "/pkg",
					description: "Package with special chars",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// @, /, - should become underscores, leading/trailing stripped
		expect(result).toContain('scope_package_name["@scope/package-name"]');
	});

	it("handles unicode characters", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "модуль",
					type: "module",
					path: "/unicode",
					description: "Cyrillic name",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Unicode should be replaced with underscores, fallback to 'node' if all stripped
		expect(result).toContain('node["модуль"]');
	});

	it("handles numeric-only names", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "12345",
					type: "module",
					path: "/numeric",
					description: "Numeric name",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Numbers should be preserved
		expect(result).toContain('12345["12345"]');
	});

	it("strips leading and trailing underscores", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "___module___",
					type: "module",
					path: "/underscores",
					description: "Leading/trailing underscores",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Should strip leading/trailing underscores
		expect(result).toContain('module["___module___"]');
	});

	it("converts to lowercase", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "MyModule",
					type: "module",
					path: "/mymodule",
					description: "Mixed case",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Should be lowercase
		expect(result).toContain('mymodule["MyModule"]');
	});
});

// ============================================================================
// escapeYaml tests (via formatSkillMd)
// ============================================================================
// formatArchitectureMd tests
// ============================================================================

describe("formatArchitectureMd", () => {
	it("formats empty entities correctly", () => {
		const arch = createMinimalArchitecture();

		const result = formatArchitectureMd(arch);

		expect(result).toContain("# Architecture: library");
		expect(result).toContain("## Entity Relationships");
		expect(result).toContain("```mermaid");
		expect(result).toContain("flowchart TB");
		expect(result).toContain("## Entities");
		expect(result).toContain("## Key Files");
		expect(result).toContain("## Detected Patterns");
	});

	it("handles special characters in entity labels", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: 'Entity "With" Quotes',
					type: "module",
					path: "/entity",
					description: "Test entity",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Double quotes should be replaced with single quotes in Mermaid labels
		expect(result).toContain("Entity 'With' Quotes");
	});

	it("handles pipe characters in entity descriptions", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "TestEntity",
					type: "module",
					path: "/test",
					description: "Uses | for piping | data",
					responsibilities: [],
				},
			],
		});

		const result = formatArchitectureMd(arch);
		// Pipes should be escaped in markdown tables
		expect(result).toContain("Uses \\| for piping \\| data");
	});

	it("formats entity relationships correctly", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "ModuleA",
					type: "module",
					path: "/a",
					description: "Module A",
					responsibilities: [],
				},
				{
					name: "ModuleB",
					type: "module",
					path: "/b",
					description: "Module B",
					responsibilities: [],
				},
			],
			relationships: [{ from: "ModuleA", to: "ModuleB", type: "imports" }],
		});

		const result = formatArchitectureMd(arch);
		expect(result).toContain("modulea -->|imports| moduleb");
	});

	it("handles missing optional patterns", () => {
		const arch = createMinimalArchitecture({
			patterns: {}, // No patterns set
		});

		const result = formatArchitectureMd(arch);

		// Should have section header but no pattern lines
		expect(result).toContain("## Detected Patterns");
		expect(result).not.toContain("**Framework**");
		expect(result).not.toContain("**Build Tool**");
		expect(result).not.toContain("**Test Framework**");
		expect(result).not.toContain("**Language**");
	});

	it("formats all patterns when present", () => {
		const arch = createMinimalArchitecture({
			patterns: {
				framework: "React",
				buildTool: "Vite",
				testFramework: "Vitest",
				language: "TypeScript",
			},
		});

		const result = formatArchitectureMd(arch);

		expect(result).toContain("- **Framework**: React");
		expect(result).toContain("- **Build Tool**: Vite");
		expect(result).toContain("- **Test Framework**: Vitest");
		expect(result).toContain("- **Language**: TypeScript");
	});

	it("formats key files table correctly", () => {
		const arch = createMinimalArchitecture({
			keyFiles: [
				{ path: "src/index.ts", role: "Entry point" },
				{ path: "package.json", role: "Package manifest" },
			],
		});

		const result = formatArchitectureMd(arch);

		expect(result).toContain("| `src/index.ts` | Entry point |");
		expect(result).toContain("| `package.json` | Package manifest |");
	});

	it("formats entities table with all columns", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "CoreModule",
					type: "module",
					path: "src/core",
					description: "Core functionality",
					responsibilities: ["Main logic"],
				},
			],
		});

		const result = formatArchitectureMd(arch);

		expect(result).toContain("| Name | Type | Path | Description |");
		expect(result).toContain("| CoreModule | module | `src/core` | Core functionality |");
	});

	it("handles quotes in relationship types", () => {
		const arch = createMinimalArchitecture({
			entities: [
				{
					name: "A",
					type: "module",
					path: "/a",
					description: "A",
					responsibilities: [],
				},
				{
					name: "B",
					type: "module",
					path: "/b",
					description: "B",
					responsibilities: [],
				},
			],
			relationships: [{ from: "A", to: "B", type: 'uses "internal" API' }],
		});

		const result = formatArchitectureMd(arch);
		// Quotes should be replaced with single quotes in relationship labels
		expect(result).toContain("uses 'internal' API");
	});
});

// ============================================================================
// formatSkillMd tests
// ============================================================================

describe("formatSkillMd", () => {
	it("formats empty arrays correctly", () => {
		const skill = createMinimalSkill({
			quickPaths: [],
			searchPatterns: [],
		});

		const result = formatSkillMd(skill);

		expect(result).toContain("---");
		expect(result).toContain("name: test-skill");
		expect(result).toContain("## Quick Paths");
		expect(result).toContain("## Search Patterns");
		expect(result).toContain("## Deep Context");
	});

	it("handles special characters in name and description", () => {
		const skill = createMinimalSkill({
			name: "test-skill",
			description: "Uses: colons, and [brackets]",
		});

		const result = formatSkillMd(skill);

		expect(result).toContain("name: test-skill");
		expect(result).toContain("description: Uses: colons, and [brackets]");
	});

	it("includes commit and generated in frontmatter when provided", () => {
		const skill = createMinimalSkill();

		const result = formatSkillMd(skill, {
			commitSha: "abc1234def5678",
			generated: "2026-01-10",
		});

		expect(result).toContain("commit: abc1234");
		expect(result).toContain("generated: 2026-01-10");
	});

	it("formats quick paths section", () => {
		const skill = createMinimalSkill({
			quickPaths: [
				{ path: "/path/to/src/index.ts", description: "Main entry point" },
				{ path: "/path/to/package.json", description: "Package manifest" },
			],
		});

		const result = formatSkillMd(skill);

		expect(result).toContain("## Quick Paths");
		expect(result).toContain("- `/path/to/src/index.ts` - Main entry point");
		expect(result).toContain("- `/path/to/package.json` - Package manifest");
	});

	it("formats search patterns table", () => {
		const skill = createMinimalSkill({
			searchPatterns: [
				{ find: "Hooks", pattern: "export function use", path: "/path/to/src/" },
				{ find: "Types", pattern: "export type", path: "/path/to/types/" },
			],
		});

		const result = formatSkillMd(skill);

		expect(result).toContain("## Search Patterns");
		expect(result).toContain("| Find | Pattern | Path |");
		expect(result).toContain("|------|---------|------|");
		expect(result).toContain("| Hooks | `export function use` | `/path/to/src/` |");
		expect(result).toContain("| Types | `export type` | `/path/to/types/` |");
	});

	it("formats complete skill with all sections populated", () => {
		const skill: Skill = {
			name: "complete-skill",
			description: "A complete skill with all sections",
			quickPaths: [
				{ path: "/repo/src/index.ts", description: "Main entry" },
				{ path: "/repo/tsconfig.json", description: "TypeScript config" },
			],
			searchPatterns: [
				{ find: "Exports", pattern: "export", path: "/repo/src/" },
				{ find: "Tests", pattern: "describe\\(", path: "/repo/tests/" },
			],
		};

		const result = formatSkillMd(skill, {
			commitSha: "abc1234",
			generated: "2026-01-10",
		});

		expect(result).toMatch(/^---\n/);
		expect(result).toContain("name: complete-skill");
		expect(result).toContain("description: A complete skill with all sections");
		expect(result).toContain("commit: abc1234");
		expect(result).toContain("generated: 2026-01-10");

		expect(result).toContain("## Quick Paths");
		expect(result).toContain("- `/repo/src/index.ts` - Main entry");

		expect(result).toContain("## Search Patterns");
		expect(result).toContain("| Exports | `export` | `/repo/src/` |");

		expect(result).toContain("## Deep Context");
	});

	it("includes deep context section", () => {
		const skill = createMinimalSkill();

		const result = formatSkillMd(skill);

		expect(result).toContain("## Deep Context");
		expect(result).toContain("- Architecture: `${ANALYSIS}/architecture.md`");
		expect(result).toContain("- Summary: `${ANALYSIS}/summary.md`");
	});
});
