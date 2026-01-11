import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Skill } from "@offworld/types";

export interface PathValidationResult {
	validatedSkill: Skill;
	removedPaths: string[];
}

export interface ValidatePathsOptions {
	basePath: string;
	onWarning?: (path: string) => void;
}

export function validateSkillPaths(
	skill: Skill,
	options: ValidatePathsOptions,
): PathValidationResult {
	const { basePath, onWarning } = options;
	const removedPaths: string[] = [];

	const validRepositoryStructure = skill.repositoryStructure.filter((entry) => {
		const fullPath = resolvePath(entry.path, basePath);
		if (existsSync(fullPath)) {
			return true;
		}
		removedPaths.push(entry.path);
		onWarning?.(entry.path);
		return false;
	});

	const validKeyFiles = skill.keyFiles.filter((entry) => {
		const fullPath = resolvePath(entry.path, basePath);
		if (existsSync(fullPath)) {
			return true;
		}
		removedPaths.push(entry.path);
		onWarning?.(entry.path);
		return false;
	});

	const validatedSkill: Skill = {
		...skill,
		repositoryStructure: validRepositoryStructure,
		keyFiles: validKeyFiles,
	};

	return {
		validatedSkill,
		removedPaths,
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
