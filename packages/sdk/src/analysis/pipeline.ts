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

import { validateConsistency } from "../validation/consistency.js";
import { mergeProseIntoSkeleton, type MergedSkillResult, type MergedEntity } from "./merge.js";
import { buildDependencyGraph, type DependencyGraph } from "./imports.js";
import {
	buildArchitectureGraph,
	generateMermaidDiagram,
	buildArchitectureSection,
	formatArchitectureMd,
	type ArchitectureGraph,
	type ArchitectureSection,
} from "./architecture.js";
import { extractAPISurface, formatAPISurfaceMd, type APISurface } from "./api-surface.js";
import { generateProseWithContext, type ProseGenerationContext, type ContextAwareProseResult, type DevelopmentProse } from "./prose.js";
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
	architectureSection: ArchitectureSection;
	apiSurface: APISurface;
	architectureMd: string;
	apiSurfaceMd: string;
	proseResult: ContextAwareProseResult;
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
 * Convert owner/repo format to skill directory name.
 * Collapses owner==repo (e.g., better-auth/better-auth → better-auth-reference)
 * Examples:
 *   better-auth/better-auth → better-auth-reference
 *   tanstack/query → tanstack-query-reference
 *   zod (local) → zod-reference
 */
function toSkillDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/") as [string, string];
		if (owner === repo) {
			return `${repo}-reference`;
		}
		return `${owner}-${repo}-reference`;
	}
	return `${repoName}-reference`;
}

function toMetaDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/") as [string, string];
		if (owner === repo) {
			return repo;
		}
		return `${owner}-${repo}`;
	}
	return repoName;
}

export interface InstallSkillOptions {
	skillContent: string;
	summaryContent: string;
	architectureContent: string;
	apiReferenceContent?: string;
	developmentContent?: string;
	skillJson?: string;
	metaJson?: string;
	architectureJson?: string;
	fileIndexJson?: string;
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
 * Skill directory (agent-facing):
 * ~/.config/offworld/skills/{owner}-{repo}-reference/
 * ├── SKILL.md
 * └── references/
 *     ├── summary.md
 *     ├── architecture.md
 *     ├── api-reference.md
 *     └── development.md
 *
 * Meta directory (internal/API):
 * ~/.config/offworld/meta/{owner}-{repo}/
 * ├── skill.json
 * ├── meta.json
 * ├── architecture.json
 * └── file-index.json
 */
export function installSkillWithReferences(repoName: string, options: InstallSkillOptions): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);
	const metaDirName = toMetaDirName(repoName);

	const skillDir = expandTilde(join(config.metaRoot, "skills", skillDirName));
	const refsDir = join(skillDir, "references");
	const metaDir = expandTilde(join(config.metaRoot, "meta", metaDirName));

	mkdirSync(refsDir, { recursive: true });
	mkdirSync(metaDir, { recursive: true });

	writeFileSync(join(skillDir, "SKILL.md"), options.skillContent, "utf-8");
	writeFileSync(join(refsDir, "summary.md"), options.summaryContent, "utf-8");
	writeFileSync(join(refsDir, "architecture.md"), options.architectureContent, "utf-8");
	if (options.apiReferenceContent) {
		writeFileSync(join(refsDir, "api-reference.md"), options.apiReferenceContent, "utf-8");
	}
	if (options.developmentContent) {
		writeFileSync(join(refsDir, "development.md"), options.developmentContent, "utf-8");
	}

	if (options.skillJson) {
		writeFileSync(join(metaDir, "skill.json"), options.skillJson, "utf-8");
	}
	if (options.metaJson) {
		writeFileSync(join(metaDir, "meta.json"), options.metaJson, "utf-8");
	}
	if (options.architectureJson) {
		writeFileSync(join(metaDir, "architecture.json"), options.architectureJson, "utf-8");
	}
	if (options.fileIndexJson) {
		writeFileSync(join(metaDir, "file-index.json"), options.fileIndexJson, "utf-8");
	}

	const openCodeSkillDir = expandTilde(join(config.skillDir, skillDirName));
	const claudeSkillDir = join(homedir(), ".claude", "skills", skillDirName);

	ensureSymlink(skillDir, openCodeSkillDir);
	ensureSymlink(skillDir, claudeSkillDir);
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
		join(expandTilde(config.metaRoot), "skills"),
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
				onDebug?.(
					`Failed to update skill file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
				);
				result.failed.push(filePath);
			}
		}
	}

	return result;
}

function findSkillFiles(dir: string, depth = 0, onDebug?: (message: string) => void): string[] {
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
				onDebug?.(
					`Failed to stat ${fullPath}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	} catch (err) {
		onDebug?.(
			`Failed to read directory ${dir}: ${err instanceof Error ? err.message : String(err)}`,
		);
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
		"**See also:** [summary.md](references/summary.md) | [architecture.md](references/architecture.md) | [api-reference.md](references/api-reference.md) | [development.md](references/development.md)",
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

export interface FormatDevelopmentOptions {
	repoName: string;
}

export function formatDevelopmentMd(prose: DevelopmentProse, options: FormatDevelopmentOptions): string {
	const lines = [
		`# ${options.repoName} - Development Guide`,
		"",
		"## Getting Started",
		"",
		prose.gettingStarted,
		"",
		"## Project Structure",
		"",
		prose.projectStructure,
		"",
		"## Build & Test",
		"",
		prose.buildAndTest,
		"",
		"## Contributing Guidelines",
		"",
		prose.contributingGuidelines,
		"",
	];

	return lines.join("\n");
}

export function formatArchitectureMdLegacy(
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
// Context Loading Helpers
// ============================================================================

/**
 * Load README.md content from the repo root
 */
export function loadReadme(repoPath: string, onDebug?: (message: string) => void): string | undefined {
	const readmeNames = ["README.md", "readme.md", "Readme.md", "README", "readme"];
	for (const name of readmeNames) {
		const readmePath = join(repoPath, name);
		if (existsSync(readmePath)) {
			try {
				return readFileSync(readmePath, "utf-8");
			} catch (err) {
				onDebug?.(`Failed to read ${readmePath}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}
	return undefined;
}

/**
 * Load example code from examples/ directory or common example patterns
 */
export function loadExamples(repoPath: string, onDebug?: (message: string) => void): string | undefined {
	const exampleDirs = ["examples", "example", "demos", "demo"];
	const exampleFiles = ["example.ts", "example.js", "examples.ts", "examples.js", "usage.ts", "usage.js"];

	// Try example directories first
	for (const dir of exampleDirs) {
		const dirPath = join(repoPath, dir);
		if (existsSync(dirPath)) {
			try {
				const stat = statSync(dirPath);
				if (stat.isDirectory()) {
					const files = readdirSync(dirPath).filter(
						(f) => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".tsx") || f.endsWith(".jsx")
					);
					if (files.length > 0) {
						const examples: string[] = [];
						for (const file of files.slice(0, 5)) {
							try {
								const content = readFileSync(join(dirPath, file), "utf-8");
								examples.push(`// ${file}\n${content}`);
							} catch {
								// Skip unreadable files
							}
						}
						if (examples.length > 0) {
							return examples.join("\n\n");
						}
					}
				}
			} catch (err) {
				onDebug?.(`Failed to read ${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}

	// Try individual example files
	for (const file of exampleFiles) {
		const filePath = join(repoPath, file);
		if (existsSync(filePath)) {
			try {
				return readFileSync(filePath, "utf-8");
			} catch (err) {
				onDebug?.(`Failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}

	return undefined;
}

/**
 * Load CONTRIBUTING.md content from the repo root
 */
export function loadContributing(repoPath: string, onDebug?: (message: string) => void): string | undefined {
	const contributingNames = ["CONTRIBUTING.md", "contributing.md", "Contributing.md", "CONTRIBUTING", "contributing"];
	for (const name of contributingNames) {
		const contributingPath = join(repoPath, name);
		if (existsSync(contributingPath)) {
			try {
				return readFileSync(contributingPath, "utf-8");
			} catch (err) {
				onDebug?.(`Failed to read ${contributingPath}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}
	return undefined;
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
				onDebug?.(
					`Failed to stat ${fullEntryPath}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	} catch (err) {
		onDebug?.(
			`Failed to read directory ${fullPath}: ${err instanceof Error ? err.message : String(err)}`,
		);
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

	onProgress("init", "Initializing language parsers");
	await initLanguages();

	onProgress("discover", "Discovering source files");
	const filePaths = discoverFiles(repoPath, "", onDebug);
	onDebug?.(`Discovered ${filePaths.length} source files`);

	onProgress("parse", "Parsing source files");
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
			onDebug?.(
				`Failed to read or parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
	onDebug?.(`Parsed ${parsedFiles.size} files, extracted ${symbolsExtracted} symbols`);

	onProgress("rank", "Ranking files by importance");
	const rankedFiles = await rankFilesWithAST(repoPath, parsedFiles);

	onProgress("skeleton", "Building skill skeleton");
	const repoName = options.qualifiedName ?? basename(repoPath);
	const skeleton = buildSkeleton(repoPath, repoName, rankedFiles, parsedFiles);

	onProgress("graph", "Building dependency graph");
	const graph = buildDependencyGraph(parsedFiles, repoPath);
	onDebug?.(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

	onProgress("architecture", "Building architecture graph");
	const architectureGraph = buildArchitectureGraph(parsedFiles, graph);
	onDebug?.(
		`Architecture: ${architectureGraph.nodes.length} nodes, ${architectureGraph.edges.length} edges, ${architectureGraph.symbolTable.size} symbols`,
	);

	onProgress("architecture-section", "Building architecture section (deterministic)");
	const architectureSection = buildArchitectureSection(parsedFiles, graph, architectureGraph);
	const architectureMd = formatArchitectureMd(architectureSection);
	onDebug?.(`Architecture section: ${architectureSection.entryPoints.length} entry points, ${architectureSection.hubs.length} hubs`);

	onProgress("api-surface", "Extracting API surface (deterministic)");
	const apiSurface = extractAPISurface(repoPath, parsedFiles);
	const apiSurfaceMd = formatAPISurfaceMd(apiSurface);
	onDebug?.(`API surface: ${apiSurface.exports.length} exports, ${apiSurface.imports.length} import patterns`);

	onProgress("context", "Loading context files");
	const readme = loadReadme(repoPath, onDebug);
	const examples = loadExamples(repoPath, onDebug);
	const contributing = loadContributing(repoPath, onDebug);
	onDebug?.(`Context: readme=${!!readme}, examples=${!!examples}, contributing=${!!contributing}`);

	const proseContext: ProseGenerationContext = {
		apiSurface,
		architecture: architectureSection,
		readme,
		examples,
		contributing,
	};

	const aiProvider = options.provider ?? config.ai?.provider;
	const aiModel = options.model ?? config.ai?.model;
	onProgress("prose", "Generating prose with AI (context-aware)");
	onDebug?.(`Using AI: ${aiProvider ?? "default"}/${aiModel ?? "default"}`);
	const proseResult = await generateProseWithContext(skeleton, {
		context: proseContext,
		provider: aiProvider,
		model: aiModel,
		onDebug,
		onStream: options.onStream,
	});
	onDebug?.("Context-aware prose generation completed");

	onProgress("validate", "Validating consistency");
	const legacyProse = {
		overview: proseResult.summary.overview,
		problemsSolved: proseResult.summary.problemsSolved,
		features: proseResult.summary.features,
		patterns: "",
		targetUseCases: proseResult.summary.targetUseCases,
		summary: proseResult.summary.overview.slice(0, 100),
		whenToUse: proseResult.skill.whenToUse,
		entityDescriptions: {},
		relationships: [],
	};
	const consistencyReport = validateConsistency(skeleton, legacyProse);
	if (!consistencyReport.passed) {
		onDebug?.(`Consistency warnings: ${consistencyReport.issues.map((i) => i.message).join(", ")}`);
	}

	onProgress("merge", "Merging skeleton and prose");
	const skill = mergeProseIntoSkeleton(skeleton, legacyProse, {
		qualifiedName: options.qualifiedName,
		repoRoot: config.repoRoot,
		metaRoot: config.metaRoot,
	});

	onProgress("state", "Building incremental state");
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
		architectureSection,
		apiSurface,
		architectureMd,
		apiSurfaceMd,
		proseResult,
		incrementalState,
		stats,
	};
}
