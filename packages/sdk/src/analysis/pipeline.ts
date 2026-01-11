/**
 * Analysis Pipeline
 * PRD 5.1-5.6: Complete analysis pipeline from repo to skill installation
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { Architecture, Config, FileIndex, Skill } from "@offworld/types";
import { getAnalysisPath, getMetaRoot, loadConfig } from "../config.js";
import { getCommitSha } from "../clone.js";
import { rankFilesByHeuristics, rankFilesWithAST } from "./heuristics.js";
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
import { initLanguages, isSupportedExtension } from "../ast/index.js";
import { parseFile, type ParsedFile } from "../ast/parser.js";
import { buildSkeleton } from "./skeleton.js";
import { generateProseWithRetry } from "./prose.js";
import { validateConsistency } from "../validation/consistency.js";
import { mergeProseIntoSkeleton, type MergedSkillResult } from "./merge.js";
import { buildDependencyGraph, type DependencyGraph } from "./imports.js";
import { buildIncrementalState, type IncrementalState } from "./incremental.js";

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

/**
 * Clean architecture data for output by stripping empty responsibilities arrays.
 * This reduces file size and noise in the JSON output.
 */
function cleanArchitectureForOutput(arch: Architecture): object {
	return {
		...arch,
		entities: arch.entities.map((entity) => {
			const { responsibilities, ...rest } = entity;
			return responsibilities?.length ? { ...rest, responsibilities } : rest;
		}),
	};
}

function saveAnalysis(
	analysisPath: string,
	result: Omit<AnalysisPipelineResult, "analysisPath">,
): void {
	mkdirSync(analysisPath, { recursive: true });

	writeFileSync(join(analysisPath, "summary.md"), result.summary, "utf-8");

	if (result.architecture) {
		// Compress JSON (no pretty-printing) and clean empty responsibilities
		const cleanedArch = cleanArchitectureForOutput(result.architecture);
		writeFileSync(join(analysisPath, "architecture.json"), JSON.stringify(cleanedArch), "utf-8");
	}

	if (result.architectureMd) {
		writeFileSync(join(analysisPath, "architecture.md"), result.architectureMd, "utf-8");
	}

	// Compress JSON (no pretty-printing) for file-index and skill
	writeFileSync(join(analysisPath, "file-index.json"), JSON.stringify(result.fileIndex), "utf-8");

	writeFileSync(join(analysisPath, "skill.json"), JSON.stringify(result.skill), "utf-8");

	writeFileSync(join(analysisPath, "SKILL.md"), result.skillMd, "utf-8");

	// Keep meta.json pretty-printed for human readability
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
			analysisPath,
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

// ============================================================================
// Enhanced Pipeline with AST Analysis
// ============================================================================

/** Statistics from AST-enhanced analysis */
export interface EnhancedPipelineStats {
	filesParsed: number;
	symbolsExtracted: number;
	entitiesCreated: number;
}

/** Result from the enhanced analysis pipeline */
export interface EnhancedPipelineResult {
	skill: MergedSkillResult;
	graph: DependencyGraph;
	incrementalState: IncrementalState;
	stats: EnhancedPipelineStats;
}

/** Options for the enhanced pipeline */
export interface EnhancedPipelineOptions {
	/** Progress callback for status updates */
	onProgress?: (step: string, message: string) => void;
	/** Debug callback for detailed logging */
	onDebug?: (message: string) => void;
	/** Stream callback for real-time AI output */
	onStream?: (text: string) => void;
}

/**
 * Recursively discover all files in a directory, respecting common ignore patterns.
 */
function discoverFiles(repoPath: string, subPath = ""): string[] {
	const fullPath = subPath ? join(repoPath, subPath) : repoPath;
	const files: string[] = [];

	const ignorePatterns = [
		"node_modules",
		".git",
		"dist",
		"build",
		".next",
		".nuxt",
		"coverage",
		"__pycache__",
		".pytest_cache",
		"target",
		".idea",
		".vscode",
	];

	try {
		const entries = readdirSync(fullPath);

		for (const entry of entries) {
			if (ignorePatterns.includes(entry)) continue;

			const entryPath = subPath ? join(subPath, entry) : entry;
			const fullEntryPath = join(repoPath, entryPath);

			try {
				const stat = statSync(fullEntryPath);

				if (stat.isDirectory()) {
					files.push(...discoverFiles(repoPath, entryPath));
				} else if (stat.isFile() && isSupportedExtension(entry)) {
					files.push(entryPath);
				}
			} catch {
				// Skip files we can't stat
			}
		}
	} catch {
		// Skip directories we can't read
	}

	return files;
}

/**
 * Run the enhanced analysis pipeline with AST-based processing.
 *
 * This pipeline integrates:
 * 1. AST parsing with multi-language support
 * 2. Enhanced file ranking with AST metrics
 * 3. Deterministic skeleton building
 * 4. AI prose generation with retry logic
 * 5. Consistency validation
 * 6. Dependency graph construction
 * 7. Incremental state tracking
 */
export async function runEnhancedPipeline(
	repoPath: string,
	options: EnhancedPipelineOptions = {},
): Promise<EnhancedPipelineResult> {
	const onProgress = options.onProgress ?? (() => {});
	const onDebug = options.onDebug;

	// Step 1: Initialize language parsers
	onProgress("init", "Initializing language parsers...");
	await initLanguages();

	// Step 2: Discover all source files
	onProgress("discover", "Discovering source files...");
	const filePaths = discoverFiles(repoPath);
	onDebug?.(`Discovered ${filePaths.length} source files`);

	// Step 3: Parse all files
	onProgress("parse", "Parsing source files...");
	const parsedFiles = new Map<string, ParsedFile>();
	const fileContents = new Map<string, string>();
	let symbolsExtracted = 0;

	for (const filePath of filePaths) {
		try {
			const fullPath = join(repoPath, filePath);
			const content = readFileSync(fullPath, "utf-8");
			fileContents.set(filePath, content);

			const parsed = parseFile(filePath, content);
			if (parsed) {
				parsedFiles.set(filePath, parsed);
				symbolsExtracted += parsed.functions.length + parsed.classes.length;
			}
		} catch {
			// Skip files we can't read or parse
		}
	}
	onDebug?.(`Parsed ${parsedFiles.size} files, extracted ${symbolsExtracted} symbols`);

	// Step 4: Rank files with AST-enhanced heuristics
	onProgress("rank", "Ranking files by importance...");
	const rankedFiles = await rankFilesWithAST(repoPath, parsedFiles);

	// Step 5: Build deterministic skeleton
	onProgress("skeleton", "Building skill skeleton...");
	const skeleton = buildSkeleton(basename(repoPath), repoPath, rankedFiles, parsedFiles);

	// Step 6: Generate prose with AI (with retry)
	onProgress("prose", "Generating prose with AI...");
	const proseResult = await generateProseWithRetry(skeleton, {
		onDebug,
		onStream: options.onStream,
	});
	onDebug?.(`Prose generation completed in ${proseResult.attempts} attempt(s)`);

	// Step 7: Validate consistency
	onProgress("validate", "Validating consistency...");
	const consistencyReport = validateConsistency(skeleton, proseResult.prose);
	if (!consistencyReport.passed) {
		onDebug?.(`Consistency warnings: ${consistencyReport.issues.map((i) => i.message).join(", ")}`);
	}

	// Step 8: Merge skeleton + prose
	onProgress("merge", "Merging skeleton and prose...");
	const skill = mergeProseIntoSkeleton(skeleton, proseResult.prose);

	// Step 9: Build dependency graph
	onProgress("graph", "Building dependency graph...");
	const graph = buildDependencyGraph(parsedFiles, repoPath);
	onDebug?.(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

	// Step 10: Build incremental state
	onProgress("state", "Building incremental state...");
	const commitSha = getCommitSha(repoPath);
	const incrementalState = buildIncrementalState(parsedFiles, fileContents, commitSha);

	// Compute stats
	const stats: EnhancedPipelineStats = {
		filesParsed: parsedFiles.size,
		symbolsExtracted,
		entitiesCreated: skeleton.entities.length,
	};

	onProgress("done", "Enhanced analysis complete!");

	return {
		skill,
		graph,
		incrementalState,
		stats,
	};
}
