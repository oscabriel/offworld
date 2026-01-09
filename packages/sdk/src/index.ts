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
