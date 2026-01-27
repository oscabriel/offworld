/**
 * Installation utilities for upgrade/uninstall commands
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NpmPackageResponseSchema } from "@offworld/types";
import { VERSION } from "./constants.js";

const GITHUB_REPO = "oscabriel/offworld";
const NPM_PACKAGE = "offworld";

export type InstallMethod = "curl" | "npm" | "pnpm" | "bun" | "brew" | "unknown";

/**
 * Detect how offworld was installed
 */
export function detectInstallMethod(): InstallMethod {
	const execPath = process.execPath;

	// curl install goes to ~/.local/bin
	if (execPath.includes(".local/bin")) return "curl";

	// Check package managers
	const checks: Array<{ name: InstallMethod; test: () => boolean }> = [
		{
			name: "npm",
			test: () => {
				try {
					const result = execSync("npm list -g --depth=0 2>/dev/null", {
						encoding: "utf-8",
					});
					return result.includes(NPM_PACKAGE);
				} catch {
					return false;
				}
			},
		},
		{
			name: "pnpm",
			test: () => {
				try {
					const result = execSync("pnpm list -g --depth=0 2>/dev/null", {
						encoding: "utf-8",
					});
					return result.includes(NPM_PACKAGE);
				} catch {
					return false;
				}
			},
		},
		{
			name: "bun",
			test: () => {
				try {
					const result = execSync("bun pm ls -g 2>/dev/null", {
						encoding: "utf-8",
					});
					return result.includes(NPM_PACKAGE);
				} catch {
					return false;
				}
			},
		},
		{
			name: "brew",
			test: () => {
				try {
					execSync("brew list --formula offworld 2>/dev/null", {
						encoding: "utf-8",
					});
					return true;
				} catch {
					return false;
				}
			},
		},
	];

	// Prioritize based on exec path hints
	if (execPath.includes("npm")) {
		const check = checks.find((c) => c.name === "npm");
		if (check?.test()) return "npm";
	}
	if (execPath.includes("pnpm")) {
		const check = checks.find((c) => c.name === "pnpm");
		if (check?.test()) return "pnpm";
	}
	if (execPath.includes("bun")) {
		const check = checks.find((c) => c.name === "bun");
		if (check?.test()) return "bun";
	}
	if (execPath.includes("Cellar") || execPath.includes("homebrew")) {
		const check = checks.find((c) => c.name === "brew");
		if (check?.test()) return "brew";
	}

	// Fall back to checking all
	for (const check of checks) {
		if (check.test()) return check.name;
	}

	return "unknown";
}

/**
 * Get current installed version
 */
export function getCurrentVersion(): string {
	return VERSION;
}

/**
 * Fetch latest version from appropriate source
 */
export async function fetchLatestVersion(method?: InstallMethod): Promise<string | null> {
	const installMethod = method ?? detectInstallMethod();

	try {
		if (installMethod === "npm" || installMethod === "pnpm" || installMethod === "bun") {
			// Fetch from npm registry
			const response = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`);
			if (!response.ok) return null;
			const json = await response.json();
			const result = NpmPackageResponseSchema.safeParse(json);
			if (!result.success) return null;
			return result.data.version ?? null;
		}

		// Default: fetch from GitHub releases
		const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "offworld-cli",
			},
		});
		if (!response.ok) return null;
		const json = await response.json();
		// GitHub releases response - just need tag_name
		const tagName =
			typeof json === "object" && json !== null && "tag_name" in json
				? String(json.tag_name)
				: null;
		// Remove 'v' prefix if present
		return tagName?.replace(/^v/, "") ?? null;
	} catch {
		return null;
	}
}

/**
 * Execute upgrade for given method
 */
export function executeUpgrade(method: InstallMethod, version: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let cmd: string;
		let args: string[];

		switch (method) {
			case "curl":
				cmd = "bash";
				args = ["-c", `curl -fsSL https://offworld.sh/install | VERSION=${version} bash`];
				break;
			case "npm":
				cmd = "npm";
				args = ["install", "-g", `${NPM_PACKAGE}@${version}`];
				break;
			case "pnpm":
				cmd = "pnpm";
				args = ["install", "-g", `${NPM_PACKAGE}@${version}`];
				break;
			case "bun":
				cmd = "bun";
				args = ["install", "-g", `${NPM_PACKAGE}@${version}`];
				break;
			case "brew":
				cmd = "brew";
				args = ["upgrade", "offworld"];
				break;
			default:
				reject(new Error(`Cannot upgrade: unknown installation method`));
				return;
		}

		const proc = spawn(cmd, args, { stdio: "inherit" });
		proc.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Upgrade failed with exit code ${code}`));
		});
		proc.on("error", reject);
	});
}

/**
 * Execute uninstall for given method
 */
export function executeUninstall(method: InstallMethod): Promise<void> {
	return new Promise((resolve, reject) => {
		let cmd: string;
		let args: string[];

		switch (method) {
			case "curl":
				// For curl installs, we just need to remove the binary
				// The handler will take care of removing data directories
				try {
					const binPath = join(homedir(), ".local", "bin", "ow");
					if (existsSync(binPath)) {
						execSync(`rm -f "${binPath}"`, { stdio: "inherit" });
					}
					resolve();
				} catch (err) {
					reject(err);
				}
				return;
			case "npm":
				cmd = "npm";
				args = ["uninstall", "-g", NPM_PACKAGE];
				break;
			case "pnpm":
				cmd = "pnpm";
				args = ["uninstall", "-g", NPM_PACKAGE];
				break;
			case "bun":
				cmd = "bun";
				args = ["remove", "-g", NPM_PACKAGE];
				break;
			case "brew":
				cmd = "brew";
				args = ["uninstall", "offworld"];
				break;
			default:
				reject(new Error(`Cannot uninstall: unknown installation method`));
				return;
		}

		const proc = spawn(cmd, args, { stdio: "inherit" });
		proc.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Uninstall failed with exit code ${code}`));
		});
		proc.on("error", reject);
	});
}

/**
 * Get shell config files to clean
 */
export function getShellConfigFiles(): string[] {
	const home = homedir();
	const configs: string[] = [];

	const candidates = [
		".bashrc",
		".bash_profile",
		".profile",
		".zshrc",
		".zshenv",
		".config/fish/config.fish",
	];

	for (const file of candidates) {
		const path = join(home, file);
		if (existsSync(path)) {
			configs.push(path);
		}
	}

	return configs;
}

/**
 * Clean PATH entries from shell config
 */
export function cleanShellConfig(filePath: string): boolean {
	try {
		const content = readFileSync(filePath, "utf-8");
		const lines = content.split("\n");
		const filtered: string[] = [];
		let modified = false;

		for (const line of lines) {
			const trimmed = line.trim();
			// Skip lines that add .local/bin to PATH (our install location)
			if (
				trimmed.includes(".local/bin") &&
				(trimmed.startsWith("export PATH=") || trimmed.startsWith("fish_add_path"))
			) {
				// Only skip if it looks like it was added for offworld
				// Be conservative - only remove if it's clearly ours
				if (trimmed.includes("# offworld") || trimmed === 'export PATH="$HOME/.local/bin:$PATH"') {
					modified = true;
					continue;
				}
			}
			filtered.push(line);
		}

		if (modified) {
			writeFileSync(filePath, filtered.join("\n"), "utf-8");
		}

		return modified;
	} catch {
		return false;
	}
}
