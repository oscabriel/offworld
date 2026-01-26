import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ai/opencode.js", () => ({
	streamPrompt: vi.fn(),
}));

vi.mock("../clone.js", () => ({
	getCommitSha: vi.fn(),
}));

vi.mock("../config.js", () => ({
	loadConfig: vi.fn(),
	toReferenceName: vi.fn((repoName: string) => {
		if (repoName.includes("/")) {
			const [owner, repo] = repoName.split("/");
			return `${owner}-${repo}`;
		}
		return repoName;
	}),
	toReferenceFileName: vi.fn((repoName: string) => {
		if (repoName.includes("/")) {
			const [owner, repo] = repoName.split("/");
			return `${owner}-${repo}.md`;
		}
		return `${repoName}.md`;
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

vi.mock("../index-manager.js", () => ({
	readGlobalMap: vi.fn(() => ({ repos: {} })),
	upsertGlobalMapEntry: vi.fn(),
}));

vi.mock("../paths.js", () => ({
	Paths: {
		data: "/mock/data",
		metaDir: "/mock/data/meta",
		offworldReferencesDir: "/mock/data/references",
		offworldSkillDir: "/mock/data/skill/offworld",
		offworldAssetsDir: "/mock/data/skill/offworld/assets",
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
	existsSync: vi.fn(() => false),
}));

import { streamPrompt } from "../ai/opencode.js";
import { getCommitSha } from "../clone.js";
import { loadConfig } from "../config.js";
import { generateReferenceWithAI, installReference } from "../generate.js";

const mockStreamPrompt = streamPrompt as ReturnType<typeof vi.fn>;
const mockGetCommitSha = getCommitSha as ReturnType<typeof vi.fn>;
const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

describe("generateReferenceWithAI", () => {
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

	it("extracts reference content from valid AI response", async () => {
		const longContent = "This is reference content. ".repeat(30);
		mockStreamPrompt.mockResolvedValue({
			text: `<reference_output>
# Test Library

${longContent}
</reference_output>`,
			durationMs: 1000,
		});

		const result = await generateReferenceWithAI("/mock/repo", "test/repo");

		expect(result.commitSha).toBe("abc1234567890");
		expect(result.referenceContent).toContain("# Test Library");
	});

	it("throws when AI response missing reference_output tags", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: "Some random response without tags",
			durationMs: 1000,
		});

		await expect(generateReferenceWithAI("/mock/repo", "test/repo")).rejects.toThrow(
			"no <reference_output> tags found",
		);
	});

	it("throws when reference content too short", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: `<reference_output>
# Test
Short
</reference_output>`,
			durationMs: 1000,
		});

		await expect(generateReferenceWithAI("/mock/repo", "test/repo")).rejects.toThrow("too short");
	});

	it("throws when reference content missing markdown heading", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: `<reference_output>
No heading here
${"This is some content ".repeat(50)}
</reference_output>`,
			durationMs: 1000,
		});

		await expect(generateReferenceWithAI("/mock/repo", "test/repo")).rejects.toThrow(
			"must start with markdown heading",
		);
	});

	it("uses custom provider and model when provided", async () => {
		mockStreamPrompt.mockResolvedValue({
			text: `<reference_output>
# Test
${"Content ".repeat(100)}
</reference_output>`,
			durationMs: 1000,
		});

		await generateReferenceWithAI("/mock/repo", "test/repo", {
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

describe("installReference", () => {
	beforeEach(() => {
		mockLoadConfig.mockReturnValue({
			agents: [],
		});
	});

	it("should accept valid arguments", () => {
		expect(() => {
			installReference("github.com:test/repo", "test/repo", "/path/to/repo", "# Test\nContent", {
				referenceUpdatedAt: new Date().toISOString(),
				commitSha: "abc123",
				version: "0.1.0",
			});
		}).not.toThrow();
	});
});
