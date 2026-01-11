import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Skill } from "@offworld/types";

export interface PathValidationResult {
	validatedSkill: Skill;
	removedPaths: string[];
	removedSearchPaths: string[];
}

export interface ValidatePathsOptions {
	basePath: string;
	onWarning?: (path: string, type: "quickPath" | "searchPattern") => void;
}

export function validateSkillPaths(
	skill: Skill,
	options: ValidatePathsOptions,
): PathValidationResult {
	const { basePath, onWarning } = options;
	const removedPaths: string[] = [];
	const removedSearchPaths: string[] = [];

	const validQuickPaths = skill.quickPaths.filter((entry) => {
		const fullPath = resolvePath(entry.path, basePath);
		if (existsSync(fullPath)) {
			return true;
		}
		removedPaths.push(entry.path);
		onWarning?.(entry.path, "quickPath");
		return false;
	});

	const validSearchPatterns = skill.searchPatterns.filter((entry) => {
		const fullPath = resolvePath(entry.path, basePath);
		if (existsSync(fullPath)) {
			return true;
		}
		removedSearchPaths.push(entry.path);
		onWarning?.(entry.path, "searchPattern");
		return false;
	});

	const validatedSkill: Skill = {
		...skill,
		quickPaths: validQuickPaths,
		searchPatterns: validSearchPatterns,
	};

	return {
		validatedSkill,
		removedPaths,
		removedSearchPaths,
	};
}

function resolvePath(path: string, basePath: string): string {
	if (path.startsWith("~/") || path.startsWith("~\\")) {
		return path;
	}
	if (isAbsolute(path)) {
		return path;
	}
	return join(basePath, path);
}

export function pathExists(path: string, basePath: string): boolean {
	const fullPath = resolvePath(path, basePath);
	return existsSync(fullPath);
}
