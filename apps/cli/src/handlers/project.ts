import * as p from "@clack/prompts";
import {
	getConfigPath,
	loadConfig,
	parseDependencies,
	resolveDependencyRepo,
	matchDependenciesToSkills,
	updateAgentFiles,
	getSkillPath,
	type InstalledSkill,
	type SkillMatch,
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
	/** Generate skills for deps without existing ones */
	generate?: boolean;
	/** Show what would be done without doing it */
	dryRun?: boolean;
	/** Skip confirmations */
	yes?: boolean;
}

export interface ProjectInitResult {
	success: boolean;
	message?: string;
	skillsInstalled?: number;
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
	if (!config.ai?.provider || !config.ai?.model) {
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

	p.log.info(`Found ${dependencies.length} dependencies`);

	p.log.step("Resolving GitHub repositories...");
	const resolvedPromises = dependencies.map((dep) => resolveDependencyRepo(dep.name));
	const resolved = await Promise.all(resolvedPromises);

	const skipList = options.skip ? options.skip.split(",").map((d) => d.trim()) : [];
	const depsList = options.deps ? options.deps.split(",").map((d) => d.trim()) : [];

	let filtered = resolved.filter((r) => {
		if (r.source === "unknown") return false;
		if (skipList.includes(r.dep)) return false;
		if (depsList.length > 0) return depsList.includes(r.dep);
		return true;
	});

	if (filtered.length === 0) {
		p.log.warn("No resolvable dependencies after filtering.");
		p.outro("");
		return { success: true, message: "No resolvable dependencies" };
	}

	const matches = matchDependenciesToSkills(filtered);

	let selected: SkillMatch[];
	if (options.all || options.deps) {
		selected = matches;
	} else {
		const checklistOptions = matches.map((m) => {
			const label = `${m.dep} (${m.repo}) - ${m.status}`;
			return { value: m, label, hint: m.status };
		});

		const selectedResult = await p.multiselect({
			message: "Select dependencies to install skills for:",
			options: checklistOptions,
			required: false,
		});

		if (p.isCancel(selectedResult)) {
			p.cancel("Operation cancelled");
			return { success: false, message: "Cancelled by user" };
		}

		selected = selectedResult as SkillMatch[];
	}

	if (selected.length === 0) {
		p.log.warn("No dependencies selected.");
		p.outro("");
		return { success: true, message: "No dependencies selected" };
	}

	if (!options.yes && !options.dryRun) {
		const confirm = await p.confirm({
			message: `Install skills for ${selected.length} dependencies?`,
		});

		if (p.isCancel(confirm) || !confirm) {
			p.cancel("Operation cancelled");
			return { success: false, message: "Cancelled by user" };
		}
	}

	if (options.dryRun) {
		p.log.info("");
		p.log.info("Dry run - would install skills for:");
		for (const match of selected) {
			p.log.info(`  - ${match.dep} (${match.repo})`);
		}
		p.outro("Dry run complete");
		return { success: true, message: "Dry run complete" };
	}

	p.log.step(`Installing ${selected.length} skills...`);

	const installed: InstalledSkill[] = [];
	let failedCount = 0;

	for (const match of selected) {
		try {
			if (!match.repo) continue;

			p.log.info(`Installing skill for ${match.dep}...`);

			const pullResult = await pullHandler({
				repo: match.repo,
				shallow: true,
				force: options.generate,
				verbose: false,
			});

			if (pullResult.success && pullResult.skillInstalled) {
				const skillPath = getSkillPath(match.repo);
				installed.push({
					dependency: match.dep,
					skill: match.repo.replace("/", "-"),
					path: skillPath,
				});
			} else {
				p.log.warn(`Failed to install skill for ${match.dep}`);
				failedCount++;
			}
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : "Unknown error";
			p.log.error(`Error installing ${match.dep}: ${errMsg}`);
			failedCount++;
		}
	}

	if (installed.length > 0) {
		p.log.step("Updating AGENTS.md...");
		try {
			updateAgentFiles(projectRoot, installed);
			p.log.success("AGENTS.md updated");
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : "Unknown error";
			p.log.error(`Failed to update AGENTS.md: ${errMsg}`);
		}
	}

	p.log.info("");
	p.log.success(`Installed ${installed.length} skills`);
	if (failedCount > 0) {
		p.log.warn(`Failed to install ${failedCount} skills`);
	}

	p.outro("Project init complete");

	return { success: true, skillsInstalled: installed.length };
}
