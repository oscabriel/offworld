// SDK exports - implementation in future PRD items
export { type Config, type RepoSource } from "@offworld/types";

// Constants (PRD 3.4)
export {
	VERSION,
	DEFAULT_IGNORE_PATTERNS,
	SUPPORTED_LANGUAGES,
	SUPPORTED_EXTENSIONS,
	type SupportedLanguage,
} from "./constants.js";

// Config utilities (PRD 3.1)
export {
	getMetaRoot,
	getRepoRoot,
	getRepoPath,
	getAnalysisPath,
	getConfigPath,
	loadConfig,
	saveConfig,
} from "./config.js";

// Repo source parsing (PRD 3.2)
export {
	parseRepoInput,
	getAnalysisPathForSource,
	RepoSourceError,
	PathNotFoundError,
	NotGitRepoError,
} from "./repo-source.js";

// Utility functions (PRD 3.5)
export {
	isBinaryBuffer,
	hashBuffer,
	loadGitignorePatterns,
	loadGitignorePatternsSimple,
	type GitignorePattern,
} from "./util.js";
