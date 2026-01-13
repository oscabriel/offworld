/**
 * Analysis Pipeline
 * AST-based analysis with AI prose generation
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
	statSync,
	symlinkSync,
	lstatSync,
	unlinkSync,
	rmSync,
} from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { Skill } from "@offworld/types";
import { loadConfig } from "../config.js";
import { getCommitSha } from "../clone.js";
import { rankFilesWithAST } from "./heuristics.js";
import { initLanguages, isSupportedExtension } from "../ast/index.js";
import { parseFile, type ParsedFile } from "../ast/parser.js";
import { buildSkeleton } from "./skeleton.js";
import { generateProseWithRetry } from "./prose.js";
import { validateConsistency } from "../validation/consistency.js";
import { mergeProseIntoSkeleton, type MergedSkillResult, type MergedEntity } from "./merge.js";
import { buildDependencyGraph, type DependencyGraph } from "./imports.js";
import {
	buildArchitectureGraph,
	generateMermaidDiagram,
	type ArchitectureGraph,
} from "./architecture.js";
import { buildIncrementalState, type IncrementalState } from "./incremental.js";

// ============================================================================
// Types
// ============================================================================

/** Statistics from AST-enhanced analysis */
export interface AnalysisPipelineStats {
	filesParsed: number;
	symbolsExtracted: number;
	entitiesCreated: number;
}

export interface AnalysisPipelineResult {
	skill: MergedSkillResult;
	graph: DependencyGraph;
	architectureGraph: ArchitectureGraph;
	incrementalState: IncrementalState;
	stats: AnalysisPipelineStats;
}

/** Options for the analysis pipeline */
export interface AnalysisPipelineOptions {
	/** Progress callback for status updates */
	onProgress?: (step: string, message: string) => void;
	/** Debug callback for detailed logging */
	onDebug?: (message: string) => void;
	/** Stream callback for real-time AI output */
	onStream?: (text: string) => void;
	/** Qualified name for the repo (e.g. 'tanstack/query' for remote, 'myrepo' for local) */
	qualifiedName?: string;
	/** AI provider ID (e.g., "anthropic", "openai"). Reads from config if not specified. */
	provider?: string;
	/** AI model ID. Reads from config if not specified. */
	model?: string;
}

// ============================================================================
// Skill Installation
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
 * Convert owner/repo format to skill directory name: {owner}-{repo}-reference
 */
function toSkillDirName(repoName: string): string {
	// Handle owner/repo format
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/");
		return `${owner}-${repo}-reference`;
	}
	// Local repo or already formatted
	return `${repoName}-reference`;
}

export interface InstallSkillOptions {
	skillContent: string;
	summaryContent: string;
	architectureContent: string;
}

function ensureSymlink(target: string, linkPath: string): void {
	try {
		const stat = lstatSync(linkPath);
		if (stat.isSymbolicLink()) {
			unlinkSync(linkPath);
		} else if (stat.isDirectory()) {
			rmSync(linkPath, { recursive: true });
		} else {
			unlinkSync(linkPath);
		}
	} catch {
		// Path doesn't exist, which is fine
	}

	const linkDir = join(linkPath, "..");
	mkdirSync(linkDir, { recursive: true });
	symlinkSync(target, linkPath, "dir");
}

/**
 * Install skill with references. Primary location is ~/.ow/skills/, with symlinks
 * from OpenCode and Claude Code skill directories.
 *
 * Structure per agentskills.io spec:
 * {owner}-{repo}-reference/
 * ├── SKILL.md
 * └── references/
 *     ├── summary.md
 *     └── architecture.md
 */
export function installSkillWithReferences(repoName: string, options: InstallSkillOptions): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);

	// Primary location: ~/.ow/skills/{owner}-{repo}-reference
	const primaryDir = expandTilde(join(config.metaRoot, "skills", skillDirName));

	mkdirSync(primaryDir, { recursive: true });
	mkdirSync(join(primaryDir, "references"), { recursive: true });

	writeFileSync(join(primaryDir, "SKILL.md"), options.skillContent, "utf-8");
	writeFileSync(join(primaryDir, "references", "summary.md"), options.summaryContent, "utf-8");
	writeFileSync(
		join(primaryDir, "references", "architecture.md"),
		options.architectureContent,
		"utf-8",
	);

	// Symlink from OpenCode and Claude Code skill directories
	const openCodeSkillDir = expandTilde(join(config.skillDir, skillDirName));
	const claudeSkillDir = join(homedir(), ".claude", "skills", skillDirName);

	ensureSymlink(primaryDir, openCodeSkillDir);
	ensureSymlink(primaryDir, claudeSkillDir);
}

/**
 * @deprecated Use installSkillWithReferences instead for full skill directory structure
 */
export function installSkill(repoName: string, skillContent: string): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);

	const primaryDir = expandTilde(join(config.metaRoot, "skills", skillDirName));
	mkdirSync(primaryDir, { recursive: true });
	writeFileSync(join(primaryDir, "SKILL.md"), skillContent, "utf-8");

	const openCodeSkillDir = expandTilde(join(config.skillDir, skillDirName));
	const claudeSkillDir = join(homedir(), ".claude", "skills", skillDirName);

	ensureSymlink(primaryDir, openCodeSkillDir);
	ensureSymlink(primaryDir, claudeSkillDir);
}

export interface UpdateSkillPathsResult {
	updated: string[];
	failed: string[];
}

export interface UpdateSkillPathsOptions {
	onDebug?: (message: string) => void;
}

export function updateSkillPaths(
	newRepoRoot: string,
	newMetaRoot: string,
	options: UpdateSkillPathsOptions = {},
): UpdateSkillPathsResult {
	const { onDebug } = options;
	const config = loadConfig();
	const result: UpdateSkillPathsResult = { updated: [], failed: [] };

	const skillDirs = [
		expandTilde(config.skillDir),
		join(homedir(), ".claude", "skills"),
		join(expandTilde(config.metaRoot), "analyses"),
	];

	for (const baseDir of skillDirs) {
		if (!existsSync(baseDir)) continue;

		const skillFiles = findSkillFiles(baseDir, 0, onDebug);
		for (const filePath of skillFiles) {
			try {
				const content = readFileSync(filePath, "utf-8");
				const updated = updatePathVariables(content, newRepoRoot, newMetaRoot);
				if (updated !== content) {
					writeFileSync(filePath, updated, "utf-8");
					result.updated.push(filePath);
				}
			} catch (err) {
				onDebug?.(`Failed to update skill file ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
				result.failed.push(filePath);
			}
		}
	}

	return result;
}

function findSkillFiles(
	dir: string,
	depth = 0,
	onDebug?: (message: string) => void,
): string[] {
	if (depth > 3) return [];
	const files: string[] = [];

	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			try {
				const stat = statSync(fullPath);
				if (stat.isFile() && entry === "SKILL.md") {
					files.push(fullPath);
				} else if (stat.isDirectory() && !entry.startsWith(".")) {
					files.push(...findSkillFiles(fullPath, depth + 1, onDebug));
				}
			} catch (err) {
				onDebug?.(`Failed to stat ${fullPath}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	} catch (err) {
		onDebug?.(`Failed to read directory ${dir}: ${err instanceof Error ? err.message : String(err)}`);
	}

	return files;
}

function updatePathVariables(content: string, newRepoRoot: string, newMetaRoot: string): string {
	return content
		.replace(/^OW_REPOS:\s*.+$/m, `OW_REPOS: ${newRepoRoot}`)
		.replace(/^OW_META:\s*.+$/m, `OW_META: ${newMetaRoot}`);
}

// ============================================================================
// Skill Formatting
// ============================================================================

export interface FormatSkillOptions {
	commitSha?: string;
	generated?: string;
}

export function formatSkillMd(skill: Skill, options: FormatSkillOptions = {}): string {
	const lines = [
		"---",
		`name: ${skill.name}`,
		`description: ${skill.description}`,
		"allowed-tools: [Read, Grep, Glob]",
	];

	if (options.commitSha) {
		lines.push(`commit: ${options.commitSha.slice(0, 7)}`);
	}
	if (options.generated) {
		lines.push(`generated: ${options.generated}`);
	}

	lines.push("---", "", `# ${skill.name}`, "", skill.description, "");

	lines.push(
		"**See also:** [summary.md](references/summary.md) (overview) | [architecture.md](references/architecture.md) (structure)",
		"",
	);

	if (skill.whenToUse?.length) {
		lines.push("## When to Use", "");
		for (const trigger of skill.whenToUse) {
			lines.push(`- ${trigger}`);
		}
		lines.push("");
	}

	if (skill.bestPractices?.length) {
		lines.push("## Best Practices", "");
		skill.bestPractices.forEach((practice: string, i: number) => {
			lines.push(`${i + 1}. ${practice}`);
		});
		lines.push("");
	}

	if (skill.commonPatterns?.length) {
		lines.push("## Common Patterns", "");
		for (const pattern of skill.commonPatterns) {
			lines.push(`**${pattern.name}:**`);
			pattern.steps.forEach((step: string, i: number) => {
				lines.push(`${i + 1}. ${step}`);
			});
			lines.push("");
		}
	}

	return lines.join("\n");
}

// ============================================================================
// Summary & Architecture Formatting
// ============================================================================

export interface FormatSummaryOptions {
	repoName: string;
}

export interface SummaryProse {
	overview: string;
	problemsSolved: string;
	features: string;
	patterns: string;
	targetUseCases: string;
}

export function formatSummaryMd(prose: SummaryProse, options: FormatSummaryOptions): string {
	const lines = [
		`# ${options.repoName}`,
		"",
		prose.overview,
		"",
		"## Problems Solved",
		"",
		prose.problemsSolved,
		"",
		"## Features",
		"",
		prose.features,
		"",
		"## Patterns & Best Practices",
		"",
		prose.patterns,
		"",
		"## Target Use Cases",
		"",
		prose.targetUseCases,
		"",
	];

	return lines.join("\n");
}

export function formatArchitectureMd(
	architectureGraph: ArchitectureGraph,
	entities: MergedEntity[],
	graph: DependencyGraph,
): string {
	const lines = ["# Architecture", ""];

	lines.push("## Dependency Diagram", "");
	lines.push("```mermaid");
	lines.push(generateMermaidDiagram(architectureGraph));
	lines.push("```", "");

	const inheritanceEdges = architectureGraph.edges.filter(
		(e) => e.type === "extends" || e.type === "implements",
	);
	if (inheritanceEdges.length > 0) {
		lines.push("## Inheritance", "");
		lines.push("| Class | Relationship | Parent/Interface |");
		lines.push("|-------|--------------|------------------|");
		for (const edge of inheritanceEdges) {
			const symbol = edge.sourceSymbol ?? edge.source.split("/").pop();
			const target = edge.targetSymbol ?? edge.target.split("/").pop();
			lines.push(`| ${symbol} | ${edge.type} | ${target} |`);
		}
		lines.push("");
	}

	if (graph.hubs.length > 0) {
		lines.push("## Dependency Hubs", "");
		lines.push("Files with high connectivity (imported by many others):", "");
		for (const hub of graph.hubs.slice(0, 10)) {
			lines.push(`- \`${hub.path}\` (${hub.inDegree} imports)`);
		}
		lines.push("");
	}

	if (entities.length > 0) {
		lines.push("## Entities", "");
		lines.push("| Name | Path | Description |");
		lines.push("|------|------|-------------|");
		for (const entity of entities) {
			const desc = entity.description.replace(/\|/g, "\\|").slice(0, 80);
			lines.push(`| ${entity.name} | \`${entity.path}\` | ${desc} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// File Discovery
// ============================================================================

function discoverFiles(
	repoPath: string,
	subPath = "",
	onDebug?: (message: string) => void,
): string[] {
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
					files.push(...discoverFiles(repoPath, entryPath, onDebug));
				} else if (stat.isFile() && isSupportedExtension(entry)) {
					files.push(entryPath);
				}
			} catch (err) {
				onDebug?.(`Failed to stat ${fullEntryPath}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	} catch (err) {
		onDebug?.(`Failed to read directory ${fullPath}: ${err instanceof Error ? err.message : String(err)}`);
	}

	return files;
}

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Run the analysis pipeline with AST-based processing.
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
export async function runAnalysisPipeline(
	repoPath: string,
	options: AnalysisPipelineOptions = {},
): Promise<AnalysisPipelineResult> {
	const onProgress = options.onProgress ?? (() => {});
	const onDebug = options.onDebug;
	const config = loadConfig();

	// Step 1: Initialize language parsers
	onProgress("init", "Initializing language parsers...");
	await initLanguages();

	// Step 2: Discover all source files
	onProgress("discover", "Discovering source files...");
	const filePaths = discoverFiles(repoPath, "", onDebug);
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
		} catch (err) {
			onDebug?.(`Failed to read or parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	onDebug?.(`Parsed ${parsedFiles.size} files, extracted ${symbolsExtracted} symbols`);

	// Step 4: Rank files with AST-enhanced heuristics
	onProgress("rank", "Ranking files by importance...");
	const rankedFiles = await rankFilesWithAST(repoPath, parsedFiles);

	// Step 5: Build deterministic skeleton
	onProgress("skeleton", "Building skill skeleton...");
	const repoName = options.qualifiedName ?? basename(repoPath);
	const skeleton = buildSkeleton(repoPath, repoName, rankedFiles, parsedFiles);

	// Step 6: Generate prose with AI (with retry)
	// Use options.provider/model if provided, otherwise fall back to config.ai settings
	const aiProvider = options.provider ?? config.ai?.provider;
	const aiModel = options.model ?? config.ai?.model;
	onProgress("prose", "Generating prose with AI...");
	onDebug?.(`Using AI: ${aiProvider ?? "default"}/${aiModel ?? "default"}`);
	const proseResult = await generateProseWithRetry(skeleton, {
		provider: aiProvider,
		model: aiModel,
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
	const skill = mergeProseIntoSkeleton(skeleton, proseResult.prose, {
		qualifiedName: options.qualifiedName,
		repoRoot: config.repoRoot,
		metaRoot: config.metaRoot,
	});

	onProgress("graph", "Building dependency graph...");
	const graph = buildDependencyGraph(parsedFiles, repoPath);
	onDebug?.(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

	onProgress("architecture", "Building architecture graph...");
	const architectureGraph = buildArchitectureGraph(parsedFiles, graph);
	onDebug?.(
		`Architecture: ${architectureGraph.nodes.length} nodes, ${architectureGraph.edges.length} edges, ${architectureGraph.symbolTable.size} symbols`,
	);

	onProgress("state", "Building incremental state...");
	const commitSha = getCommitSha(repoPath);
	const incrementalState = buildIncrementalState(parsedFiles, fileContents, commitSha);

	const stats: AnalysisPipelineStats = {
		filesParsed: parsedFiles.size,
		symbolsExtracted,
		entitiesCreated: skeleton.entities.length,
	};

	onProgress("done", "Analysis complete!");

	return {
		skill,
		graph,
		architectureGraph,
		incrementalState,
		stats,
	};
}
