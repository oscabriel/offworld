/**
 * Analysis Pipeline exports
 * PRD 5.1-5.6: Complete analysis from context gathering to skill installation
 */

// Context gathering (PRD 5.1)
export {
	gatherContext,
	formatContextForPrompt,
	estimateTokens,
	type GatheredContext,
	type ContextOptions,
} from "./context.js";

// Generation functions (PRD 5.2-5.5)
export {
	generateSummary,
	extractArchitecture,
	generateSkill,
	formatArchitectureMd,
	formatSkillMd,
} from "./generate.js";

// Pipeline (PRD 5.1-5.6)
export {
	runAnalysisPipeline,
	installSkill,
	type AnalysisPipelineResult,
	type AnalysisMeta,
	type AnalysisPipelineOptions,
} from "./pipeline.js";
