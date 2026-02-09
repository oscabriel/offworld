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
} from "@offworld/sdk/internal";
import { createOpenCodeContext, type OpenCodeContext } from "@offworld/sdk/ai";
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
	/** Force local generation for deps without existing references */
	generate?: boolean;
	/** Show what would be done without doing it */
	dryRun?: boolean;
	/** Skip confirmations */
	yes?: boolean;
	/** Max parallel installs for remote/installed refs */
	concurrency?: number;
}

export interface ProjectInitResult {
	success: boolean;
	message?: string;
	referencesInstalled?: number;
}

export function isInternalDependencyVersion(version?: string): boolean {
	if (!version) return false;
	const trimmed = version.trim();
	if (!trimmed) return false;

	const isPathReference =
		trimmed.startsWith("./") ||
		trimmed.startsWith("../") ||
		trimmed.startsWith("/") ||
		trimmed.startsWith("~/") ||
		trimmed.startsWith("~\\");

	return (
		trimmed.startsWith("workspace:") ||
		trimmed.startsWith("file:") ||
		trimmed.startsWith("link:") ||
		trimmed.startsWith("portal:") ||
		isPathReference
	);
}

function dedupeMatchesByRepo(matches: ReferenceMatch[]): ReferenceMatch[] {
	const seenRepos = new Set<string>();
	const deduped: ReferenceMatch[] = [];

	for (const match of matches) {
		if (!match.repo) {
			deduped.push(match);
			continue;
		}

		if (seenRepos.has(match.repo)) continue;
		seenRepos.add(match.repo);
		deduped.push(match);
	}

	return deduped;
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

const LOGO_LINES = [
	" ██████╗ ███████╗███████╗██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗ ",
	"██╔═══██╗██╔════╝██╔════╝██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗",
	"██║   ██║█████╗  █████╗  ██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║",
	"██║   ██║██╔══╝  ██╔══╝  ██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║",
	"╚██████╔╝██║     ██║     ╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝",
	" ╚═════╝ ╚═╝     ╚═╝      ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝ ",
];

const OLIVE = "\x1b[38;5;187m";
const RESET = "\x1b[0m";

function showBanner(): void {
	console.log();
	for (const line of LOGO_LINES) {
		console.log(`${OLIVE}${line}${RESET}`);
	}
	console.log();
}

async function runWithConcurrency<T>(
	tasks: (() => Promise<T>)[],
	concurrency: number,
): Promise<T[]> {
	if (concurrency < 1) {
		throw new Error("Concurrency must be at least 1.");
	}

	const results: T[] = [];
	let index = 0;

	async function worker(): Promise<void> {
		while (index < tasks.length) {
			const i = index++;
			results[i] = await tasks[i]!();
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
	await Promise.all(workers);
	return results;
}

export async function projectInitHandler(
	options: ProjectInitOptions = {},
): Promise<ProjectInitResult> {
	showBanner();
	p.intro("Scan your deps to install reference files and create a clone map for your agents.");

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
	const externalDeps = dependencies.filter((dep) => !isInternalDependencyVersion(dep.version));

	const resolvedPromises = externalDeps.map((dep) => resolveDependencyRepo(dep.name, dep.version));
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
					return pc.blue("(add to map)");
				case "remote":
					return pc.green("(remote available)");
				case "generate":
					return pc.yellow("(generate)");
				default:
					return pc.dim("(not found)");
			}
		};

		const repoGroups = new Map<string, ReferenceMatch[]>();
		for (const m of matches) {
			const repo = m.repo ?? "unknown";
			if (!repoGroups.has(repo)) {
				repoGroups.set(repo, []);
			}
			repoGroups.get(repo)!.push(m);
		}

		const sortedRepos = [...repoGroups.keys()].sort((a, b) => a.localeCompare(b));

		const checklistOptions = sortedRepos.map((repo) => {
			const group = repoGroups.get(repo)!;
			const representative = group[0]!;
			const status = statusLabel(representative.status);
			const label = `${repo} ${status}`;
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

	const dedupedSelected = dedupeMatchesByRepo(selected);
	if (dedupedSelected.length !== selected.length) {
		const dedupeCount = selected.length - dedupedSelected.length;
		p.log.info(`Deduped ${dedupeCount} duplicate dependencies that map to the same repository.`);
	}
	selected = dedupedSelected;

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

	const requestedConcurrency = options.concurrency ?? 4;
	const concurrency =
		Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
			? Math.max(1, Math.trunc(requestedConcurrency))
			: 4;
	const installedGroup = selected.filter((m) => m.status === "installed");
	const remoteGroup = selected.filter((m) => m.status === "remote");
	const generateGroup = selected.filter((m) => m.status === "generate");
	const total = selected.length;

	const installed: InstalledReference[] = [];
	const successfulMatches: ReferenceMatch[] = [];
	let failedCount = 0;
	let counter = 0;

	// --- Phase 1: Installed refs (fast path — no pull, just map + agent files) ---
	if (installedGroup.length > 0) {
		p.log.step(`Adding ${pc.blue(installedGroup.length)} already-installed references...`);

		const installedTasks = installedGroup.map((match) => async () => {
			const i = ++counter;
			const repo = match.repo!;
			const progress = `[${i}/${total}]`;
			const prefix = `${progress} ${match.dep}`;

			try {
				const referencePath = getReferencePath(repo);
				successfulMatches.push(match);
				installed.push({
					dependency: match.dep,
					reference: toReferenceFileName(repo),
					path: referencePath,
				});
				p.log.info(`${prefix} ${pc.green("✓")} ${pc.dim("(already installed)")}`);
				return { match, success: true, source: "installed" as const };
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : "Unknown error";
				p.log.info(`${prefix} ${pc.red("✗")} ${pc.dim(errMsg)}`);
				failedCount++;
				return { match, success: false };
			}
		});

		await runWithConcurrency(installedTasks, concurrency);
	}

	// --- Phase 2: Remote refs (download from offworld.sh, bounded parallelism) ---
	if (remoteGroup.length > 0) {
		p.log.step(`Downloading ${pc.green(remoteGroup.length)} remote references...`);

		const remoteTasks = remoteGroup.map((match) => async () => {
			const i = ++counter;
			const repo = match.repo!;
			const progress = `[${i}/${total}]`;
			const prefix = `${progress} ${match.dep}`;

			const spinner = p.spinner();
			spinner.start(`${prefix}: Downloading...`);

			try {
				const pullResult = await pullHandler({
					repo,
					force: false,
					verbose: false,
					allowGenerate: false,
					quiet: true,
					skipConfirm: true,
					skipUpdate: true,
					onProgress: (msg) => spinner.message(`${prefix}: ${msg}`),
				});

				if (pullResult.success && pullResult.referenceInstalled) {
					const referencePath = getReferencePath(repo);
					successfulMatches.push(match);
					installed.push({
						dependency: match.dep,
						reference: toReferenceFileName(repo),
						path: referencePath,
					});
					const source =
						pullResult.referenceSource === "remote" ? "downloaded" : pullResult.referenceSource;
					spinner.stop(`${prefix} ${pc.green("✓")} ${pc.dim(`(${source})`)}`);
					return { match, success: true, source: "remote" as const };
				}
				spinner.stop(`${prefix} ${pc.red("✗")} ${pc.red("failed")}`);
				failedCount++;
				return { match, success: false };
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : "Unknown error";
				spinner.stop(`${prefix} ${pc.red("✗")} ${pc.dim(errMsg)}`);
				failedCount++;
				return { match, success: false };
			}
		});

		await runWithConcurrency(remoteTasks, concurrency);
	}

	// --- Phase 3: Generate refs (sequential, shared OpenCode server) ---
	if (generateGroup.length > 0) {
		p.log.step(`Generating ${pc.yellow(generateGroup.length)} references with OpenCode...`);

		let openCodeContext: OpenCodeContext | undefined;
		try {
			if (generateGroup.length > 1) {
				p.log.info(pc.dim("Starting OpenCode server for batch generation..."));
				openCodeContext = await createOpenCodeContext({
					onDebug: () => {},
				});
			}

			for (const match of generateGroup) {
				const i = ++counter;
				const repo = match.repo!;
				const progress = `[${i}/${total}]`;
				const prefix = `${progress} ${match.dep}`;

				const spinner = p.spinner();
				spinner.start(`${prefix}: Starting...`);

				try {
					const pullResult = await pullHandler({
						repo,
						force: options.generate,
						verbose: false,
						quiet: true,
						skipConfirm: true,
						openCodeContext,
						onProgress: (msg) => spinner.message(`${prefix}: ${msg}`),
					});

					if (pullResult.success && pullResult.referenceInstalled) {
						const referencePath = getReferencePath(repo);
						successfulMatches.push(match);
						installed.push({
							dependency: match.dep,
							reference: toReferenceFileName(repo),
							path: referencePath,
						});
						const source = pullResult.referenceSource === "remote" ? "downloaded" : "generated";
						spinner.stop(`${prefix} ${pc.green("✓")} ${pc.dim(`(${source})`)}`);
					} else {
						spinner.stop(`${prefix} ${pc.red("✗")} ${pc.red("failed")}`);
						failedCount++;
					}
				} catch (error) {
					const errMsg = error instanceof Error ? error.message : "Unknown error";
					spinner.stop(`${prefix} ${pc.red("✗")} ${pc.dim(errMsg)}`);
					failedCount++;
				}
			}
		} finally {
			openCodeContext?.close();
		}
	}

	if (successfulMatches.length > 0) {
		const map = readGlobalMap();
		const successfulRepos = new Map<string, ReferenceMatch>();
		for (const match of successfulMatches) {
			if (!match.repo || successfulRepos.has(match.repo)) continue;
			successfulRepos.set(match.repo, match);
		}

		const projectEntries = Object.fromEntries(
			Array.from(successfulRepos.values()).map((match) => {
				const qualifiedName = `github.com:${match.repo}`;
				const entry = map.repos[qualifiedName];
				return [
					qualifiedName,
					{
						localPath: entry?.localPath ?? "",
						reference: toReferenceFileName(match.repo!),
						keywords: entry?.keywords ?? [],
					},
				];
			}),
		);

		writeProjectMap(projectRoot, projectEntries);
	} else {
		p.log.warn("No references were installed. Project map was not updated.");
	}

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
