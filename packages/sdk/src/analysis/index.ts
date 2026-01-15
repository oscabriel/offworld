export {
	rankFilesByHeuristics,
	rankFilesWithAST,
	type HeuristicsOptions,
	type ASTEnhancedFileEntry,
} from "./heuristics.js";

export {
	gatherContext,
	formatContextForPrompt,
	estimateTokens,
	type GatheredContext,
	type ContextOptions,
} from "./context.js";

export {
	runAnalysisPipeline,
	installSkillWithReferences,
	updateSkillPaths,
	formatSkillMd,
	formatSummaryMd,
	formatArchitectureMdLegacy,
	loadReadme,
	loadExamples,
	loadContributing,
	type AnalysisPipelineResult,
	type AnalysisPipelineOptions,
	type AnalysisPipelineStats,
	type FormatSkillOptions,
	type FormatSummaryOptions,
	type SummaryProse,
	type UpdateSkillPathsResult,
	type InstallSkillOptions,
} from "./pipeline.js";

export { type MergedSkillResult, type MergedEntity, type MergedKeyFile } from "./merge.js";

export {
	type EntityRelationship,
	type ProseGenerationContext,
	type SkillProse,
	type SummaryContent,
	type DevelopmentProse,
	type ContextAwareProseResult,
	type GenerateWithContextOptions,
	generateProseWithContext,
} from "./prose.js";

export {
	buildArchitectureGraph,
	generateMermaidDiagram,
	buildSymbolTable,
	buildArchitectureSection,
	formatArchitectureMd,
	type ArchitectureGraph,
	type ArchitectureEdge,
	type ArchitectureNode,
	type SymbolEntry,
	type RelationshipType,
	type ArchitectureSection,
	type EntryPoint,
	type CoreModule,
	type DependencyHub,
	type InheritanceRelation,
	type LayerGroup,
	type LayerType,
	type DirectoryNode,
	type FindingEntry,
	type MonorepoPackage,
} from "./architecture.js";

export { parseArchitectureMarkdown, parseSkillMarkdown, ParseError } from "./parsers.js";

export {
	extractAPISurface,
	formatAPISurfaceMd,
	type APISurface,
	type ImportPattern,
	type PublicExport,
	type SubpathExport,
} from "./api-surface.js";
