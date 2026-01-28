/**
 * Dependency manifest parsing for multiple package ecosystems
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";

export type ManifestType = "npm" | "python" | "rust" | "go" | "unknown";

export interface Dependency {
	name: string;
	version?: string;
	dev: boolean;
}

const DEFAULT_IGNORED_DIRS = new Set([
	".git",
	".offworld",
	".turbo",
	"build",
	"dist",
	"node_modules",
	"out",
]);

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
			return parseNpmDependencies(dir);
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

function parseNpmDependencies(dir: string): Dependency[] {
	const rootPath = join(dir, "package.json");
	const rootDeps = parsePackageJson(rootPath);
	const workspaceDeps = parseWorkspaceDependencies(dir);
	return mergeDependencies(rootDeps, workspaceDeps).sort((a, b) => a.name.localeCompare(b.name));
}

function parseWorkspaceDependencies(dir: string): Dependency[] {
	const workspacePatterns = getWorkspacePatterns(dir);
	if (workspacePatterns.length === 0) return [];

	const packageJsonPaths = resolveWorkspacePackageJsonPaths(dir, workspacePatterns);
	const deps: Dependency[] = [];
	for (const path of packageJsonPaths) {
		deps.push(...parsePackageJson(path));
	}

	return mergeDependencies([], deps);
}

function getWorkspacePatterns(dir: string): string[] {
	const patterns = new Set<string>();

	const packageJsonPath = join(dir, "package.json");
	if (existsSync(packageJsonPath)) {
		const rootJson = readJson(packageJsonPath);
		const workspaces = rootJson?.workspaces;
		if (Array.isArray(workspaces)) {
			for (const pattern of workspaces) {
				if (typeof pattern === "string") patterns.add(pattern);
			}
		} else if (workspaces && typeof workspaces === "object") {
			const packagesField = (workspaces as { packages?: unknown }).packages;
			if (Array.isArray(packagesField)) {
				for (const pattern of packagesField) {
					if (typeof pattern === "string") patterns.add(pattern);
				}
			}
		}
	}

	const pnpmWorkspacePath = existsSync(join(dir, "pnpm-workspace.yaml"))
		? join(dir, "pnpm-workspace.yaml")
		: existsSync(join(dir, "pnpm-workspace.yml"))
			? join(dir, "pnpm-workspace.yml")
			: null;

	if (pnpmWorkspacePath) {
		for (const pattern of parsePnpmWorkspacePackages(pnpmWorkspacePath)) {
			patterns.add(pattern);
		}
	}

	return Array.from(patterns);
}

function resolveWorkspacePackageJsonPaths(dir: string, patterns: string[]): string[] {
	const includePatterns = patterns.filter((pattern) => !pattern.startsWith("!"));
	const excludePatterns = patterns
		.filter((pattern) => pattern.startsWith("!"))
		.map((pattern) => pattern.slice(1));

	if (includePatterns.length === 0) return [];

	const includeRegexes = includePatterns.map(patternToRegex);
	const excludeRegexes = excludePatterns.map(patternToRegex);

	const matches: string[] = [];
	const directories = walkDirectories(dir);

	for (const relativePath of directories) {
		if (!includeRegexes.some((regex) => regex.test(relativePath))) continue;
		if (excludeRegexes.some((regex) => regex.test(relativePath))) continue;

		const packageJsonPath = join(dir, relativePath, "package.json");
		if (existsSync(packageJsonPath)) {
			matches.push(packageJsonPath);
		}
	}

	return Array.from(new Set(matches));
}

function walkDirectories(root: string): string[] {
	const results: string[] = [];
	const stack: string[] = [""];

	while (stack.length > 0) {
		const relativePath = stack.pop();
		const currentPath = relativePath ? join(root, relativePath) : root;

		let entries: Dirent[];
		try {
			entries = readdirSync(currentPath, { withFileTypes: true }) as Dirent[];
		} catch {
			continue;
		}

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue;

			const nextRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
			results.push(nextRelative);
			stack.push(nextRelative);
		}
	}

	return results;
}

function patternToRegex(pattern: string): RegExp {
	let normalized = pattern.trim().replace(/\\/g, "/");
	if (normalized.startsWith("./")) normalized = normalized.slice(2);
	if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);

	const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	const withGlob = escaped
		.replace(/\\\*\\\*/g, ".*")
		.replace(/\\\*/g, "[^/]+");

	return new RegExp(`^${withGlob}$`);
}

function parsePnpmWorkspacePackages(path: string): string[] {
	try {
		const content = readFileSync(path, "utf-8");
		const lines = content.split("\n");
		const patterns: string[] = [];
		let inPackages = false;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			if (/^packages\s*:/.test(trimmed)) {
				inPackages = true;
				continue;
			}

			if (!inPackages) continue;

			const entryMatch = trimmed.match(/^-\s*(.+)$/);
			if (entryMatch?.[1]) {
				const value = entryMatch[1].trim().replace(/^['"]|['"]$/g, "");
				if (value) patterns.push(value);
				continue;
			}

			if (!line.startsWith(" ") && !line.startsWith("\t")) {
				break;
			}
		}

		return patterns;
	} catch {
		return [];
	}
}

function readJson(path: string): Record<string, unknown> | null {
	try {
		const content = readFileSync(path, "utf-8");
		return JSON.parse(content) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function mergeDependencies(base: Dependency[], incoming: Dependency[]): Dependency[] {
	const map = new Map<string, Dependency>();

	for (const dep of [...base, ...incoming]) {
		const existing = map.get(dep.name);
		if (!existing) {
			map.set(dep.name, { ...dep });
			continue;
		}

		const dev = existing.dev && dep.dev;
		const version = existing.version ?? dep.version;
		map.set(dep.name, { name: dep.name, version, dev });
	}

	return Array.from(map.values());
}

/**
 * Parse package.json dependencies
 */
function parsePackageJson(path: string): Dependency[] {
	try {
		const content = readFileSync(path, "utf-8");
		const pkg = JSON.parse(content);
		const deps: Dependency[] = [];

		if (pkg.dependencies && typeof pkg.dependencies === "object") {
			for (const [name, version] of Object.entries(pkg.dependencies)) {
				deps.push({ name, version: version as string, dev: false });
			}
		}

		if (pkg.devDependencies && typeof pkg.devDependencies === "object") {
			for (const [name, version] of Object.entries(pkg.devDependencies)) {
				deps.push({ name, version: version as string, dev: true });
			}
		}

		if (pkg.peerDependencies && typeof pkg.peerDependencies === "object") {
			for (const [name, version] of Object.entries(pkg.peerDependencies)) {
				deps.push({ name, version: version as string, dev: false });
			}
		}

		if (pkg.optionalDependencies && typeof pkg.optionalDependencies === "object") {
			for (const [name, version] of Object.entries(pkg.optionalDependencies)) {
				deps.push({ name, version: version as string, dev: false });
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
