/**
 * Unit tests for analysis/pipeline.ts pure functions
 * PRD T1.3: Tests for expandTilde() via installSkill()
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Mock setup - vi.mock calls are hoisted
// ============================================================================

// Virtual file system state
const writtenFiles: Map<string, string> = new Map();
const createdDirs: Set<string> = new Set();
const mockSkillDir = "~/.config/opencode/skill";

// Mock node:fs
vi.mock("node:fs", () => ({
	writeFileSync: vi.fn((path: string, content: string) => {
		writtenFiles.set(path, content);
	}),
	mkdirSync: vi.fn((path: string) => {
		createdDirs.add(path);
	}),
}));

// Mock config.ts to return predictable paths
vi.mock("../config.js", () => ({
	loadConfig: () => ({
		skillDir: mockSkillDir,
	}),
}));

// Import after mocking
import { installSkill } from "../analysis/pipeline.js";

// ============================================================================
// Setup and teardown
// ============================================================================

function clearState(): void {
	writtenFiles.clear();
	createdDirs.clear();
}

beforeEach(() => {
	vi.clearAllMocks();
	clearState();
});

afterEach(() => {
	vi.clearAllMocks();
	clearState();
});

// ============================================================================
// expandTilde tests (via installSkill)
// ============================================================================

describe("expandTilde (via installSkill)", () => {
	it("expands ~/ to home directory for OpenCode skill path", () => {
		const repoName = "test-repo";
		const skillContent = "# Test Skill";

		installSkill(repoName, skillContent);

		// OpenCode skill dir should have ~ expanded
		const expectedOpenCodeDir = join(homedir(), ".config/opencode/skill", repoName);
		expect(createdDirs.has(expectedOpenCodeDir)).toBe(true);
		expect(writtenFiles.has(join(expectedOpenCodeDir, "SKILL.md"))).toBe(true);
	});

	it("writes skill to both OpenCode and Claude Code directories", () => {
		const repoName = "test-repo";
		const skillContent = "# Test Skill Content";

		installSkill(repoName, skillContent);

		// Claude Code skill dir (absolute path, no tilde)
		const expectedClaudeDir = join(homedir(), ".claude", "skills", repoName);
		expect(createdDirs.has(expectedClaudeDir)).toBe(true);
		expect(writtenFiles.has(join(expectedClaudeDir, "SKILL.md"))).toBe(true);
		expect(writtenFiles.get(join(expectedClaudeDir, "SKILL.md"))).toBe(skillContent);

		// OpenCode skill dir (expanded from ~/)
		const expectedOpenCodeDir = join(homedir(), ".config/opencode/skill", repoName);
		expect(writtenFiles.get(join(expectedOpenCodeDir, "SKILL.md"))).toBe(skillContent);
	});

	it("handles repo names with path separators", () => {
		const repoName = "owner/repo-name";
		const skillContent = "# Nested Repo Skill";

		installSkill(repoName, skillContent);

		// Verify paths are created correctly with nested repo name
		const expectedOpenCodeDir = join(homedir(), ".config/opencode/skill", "owner/repo-name");
		const expectedClaudeDir = join(homedir(), ".claude", "skills", "owner/repo-name");

		expect(createdDirs.has(expectedOpenCodeDir)).toBe(true);
		expect(createdDirs.has(expectedClaudeDir)).toBe(true);
	});

	it("handles empty skill content", () => {
		const repoName = "empty-skill-repo";
		const skillContent = "";

		installSkill(repoName, skillContent);

		const expectedOpenCodeDir = join(homedir(), ".config/opencode/skill", repoName);
		expect(writtenFiles.get(join(expectedOpenCodeDir, "SKILL.md"))).toBe("");
	});
});

// ============================================================================
// installSkill tests
// ============================================================================

describe("installSkill", () => {
	it("creates directories with recursive option", async () => {
		const fs = await import("node:fs");
		const repoName = "test-repo";
		const skillContent = "# Skill";

		installSkill(repoName, skillContent);

		expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
		expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
	});

	it("writes SKILL.md to both skill directories", async () => {
		const fs = await import("node:fs");
		const repoName = "test-repo";
		const skillContent = "# Test Skill\n\nDescription here";

		installSkill(repoName, skillContent);

		expect(fs.writeFileSync).toHaveBeenCalledTimes(2);

		const calls = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
		const firstPath = calls[0]?.[0] as string | undefined;
		const secondPath = calls[1]?.[0] as string | undefined;
		expect(firstPath).toContain("SKILL.md");
		expect(secondPath).toContain("SKILL.md");

		const firstEncoding = calls[0]?.[2] as string | undefined;
		const secondEncoding = calls[1]?.[2] as string | undefined;
		expect(firstEncoding).toBe("utf-8");
		expect(secondEncoding).toBe("utf-8");
	});

	it("passes skill content unchanged to writeFileSync", async () => {
		const fs = await import("node:fs");
		const repoName = "content-test";
		const skillContent = "---\nname: test\n---\n\n# Content";

		installSkill(repoName, skillContent);

		const calls = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
		const firstContent = calls[0]?.[1] as string | undefined;
		const secondContent = calls[1]?.[1] as string | undefined;
		expect(firstContent).toBe(skillContent);
		expect(secondContent).toBe(skillContent);
	});
});
