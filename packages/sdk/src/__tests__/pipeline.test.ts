/**
 * Unit tests for analysis/pipeline.ts pure functions
 * PRD T1.3: Tests for expandTilde() via installSkill()
 * PRD T4.1: Integration tests for runAnalysisPipeline
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Architecture, FileIndexEntry, Skill } from "@offworld/types";
import type { GatheredContext } from "../analysis/context.js";

// ============================================================================
// Mock setup - vi.mock calls are hoisted
// ============================================================================

// Virtual file system state
const writtenFiles: Map<string, string> = new Map();
const createdDirs: Set<string> = new Set();
const mockSkillDir = "~/.config/opencode/skill";
const mockMetaRoot = "/mock/.ow";

// Mock commit SHA
let mockCommitSha = "abc123def456";

// Mock file index
let mockFileIndex: FileIndexEntry[] = [
	{ path: "src/index.ts", importance: 0.9, type: "entry" },
	{ path: "src/utils.ts", importance: 0.5, type: "util" },
];

let mockContext: GatheredContext = {
	repoPath: "/mock/test-repo",
	repoName: "test-repo",
	readme: "# Test Repo",
	packageConfig: '{"name": "test"}',
	fileTree: "src/\n  index.ts",
	topFiles: [{ path: "src/index.ts", importance: 0.9, role: "entry", content: "export {}" }],
	estimatedTokens: 100,
};

// Mock architecture
let mockArchitecture: Architecture = {
	projectType: "library",
	entities: [
		{ name: "core", type: "module", path: "src", description: "Core module", responsibilities: [] },
	],
	relationships: [],
	keyFiles: [{ path: "src/index.ts", role: "entry" }],
	patterns: { language: "typescript" },
};

// Mock skill
let mockSkill: Skill = {
	name: "test-skill",
	description: "Test skill",
	allowedTools: ["Read", "Glob"],
	repositoryStructure: [{ path: "src", purpose: "Source code" }],
	keyFiles: [{ path: "src/index.ts", description: "Entry point" }],
	searchStrategies: ["grep for exports"],
	whenToUse: ["When working with test-repo"],
};

// Mock summary
let mockSummary = "# Test Summary\n\nThis is a test repository.";

// Control flags for error simulation
let shouldRankFail = false;
let shouldContextFail = false;
let shouldSummaryFail = false;
let shouldArchitectureFail = false;
let shouldSkillFail = false;

// Mock node:fs
vi.mock("node:fs", () => ({
	writeFileSync: vi.fn((path: string, content: string) => {
		writtenFiles.set(path, content);
	}),
	mkdirSync: vi.fn((path: string) => {
		createdDirs.add(path);
	}),
	existsSync: vi.fn(() => true),
}));

// Mock config.ts to return predictable paths
vi.mock("../config.js", () => ({
	loadConfig: () => ({
		skillDir: mockSkillDir,
	}),
	getMetaRoot: () => mockMetaRoot,
	getAnalysisPath: (fullName: string, provider: string) =>
		`${mockMetaRoot}/analyses/${provider}--${fullName.replace("/", "--")}`,
}));

// Mock clone.js for getCommitSha
vi.mock("../clone.js", () => ({
	getCommitSha: vi.fn(() => mockCommitSha),
}));

// Mock heuristics.js for rankFilesByHeuristics
vi.mock("../analysis/heuristics.js", () => ({
	rankFilesByHeuristics: vi.fn(async () => {
		if (shouldRankFail) {
			throw new Error("Ranking failed");
		}
		return mockFileIndex;
	}),
}));

// Mock context.js for gatherContext
vi.mock("../analysis/context.js", () => ({
	gatherContext: vi.fn(async () => {
		if (shouldContextFail) {
			throw new Error("Context gathering failed");
		}
		return mockContext;
	}),
}));

vi.mock("../analysis/generate.js", () => ({
	generateSummaryAndArchitecture: vi.fn(async () => {
		if (shouldSummaryFail) {
			throw new Error("Summary generation failed");
		}
		if (shouldArchitectureFail) {
			throw new Error("Architecture extraction failed");
		}
		return { summary: mockSummary, architecture: mockArchitecture };
	}),
	generateRichSkill: vi.fn(async () => {
		if (shouldSkillFail) {
			throw new Error("Skill generation failed");
		}
		return { skill: mockSkill, skillMd: "---\nname: test-skill\n---\n# Skill" };
	}),
	formatArchitectureMd: vi.fn(() => "# Architecture Markdown"),
	formatSkillMd: vi.fn(() => "---\nname: test-skill\n---\n# Formatted Skill"),
}));

// Import after mocking
import { installSkill, runAnalysisPipeline } from "../analysis/pipeline.js";
import { getCommitSha } from "../clone.js";
import { rankFilesByHeuristics } from "../analysis/heuristics.js";
import { gatherContext } from "../analysis/context.js";
import {
	generateSummaryAndArchitecture,
	generateRichSkill,
	formatArchitectureMd,
} from "../analysis/generate.js";

// ============================================================================
// Setup and teardown
// ============================================================================

function clearState(): void {
	writtenFiles.clear();
	createdDirs.clear();
	// Reset error flags
	shouldRankFail = false;
	shouldContextFail = false;
	shouldSummaryFail = false;
	shouldArchitectureFail = false;
	shouldSkillFail = false;
	// Reset mock values to defaults
	mockCommitSha = "abc123def456";
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

// ============================================================================
// PRD T4.1: runAnalysisPipeline integration tests
// ============================================================================

describe("runAnalysisPipeline", () => {
	describe("full pipeline execution", () => {
		it("executes all pipeline steps in order", async () => {
			await runAnalysisPipeline("/path/to/repo");

			// Verify all mocked functions were called
			expect(getCommitSha).toHaveBeenCalledWith("/path/to/repo");
			expect(rankFilesByHeuristics).toHaveBeenCalledWith("/path/to/repo");
			expect(gatherContext).toHaveBeenCalledWith("/path/to/repo", { rankedFiles: mockFileIndex });
			expect(generateSummaryAndArchitecture).toHaveBeenCalled();
			expect(generateRichSkill).toHaveBeenCalled();
			expect(formatArchitectureMd).toHaveBeenCalledWith(mockArchitecture);
		});

		it("returns complete analysis result", async () => {
			const result = await runAnalysisPipeline("/path/to/repo");

			expect(result.summary).toBe(mockSummary);
			expect(result.architecture).toEqual(mockArchitecture);
			expect(result.architectureMd).toBe("# Architecture Markdown");
			expect(result.fileIndex).toEqual(mockFileIndex);
			expect(result.skill).toEqual(mockSkill);
			expect(result.skillMd).toBe("---\nname: test-skill\n---\n# Skill");
			expect(result.meta.commitSha).toBe(mockCommitSha);
			expect(result.meta.analyzedAt).toBeDefined();
		});

		it("includes version in metadata", async () => {
			const result = await runAnalysisPipeline("/path/to/repo");

			expect(result.meta.version).toBeDefined();
			expect(typeof result.meta.version).toBe("string");
		});

		it("includes estimated tokens in metadata", async () => {
			const result = await runAnalysisPipeline("/path/to/repo");

			expect(result.meta.estimatedTokens).toBe(mockContext.estimatedTokens);
		});
	});

	describe("progress callback invocation", () => {
		it("calls onProgress for each step", async () => {
			const progressSteps: Array<{ step: string; message: string }> = [];
			const onProgress = (step: string, message: string) => {
				progressSteps.push({ step, message });
			};

			await runAnalysisPipeline("/path/to/repo", { onProgress });

			const stepNames = progressSteps.map((s) => s.step);
			expect(stepNames).toContain("commit");
			expect(stepNames).toContain("rank");
			expect(stepNames).toContain("context");
			expect(stepNames).toContain("analyze");
			expect(stepNames).toContain("format");
			expect(stepNames).toContain("skill");
			expect(stepNames).toContain("save");
			expect(stepNames).toContain("install");
			expect(stepNames).toContain("done");
		});

		it("reports progress in correct order", async () => {
			const stepOrder: string[] = [];
			const onProgress = (step: string) => {
				stepOrder.push(step);
			};

			await runAnalysisPipeline("/path/to/repo", { onProgress });

			const commitIndex = stepOrder.indexOf("commit");
			const rankIndex = stepOrder.indexOf("rank");
			const contextIndex = stepOrder.indexOf("context");
			const analyzeIndex = stepOrder.indexOf("analyze");
			const formatIndex = stepOrder.indexOf("format");
			const skillIndex = stepOrder.indexOf("skill");
			const saveIndex = stepOrder.indexOf("save");
			const installIndex = stepOrder.indexOf("install");
			const doneIndex = stepOrder.indexOf("done");

			expect(commitIndex).toBeLessThan(rankIndex);
			expect(rankIndex).toBeLessThan(contextIndex);
			expect(contextIndex).toBeLessThan(analyzeIndex);
			expect(analyzeIndex).toBeLessThan(formatIndex);
			expect(formatIndex).toBeLessThan(skillIndex);
			expect(skillIndex).toBeLessThan(saveIndex);
			expect(saveIndex).toBeLessThan(installIndex);
			expect(installIndex).toBeLessThan(doneIndex);
		});

		it("works without onProgress callback", async () => {
			// Should not throw when no callback provided
			const result = await runAnalysisPipeline("/path/to/repo");
			expect(result).toBeDefined();
		});
	});

	describe("local repo path handling", () => {
		it("uses hashed path for local repos", async () => {
			const result = await runAnalysisPipeline("/some/local/path");

			// Analysis path should be under local-- with a hash
			expect(result.analysisPath).toMatch(/\/mock\/\.ow\/analyses\/local--[a-f0-9]+/);
		});

		it("uses basename as repo name for local repos", async () => {
			const progressData: Array<{ step: string; message: string }> = [];
			await runAnalysisPipeline("/some/local/my-project", {
				onProgress: (step, message) => progressData.push({ step, message }),
			});

			// installSkill should be called with the basename
			const fs = await import("node:fs");
			const mkdirCalls = (fs.mkdirSync as ReturnType<typeof vi.fn>).mock.calls;

			// Should have created skill dirs with "my-project" name
			const skillDirPaths = mkdirCalls.map((call) => call[0] as string);
			const hasProjectDir = skillDirPaths.some((p) => p.includes("my-project"));
			expect(hasProjectDir).toBe(true);
		});

		it("generates consistent hash for same path", async () => {
			const result1 = await runAnalysisPipeline("/consistent/path");
			const result2 = await runAnalysisPipeline("/consistent/path");

			expect(result1.analysisPath).toBe(result2.analysisPath);
		});

		it("generates different hash for different paths", async () => {
			const result1 = await runAnalysisPipeline("/path/one");
			const result2 = await runAnalysisPipeline("/path/two");

			expect(result1.analysisPath).not.toBe(result2.analysisPath);
		});
	});

	describe("remote repo path handling", () => {
		it("uses provider and fullName for analysis path", async () => {
			const result = await runAnalysisPipeline("/path/to/cloned/repo", {
				provider: "github",
				fullName: "owner/repo",
			});

			expect(result.analysisPath).toBe("/mock/.ow/analyses/github--owner--repo");
		});

		it("uses fullName as repo name for skill installation", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "owner/repo",
			});

			const fs = await import("node:fs");
			const mkdirCalls = (fs.mkdirSync as ReturnType<typeof vi.fn>).mock.calls;
			const skillDirPaths = mkdirCalls.map((call) => call[0] as string);

			// Should have skill dir with owner/repo
			const hasOwnerRepoDir = skillDirPaths.some((p) => p.includes("owner/repo"));
			expect(hasOwnerRepoDir).toBe(true);
		});

		it("handles gitlab provider", async () => {
			const result = await runAnalysisPipeline("/path/to/repo", {
				provider: "gitlab",
				fullName: "user/project",
			});

			expect(result.analysisPath).toBe("/mock/.ow/analyses/gitlab--user--project");
		});

		it("handles bitbucket provider", async () => {
			const result = await runAnalysisPipeline("/path/to/repo", {
				provider: "bitbucket",
				fullName: "team/code",
			});

			expect(result.analysisPath).toBe("/mock/.ow/analyses/bitbucket--team--code");
		});
	});

	describe("error propagation", () => {
		it("propagates rankFileImportance errors", async () => {
			shouldRankFail = true;

			await expect(runAnalysisPipeline("/path/to/repo")).rejects.toThrow("Ranking failed");
		});

		it("propagates gatherContext errors", async () => {
			shouldContextFail = true;

			await expect(runAnalysisPipeline("/path/to/repo")).rejects.toThrow(
				"Context gathering failed",
			);
		});

		it("propagates generateSummary errors", async () => {
			shouldSummaryFail = true;

			await expect(runAnalysisPipeline("/path/to/repo")).rejects.toThrow(
				"Summary generation failed",
			);
		});

		it("propagates extractArchitecture errors", async () => {
			shouldArchitectureFail = true;

			await expect(runAnalysisPipeline("/path/to/repo")).rejects.toThrow(
				"Architecture extraction failed",
			);
		});

		it("propagates generateSkill errors", async () => {
			shouldSkillFail = true;

			await expect(runAnalysisPipeline("/path/to/repo")).rejects.toThrow("Skill generation failed");
		});
	});

	describe("file saving verification", () => {
		it("creates analysis directory", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			expect(createdDirs.has("/mock/.ow/analyses/github--test--project")).toBe(true);
		});

		it("saves summary.md", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			const summaryPath = "/mock/.ow/analyses/github--test--project/summary.md";
			expect(writtenFiles.has(summaryPath)).toBe(true);
			expect(writtenFiles.get(summaryPath)).toBe(mockSummary);
		});

		it("saves architecture.json", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			const archPath = "/mock/.ow/analyses/github--test--project/architecture.json";
			expect(writtenFiles.has(archPath)).toBe(true);
			const savedArch = JSON.parse(writtenFiles.get(archPath)!);
			expect(savedArch).toEqual(mockArchitecture);
		});

		it("saves architecture.md", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			const archMdPath = "/mock/.ow/analyses/github--test--project/architecture.md";
			expect(writtenFiles.has(archMdPath)).toBe(true);
			expect(writtenFiles.get(archMdPath)).toBe("# Architecture Markdown");
		});

		it("saves file-index.json", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			const indexPath = "/mock/.ow/analyses/github--test--project/file-index.json";
			expect(writtenFiles.has(indexPath)).toBe(true);
			const savedIndex = JSON.parse(writtenFiles.get(indexPath)!);
			expect(savedIndex).toEqual(mockFileIndex);
		});

		it("saves skill.json", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			const skillPath = "/mock/.ow/analyses/github--test--project/skill.json";
			expect(writtenFiles.has(skillPath)).toBe(true);
			const savedSkill = JSON.parse(writtenFiles.get(skillPath)!);
			expect(savedSkill).toEqual(mockSkill);
		});

		it("saves SKILL.md", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});

			const skillMdPath = "/mock/.ow/analyses/github--test--project/SKILL.md";
			expect(writtenFiles.has(skillMdPath)).toBe(true);
			expect(writtenFiles.get(skillMdPath)).toBe("---\nname: test-skill\n---\n# Skill");
		});

		it("saves meta.json with correct structure", async () => {
			const before = new Date().toISOString();
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "test/project",
			});
			const after = new Date().toISOString();

			const metaPath = "/mock/.ow/analyses/github--test--project/meta.json";
			expect(writtenFiles.has(metaPath)).toBe(true);

			const savedMeta = JSON.parse(writtenFiles.get(metaPath)!);
			expect(savedMeta.commitSha).toBe(mockCommitSha);
			expect(savedMeta.version).toBeDefined();
			expect(savedMeta.analyzedAt).toBeDefined();
			// Verify timestamp is reasonable
			expect(savedMeta.analyzedAt >= before).toBe(true);
			expect(savedMeta.analyzedAt <= after).toBe(true);
		});

		it("installs skill to both directories", async () => {
			await runAnalysisPipeline("/path/to/repo", {
				provider: "github",
				fullName: "owner/repo",
			});

			// Check OpenCode skill dir
			const openCodeSkillDir = join(homedir(), ".config/opencode/skill", "owner/repo");
			expect(createdDirs.has(openCodeSkillDir)).toBe(true);
			expect(writtenFiles.has(join(openCodeSkillDir, "SKILL.md"))).toBe(true);

			// Check Claude Code skill dir
			const claudeSkillDir = join(homedir(), ".claude", "skills", "owner/repo");
			expect(createdDirs.has(claudeSkillDir)).toBe(true);
			expect(writtenFiles.has(join(claudeSkillDir, "SKILL.md"))).toBe(true);
		});
	});

	describe("config handling", () => {
		it("uses provided config if given", async () => {
			const customConfig = { skillDir: "/custom/skill", repoRoot: "/custom/repos" };
			await runAnalysisPipeline("/path/to/repo", { config: customConfig as never });

			expect(generateSummaryAndArchitecture).toHaveBeenCalled();
		});

		it("uses default config if not provided", async () => {
			await runAnalysisPipeline("/path/to/repo");

			expect(generateSummaryAndArchitecture).toHaveBeenCalled();
		});
	});
});
