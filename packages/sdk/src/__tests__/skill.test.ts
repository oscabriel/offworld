/**
 * Unit tests for skill formatting
 * PRD T5.2
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

// Mock config.js
vi.mock("../config.js", () => ({
	loadConfig: vi.fn(),
}));

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { loadConfig } from "../config.js";
import { formatSkillMd } from "../analysis/generate.js";
import { installSkill } from "../analysis/pipeline.js";
import type { Skill, Config } from "@offworld/types";

describe("skill formatting", () => {
	const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
	const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;
	const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
	const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

	const mockSkill: Skill = {
		name: "tanstack-router",
		description: "Expert knowledge of TanStack Router library",
		allowedTools: ["Read", "Glob", "Grep", "Bash"],
		repositoryStructure: [
			{ path: "packages/", purpose: "Core packages and libraries" },
			{ path: "docs/", purpose: "Documentation site" },
			{ path: "examples/", purpose: "Example applications" },
		],
		keyFiles: [
			{ path: "packages/router/src/index.ts", description: "Main entry point" },
			{ path: "packages/router/src/router.ts", description: "Router core implementation" },
			{ path: "packages/router/src/route.ts", description: "Route definitions" },
			{ path: "packages/router/src/link.ts", description: "Link component" },
			{ path: "README.md", description: "Project overview" },
		],
		searchStrategies: [
			"Use Glob with pattern '**/*.ts' to find TypeScript files",
			"Use Grep with 'createRouter' to find router instantiations",
			"Use Grep with 'Route' to find route definitions",
		],
		whenToUse: [
			"When user asks about TanStack Router",
			"When navigating to routes or links",
			"When setting up routing in a React app",
		],
	};

	const defaultConfig: Config = {
		repoRoot: "~/ow",
		metaRoot: "~/.ow",
		skillDir: "~/.config/opencode/skill",
		defaultShallow: true,
		autoAnalyze: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadConfig.mockReturnValue(defaultConfig);
		mockExistsSync.mockReturnValue(false);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// formatSkillMd tests
	// =========================================================================
	describe("formatSkillMd", () => {
		it("produces valid YAML frontmatter", () => {
			const result = formatSkillMd(mockSkill);

			// Should start and end with ---
			expect(result).toMatch(/^---\n/);
			expect(result).toContain("\n---\n");

			// Should have name and description
			expect(result).toContain('name: "tanstack-router"');
			expect(result).toContain('description: "Expert knowledge of TanStack Router library"');
		});

		it("includes all required sections", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("## Repository Structure");
			expect(result).toContain("## Quick Reference Paths");
			expect(result).toContain("## Search Strategies");
			expect(result).toContain("## When to Use");
		});

		it("includes commit and generated in frontmatter when provided", () => {
			const result = formatSkillMd(mockSkill, {
				commitSha: "abc1234def5678",
				generated: "2026-01-10",
			});

			expect(result).toContain("commit: abc1234");
			expect(result).toContain("generated: 2026-01-10");
			expect(result).not.toContain("allowed-tools:");
		});

		it("omits commit and generated when not provided", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).not.toContain("commit:");
			expect(result).not.toContain("generated:");
			expect(result).not.toContain("allowed-tools:");
		});

		it("escapes special characters in YAML", () => {
			const skillWithQuotes: Skill = {
				...mockSkill,
				name: 'test-"skill"',
				description: 'A skill with "quotes" and\nnewlines',
			};

			const result = formatSkillMd(skillWithQuotes);

			// Should escape quotes
			expect(result).toContain('name: "test-\\"skill\\""');
			// Should escape newlines
			expect(result).toContain("\\n");
		});

		it("includes repository structure entries", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("`packages/`");
			expect(result).toContain("Core packages and libraries");
			expect(result).toContain("`docs/`");
			expect(result).toContain("Documentation site");
		});

		it("includes key files entries", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("`packages/router/src/index.ts`");
			expect(result).toContain("Main entry point");
			expect(result).toContain("`packages/router/src/router.ts`");
			expect(result).toContain("Router core implementation");
		});

		it("includes search strategies", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("'**/*.ts'");
			expect(result).toContain("'createRouter'");
		});

		it("includes when to use conditions", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("When user asks about TanStack Router");
			expect(result).toContain("When navigating to routes or links");
		});

		it("handles empty arrays", () => {
			const emptySkill: Skill = {
				...mockSkill,
				repositoryStructure: [],
				keyFiles: [],
				searchStrategies: [],
				whenToUse: [],
			};

			const result = formatSkillMd(emptySkill);

			// Should still have sections, just empty
			expect(result).toContain("## Repository Structure");
			expect(result).toContain("## When to Use");
		});
	});

	// =========================================================================
	// installSkill tests
	// =========================================================================
	describe("installSkill", () => {
		it("creates OpenCode skill directory", () => {
			installSkill("tanstack/router", "# SKILL.md content");

			// Should create OpenCode directory
			expect(mockMkdirSync).toHaveBeenCalledWith(
				expect.stringContaining("opencode"),
				expect.objectContaining({ recursive: true }),
			);
		});

		it("creates Claude Code skill directory", () => {
			installSkill("tanstack/router", "# SKILL.md content");

			// Should create Claude Code directory
			expect(mockMkdirSync).toHaveBeenCalledWith(
				expect.stringContaining(".claude/skills"),
				expect.objectContaining({ recursive: true }),
			);
		});

		it("writes correct content to both locations", () => {
			const skillContent = "# SKILL.md\n\nTest content";
			installSkill("tanstack/router", skillContent);

			// Should write SKILL.md to both directories
			expect(mockWriteFileSync).toHaveBeenCalledTimes(2);

			// Check both calls write SKILL.md with correct content
			const calls = mockWriteFileSync.mock.calls;
			expect(calls[0]![0]).toContain("SKILL.md");
			expect(calls[0]![1]).toBe(skillContent);
			expect(calls[1]![0]).toContain("SKILL.md");
			expect(calls[1]![1]).toBe(skillContent);
		});

		it("uses repo name for directory structure", () => {
			installSkill("owner/repo-name", "content");

			// Should use repo name in path
			const calls = mockMkdirSync.mock.calls;
			expect(calls[0]![0]).toContain("owner/repo-name");
			expect(calls[1]![0]).toContain("owner/repo-name");
		});

		it("expands tilde in OpenCode skill path", () => {
			installSkill("test/repo", "content");

			// First call should be OpenCode path (expanded from config.skillDir)
			const openCodePath = mockMkdirSync.mock.calls[0]![0] as string;

			// Should not contain literal ~
			expect(openCodePath).not.toContain("~");
			// Should be an absolute path (on any OS)
			expect(openCodePath.length).toBeGreaterThan(10);
		});

		it("handles nested repo names", () => {
			installSkill("org/sub/repo", "content");

			const calls = mockWriteFileSync.mock.calls;
			expect(calls[0]![0]).toContain("org/sub/repo");
		});
	});
});
