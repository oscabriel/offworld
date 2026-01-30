import * as p from "@clack/prompts";
import pc from "picocolors";
import {
	getConfigPath,
	loadConfig,
	parseDependencies,
	resolveDependencyRepo,
	matchDependenciesToReferencesWithRemoteCheck,
	updateAgentFiles,
	getReferencePath,
	toReferenceFileName,
	readGlobalMap,
	writeProjectMap,
	type InstalledReference,
	type ReferenceMatch,
} from "@offworld/sdk";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { pullHandler } from "./pull";

export interface ProjectInitOptions {
	/** Select all detected dependencies */
	all?: boolean;
	/** Comma-separated deps to include (skip selection) */
	deps?: string;
	/** Comma-separated deps to exclude */
	skip?: string;
	/** Generate references for deps without existing ones */
	generate?: boolean;
	/** Show what would be done without doing it */
	dryRun?: boolean;
	/** Skip confirmations */
	yes?: boolean;
}

export interface ProjectInitResult {
	success: boolean;
	message?: string;
	referencesInstalled?: number;
}

function detectProjectRoot(): string | null {
	let currentDir = process.cwd();
	while (currentDir !== homedir()) {
		const gitPath = join(currentDir, ".git");
		if (existsSync(gitPath)) {
			return currentDir;
		}
		const parent = dirname(currentDir);
		if (parent === currentDir) {
			break;
		}
		currentDir = parent;
	}
	return null;
}

export async function projectInitHandler(
	options: ProjectInitOptions = {},
): Promise<ProjectInitResult> {
	p.intro("ow project init");

	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		p.log.error("No global config found. Run 'ow init' first to set up global configuration.");
		p.outro("");
		return { success: false, message: "No global config found" };
	}

	const config = loadConfig();
	if (!config.defaultModel) {
		p.log.error("Global config is missing AI settings. Run 'ow init --force' to reconfigure.");
		p.outro("");
		return { success: false, message: "Invalid global config" };
	}

	const projectRoot = detectProjectRoot() || process.cwd();
	p.log.info(`Project root: ${projectRoot}`);

	p.log.step("Scanning dependencies...");
	const dependencies = parseDependencies(projectRoot);

	if (dependencies.length === 0) {
		p.log.warn("No dependencies found in manifest files.");
		p.outro("");
		return { success: true, message: "No dependencies found" };
	}

	p.log.info(`Found ${pc.cyan(dependencies.length)} dependencies`);

	if (dependencies.length > 10) {
		p.log.warn(
			"Generating many references at once uses a lot of tokens. Consider selecting just a few.",
		);
	}

	p.log.step("Resolving GitHub repositories...");
	const isInternalDep = (version?: string): boolean => {
		if (!version) return false;
		return (
			version.startsWith("workspace:") ||
			version.startsWith("catalog:") ||
			version.startsWith("file:") ||
			version.startsWith("link:")
		);
	};

	const externalDeps = dependencies.filter((dep) => !isInternalDep(dep.version));

	const resolvedPromises = externalDeps.map((dep) => resolveDependencyRepo(dep.name));
	const resolved = await Promise.all(resolvedPromises);

	const skipList = options.skip ? options.skip.split(",").map((d) => d.trim()) : [];
	const depsList = options.deps ? options.deps.split(",").map((d) => d.trim()) : [];

	let filtered = resolved.filter((r) => {
		if (skipList.includes(r.dep)) return false;
		if (depsList.length > 0) return depsList.includes(r.dep);
		return true;
	});

	if (filtered.length === 0) {
		p.log.warn("No dependencies left after filtering.");
		p.outro("");
		return { success: true, message: "No dependencies after filtering" };
	}

	p.log.step("Checking for available remote references...");
	const matches = await matchDependenciesToReferencesWithRemoteCheck(filtered);

	const readyCount = matches.filter((m) => m.status === "installed").length;
	const remoteCount = matches.filter((m) => m.status === "remote").length;
	const generateCount = matches.filter((m) => m.status === "generate").length;

	const parts: string[] = [];
	if (readyCount > 0) parts.push(`${pc.blue(readyCount)} ref installed`);
	if (remoteCount > 0) parts.push(`${pc.green(remoteCount)} remote`);
	if (generateCount > 0) parts.push(`${pc.yellow(generateCount)} need generation`);
	if (parts.length > 0) {
		p.log.info(parts.join(", "));
	}

	const unresolved = matches.filter((match) => !match.repo);
	if (unresolved.length > 0) {
		p.log.warn(`Could not resolve ${unresolved.length} dependencies to a GitHub repo:`);
		for (const match of unresolved) {
			p.log.info(`  - ${match.dep}`);
		}
	}

	const installable = matches.filter((match) => match.repo);

	let selected: ReferenceMatch[];
	if (options.all || options.deps) {
		selected = installable;
	} else {
		const statusLabel = (status: string) => {
			switch (status) {
				case "installed":
					return pc.blue("(add to map)"); // Already on machine, just add to project
				case "remote":
					return pc.green("(remote available)"); // Quick download from offworld.sh
				case "generate":
					return pc.yellow("(generate)"); // Slow AI generation needed
				default:
					return pc.dim("(not found)");
			}
		};

		// Dedupe by repo - group deps that share the same repo
		const repoGroups = new Map<string, ReferenceMatch[]>();
		for (const m of matches) {
			const repo = m.repo ?? "unknown";
			if (!repoGroups.has(repo)) {
				repoGroups.set(repo, []);
			}
			repoGroups.get(repo)!.push(m);
		}

		// Sort repos alphabetically
		const sortedRepos = [...repoGroups.keys()].sort((a, b) => a.localeCompare(b));

		const checklistOptions = sortedRepos.map((repo) => {
			const group = repoGroups.get(repo)!;
			// Use first match as representative (they share the same repo/status)
			const representative = group[0]!;
			const status = statusLabel(representative.status);
			const label = `${repo} ${status}`;
			// Show all dep names in hint
			const deps = group.map((m) => m.dep).join(", ");
			return {
				value: representative,
				label,
				hint: deps,
				disabled: representative.status === "unknown",
			};
		});

		const selectedResult = await p.multiselect({
			message: "Select references[repo name (status) (deps list)]:",
			options: checklistOptions,
			required: false,
			maxItems: 20,
		});

		if (p.isCancel(selectedResult)) {
			p.cancel("Operation cancelled");
			return { success: false, message: "Cancelled by user" };
		}

		selected = Array.isArray(selectedResult) ? selectedResult : [];
	}

	if (selected.length === 0) {
		p.log.warn("No dependencies selected.");
		p.outro("");
		return { success: true, message: "No dependencies selected" };
	}

	if (!options.yes && !options.dryRun) {
		const confirm = await p.confirm({
			message: `Install references for ${selected.length} dependencies?`,
		});

		if (p.isCancel(confirm) || !confirm) {
			p.cancel("Operation cancelled");
			return { success: false, message: "Cancelled by user" };
		}
	}

	if (options.dryRun) {
		p.log.info("");
		p.log.info("Dry run - would install references for:");
		for (const match of selected) {
			p.log.info(`  - ${match.dep} (${match.repo})`);
		}
		p.outro("Dry run complete");
		return { success: true, message: "Dry run complete" };
	}

	const installed: InstalledReference[] = [];
	let failedCount = 0;
	const total = selected.length;

	for (let i = 0; i < selected.length; i++) {
		const match = selected[i]!;
		if (!match.repo) continue;

		const repo = match.repo;
		const progress = `[${i + 1}/${total}]`;
		const spinner = p.spinner();
		spinner.start(`${progress} ${match.dep} (${repo})`);

		try {
			const pullResult = await pullHandler({
				repo,
				shallow: true,
				force: options.generate,
				verbose: false,
				quiet: true,
			});

			if (pullResult.success && pullResult.referenceInstalled) {
				const referencePath = getReferencePath(repo);
				installed.push({
					dependency: match.dep,
					reference: toReferenceFileName(repo),
					path: referencePath,
				});
				const source = pullResult.referenceSource === "remote" ? "downloaded" : "generated";
				spinner.stop(`${progress} ${match.dep} ${pc.green("✓")} ${pc.dim(`(${source})`)}`);
			} else {
				spinner.stop(`${progress} ${match.dep} ${pc.red("✗")} ${pc.red("failed")}`);
				failedCount++;
			}
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : "Unknown error";
			spinner.stop(`${progress} ${match.dep} ${pc.red("✗")} ${pc.dim(errMsg)}`);
			failedCount++;
		}
	}

	const map = readGlobalMap();
	const projectEntries = Object.fromEntries(
		selected
			.filter((m) => m.repo)
			.map((m) => {
				const qualifiedName = `github.com:${m.repo}`;
				const entry = map.repos[qualifiedName];
				return [
					qualifiedName,
					{
						localPath: entry?.localPath ?? "",
						reference: toReferenceFileName(m.repo!),
						keywords: entry?.keywords ?? [],
					},
				];
			}),
	);
	writeProjectMap(projectRoot, projectEntries);

	if (installed.length > 0) {
		try {
			updateAgentFiles(projectRoot, installed);
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : "Unknown error";
			p.log.error(`Failed to update AGENTS.md: ${errMsg}`);
		}
	}

	const successText = pc.green(`${installed.length} references installed`);
	const failText = failedCount > 0 ? pc.dim(` (${failedCount} failed)`) : "";
	p.outro(`${successText}${failText}`);

	return { success: true, referencesInstalled: installed.length };
}
