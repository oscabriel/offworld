/**
 * Unit tests for architecture formatting
 * PRD T5.3
 */

import { describe, expect, it } from "vitest";

import { formatArchitectureMd } from "../analysis/generate.js";
import type { Architecture, Entity, Relationship } from "@offworld/types";

describe("architecture formatting", () => {
	const mockEntity1: Entity = {
		name: "core",
		type: "module",
		path: "src/core",
		description: "Core module with main functionality",
		responsibilities: ["Handle routing", "Manage state"],
		exports: ["Router", "State"],
		dependencies: [],
	};

	const mockEntity2: Entity = {
		name: "utils",
		type: "util",
		path: "src/utils",
		description: "Utility functions",
		responsibilities: ["Helper functions"],
		exports: ["formatDate", "parseUrl"],
		dependencies: [],
	};

	const mockEntity3: Entity = {
		name: "types",
		type: "package",
		path: "src/types",
		description: "TypeScript types and interfaces",
		responsibilities: ["Type definitions"],
		exports: ["Config", "Options"],
		dependencies: [],
	};

	const mockRelationship1: Relationship = {
		from: "core",
		to: "utils",
		type: "imports",
	};

	const mockRelationship2: Relationship = {
		from: "core",
		to: "types",
		type: "uses",
	};

	const mockArchitecture: Architecture = {
		projectType: "library",
		entities: [mockEntity1, mockEntity2, mockEntity3],
		relationships: [mockRelationship1, mockRelationship2],
		keyFiles: [
			{ path: "src/index.ts", role: "entry" },
			{ path: "src/core/router.ts", role: "core" },
			{ path: "README.md", role: "doc" },
		],
		patterns: {
			framework: "React",
			buildTool: "Vite",
			testFramework: "Vitest",
			language: "TypeScript",
		},
	};

	// =========================================================================
	// formatArchitectureMd tests
	// =========================================================================
	describe("formatArchitectureMd", () => {
		it("produces valid Mermaid syntax", () => {
			const result = formatArchitectureMd(mockArchitecture);

			// Should have mermaid code block
			expect(result).toContain("```mermaid");
			expect(result).toContain("```");

			// Should have flowchart declaration
			expect(result).toContain("flowchart TB");
		});

		it("includes all entities in diagram", () => {
			const result = formatArchitectureMd(mockArchitecture);

			// Each entity should be a node
			expect(result).toContain('core["core"]');
			expect(result).toContain('utils["utils"]');
			expect(result).toContain('types["types"]');
		});

		it("includes relationships as arrows", () => {
			const result = formatArchitectureMd(mockArchitecture);

			// Relationships should be arrows with labels
			expect(result).toContain("core -->|imports| utils");
			expect(result).toContain("core -->|uses| types");
		});

		it("includes key files table", () => {
			const result = formatArchitectureMd(mockArchitecture);

			// Should have key files section
			expect(result).toContain("## Key Files");

			// Should have table header
			expect(result).toContain("| File | Role |");
			expect(result).toContain("|------|------|");

			// Should have file entries
			expect(result).toContain("`src/index.ts`");
			expect(result).toContain("entry");
			expect(result).toContain("`src/core/router.ts`");
			expect(result).toContain("core");
		});

		it("includes patterns section", () => {
			const result = formatArchitectureMd(mockArchitecture);

			// Should have patterns section
			expect(result).toContain("## Detected Patterns");

			// Should have each pattern
			expect(result).toContain("**Framework**: React");
			expect(result).toContain("**Build Tool**: Vite");
			expect(result).toContain("**Test Framework**: Vitest");
			expect(result).toContain("**Language**: TypeScript");
		});

		it("includes project type in title", () => {
			const result = formatArchitectureMd(mockArchitecture);

			expect(result).toContain("# Architecture: library");
		});

		it("includes entities table", () => {
			const result = formatArchitectureMd(mockArchitecture);

			// Should have entities section
			expect(result).toContain("## Entities");

			// Should have table header
			expect(result).toContain("| Name | Type | Path | Description |");
			expect(result).toContain("|------|------|------|-------------|");

			// Should have entity entries
			expect(result).toContain("core");
			expect(result).toContain("module");
			expect(result).toContain("`src/core`");
			expect(result).toContain("Core module with main functionality");
		});

		it("escapes pipe characters in descriptions", () => {
			const archWithPipes: Architecture = {
				...mockArchitecture,
				entities: [
					{
						...mockEntity1,
						description: "Description with | pipe character",
					},
				],
			};

			const result = formatArchitectureMd(archWithPipes);

			// Pipe should be escaped for markdown table
			expect(result).toContain("\\|");
		});

		it("handles empty entities array", () => {
			const emptyArch: Architecture = {
				...mockArchitecture,
				entities: [],
				relationships: [],
			};

			const result = formatArchitectureMd(emptyArch);

			// Should still have structure
			expect(result).toContain("```mermaid");
			expect(result).toContain("## Entities");
		});

		it("handles empty patterns", () => {
			const noPatterns: Architecture = {
				...mockArchitecture,
				patterns: {},
			};

			const result = formatArchitectureMd(noPatterns);

			// Should still have patterns section
			expect(result).toContain("## Detected Patterns");

			// But no pattern entries
			expect(result).not.toContain("**Framework**");
		});

		it("sanitizes entity names for Mermaid IDs", () => {
			const archWithSpecialNames: Architecture = {
				...mockArchitecture,
				entities: [
					{
						...mockEntity1,
						name: "@scope/package-name",
					},
				],
				relationships: [],
			};

			const result = formatArchitectureMd(archWithSpecialNames);

			// ID should be sanitized (no @ or /)
			expect(result).toContain('scope_package_name["@scope/package-name"]');
		});

		it("handles entities with quotes in names", () => {
			const archWithQuotes: Architecture = {
				...mockArchitecture,
				entities: [
					{
						...mockEntity1,
						name: 'test"module"',
					},
				],
				relationships: [],
			};

			const result = formatArchitectureMd(archWithQuotes);

			// Should escape quotes in label
			expect(result).toContain("test'module'");
		});

		it("includes all key files", () => {
			const result = formatArchitectureMd(mockArchitecture);

			for (const file of mockArchitecture.keyFiles) {
				expect(result).toContain(`\`${file.path}\``);
				expect(result).toContain(file.role);
			}
		});

		it("handles different project types", () => {
			const monorepoArch: Architecture = {
				...mockArchitecture,
				projectType: "monorepo",
			};

			const result = formatArchitectureMd(monorepoArch);
			expect(result).toContain("# Architecture: monorepo");
		});

		it("handles partial patterns", () => {
			const partialPatterns: Architecture = {
				...mockArchitecture,
				patterns: {
					framework: "Vue",
					// other fields undefined
				},
			};

			const result = formatArchitectureMd(partialPatterns);

			expect(result).toContain("**Framework**: Vue");
			expect(result).not.toContain("**Build Tool**");
		});
	});
});
