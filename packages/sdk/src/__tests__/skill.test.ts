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
		quickPaths: [
			{ path: "/repo/packages/router/src/index.ts", description: "Main entry point" },
			{ path: "/repo/packages/router/src/router.ts", description: "Router core implementation" },
			{ path: "/repo/packages/router/src/route.ts", description: "Route definitions" },
			{ path: "/repo/packages/router/src/link.ts", description: "Link component" },
			{ path: "/repo/README.md", description: "Project overview" },
		],
		searchPatterns: [
			{ find: "Components", pattern: "export.*function", path: "/repo/packages/" },
			{ find: "Routes", pattern: "createRoute", path: "/repo/packages/router/" },
			{ find: "Types", pattern: "export type", path: "/repo/packages/" },
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
			expect(result).toContain("name: tanstack-router");
			expect(result).toContain("description: Expert knowledge of TanStack Router library");
		});

		it("includes all required sections", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("## Quick Paths");
			expect(result).toContain("## Search Patterns");
			expect(result).toContain("## Deep Context");
		});

		it("includes commit and generated in frontmatter when provided", () => {
			const result = formatSkillMd(mockSkill, {
				commitSha: "abc1234def5678",
				generated: "2026-01-10",
			});

			expect(result).toContain("commit: abc1234");
			expect(result).toContain("generated: 2026-01-10");
		});

		it("omits commit and generated when not provided", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).not.toContain("commit:");
			expect(result).not.toContain("generated:");
		});

		it("includes quick paths entries", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("`/repo/packages/router/src/index.ts`");
			expect(result).toContain("Main entry point");
			expect(result).toContain("`/repo/packages/router/src/router.ts`");
			expect(result).toContain("Router core implementation");
		});

		it("includes search patterns table", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("| Find | Pattern | Path |");
			expect(result).toContain("|------|---------|------|");
			expect(result).toContain("| Components |");
			expect(result).toContain("| Routes |");
		});

		it("includes deep context section", () => {
			const result = formatSkillMd(mockSkill);

			expect(result).toContain("## Deep Context");
			expect(result).toContain("Architecture: Read analysis/architecture.md");
			expect(result).toContain("Summary: Read analysis/summary.md");
		});

		it("handles empty arrays", () => {
			const emptySkill: Skill = {
				...mockSkill,
				quickPaths: [],
				searchPatterns: [],
			};

			const result = formatSkillMd(emptySkill);

			// Should still have sections, just empty
			expect(result).toContain("## Quick Paths");
			expect(result).toContain("## Search Patterns");
			expect(result).toContain("## Deep Context");
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
