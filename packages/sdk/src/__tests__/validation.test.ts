import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "@offworld/types";
import { validateSkillPaths, pathExists } from "../validation/paths.js";
import { isAnalysisStale, getCachedCommitSha } from "../validation/staleness.js";

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("node:fs", () => ({
	existsSync: (path: string) => mockExistsSync(path),
	readFileSync: (path: string, encoding?: string) => mockReadFileSync(path, encoding),
}));

describe("validateSkillPaths", () => {
	const basePath = "/test/repo";

	const mockSkill: Skill = {
		name: "test-skill",
		description: "Test skill",
		allowedTools: [],
		repositoryStructure: [
			{ path: "src", purpose: "Source code" },
			{ path: "lib", purpose: "Library code" },
			{ path: "missing", purpose: "Does not exist" },
		],
		keyFiles: [
			{ path: "src/index.ts", description: "Entry point" },
			{ path: "config.json", description: "Config" },
			{ path: "nonexistent.ts", description: "Missing file" },
		],
		searchStrategies: [],
		whenToUse: [],
	};

	beforeEach(() => {
		mockExistsSync.mockReset();
	});

	it("should keep valid paths and remove invalid ones", () => {
		mockExistsSync.mockImplementation((path: string) => {
			const validPaths = [
				"/test/repo/src",
				"/test/repo/lib",
				"/test/repo/src/index.ts",
				"/test/repo/config.json",
			];
			return validPaths.includes(path);
		});

		const { validatedSkill, removedPaths } = validateSkillPaths(mockSkill, { basePath });

		expect(validatedSkill.repositoryStructure).toHaveLength(2);
		expect(validatedSkill.repositoryStructure.map((e) => e.path)).toEqual(["src", "lib"]);

		expect(validatedSkill.keyFiles).toHaveLength(2);
		expect(validatedSkill.keyFiles.map((e) => e.path)).toEqual(["src/index.ts", "config.json"]);

		expect(removedPaths).toEqual(["missing", "nonexistent.ts"]);
	});

	it("should call onWarning for each removed path", () => {
		mockExistsSync.mockReturnValue(false);
		const warnings: string[] = [];

		validateSkillPaths(mockSkill, {
			basePath,
			onWarning: (path) => warnings.push(path),
		});

		expect(warnings).toHaveLength(6);
	});

	it("should handle absolute paths without joining", () => {
		const absoluteSkill: Skill = {
			...mockSkill,
			repositoryStructure: [{ path: "/absolute/path", purpose: "Absolute" }],
			keyFiles: [],
		};

		mockExistsSync.mockImplementation((path: string) => path === "/absolute/path");

		const { validatedSkill } = validateSkillPaths(absoluteSkill, { basePath });
		expect(validatedSkill.repositoryStructure).toHaveLength(1);
	});

	it("should return original skill if all paths exist", () => {
		mockExistsSync.mockReturnValue(true);

		const { validatedSkill, removedPaths } = validateSkillPaths(mockSkill, { basePath });

		expect(validatedSkill.repositoryStructure).toHaveLength(3);
		expect(validatedSkill.keyFiles).toHaveLength(3);
		expect(removedPaths).toHaveLength(0);
	});
});

describe("pathExists", () => {
	beforeEach(() => {
		mockExistsSync.mockReset();
	});

	it("should resolve relative paths against basePath", () => {
		mockExistsSync.mockImplementation((p: string) => p === "/base/rel/path");

		expect(pathExists("rel/path", "/base")).toBe(true);
		expect(mockExistsSync).toHaveBeenCalledWith("/base/rel/path");
	});

	it("should not modify absolute paths", () => {
		mockExistsSync.mockImplementation((p: string) => p === "/abs/path");

		expect(pathExists("/abs/path", "/base")).toBe(true);
		expect(mockExistsSync).toHaveBeenCalledWith("/abs/path");
	});
});

describe("isAnalysisStale", () => {
	const analysisPath = "/test/analysis";

	beforeEach(() => {
		mockExistsSync.mockReset();
		mockReadFileSync.mockReset();
	});

	it("should return stale with missing_meta when meta.json does not exist", () => {
		mockExistsSync.mockReturnValue(false);

		const result = isAnalysisStale(analysisPath, "abc1234");

		expect(result.isStale).toBe(true);
		expect(result.reason).toBe("missing_meta");
		expect(result.currentSha).toBe("abc1234");
	});

	it("should return stale with sha_mismatch when SHAs differ", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify({ commitSha: "old1234" }));

		const result = isAnalysisStale(analysisPath, "new5678");

		expect(result.isStale).toBe(true);
		expect(result.reason).toBe("sha_mismatch");
		expect(result.cachedSha).toBe("old1234");
		expect(result.currentSha).toBe("new5678");
	});

	it("should return not stale when SHAs match", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify({ commitSha: "abc1234def" }));

		const result = isAnalysisStale(analysisPath, "abc1234xyz");

		expect(result.isStale).toBe(false);
		expect(result.cachedSha).toBe("abc1234def");
	});

	it("should return stale with parse_error when JSON is invalid", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue("invalid json");

		const result = isAnalysisStale(analysisPath, "abc1234");

		expect(result.isStale).toBe(true);
		expect(result.reason).toBe("parse_error");
	});

	it("should return stale with missing_meta when commitSha is not in meta", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify({ analyzedAt: "2025-01-01" }));

		const result = isAnalysisStale(analysisPath, "abc1234");

		expect(result.isStale).toBe(true);
		expect(result.reason).toBe("missing_meta");
	});
});

describe("getCachedCommitSha", () => {
	const analysisPath = "/test/analysis";

	beforeEach(() => {
		mockExistsSync.mockReset();
		mockReadFileSync.mockReset();
	});

	it("should return null when meta.json does not exist", () => {
		mockExistsSync.mockReturnValue(false);

		expect(getCachedCommitSha(analysisPath)).toBe(null);
	});

	it("should return commitSha from meta.json", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify({ commitSha: "abc1234" }));

		expect(getCachedCommitSha(analysisPath)).toBe("abc1234");
	});

	it("should return null on parse error", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue("invalid json");

		expect(getCachedCommitSha(analysisPath)).toBe(null);
	});
});
