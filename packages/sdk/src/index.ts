export {
	type Config,
	type RepoSource,
	type RepoIndex,
	type RepoIndexEntry,
	type FileIndexEntry,
	type FileIndex,
	type FileRole,
} from "@offworld/types";

export {
	VERSION,
	DEFAULT_IGNORE_PATTERNS,
	SUPPORTED_LANGUAGES,
	SUPPORTED_EXTENSIONS,
	type SupportedLanguage,
} from "./constants.js";

export {
	getMetaRoot,
	getRepoRoot,
	getRepoPath,
	getAnalysisPath,
	getConfigPath,
	loadConfig,
	saveConfig,
} from "./config.js";

export {
	parseRepoInput,
	getAnalysisPathForSource,
	RepoSourceError,
	PathNotFoundError,
	NotGitRepoError,
} from "./repo-source.js";

export {
	isBinaryBuffer,
	hashBuffer,
	loadGitignorePatterns,
	loadGitignorePatternsSimple,
	type GitignorePattern,
} from "./util.js";

export {
	getIndexPath,
	getIndex,
	saveIndex,
	updateIndex,
	removeFromIndex,
	getIndexEntry,
	listIndexedRepos,
} from "./index-manager.js";

export {
	cloneRepo,
	updateRepo,
	removeRepo,
	listRepos,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	CloneError,
	RepoExistsError,
	RepoNotFoundError,
	GitError,
	type CloneOptions,
	type UpdateResult,
	type RemoveOptions,
} from "./clone.js";

export { rankFilesByHeuristics, type HeuristicsOptions } from "./analysis/heuristics.js";

export {
	streamPrompt,
	OpenCodeAnalysisError,
	OpenCodeSDKError,
	type StreamPromptOptions,
	type StreamPromptResult,
} from "./ai/index.js";

export {
	SyncError,
	NetworkError,
	AuthenticationError,
	RateLimitError,
	ConflictError,
	PushNotAllowedError,
	pullAnalysis,
	pushAnalysis,
	checkRemote,
	checkStaleness,
	fetchRepoStars,
	canPushToWeb,
	validatePushAllowed,
	type AnalysisData,
	type PullResponse,
	type CheckResponse,
	type PushResponse,
	type SyncOptions,
	type StalenessResult,
	type CanPushResult,
} from "./sync.js";

export {
	gatherContext,
	formatContextForPrompt,
	estimateTokens,
	type GatheredContext,
	type ContextOptions,
	generateSummary,
	extractArchitecture,
	generateSkill,
	generateRichSkill,
	formatArchitectureMd,
	formatSkillMd,
	runAnalysisPipeline,
	installSkill,
	type AnalysisPipelineResult,
	type AnalysisMeta,
	type AnalysisPipelineOptions,
	type GenerateOptions,
	type SkillGenerateOptions,
	type RichSkillResult,
} from "./analysis/index.js";

export {
	AuthError,
	NotLoggedInError,
	TokenExpiredError,
	getAuthPath,
	saveAuthData,
	loadAuthData,
	clearAuthData,
	getToken,
	getTokenOrNull,
	isLoggedIn,
	getAuthStatus,
	type AuthData,
	type AuthStatus,
} from "./auth.js";

export {
	validateSkillPaths,
	pathExists,
	isAnalysisStale,
	getCachedCommitSha,
	type PathValidationResult,
	type ValidatePathsOptions,
	type StalenessCheckResult,
} from "./validation/index.js";
