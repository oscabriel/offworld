/**
 * Analysis Pipeline
 * PRD 5.1-5.6: Complete analysis pipeline from repo to skill installation
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { Architecture, Config, FileIndex, Skill } from "@offworld/types";
import { getAnalysisPath, getMetaRoot, loadConfig } from "../config.js";
import { getCommitSha } from "../clone.js";
import { rankFileImportance } from "../importance/ranker.js";
import { VERSION } from "../constants.js";
import { gatherContext, type GatheredContext } from "./context.js";
import {
	generateSummary,
	extractArchitecture,
	generateSkill,
	formatArchitectureMd,
	formatSkillMd,
} from "./generate.js";

// ============================================================================
// Types
// ============================================================================

/** Analysis result with all generated artifacts */
export interface AnalysisPipelineResult {
	/** Markdown summary */
	summary: string;
	/** Architecture data */
	architecture: Architecture;
	/** Architecture markdown with Mermaid */
	architectureMd: string;
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

/** Options for the analysis pipeline */
export interface AnalysisPipelineOptions {
	/** Custom config */
	config?: Config;
	/** Provider to use for AI (github provider from repo source) */
	provider?: "github" | "gitlab" | "bitbucket";
	/** Full name of the repo (owner/repo) - for remote repos */
	fullName?: string;
	/** Progress callback for status updates */
	onProgress?: (step: string, message: string) => void;
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

/**
 * Save all analysis artifacts to the analysis directory.
 */
function saveAnalysis(
	analysisPath: string,
	result: Omit<AnalysisPipelineResult, "analysisPath">
): void {
	// Ensure directory exists
	mkdirSync(analysisPath, { recursive: true });

	// Write summary.md
	writeFileSync(join(analysisPath, "summary.md"), result.summary, "utf-8");

	// Write architecture.json
	writeFileSync(
		join(analysisPath, "architecture.json"),
		JSON.stringify(result.architecture, null, 2),
		"utf-8"
	);

	// Write architecture.md
	writeFileSync(join(analysisPath, "architecture.md"), result.architectureMd, "utf-8");

	// Write file-index.json
	writeFileSync(
		join(analysisPath, "file-index.json"),
		JSON.stringify(result.fileIndex, null, 2),
		"utf-8"
	);

	// Write skill.json
	writeFileSync(
		join(analysisPath, "skill.json"),
		JSON.stringify(result.skill, null, 2),
		"utf-8"
	);

	// Write SKILL.md
	writeFileSync(join(analysisPath, "SKILL.md"), result.skillMd, "utf-8");

	// Write meta.json
	writeFileSync(
		join(analysisPath, "meta.json"),
		JSON.stringify(result.meta, null, 2),
		"utf-8"
	);
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
	options: AnalysisPipelineOptions = {}
): Promise<AnalysisPipelineResult> {
	const config = options.config ?? loadConfig();
	const onProgress = options.onProgress ?? (() => {});

	// Determine analysis path
	let analysisPath: string;
	let repoName: string;

	if (options.fullName && options.provider) {
		// Remote repo
		analysisPath = getAnalysisPath(options.fullName, options.provider);
		repoName = options.fullName;
	} else {
		// Local repo - use path hash
		const pathHash = createHash("sha256")
			.update(repoPath)
			.digest("hex")
			.slice(0, 12);
		analysisPath = join(getMetaRoot(), "analyses", `local--${pathHash}`);
		repoName = basename(repoPath);
	}

	// Get commit SHA
	onProgress("commit", "Getting current commit...");
	const commitSha = getCommitSha(repoPath);

	// Step 1: Rank files
	onProgress("rank", "Ranking files by importance...");
	const fileIndex = await rankFileImportance(repoPath);

	// Step 2: Gather context
	onProgress("context", "Gathering repository context...");
	const context = await gatherContext(repoPath, { rankedFiles: fileIndex });

	// Step 3: Generate summary
	onProgress("summary", "Generating summary...");
	const summary = await generateSummary(context, config);

	// Step 4: Extract architecture
	onProgress("architecture", "Extracting architecture...");
	const architecture = await extractArchitecture(context, config);

	// Step 5: Format architecture markdown
	onProgress("format", "Formatting architecture diagram...");
	const architectureMd = formatArchitectureMd(architecture);

	// Step 6: Generate skill
	onProgress("skill", "Generating skill...");
	const skill = await generateSkill(context, summary, architecture, config);
	const skillMd = formatSkillMd(skill);

	// Build metadata
	const meta: AnalysisMeta = {
		analyzedAt: new Date().toISOString(),
		commitSha,
		version: VERSION,
		estimatedTokens: context.estimatedTokens,
	};

	// Build result
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

	// Step 7: Save artifacts
	onProgress("save", "Saving analysis...");
	saveAnalysis(analysisPath, result);

	// Step 8: Install skill
	onProgress("install", "Installing skill...");
	installSkill(repoName, skillMd);

	onProgress("done", "Analysis complete!");

	return result;
}
