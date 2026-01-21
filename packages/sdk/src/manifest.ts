/**
 * Dependency manifest parsing for multiple package ecosystems
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ManifestType = "npm" | "python" | "rust" | "go" | "unknown";

export interface Dependency {
	name: string;
	version?: string;
	dev: boolean;
}

/**
 * Detects the manifest type in a directory
 */
export function detectManifestType(dir: string): ManifestType {
	if (existsSync(join(dir, "package.json"))) return "npm";
	if (existsSync(join(dir, "pyproject.toml"))) return "python";
	if (existsSync(join(dir, "Cargo.toml"))) return "rust";
	if (existsSync(join(dir, "go.mod"))) return "go";
	if (existsSync(join(dir, "requirements.txt"))) return "python";
	return "unknown";
}

/**
 * Parses dependencies from manifest files
 */
export function parseDependencies(dir: string): Dependency[] {
	const type = detectManifestType(dir);

	switch (type) {
		case "npm":
			return parsePackageJson(join(dir, "package.json"));
		case "python":
			return existsSync(join(dir, "pyproject.toml"))
				? parsePyprojectToml(join(dir, "pyproject.toml"))
				: parseRequirementsTxt(join(dir, "requirements.txt"));
		case "rust":
			return parseCargoToml(join(dir, "Cargo.toml"));
		case "go":
			return parseGoMod(join(dir, "go.mod"));
		default:
			return [];
	}
}

/**
 * Parse package.json dependencies
 */
function parsePackageJson(path: string): Dependency[] {
	try {
		const content = readFileSync(path, "utf-8");
		const pkg = JSON.parse(content);
		const deps: Dependency[] = [];

		// Regular dependencies
		if (pkg.dependencies && typeof pkg.dependencies === "object") {
			for (const [name, version] of Object.entries(pkg.dependencies)) {
				deps.push({ name, version: version as string, dev: false });
			}
		}

		// Dev dependencies
		if (pkg.devDependencies && typeof pkg.devDependencies === "object") {
			for (const [name, version] of Object.entries(pkg.devDependencies)) {
				deps.push({ name, version: version as string, dev: true });
			}
		}

		return deps;
	} catch {
		return [];
	}
}

/**
 * Parse pyproject.toml dependencies
 */
function parsePyprojectToml(path: string): Dependency[] {
	try {
		const content = readFileSync(path, "utf-8");
		const deps: Dependency[] = [];

		// Simple regex-based parsing for [project.dependencies]
		const depsSection = content.match(/\[project\.dependencies\]([\s\S]*?)(?=\[|$)/);
		if (!depsSection?.[1]) return [];

		const lines = depsSection[1].split("\n");
		for (const line of lines) {
			const match = line.match(/["']([a-zA-Z0-9_-]+)(?:[>=<~!]+([^"']+))?["']/);
			if (match?.[1]) {
				deps.push({
					name: match[1],
					version: match[2]?.trim(),
					dev: false,
				});
			}
		}

		return deps;
	} catch {
		return [];
	}
}

/**
 * Parse Cargo.toml dependencies
 */
function parseCargoToml(path: string): Dependency[] {
	try {
		const content = readFileSync(path, "utf-8");
		const deps: Dependency[] = [];

		const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
		if (!depsSection?.[1]) return [];

		const lines = depsSection[1].split("\n");
		for (const line of lines) {
			const simpleMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
			const tableMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*{.*version\s*=\s*"([^"]+)"/);

			if (simpleMatch?.[1] && simpleMatch[2]) {
				deps.push({ name: simpleMatch[1], version: simpleMatch[2], dev: false });
			} else if (tableMatch?.[1] && tableMatch[2]) {
				deps.push({ name: tableMatch[1], version: tableMatch[2], dev: false });
			}
		}

		return deps;
	} catch {
		return [];
	}
}

/**
 * Parse go.mod dependencies
 */
function parseGoMod(path: string): Dependency[] {
	try {
		const content = readFileSync(path, "utf-8");
		const deps: Dependency[] = [];

		const requireSection = content.match(/require\s*\(([\s\S]*?)\)/);
		if (!requireSection?.[1]) {
			const singleRequire = content.match(/require\s+([^\s]+)\s+([^\s]+)/);
			if (singleRequire?.[1] && singleRequire[2]) {
				deps.push({
					name: singleRequire[1],
					version: singleRequire[2],
					dev: false,
				});
			}
			return deps;
		}

		const lines = requireSection[1].split("\n");
		for (const line of lines) {
			const match = line.match(/^\s*([^\s]+)\s+([^\s]+)/);
			if (match?.[1] && match[2]) {
				deps.push({ name: match[1], version: match[2], dev: false });
			}
		}

		return deps;
	} catch {
		return [];
	}
}

/**
 * Parse requirements.txt dependencies
 */
function parseRequirementsTxt(path: string): Dependency[] {
	try {
		const content = readFileSync(path, "utf-8");
		const deps: Dependency[] = [];

		const lines = content.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[>=<~!]+(.+))?/);
			if (match?.[1]) {
				deps.push({
					name: match[1],
					version: match[2]?.trim(),
					dev: false,
				});
			}
		}

		return deps;
	} catch {
		return [];
	}
}
