export { rankFilesByHeuristics, type HeuristicsOptions } from "./heuristics.js";

export {
	gatherContext,
	formatContextForPrompt,
	estimateTokens,
	type GatheredContext,
	type ContextOptions,
} from "./context.js";

export {
	generateSummary,
	extractArchitecture,
	generateSummaryAndArchitecture,
	generateSkill,
	generateRichSkill,
	formatArchitectureMd,
	formatSkillMd,
	type GenerateOptions,
	type SkillGenerateOptions,
	type RichSkillResult,
	type SummaryAndArchitectureResult,
} from "./generate.js";

// Pipeline (PRD 5.1-5.6)
export {
	runAnalysisPipeline,
	installSkill,
	type AnalysisPipelineResult,
	type AnalysisMeta,
	type AnalysisPipelineOptions,
} from "./pipeline.js";

// Markdown parsers (M2.x)
export {
	extractField,
	parseListSection,
	parsePathDescSection,
	parsePathPurposeSection,
	parseArchitectureMarkdown,
	parseSkillMarkdown,
	ParseError,
} from "./parsers.js";
