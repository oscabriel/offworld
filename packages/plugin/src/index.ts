/**
 * Offworld OpenCode Plugin
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import {
	listIndexedRepos,
	getAnalysisPath,
	getCommitSha,
	cloneRepo,
	parseRepoInput,
	runAnalysisPipeline,
	installSkillWithReferences,
	formatSkillMd,
	formatSummaryMd,
	formatArchitectureMd,
	loadConfig,
} from "@offworld/sdk";
import type { Architecture } from "@offworld/types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const version = "0.1.0";

// ============================================================================
// GitHub Detection Patterns
// ============================================================================

/** Matches github.com/owner/repo URLs */
const GITHUB_URL_PATTERN = /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/g;

/** Matches owner/repo format (e.g., "tanstack/router") */
const REPO_SHORTHAND_PATTERN = /\b([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)\b/g;

const FALSE_POSITIVES = new Set([
	"node_modules/package",
	"src/components",
	"dist/index",
	"build/output",
]);

function extractGitHubRepos(text: string): string[] {
	const repos = new Set<string>();

	for (const match of text.matchAll(GITHUB_URL_PATTERN)) {
		const repo = match[1]?.replace(/\.git$/, "").toLowerCase();
		if (repo && !FALSE_POSITIVES.has(repo)) {
			repos.add(repo);
		}
	}

	for (const match of text.matchAll(REPO_SHORTHAND_PATTERN)) {
		const repo = match[1]?.toLowerCase();
		if (repo && repo.includes("/") && !FALSE_POSITIVES.has(repo)) {
			const [owner, name] = repo.split("/");
			if (owner && name && owner.length > 1 && name.length > 1) {
				repos.add(repo);
			}
		}
	}

	return Array.from(repos);
}

// ============================================================================
// Types
// ============================================================================

type OffworldMode = "list" | "summary" | "architecture" | "clone";

interface ToolArgs {
	mode: OffworldMode;
	repo?: string;
}

interface RepoInfo {
	fullName: string;
	qualifiedName: string;
	localPath?: string;
	hasAnalysis: boolean;
	hasSkill: boolean;
}

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Load summary.md content for a repository
 */
function loadSummary(
	fullName: string,
	provider: "github" | "gitlab" | "bitbucket" = "github",
): string | null {
	const analysisPath = getAnalysisPath(fullName, provider);
	const summaryPath = join(analysisPath, "summary.md");

	if (!existsSync(summaryPath)) {
		return null;
	}

	try {
		return readFileSync(summaryPath, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Load architecture.json for a repository
 */
function loadArchitecture(
	fullName: string,
	provider: "github" | "gitlab" | "bitbucket" = "github",
): Architecture | null {
	const analysisPath = getAnalysisPath(fullName, provider);
	const archPath = join(analysisPath, "architecture.json");

	if (!existsSync(archPath)) {
		return null;
	}

	try {
		const content = readFileSync(archPath, "utf-8");
		return JSON.parse(content) as Architecture;
	} catch {
		return null;
	}
}

/**
 * List all cloned repositories with their status
 */
function listRepos(): RepoInfo[] {
	const repos = listIndexedRepos();

	return repos.map((entry) => {
		// Parse provider from qualifiedName (e.g., "github:owner/repo")
		const [providerPart, namePart] = entry.qualifiedName.split(":");
		const provider = providerPart as "github" | "gitlab" | "bitbucket" | "local";

		// Check if analysis exists
		let hasAnalysis = false;
		if (provider !== "local" && namePart) {
			const analysisPath = getAnalysisPath(namePart, provider as "github" | "gitlab" | "bitbucket");
			hasAnalysis = existsSync(join(analysisPath, "meta.json"));
		}

		return {
			fullName: entry.fullName,
			qualifiedName: entry.qualifiedName,
			localPath: entry.localPath,
			hasAnalysis,
			hasSkill: entry.hasSkill,
		};
	});
}

async function cloneAndAnalyze(
	repoInput: string,
): Promise<{ success: boolean; message: string; path?: string }> {
	try {
		const source = parseRepoInput(repoInput);

		if (source.type !== "remote") {
			return {
				success: false,
				message: "Only remote repositories can be cloned",
			};
		}

		const config = loadConfig();

		const repoPath = await cloneRepo(source, {
			shallow: true,
			config,
		});

		const result = await runAnalysisPipeline(repoPath, {});

		const { skill: mergedSkill, graph, architectureGraph } = result;
		const skill = mergedSkill.skill;
		const { entities, prose } = mergedSkill;

		const commitSha = getCommitSha(repoPath);
		const analyzedAt = new Date().toISOString();
		const generated = analyzedAt.split("T")[0];

		const analysisPath = getAnalysisPath(source.fullName, source.provider);
		mkdirSync(analysisPath, { recursive: true });

		const summaryMd = formatSummaryMd(prose, { repoName: source.fullName });
		writeFileSync(join(analysisPath, "summary.md"), summaryMd, "utf-8");

		const architectureMd = formatArchitectureMd(architectureGraph, entities, graph);
		writeFileSync(join(analysisPath, "architecture.md"), architectureMd, "utf-8");

		writeFileSync(join(analysisPath, "skill.json"), JSON.stringify(skill), "utf-8");

		const skillMd = formatSkillMd(skill, { commitSha, generated });
		writeFileSync(join(analysisPath, "SKILL.md"), skillMd, "utf-8");

		const meta = { analyzedAt, commitSha, version: "0.1.0" };
		writeFileSync(join(analysisPath, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

		installSkillWithReferences(source.fullName, {
			skillContent: skillMd,
			summaryContent: summaryMd,
			architectureContent: architectureMd,
		});

		return {
			success: true,
			message: `Cloned and analyzed ${source.fullName}`,
			path: repoPath,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			message: `Failed to clone: ${message}`,
		};
	}
}

/**
 * Offworld tool for OpenCode
 * Provides access to cloned repo data and analysis
 */
const offworldTool = tool({
	description:
		"Access Offworld repository analyses. Use mode='list' to see cloned repos, " +
		"mode='summary' with repo param for project summary, " +
		"mode='architecture' with repo param for architecture details, " +
		"mode='clone' with repo param to clone and analyze a new repo.",
	args: {
		mode: tool.schema.enum(["list", "summary", "architecture", "clone"]),
		repo: tool.schema.string().optional(),
	},
	async execute(args: ToolArgs): Promise<string> {
		const { mode, repo } = args;

		switch (mode) {
			case "list": {
				const repos = listRepos();
				if (repos.length === 0) {
					return "No repositories cloned. Use mode='clone' with a repo to get started.";
				}
				const list = repos
					.map(
						(r) =>
							`- ${r.fullName}${r.hasAnalysis ? " [analyzed]" : ""}${r.hasSkill ? " [skill]" : ""}`,
					)
					.join("\n");
				return `Cloned repositories:\n${list}`;
			}

			case "summary": {
				if (!repo) {
					return "Error: 'repo' parameter required for summary mode. Use format 'owner/repo'.";
				}
				// Parse to get provider
				let provider: "github" | "gitlab" | "bitbucket" = "github";
				let fullName: string = repo;
				if (repo.includes(":")) {
					const [p, name] = repo.split(":");
					provider = p as "github" | "gitlab" | "bitbucket";
					fullName = name ?? repo;
				}
				const summary = loadSummary(fullName, provider);
				if (!summary) {
					return `No summary found for ${repo}. Run 'ow pull ${repo}' to generate analysis.`;
				}
				return summary;
			}

			case "architecture": {
				if (!repo) {
					return "Error: 'repo' parameter required for architecture mode. Use format 'owner/repo'.";
				}
				// Parse to get provider
				let provider: "github" | "gitlab" | "bitbucket" = "github";
				let fullName: string = repo;
				if (repo.includes(":")) {
					const [p, name] = repo.split(":");
					provider = p as "github" | "gitlab" | "bitbucket";
					fullName = name ?? repo;
				}
				const arch = loadArchitecture(fullName, provider);
				if (!arch) {
					return `No architecture found for ${repo}. Run 'ow pull ${repo}' to generate analysis.`;
				}
				return JSON.stringify(arch, null, 2);
			}

			case "clone": {
				if (!repo) {
					return "Error: 'repo' parameter required for clone mode. Use format 'owner/repo' or GitHub URL.";
				}
				const result = await cloneAndAnalyze(repo);
				return result.message;
			}

			default:
				return `Unknown mode: ${mode}. Use one of: list, summary, architecture, clone`;
		}
	},
});

// ============================================================================
// Context Injection
// ============================================================================

/**
 * Generate context injection for system prompt
 * Lists available Offworld repos for the AI to reference
 */
function generateContextInjection(): string | null {
	const repos = listRepos();

	if (repos.length === 0) {
		return null;
	}

	const analyzedRepos = repos.filter((r) => r.hasAnalysis);
	if (analyzedRepos.length === 0) {
		return null;
	}

	const repoList = analyzedRepos
		.map((r) => `  - ${r.fullName}${r.hasSkill ? " (skill installed)" : ""}`)
		.join("\n");

	return `[OFFWORLD] You have access to analyses for the following repositories:
${repoList}

Use the 'offworld' tool with mode='summary' or mode='architecture' to retrieve details about these repos.`;
}

// ============================================================================
// Plugin Export
// ============================================================================

export const OffworldPlugin = (async () => {
	const injectedSessions = new Set<string>();

	return {
		tool: {
			offworld: offworldTool,
		},

		"chat.message": async (
			input: { sessionID: string },
			output: { parts: Array<{ type: string; text?: string; id?: string; synthetic?: boolean }> },
		) => {
			const isFirstMessage = !injectedSessions.has(input.sessionID);

			if (isFirstMessage) {
				injectedSessions.add(input.sessionID);
				const contextInjection = generateContextInjection();
				if (contextInjection) {
					output.parts.unshift({
						id: `offworld-context-${Date.now()}`,
						type: "text",
						text: contextInjection,
						synthetic: true,
					});
				}
			}

			const textParts = output.parts.filter(
				(p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string",
			);
			if (textParts.length === 0) return;

			const userMessage = textParts.map((p) => p.text).join("\n");
			const detectedRepos = extractGitHubRepos(userMessage);
			if (detectedRepos.length === 0) return;

			const clonedRepos = listRepos().map((r) => r.fullName.toLowerCase());
			const missingRepos = detectedRepos.filter((r) => !clonedRepos.includes(r));

			if (missingRepos.length > 0) {
				output.parts.push({
					id: `offworld-detect-${Date.now()}`,
					type: "text",
					text:
						`[OFFWORLD] Detected repositories not yet cloned: ${missingRepos.join(", ")}\n` +
						`Use the offworld tool with mode='clone' and repo='${missingRepos[0]}' to clone and analyze.`,
					synthetic: true,
				});
			}
		},
	};
}) as Plugin;

// Default export for convenience
export default OffworldPlugin;

// Re-export types for consumers
export type { Plugin } from "@opencode-ai/plugin";
export { type Config, type RepoSource, type Architecture, type Skill } from "@offworld/types";
