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
		quickPaths: [
			{ path: "src/index.ts", description: "Entry point" },
			{ path: "config.json", description: "Config" },
			{ path: "nonexistent.ts", description: "Missing file" },
		],
		searchPatterns: [
			{ find: "Exports", pattern: "export", path: "/test/repo/src/" },
			{ find: "Tests", pattern: "describe", path: "/test/repo/tests/" },
		],
	};

	beforeEach(() => {
		mockExistsSync.mockReset();
	});

	it("should keep valid paths and remove invalid ones", () => {
		mockExistsSync.mockImplementation((path: string) => {
			const validPaths = ["/test/repo/src/index.ts", "/test/repo/config.json", "/test/repo/src/"];
			return validPaths.includes(path);
		});

		const { validatedSkill, removedPaths, removedSearchPaths } = validateSkillPaths(mockSkill, {
			basePath,
		});

		expect(validatedSkill.quickPaths).toHaveLength(2);
		expect(validatedSkill.quickPaths.map((e) => e.path)).toEqual(["src/index.ts", "config.json"]);
		expect(removedPaths).toEqual(["nonexistent.ts"]);

		expect(validatedSkill.searchPatterns).toHaveLength(1);
		expect(validatedSkill.searchPatterns[0]?.path).toBe("/test/repo/src/");
		expect(removedSearchPaths).toEqual(["/test/repo/tests/"]);
	});

	it("should call onWarning for each removed path with type", () => {
		mockExistsSync.mockReturnValue(false);
		const warnings: Array<{ path: string; type: string }> = [];

		validateSkillPaths(mockSkill, {
			basePath,
			onWarning: (path, type) => warnings.push({ path, type }),
		});

		expect(warnings).toHaveLength(5);
		expect(warnings.filter((w) => w.type === "quickPath")).toHaveLength(3);
		expect(warnings.filter((w) => w.type === "searchPattern")).toHaveLength(2);
	});

	it("should handle absolute paths without joining", () => {
		const absoluteSkill: Skill = {
			...mockSkill,
			quickPaths: [{ path: "/absolute/path", description: "Absolute" }],
			searchPatterns: [{ find: "Search", pattern: "test", path: "/absolute/dir/" }],
		};

		mockExistsSync.mockImplementation(
			(path: string) => path === "/absolute/path" || path === "/absolute/dir/",
		);

		const { validatedSkill } = validateSkillPaths(absoluteSkill, { basePath });
		expect(validatedSkill.quickPaths).toHaveLength(1);
		expect(validatedSkill.searchPatterns).toHaveLength(1);
	});

	it("should return original skill if all paths exist", () => {
		mockExistsSync.mockReturnValue(true);

		const { validatedSkill, removedPaths, removedSearchPaths } = validateSkillPaths(mockSkill, {
			basePath,
		});

		expect(validatedSkill.quickPaths).toHaveLength(3);
		expect(validatedSkill.searchPatterns).toHaveLength(2);
		expect(removedPaths).toHaveLength(0);
		expect(removedSearchPaths).toHaveLength(0);
	});

	it("should validate searchPatterns directory paths", () => {
		const skillWithDirs: Skill = {
			name: "test",
			description: "Test",
			quickPaths: [],
			searchPatterns: [
				{ find: "Valid", pattern: "test", path: "/test/repo/src/" },
				{ find: "Invalid", pattern: "test", path: "/test/repo/missing/" },
			],
		};

		mockExistsSync.mockImplementation((path: string) => path === "/test/repo/src/");

		const { validatedSkill, removedSearchPaths } = validateSkillPaths(skillWithDirs, { basePath });

		expect(validatedSkill.searchPatterns).toHaveLength(1);
		expect(validatedSkill.searchPatterns[0]?.find).toBe("Valid");
		expect(removedSearchPaths).toEqual(["/test/repo/missing/"]);
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
