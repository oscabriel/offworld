import * as p from "@clack/prompts";
import { getConfigPath, loadConfig } from "@offworld/sdk";
import { existsSync } from "node:fs";

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
}

export async function projectInitHandler(
	_options: ProjectInitOptions = {},
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

	// TODO: Detect project root via git or cwd
	// TODO: Scan dependency manifests
	// TODO: Resolve dependency → repo mapping
	// TODO: Match to skill availability
	// TODO: Present checklist to user
	// TODO: Install selected skills
	// TODO: Update AGENTS.md + agent-specific files

	p.log.warn("Project init not yet implemented. This is a placeholder.");
	p.log.info("");
	p.log.info("When complete, this command will:");
	p.log.info("  1. Scan dependency manifests (package.json, etc.)");
	p.log.info("  2. Resolve dependency names to GitHub repos");
	p.log.info("  3. Match to skill availability");
	p.log.info("  4. Install selected skills");
	p.log.info("  5. Update AGENTS.md with skill references");
	p.log.info("");
	p.outro("Stay tuned!");

	return { success: true };
}
