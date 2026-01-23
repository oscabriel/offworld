import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ai/opencode.js", () => ({
	streamPrompt: vi.fn(),
}));

vi.mock("../clone.js", () => ({
	getCommitSha: vi.fn(),
}));

vi.mock("../config.js", () => ({
	loadConfig: vi.fn(),
	toSkillDirName: vi.fn((repoName: string) => {
		if (repoName.includes("/")) {
			const [owner, repo] = repoName.split("/");
			return `${owner}-${repo}-reference`;
		}
		return `${repoName}-reference`;
	}),
	toMetaDirName: vi.fn((repoName: string) => {
		if (repoName.includes("/")) {
			const [owner, repo] = repoName.split("/");
			return `${owner}-${repo}`;
		}
		return repoName;
	}),
}));

vi.mock("../agents.js", () => ({
	agents: {},
}));

vi.mock("../paths.js", () => ({
	Paths: {
		data: "/mock/data",
	},
	expandTilde: vi.fn((path: string) => path),
}));

vi.mock("node:fs", () => ({
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
	lstatSync: vi.fn(),
	unlinkSync: vi.fn(),
	rmSync: vi.fn(),
	symlinkSync: vi.fn(),
	existsSync: vi.fn(),
}));

import { streamPrompt } from "../ai/opencode.js";
import { getCommitSha } from "../clone.js";
import { loadConfig } from "../config.js";
import { generateSkillWithAI, installSkill } from "../generate.js";

const mockStreamPrompt = streamPrompt as ReturnType<typeof vi.fn>;
const mockGetCommitSha = getCommitSha as ReturnType<typeof vi.fn>;
const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

describe("generateSkillWithAI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadConfig.mockReturnValue({
			defaultModel: "anthropic/claude-sonnet-4",
			agents: [],
		});
		mockGetCommitSha.mockReturnValue("abc1234567890");
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("extracts skill content from valid AI response", async () => {
		const longContent = "This is skill content. ".repeat(30);
		mockStreamPrompt.mockResolvedValue({
			text: `<skill_output>
---
name: Test Library
description: A test library
---

# Test Library
${longContent}
</skill_output>`,
			durationMs: 1000,
		});

		const result = await generateSkillWithAI("/mock/repo", "test/repo");

		expect(result.commitSha).toBe("abc1234567890");
		expect(result.skillContent).toContain("name: Test Library");
		expect(result.skillContent).toContain("# Test Library");
	});

	it("throws when AI response missing skill_output tags", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: "Some random response without tags",
			durationMs: 1000,
		});

		await expect(generateSkillWithAI("/mock/repo", "test/repo")).rejects.toThrow(
			"no <skill_output> tags found",
		);
	});

	it("throws when skill content too short", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: `<skill_output>
---
name: Test
---
Short
</skill_output>`,
			durationMs: 1000,
		});

		await expect(generateSkillWithAI("/mock/repo", "test/repo")).rejects.toThrow("too short");
	});

	it("throws when skill content missing YAML frontmatter", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: `<skill_output>
# No Frontmatter
${"This is some content ".repeat(50)}
</skill_output>`,
			durationMs: 1000,
		});

		await expect(generateSkillWithAI("/mock/repo", "test/repo")).rejects.toThrow(
			"missing YAML frontmatter",
		);
	});

	it("uses custom provider and model when provided", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: `<skill_output>
---
name: Test
description: Test
---
${"Content ".repeat(100)}
</skill_output>`,
			durationMs: 1000,
		});

		await generateSkillWithAI("/mock/repo", "test/repo", {
			provider: "openai",
			model: "gpt-4",
		});

		expect(mockStreamPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "openai",
				model: "gpt-4",
			}),
		);
	});
});

describe("installSkill", () => {
	beforeEach(() => {
		mockLoadConfig.mockReturnValue({
			agents: [],
		});
	});

	it("should accept valid arguments", () => {
		expect(() => {
			installSkill("test/repo", "---\nname: Test\n---\n# Test\nContent", {
				analyzedAt: new Date().toISOString(),
				commitSha: "abc123",
				version: "0.1.0",
			});
		}).not.toThrow();
	});
});
