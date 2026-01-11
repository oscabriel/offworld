import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "@offworld/types";
import { validateSkillPaths, pathExists } from "../validation/paths.js";

const mockExistsSync = vi.fn();

vi.mock("node:fs", () => ({
	existsSync: (path: string) => mockExistsSync(path),
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
