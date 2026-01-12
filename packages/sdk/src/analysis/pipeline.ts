/**
 * Analysis Pipeline
 * AST-based analysis with AI prose generation
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
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
import { buildIncrementalState, type IncrementalState } from "./incremental.js";
import type { EntityRelationship } from "./prose.js";

// ============================================================================
// Types
// ============================================================================

/** Statistics from AST-enhanced analysis */
export interface AnalysisPipelineStats {
	filesParsed: number;
	symbolsExtracted: number;
	entitiesCreated: number;
}

/** Result from the analysis pipeline */
export interface AnalysisPipelineResult {
	skill: MergedSkillResult;
	graph: DependencyGraph;
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

export interface UpdateSkillPathsResult {
	updated: string[];
	failed: string[];
}

export function updateSkillPaths(newRepoRoot: string, newMetaRoot: string): UpdateSkillPathsResult {
	const config = loadConfig();
	const result: UpdateSkillPathsResult = { updated: [], failed: [] };

	const skillDirs = [
		expandTilde(config.skillDir),
		join(homedir(), ".claude", "skills"),
		join(expandTilde(config.metaRoot), "analyses"),
	];

	for (const baseDir of skillDirs) {
		if (!existsSync(baseDir)) continue;

		const skillFiles = findSkillFiles(baseDir);
		for (const filePath of skillFiles) {
			try {
				const content = readFileSync(filePath, "utf-8");
				const updated = updatePathVariables(content, newRepoRoot, newMetaRoot);
				if (updated !== content) {
					writeFileSync(filePath, updated, "utf-8");
					result.updated.push(filePath);
				}
			} catch {
				result.failed.push(filePath);
			}
		}
	}

	return result;
}

function findSkillFiles(dir: string, depth = 0): string[] {
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
					files.push(...findSkillFiles(fullPath, depth + 1));
				}
			} catch {}
		}
	} catch {}

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
	repoRoot?: string;
	metaRoot?: string;
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

	const repoRoot = options.repoRoot ?? "~/ow";
	const metaRoot = options.metaRoot ?? "~/.ow";
	lines.push(`OW_REPOS: ${repoRoot}`);
	lines.push(`OW_META: ${metaRoot}`);
	if (skill.basePaths) {
		lines.push(`REPO: ${skill.basePaths.repo}`);
		lines.push(`ANALYSIS: ${skill.basePaths.analysis}`);
	}
	lines.push("");

	lines.push(
		"**Further Reading:** `${ANALYSIS}/summary.md` (overview) | `${ANALYSIS}/architecture.md` (structure)",
		"",
	);

	if (skill.whenToUse?.length) {
		lines.push("## When to Use", "");
		for (const trigger of skill.whenToUse) {
			lines.push(`- ${trigger}`);
		}
		lines.push("");
	}

	lines.push("## Entry Points", "");
	const topPaths = skill.quickPaths.slice(0, 8);
	for (const qp of topPaths) {
		lines.push(`- \`${qp.path}\``);
	}
	lines.push("");

	lines.push(
		"## How to Fetch Analysis Data",
		"",
		"Use these patterns to query the analyzed codebase:",
		"",
		"**Find implementations:**",
		"```",
		`Grep(pattern="function|class|interface", path="\${REPO}/src")`,
		"```",
		"",
		"**Find dependencies:**",
		"```",
		`Read("\${ANALYSIS}/architecture.md")  # Entity relationships and dependency hubs`,
		"```",
		"",
		"**Find usage patterns:**",
		"```",
		`Grep(pattern="import.*from", path="\${REPO}")  # All imports`,
		`Glob(pattern="**/*.test.ts", path="\${REPO}")  # All tests`,
		"```",
		"",
		"**Read key files:**",
		"```",
		`Read("\${ANALYSIS}/summary.md")  # High-level overview`,
		"```",
		"",
	);

	lines.push(
		"## Integration Guide",
		"",
		"When using this library in a project:",
		"",
		"1. **Study the entry points** listed above to understand the public API",
		"2. **Check architecture.md** for entity relationships before modifying",
		"3. **Read summary.md** for project context and design decisions",
		"4. **Follow existing patterns** - grep for similar code before adding new features",
		"5. **Verify imports** - use the dependency hubs to understand coupling",
		"",
	);

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
	entities: MergedEntity[],
	relationships: EntityRelationship[],
	graph: DependencyGraph,
): string {
	const lines = ["# Architecture", ""];

	lines.push("## Entity Diagram", "");
	lines.push("```mermaid");
	lines.push("flowchart TB");

	for (const entity of entities) {
		const id = sanitizeMermaidId(entity.name);
		const label = entity.name.replace(/"/g, "'");
		lines.push(`    ${id}["${label}"]`);
	}

	for (const rel of relationships) {
		const fromId = sanitizeMermaidId(rel.from);
		const toId = sanitizeMermaidId(rel.to);
		const label = rel.type.replace(/"/g, "'");
		lines.push(`    ${fromId} -->|${label}| ${toId}`);
	}

	lines.push("```", "");

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

	if (relationships.length > 0) {
		lines.push("## Relationships", "");
		lines.push("| From | To | Type |");
		lines.push("|------|-----|------|");
		for (const rel of relationships) {
			lines.push(`| ${rel.from} | ${rel.to} | ${rel.type} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function sanitizeMermaidId(name: string): string {
	return (
		name
			.replace(/[^a-zA-Z0-9]/g, "_")
			.replace(/^_+|_+$/g, "")
			.toLowerCase() || "node"
	);
}

// ============================================================================
// File Discovery
// ============================================================================

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
	const repoName = options.qualifiedName ?? basename(repoPath);
	const skeleton = buildSkeleton(repoPath, repoName, rankedFiles, parsedFiles);

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
	const skill = mergeProseIntoSkeleton(skeleton, proseResult.prose, {
		qualifiedName: options.qualifiedName,
		repoRoot: config.repoRoot,
		metaRoot: config.metaRoot,
	});

	// Step 9: Build dependency graph
	onProgress("graph", "Building dependency graph...");
	const graph = buildDependencyGraph(parsedFiles, repoPath);
	onDebug?.(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

	// Step 10: Build incremental state
	onProgress("state", "Building incremental state...");
	const commitSha = getCommitSha(repoPath);
	const incrementalState = buildIncrementalState(parsedFiles, fileContents, commitSha);

	// Compute stats
	const stats: AnalysisPipelineStats = {
		filesParsed: parsedFiles.size,
		symbolsExtracted,
		entitiesCreated: skeleton.entities.length,
	};

	onProgress("done", "Analysis complete!");

	return {
		skill,
		graph,
		incrementalState,
		stats,
	};
}
