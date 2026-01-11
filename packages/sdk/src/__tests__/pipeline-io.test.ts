/**
 * Tests for pipeline file I/O with real temp directories
 * PRD T4.2: Test installSkill() and saveAnalysis() with temp directories
 *
 * These tests use actual file system operations (not mocked) to verify:
 * - Real file creation and content
 * - Directory creation behavior
 * - File permissions and cleanup
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Architecture, FileIndexEntry, Skill } from "@offworld/types";
import type { GatheredContext } from "../analysis/context.js";

// ============================================================================
// Temp directory management
// ============================================================================

let tempDir: string;
let mockSkillDir: string;
let mockMetaRoot: string;

// Test data
const mockFileIndex: FileIndexEntry[] = [
	{ path: "src/index.ts", importance: 0.9, type: "entry" },
	{ path: "src/utils.ts", importance: 0.5, type: "util" },
];

const mockContext: GatheredContext = {
	repoPath: "/mock/test-repo",
	repoName: "test-repo",
	readme: "# Test Repo",
	packageConfig: '{"name": "test"}',
	fileTree: "src/\n  index.ts",
	topFiles: [{ path: "src/index.ts", importance: 0.9, role: "entry", content: "export {}" }],
	estimatedTokens: 100,
};

const mockArchitecture: Architecture = {
	projectType: "library",
	entities: [
		{ name: "core", type: "module", path: "src", description: "Core module", responsibilities: [] },
	],
	relationships: [],
	keyFiles: [{ path: "src/index.ts", role: "entry" }],
	patterns: { language: "typescript" },
};

const mockSkill: Skill = {
	name: "test-skill",
	description: "Test skill description",
	allowedTools: ["Read", "Glob"],
	repositoryStructure: [{ path: "src", purpose: "Source code" }],
	keyFiles: [{ path: "src/index.ts", description: "Entry point" }],
	searchStrategies: ["grep for exports"],
	whenToUse: ["When working with test-repo"],
};

const mockSummary = "# Test Summary\n\nThis is a test repository.";
const mockArchitectureMd = "# Architecture\n\nTest architecture markdown.";
const mockSkillMd = "---\nname: test-skill\n---\n\n# Test Skill\n\nSkill content here.";
const mockCommitSha = "abc123def456789";

// ============================================================================
// Mock setup - mock dependencies but NOT node:fs
// ============================================================================

// Mock config to use our temp directories
vi.mock("../config.js", () => ({
	loadConfig: () => ({
		skillDir: mockSkillDir,
		repoRoot: tempDir,
	}),
	getMetaRoot: () => mockMetaRoot,
	getAnalysisPath: (fullName: string, provider: string) =>
		join(mockMetaRoot, "analyses", `${provider}--${fullName.replace("/", "--")}`),
}));

// Mock clone.js
vi.mock("../clone.js", () => ({
	getCommitSha: vi.fn(() => mockCommitSha),
}));

vi.mock("../analysis/heuristics.js", () => ({
	rankFilesByHeuristics: vi.fn(async () => mockFileIndex),
}));

// Mock context.js
vi.mock("../analysis/context.js", () => ({
	gatherContext: vi.fn(async () => mockContext),
}));

vi.mock("../analysis/generate.js", () => ({
	generateSummaryAndArchitecture: vi.fn(async () => ({
		summary: mockSummary,
		architecture: mockArchitecture,
	})),
	generateRichSkill: vi.fn(async () => ({ skill: mockSkill, skillMd: mockSkillMd })),
	formatArchitectureMd: vi.fn(() => mockArchitectureMd),
	formatSkillMd: vi.fn(() => mockSkillMd),
}));

vi.mock("../validation/paths.js", () => ({
	validateSkillPaths: vi.fn((skill) => ({ validatedSkill: skill, removedPaths: [] })),
}));

// Import after mocking
import { installSkill, runAnalysisPipeline } from "../analysis/pipeline.js";

// ============================================================================
// Setup and teardown
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();

	// Create fresh temp directories for each test
	tempDir = mkdtempSync(join(tmpdir(), "pipeline-io-test-"));
	mockSkillDir = join(tempDir, "skill");
	mockMetaRoot = join(tempDir, ".ow");
});

afterEach(() => {
	// Cleanup temp directory
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
});

// ============================================================================
// installSkill tests with real file I/O
// ============================================================================

describe("installSkill with temp directories", () => {
	it("creates skill directories when they do not exist", () => {
		const repoName = "test-repo";
		const skillContent = "# Test Skill\n\nSkill content here.";

		installSkill(repoName, skillContent);

		// Verify OpenCode skill directory was created
		const openCodeSkillDir = join(mockSkillDir, repoName);
		expect(existsSync(openCodeSkillDir)).toBe(true);

		// Verify Claude skill directory was created (uses real homedir, so we check via written file tracking)
		// Note: installSkill uses join(homedir(), ".claude", "skills", repoName) for Claude
		// Since we can't easily redirect homedir(), we verify the OpenCode side fully
	});

	it("writes SKILL.md with correct content", () => {
		const repoName = "content-test-repo";
		const skillContent = "---\nname: test\n---\n\n# Skill Content\n\nDetailed description.";

		installSkill(repoName, skillContent);

		// Read back and verify content
		const skillFilePath = join(mockSkillDir, repoName, "SKILL.md");
		const writtenContent = readFileSync(skillFilePath, "utf-8");
		expect(writtenContent).toBe(skillContent);
	});

	it("handles nested repo names (owner/repo)", () => {
		const repoName = "owner/nested-repo";
		const skillContent = "# Nested Repo Skill";

		installSkill(repoName, skillContent);

		// Verify nested directory structure was created
		const skillDir = join(mockSkillDir, "owner", "nested-repo");
		expect(existsSync(skillDir)).toBe(true);
		expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
	});

	it("overwrites existing SKILL.md", () => {
		const repoName = "overwrite-test";
		const originalContent = "# Original Content";
		const updatedContent = "# Updated Content";

		// Write original
		installSkill(repoName, originalContent);

		// Verify original
		const skillFilePath = join(mockSkillDir, repoName, "SKILL.md");
		expect(readFileSync(skillFilePath, "utf-8")).toBe(originalContent);

		// Write updated
		installSkill(repoName, updatedContent);

		// Verify updated
		expect(readFileSync(skillFilePath, "utf-8")).toBe(updatedContent);
	});

	it("handles empty skill content", () => {
		const repoName = "empty-skill";
		const skillContent = "";

		installSkill(repoName, skillContent);

		const skillFilePath = join(mockSkillDir, repoName, "SKILL.md");
		expect(existsSync(skillFilePath)).toBe(true);
		expect(readFileSync(skillFilePath, "utf-8")).toBe("");
	});

	it("handles skill content with special characters", () => {
		const repoName = "special-chars";
		const skillContent =
			'# Skill with émojis 🚀 and spëcial çharacters\n\nLine with\ttabs and "quotes"';

		installSkill(repoName, skillContent);

		const skillFilePath = join(mockSkillDir, repoName, "SKILL.md");
		expect(readFileSync(skillFilePath, "utf-8")).toBe(skillContent);
	});

	it("handles large skill content", () => {
		const repoName = "large-skill";
		// Generate ~100KB of content
		const skillContent = "# Large Skill\n\n" + "Lorem ipsum dolor sit amet. ".repeat(4000);

		installSkill(repoName, skillContent);

		const skillFilePath = join(mockSkillDir, repoName, "SKILL.md");
		expect(readFileSync(skillFilePath, "utf-8")).toBe(skillContent);
	});
});

// ============================================================================
// saveAnalysis tests via runAnalysisPipeline with real file I/O
// ============================================================================

describe("saveAnalysis with temp directories (via runAnalysisPipeline)", () => {
	it("creates analysis directory", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		expect(existsSync(result.analysisPath)).toBe(true);
	});

	it("saves summary.md with correct content", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const summaryPath = join(result.analysisPath, "summary.md");
		expect(existsSync(summaryPath)).toBe(true);
		expect(readFileSync(summaryPath, "utf-8")).toBe(mockSummary);
	});

	it("saves architecture.json with valid JSON", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const archPath = join(result.analysisPath, "architecture.json");
		expect(existsSync(archPath)).toBe(true);

		const content = readFileSync(archPath, "utf-8");
		const parsed = JSON.parse(content);
		expect(parsed).toEqual(mockArchitecture);
	});

	it("saves architecture.md with correct content", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const archMdPath = join(result.analysisPath, "architecture.md");
		expect(existsSync(archMdPath)).toBe(true);
		expect(readFileSync(archMdPath, "utf-8")).toBe(mockArchitectureMd);
	});

	it("saves file-index.json with valid JSON", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const indexPath = join(result.analysisPath, "file-index.json");
		expect(existsSync(indexPath)).toBe(true);

		const content = readFileSync(indexPath, "utf-8");
		const parsed = JSON.parse(content);
		expect(parsed).toEqual(mockFileIndex);
	});

	it("saves skill.json with valid JSON", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const skillPath = join(result.analysisPath, "skill.json");
		expect(existsSync(skillPath)).toBe(true);

		const content = readFileSync(skillPath, "utf-8");
		const parsed = JSON.parse(content);
		expect(parsed).toEqual(mockSkill);
	});

	it("saves SKILL.md with correct content", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const skillMdPath = join(result.analysisPath, "SKILL.md");
		expect(existsSync(skillMdPath)).toBe(true);
		expect(readFileSync(skillMdPath, "utf-8")).toBe(mockSkillMd);
	});

	it("saves meta.json with valid structure", async () => {
		const before = new Date().toISOString();
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});
		const after = new Date().toISOString();

		const metaPath = join(result.analysisPath, "meta.json");
		expect(existsSync(metaPath)).toBe(true);

		const content = readFileSync(metaPath, "utf-8");
		const meta = JSON.parse(content);

		expect(meta.commitSha).toBe(mockCommitSha);
		expect(meta.version).toBeDefined();
		expect(meta.analyzedAt).toBeDefined();
		expect(meta.analyzedAt >= before).toBe(true);
		expect(meta.analyzedAt <= after).toBe(true);
		expect(meta.estimatedTokens).toBe(100);
	});

	it("creates all expected files in analysis directory", async () => {
		const result = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const files = readdirSync(result.analysisPath);
		expect(files).toContain("summary.md");
		expect(files).toContain("architecture.json");
		expect(files).toContain("architecture.md");
		expect(files).toContain("file-index.json");
		expect(files).toContain("skill.json");
		expect(files).toContain("SKILL.md");
		expect(files).toContain("meta.json");
		expect(files.length).toBe(7);
	});

	it("handles local repo path (creates local--hash directory)", async () => {
		const result = await runAnalysisPipeline("/some/local/repo");

		// Should create a local--{hash} directory
		expect(result.analysisPath).toMatch(/local--[a-f0-9]+$/);
		expect(existsSync(result.analysisPath)).toBe(true);

		// Should still save all files
		const files = readdirSync(result.analysisPath);
		expect(files.length).toBe(7);
	});

	it("overwrites existing analysis on re-run", async () => {
		// First run
		const result1 = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		const metaPath = join(result1.analysisPath, "meta.json");
		const meta1 = JSON.parse(readFileSync(metaPath, "utf-8"));
		const firstTimestamp = meta1.analyzedAt;

		// Wait a tiny bit to ensure different timestamp
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Second run
		const result2 = await runAnalysisPipeline("/fake/repo/path", {
			provider: "github",
			fullName: "test/project",
		});

		expect(result2.analysisPath).toBe(result1.analysisPath);

		const meta2 = JSON.parse(readFileSync(metaPath, "utf-8"));
		expect(meta2.analyzedAt).not.toBe(firstTimestamp);
	});
});

// ============================================================================
// Cleanup verification tests
// ============================================================================

describe("temp directory cleanup", () => {
	it("creates directories that can be cleaned up", () => {
		const repoName = "cleanup-test";
		installSkill(repoName, "# Test");

		const skillDir = join(mockSkillDir, repoName);
		expect(existsSync(skillDir)).toBe(true);

		// Verify cleanup works (simulating afterEach behavior)
		rmSync(tempDir, { recursive: true, force: true });
		expect(existsSync(tempDir)).toBe(false);
	});
});
