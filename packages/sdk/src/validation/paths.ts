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
	/** Path to substitute for ${ANALYSIS} variable */
	analysisPath?: string;
	onWarning?: (path: string, type: "quickPath" | "searchPattern") => void;
}

/**
 * Substitute ${REPO} and ${ANALYSIS} variables in a path.
 */
function substituteVariables(path: string, repoPath: string, analysisPath?: string): string {
	let result = path.replace(/\$\{REPO\}/g, repoPath);
	if (analysisPath) {
		result = result.replace(/\$\{ANALYSIS\}/g, analysisPath);
	}
	return result;
}

export function validateSkillPaths(
	skill: Skill,
	options: ValidatePathsOptions,
): PathValidationResult {
	const { basePath, analysisPath, onWarning } = options;
	const removedPaths: string[] = [];
	const removedSearchPaths: string[] = [];

	const validQuickPaths = skill.quickPaths.filter((entry) => {
		// Substitute variables before checking existence
		const substitutedPath = substituteVariables(entry.path, basePath, analysisPath);
		const fullPath = resolvePath(substitutedPath, basePath);
		if (existsSync(fullPath)) {
			return true;
		}
		removedPaths.push(entry.path);
		onWarning?.(entry.path, "quickPath");
		return false;
	});

	const validSearchPatterns = skill.searchPatterns.filter((entry) => {
		// Substitute variables before checking existence
		const substitutedPath = substituteVariables(entry.path, basePath, analysisPath);
		const fullPath = resolvePath(substitutedPath, basePath);
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
