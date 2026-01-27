import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ai/opencode.js", () => ({
	streamPrompt: vi.fn(),
}));

vi.mock("../clone.js", () => ({
	getCommitSha: vi.fn(),
}));

vi.mock("../agents.js", () => ({
	agents: {
		opencode: {
			name: "opencode",
			globalSkillsDir: "/mock/opencode/skills",
		},
	},
}));

vi.mock("node:fs", () => ({
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
	existsSync: vi.fn(() => false),
	symlinkSync: vi.fn(),
	lstatSync: vi.fn(() => ({ isSymbolicLink: () => true })),
	rmSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

vi.mock("../paths.js", () => ({
	Paths: {
		data: "/mock/data",
		metaDir: "/mock/data/meta",
		offworldReferencesDir: "/mock/data/references",
		offworldSkillDir: "/mock/data/skill/offworld",
		offworldAssetsDir: "/mock/data/skill/offworld/assets",
	},
	expandTilde: vi.fn((p: string) => p),
}));

import type { GlobalMap } from "@offworld/types";

let globalMapState: GlobalMap = { repos: {} };

vi.mock("../config.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config.js")>();
	return {
		...actual,
		loadConfig: vi.fn(),
	};
});

vi.mock("../index-manager.js", () => ({
	readGlobalMap: vi.fn(() => globalMapState),
	upsertGlobalMapEntry: vi.fn(),
	writeGlobalMap: vi.fn((map) => {
		Object.assign(globalMapState, map);
	}),
}));

import { streamPrompt } from "../ai/opencode.js";
import { getCommitSha } from "../clone.js";
import { loadConfig } from "../config.js";
import { generateReferenceWithAI, installReference } from "../generate.js";
import * as fs from "node:fs";

const mockStreamPrompt = streamPrompt as ReturnType<typeof vi.fn>;
const mockGetCommitSha = getCommitSha as ReturnType<typeof vi.fn>;
const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

describe("generateReferenceWithAI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadConfig.mockReturnValue({
			defaultModel: "anthropic/claude-sonnet-4",
			agents: ["opencode"],
		});
		mockGetCommitSha.mockReturnValue("abc1234567890");
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
		vi.resetAllMocks();
		mockLoadConfig.mockReturnValue({
			agents: ["opencode"],
		});

		globalMapState = { repos: {} };
	});

	it("creates reference file, meta file, and updates global map", () => {
		const referenceContent = "# TanStack Router\n\nA router library.";
		const meta = {
			referenceUpdatedAt: "2026-01-27T00:00:00Z",
			commitSha: "abc123",
			version: "0.1.0",
		};

		installReference(
			"github.com:tanstack/router",
			"tanstack/router",
			"/home/user/ow/tanstack/router",
			referenceContent,
			meta,
		);

		expect(fs.mkdirSync).toHaveBeenCalledWith(
			"/mock/data/references",
			expect.objectContaining({ recursive: true }),
		);

		expect(fs.writeFileSync).toHaveBeenCalledWith(
			"/mock/data/references/tanstack-router.md",
			referenceContent,
			"utf-8",
		);

		expect(fs.mkdirSync).toHaveBeenCalledWith(
			"/mock/data/meta/tanstack-router",
			expect.objectContaining({ recursive: true }),
		);

		const writeFileSyncMock = vi.mocked(fs.writeFileSync);
		const metaWriteCall = writeFileSyncMock.mock.calls.find((call) =>
			call[0]?.toString().includes("meta.json"),
		);
		expect(metaWriteCall).toBeDefined();

		const metaContent = metaWriteCall?.[1] as string;
		expect(metaContent).toContain("referenceUpdatedAt");
		expect(metaContent).toContain("abc123");

		expect(globalMapState.repos["github.com:tanstack/router"]).toEqual(
			expect.objectContaining({
				localPath: "/home/user/ow/tanstack/router",
				primary: "tanstack-router.md",
				keywords: expect.arrayContaining(["tanstack/router", "tanstack", "router"]),
			}),
		);
	});

	it("derives keywords from repo name and content", () => {
		installReference(
			"github.com:colinhacks/zod",
			"colinhacks/zod",
			"/home/user/ow/colinhacks/zod",
			"# Zod\n\nSchema validation library",
			{
				referenceUpdatedAt: "2026-01-27T00:00:00Z",
				commitSha: "abc123",
				version: "0.1.0",
			},
		);

		const entry = globalMapState.repos["github.com:colinhacks/zod"];
		expect(entry).toEqual(
			expect.objectContaining({
				keywords: expect.arrayContaining(["colinhacks/zod", "colinhacks-zod", "zod"]),
			}),
		);
	});

	it("merges keywords from existing entry when updating", () => {
		globalMapState.repos["github.com:tanstack/router"] = {
			localPath: "/old/path",
			references: ["old-reference.md"],
			primary: "old-reference.md",
			keywords: ["old-keyword"],
			updatedAt: "2026-01-01T00:00:00Z",
		};

		installReference(
			"github.com:tanstack/router",
			"tanstack/router",
			"/new/path",
			"# New Reference",
			{
				referenceUpdatedAt: "2026-01-27T00:00:00Z",
				commitSha: "def456",
				version: "0.1.0",
			},
		);

		const entry = globalMapState.repos["github.com:tanstack/router"];
		expect(entry).toEqual(
			expect.objectContaining({
				localPath: "/new/path",
				keywords: expect.arrayContaining(["old-keyword", "tanstack", "router"]),
			}),
		);
	});

	it("handles legacy qualified name migration", () => {
		globalMapState.repos["github:tanstack/router"] = {
			localPath: "/old/path",
			references: ["old-ref.md"],
			primary: "old-ref.md",
			keywords: ["legacy"],
			updatedAt: "2026-01-01T00:00:00Z",
		};

		installReference("github.com:tanstack/router", "tanstack/router", "/new/path", "# Updated", {
			referenceUpdatedAt: "2026-01-27T00:00:00Z",
			commitSha: "abc123",
			version: "0.1.0",
		});

		const updatedEntry = globalMapState.repos["github.com:tanstack/router"];
		expect(updatedEntry).toBeDefined();
		expect(updatedEntry).toEqual(
			expect.objectContaining({
				localPath: "/new/path",
				keywords: expect.arrayContaining(["legacy"]),
			}),
		);

		expect(globalMapState.repos["github:tanstack/router"]).toBeUndefined();
	});

	it("handles custom keywords when provided", () => {
		const customKeywords = ["custom-tag", "special"];

		installReference(
			"github.com:owner/repo",
			"owner/repo",
			"/path/to/repo",
			"# Repo",
			{
				referenceUpdatedAt: "2026-01-27T00:00:00Z",
				commitSha: "abc123",
				version: "0.1.0",
			},
			customKeywords,
		);

		const entry = globalMapState.repos["github.com:owner/repo"];
		expect(entry).toEqual(
			expect.objectContaining({
				keywords: customKeywords,
			}),
		);
	});
});
