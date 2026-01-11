/**
 * Analysis Pipeline
 * PRD 5.1-5.6: Complete analysis pipeline from repo to skill installation
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { Architecture, Config, FileIndex, Skill } from "@offworld/types";
import { getAnalysisPath, getMetaRoot, loadConfig } from "../config.js";
import { getCommitSha } from "../clone.js";
import { rankFilesByHeuristics } from "./heuristics.js";
import { VERSION } from "../constants.js";
import { gatherContext } from "./context.js";
import {
	generateSummaryAndArchitecture,
	generateSummary,
	generateRichSkill,
	formatArchitectureMd,
	formatSkillMd,
} from "./generate.js";
import { validateSkillPaths } from "../validation/paths.js";

// ============================================================================
// Types
// ============================================================================

/** Analysis result with all generated artifacts */
export interface AnalysisPipelineResult {
	/** Markdown summary */
	summary: string;
	/** Architecture data (null if includeArchitecture=false) */
	architecture: Architecture | null;
	/** Architecture markdown with Mermaid (null if includeArchitecture=false) */
	architectureMd: string | null;
	/** File index with importance ranking */
	fileIndex: FileIndex;
	/** Generated skill */
	skill: Skill;
	/** Skill markdown content */
	skillMd: string;
	/** Analysis metadata */
	meta: AnalysisMeta;
	/** Path where analysis was saved */
	analysisPath: string;
}

/** Metadata about the analysis */
export interface AnalysisMeta {
	analyzedAt: string;
	commitSha: string;
	version: string;
	estimatedTokens?: number;
	costUsd?: number;
}

/** Timing breakdown for performance analysis */
export interface PipelineTiming {
	total: number;
	steps: Record<string, number>;
}

/** Options for the analysis pipeline */
export interface AnalysisPipelineOptions {
	/** Custom config */
	config?: Config;
	/** Provider to use for AI (github provider from repo source) */
	provider?: "github" | "gitlab" | "bitbucket";
	/** Full name of the repo (owner/repo) - for remote repos */
	fullName?: string;
	/** Skip architecture generation (summary-only mode) */
	includeArchitecture?: boolean;
	/** Progress callback for status updates */
	onProgress?: (step: string, message: string) => void;
	/** Debug callback for detailed logging */
	onDebug?: (message: string) => void;
	/** Stream callback for real-time AI output */
	onStream?: (text: string) => void;
	/** Timing callback for performance breakdown */
	onTiming?: (timing: PipelineTiming) => void;
}

// ============================================================================
// Skill Installation (PRD 5.6)
// ============================================================================

/**
 * Expand ~ to user's home directory
 */
function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

/**
 * Install SKILL.md to both OpenCode and Claude Code skill directories.
 */
export function installSkill(repoName: string, skillContent: string): void {
	const config = loadConfig();

	// OpenCode skill directory (~/.config/opencode/skill/{repo})
	const openCodeSkillDir = expandTilde(join(config.skillDir, repoName));

	// Claude Code skill directory (~/.claude/skills/{repo})
	const claudeSkillDir = join(homedir(), ".claude", "skills", repoName);

	// Ensure directories exist and write SKILL.md
	for (const skillDir of [openCodeSkillDir, claudeSkillDir]) {
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf-8");
	}
}

// ============================================================================
// Analysis Saving
// ============================================================================

function saveAnalysis(
	analysisPath: string,
	result: Omit<AnalysisPipelineResult, "analysisPath">,
): void {
	mkdirSync(analysisPath, { recursive: true });

	writeFileSync(join(analysisPath, "summary.md"), result.summary, "utf-8");

	if (result.architecture) {
		writeFileSync(
			join(analysisPath, "architecture.json"),
			JSON.stringify(result.architecture, null, 2),
			"utf-8",
		);
	}

	if (result.architectureMd) {
		writeFileSync(join(analysisPath, "architecture.md"), result.architectureMd, "utf-8");
	}

	writeFileSync(
		join(analysisPath, "file-index.json"),
		JSON.stringify(result.fileIndex, null, 2),
		"utf-8",
	);

	writeFileSync(join(analysisPath, "skill.json"), JSON.stringify(result.skill, null, 2), "utf-8");

	writeFileSync(join(analysisPath, "SKILL.md"), result.skillMd, "utf-8");

	writeFileSync(join(analysisPath, "meta.json"), JSON.stringify(result.meta, null, 2), "utf-8");
}

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Run the complete analysis pipeline on a repository.
 *
 * Steps:
 * 1. Rank files by importance (PRD 3.9)
 * 2. Gather context (PRD 5.1)
 * 3. Generate summary (PRD 5.2)
 * 4. Extract architecture (PRD 5.3)
 * 5. Format architecture.md (PRD 5.4)
 * 6. Generate skill (PRD 5.5)
 * 7. Save all artifacts
 * 8. Install skill (PRD 5.6)
 *
 * @param repoPath - Absolute path to the repository
 * @param options - Pipeline options
 * @returns Complete analysis result
 */
export async function runAnalysisPipeline(
	repoPath: string,
	options: AnalysisPipelineOptions = {},
): Promise<AnalysisPipelineResult> {
	const onProgress = options.onProgress ?? (() => {});
	const includeArchitecture = options.includeArchitecture ?? true;
	const generateOptions = {
		onDebug: options.onDebug,
		onStream: options.onStream,
	};

	const timing: PipelineTiming = { total: 0, steps: {} };
	const pipelineStart = Date.now();

	function timeStep<T>(step: string, fn: () => T): T {
		const start = Date.now();
		const result = fn();
		timing.steps[step] = Date.now() - start;
		return result;
	}

	async function timeStepAsync<T>(step: string, fn: () => Promise<T>): Promise<T> {
		const start = Date.now();
		const result = await fn();
		timing.steps[step] = Date.now() - start;
		return result;
	}

	let analysisPath: string;
	let repoName: string;

	if (options.fullName && options.provider) {
		analysisPath = getAnalysisPath(options.fullName, options.provider);
		repoName = options.fullName;
	} else {
		const pathHash = createHash("sha256").update(repoPath).digest("hex").slice(0, 12);
		analysisPath = join(getMetaRoot(), "analyses", `local--${pathHash}`);
		repoName = basename(repoPath);
	}

	onProgress("commit", "Getting current commit...");
	const commitSha = timeStep("commit", () => getCommitSha(repoPath));

	onProgress("rank", "Ranking files by importance...");
	const fileIndex = await timeStepAsync("rank", () => rankFilesByHeuristics(repoPath));

	onProgress("context", "Gathering repository context...");
	const context = await timeStepAsync("context", () =>
		gatherContext(repoPath, { rankedFiles: fileIndex }),
	);

	let summary: string;
	let architecture: Architecture | null = null;
	let architectureMd: string | null = null;

	if (includeArchitecture) {
		onProgress("analyze", "Generating summary and architecture...");
		const result = await timeStepAsync("analyze", () =>
			generateSummaryAndArchitecture(context, generateOptions),
		);
		summary = result.summary;
		architecture = result.architecture;

		onProgress("format", "Formatting architecture diagram...");
		architectureMd = timeStep("format", () => formatArchitectureMd(architecture!));
	} else {
		onProgress("analyze", "Generating summary...");
		summary = await timeStepAsync("analyze", () => generateSummary(context, generateOptions));
	}

	onProgress("skill", "Generating skill...");
	const generated = new Date().toISOString().split("T")[0];
	const skillOptions = {
		...generateOptions,
		fullName: options.fullName,
		commitSha,
		generated,
		analysisPath,
	};
	const { skill: rawSkill, skillMd: rawSkillMd } = await timeStepAsync("skill", () =>
		generateRichSkill(context, summary, architecture, skillOptions),
	);

	onProgress("validate", "Validating paths...");
	const {
		validatedSkill: skill,
		removedPaths,
		removedSearchPaths,
	} = timeStep("validate", () =>
		validateSkillPaths(rawSkill, {
			basePath: repoPath,
			onWarning: (path, type) => options.onDebug?.(`Removed non-existent ${type}: ${path}`),
		}),
	);

	const pathsWereRemoved = removedPaths.length > 0 || removedSearchPaths.length > 0;
	const skillMd = pathsWereRemoved ? formatSkillMd(skill, { commitSha, generated }) : rawSkillMd;

	const meta: AnalysisMeta = {
		analyzedAt: new Date().toISOString(),
		commitSha,
		version: VERSION,
		estimatedTokens: context.estimatedTokens,
	};

	const result: AnalysisPipelineResult = {
		summary,
		architecture,
		architectureMd,
		fileIndex,
		skill,
		skillMd,
		meta,
		analysisPath,
	};

	onProgress("save", "Saving analysis...");
	timeStep("save", () => saveAnalysis(analysisPath, result));

	onProgress("install", "Installing skill...");
	timeStep("install", () => installSkill(repoName, skillMd));

	timing.total = Date.now() - pipelineStart;

	if (options.onTiming) {
		options.onTiming(timing);
	}

	onProgress("done", "Analysis complete!");

	return result;
}
