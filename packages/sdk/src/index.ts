// SDK exports - implementation in future PRD items
export {
	type AIProvider,
	type Config,
	type RepoSource,
	type RepoIndex,
	type RepoIndexEntry,
	type FileIndexEntry,
	type FileIndex,
	type FileRole,
} from "@offworld/types";

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

// Index manager (PRD 3.6)
export {
	getIndexPath,
	getIndex,
	saveIndex,
	updateIndex,
	removeFromIndex,
	getIndexEntry,
	listIndexedRepos,
} from "./index-manager.js";

// Clone operations (PRD 3.3)
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

// Tree-sitter parser (PRD 3.7)
export {
	// Types
	type Parser,
	type Language,
	type SyntaxNode,
	type Tree,
	// Errors
	ParserError,
	ParserNotInitializedError,
	LanguageNotSupportedError,
	LanguageLoadError,
	// Language mapping
	getLanguage,
	isExtensionSupported,
	// Initialization
	initializeParser,
	isParserInitialized,
	loadLanguage,
	loadLanguageForExtension,
	// Parsing
	createParser,
	parse,
	parseByExtension,
	// Cleanup
	clearLanguageCache,
	resetParser,
} from "./importance/index.js";

// Import extraction (PRD 3.8)
export { type ExtractedImport, extractImports, extractModuleNames } from "./importance/index.js";

// File importance ranking (PRD 3.9)
export { type RankOptions, rankFileImportance } from "./importance/index.js";

// AI Provider detection (PRD 3.10)
export {
	// Errors
	AIProviderError,
	AIProviderNotFoundError,
	PreferredProviderNotAvailableError,
	// Detection functions
	isClaudeCodeAvailable,
	isOpenCodeAvailable,
	isProviderAvailable,
	detectProvider,
	// Utilities
	getProviderDisplayName,
	// Types
	type DetectionResult,
} from "./ai/index.js";

// Claude Code SDK wrapper (PRD 3.11)
export {
	analyzeWithClaudeCode,
	ClaudeCodeAnalysisError,
	type ClaudeCodeAnalysisOptions,
	type ClaudeCodeAnalysisResult,
} from "./ai/index.js";

// OpenCode SDK wrapper (PRD 3.12)
export {
	analyzeWithOpenCode,
	OpenCodeAnalysisError,
	OpenCodeConnectionError,
	type OpenCodeAnalysisOptions,
	type OpenCodeAnalysisResult,
} from "./ai/index.js";

// Unified AI interface (PRD 3.13)
export { runAnalysis, type AnalysisOptions, type AnalysisResult } from "./ai/index.js";

// Sync operations (PRD 3.14)
export {
	// Errors
	SyncError,
	NetworkError,
	AuthenticationError,
	RateLimitError,
	ConflictError,
	PushNotAllowedError,
	// API functions
	pullAnalysis,
	pushAnalysis,
	checkRemote,
	checkStaleness,
	// Push validation
	fetchRepoStars,
	canPushToWeb,
	validatePushAllowed,
	// Types
	type AnalysisData,
	type PullResponse,
	type CheckResponse,
	type PushResponse,
	type SyncOptions,
	type StalenessResult,
	type CanPushResult,
} from "./sync.js";

// Analysis Pipeline (PRD 5.1-5.6)
export {
	// Context gathering (PRD 5.1)
	gatherContext,
	formatContextForPrompt,
	estimateTokens,
	type GatheredContext,
	type ContextOptions,
	// Generation (PRD 5.2-5.5)
	generateSummary,
	extractArchitecture,
	generateSkill,
	formatArchitectureMd,
	formatSkillMd,
	// Pipeline (PRD 5.1-5.6)
	runAnalysisPipeline,
	installSkill,
	type AnalysisPipelineResult,
	type AnalysisMeta,
	type AnalysisPipelineOptions,
} from "./analysis/index.js";

// Authentication (PRD 4.8)
export {
	// Errors
	AuthError,
	NotLoggedInError,
	TokenExpiredError,
	// Path utilities
	getAuthPath,
	// Token storage
	saveAuthData,
	loadAuthData,
	clearAuthData,
	// Token retrieval
	getToken,
	getTokenOrNull,
	isLoggedIn,
	// Status
	getAuthStatus,
	// Types
	type AuthData,
	type AuthStatus,
} from "./auth.js";
