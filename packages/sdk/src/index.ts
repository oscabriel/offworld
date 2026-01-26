export {
	type Config,
	type RepoSource,
	type RepoIndex,
	type RepoIndexEntry,
	type FileIndexEntry,
	type FileIndex,
	type FileRole,
} from "@offworld/types";

export { VERSION, DEFAULT_IGNORE_PATTERNS } from "./constants.js";

export {
	getMetaRoot,
	getStateRoot,
	getRepoRoot,
	getRepoPath,
	getAnalysisPath,
	getSkillPath,
	getMetaPath,
	getConfigPath,
	loadConfig,
	saveConfig,
	toSkillDirName,
	toMetaDirName,
} from "./config.js";

export { expandTilde, Paths } from "./paths.js";

export {
	parseRepoInput,
	getAnalysisPathForSource,
	RepoSourceError,
	PathNotFoundError,
	NotGitRepoError,
} from "./repo-source.js";

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
	removeSkillByName,
	listRepos,
	isRepoCloned,
	getClonedRepoPath,
	getCommitSha,
	getCommitDistance,
	isShallowClone,
	unshallowRepo,
	CloneError,
	RepoExistsError,
	RepoNotFoundError,
	GitError,
	type CloneOptions,
	type UpdateOptions,
	type UpdateResult,
	type RemoveOptions,
} from "./clone.js";

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
	CommitExistsError,
	InvalidInputError,
	InvalidSkillError,
	RepoNotFoundError as SyncRepoNotFoundError,
	LowStarsError,
	PrivateRepoError,
	CommitNotFoundError,
	GitHubError,
	PushNotAllowedError,
	pullAnalysis,
	pullAnalysisByName,
	pushAnalysis,
	checkRemote,
	checkRemoteByName,
	checkStaleness,
	fetchRepoStars,
	fetchGitHubMetadata,
	canPushToWeb,
	validatePushAllowed,
	type AnalysisData,
	type PullResponse,
	type CheckResponse,
	type PushResponse,
	type StalenessResult,
	type CanPushResult,
	type GitHubRepoMetadata,
} from "./sync.js";

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
	refreshAccessToken,
	type AuthData,
	type AuthStatus,
} from "./auth.js";

export {
	generateSkillWithAI,
	installSkill,
	type GenerateSkillOptions,
	type GenerateSkillResult,
	type InstallSkillMeta,
} from "./generate.js";

export {
	agents,
	detectInstalledAgents,
	getAgentConfig,
	getAllAgentConfigs,
	type AgentConfig,
} from "./agents.js";

export {
	detectManifestType,
	parseDependencies,
	type ManifestType,
	type Dependency,
} from "./manifest.js";

export {
	KNOWN_MAPPINGS,
	resolveFromNpm,
	resolveDependencyRepo,
	type ResolvedDep,
} from "./dep-mappings.js";

export {
	matchDependenciesToSkills,
	isSkillInstalled,
	type SkillStatus,
	type SkillMatch,
} from "./skill-matcher.js";

export { updateAgentFiles, appendSkillsSection, type InstalledSkill } from "./agents-md.js";

export {
	getRepoStatus,
	updateAllRepos,
	pruneRepos,
	gcRepos,
	discoverRepos,
	type RepoStatusSummary,
	type RepoStatusOptions,
	type UpdateAllOptions,
	type UpdateAllResult,
	type PruneOptions,
	type PruneResult,
	type GcOptions,
	type GcResult,
	type DiscoverOptions,
	type DiscoverResult,
} from "./repo-manager.js";

export {
	listProviders,
	getProvider,
	listProvidersWithModels,
	validateProviderModel,
	type ProviderInfo,
	type ModelInfo,
	type ProviderWithModels,
} from "./models.js";

export {
	detectInstallMethod,
	getCurrentVersion,
	fetchLatestVersion,
	executeUpgrade,
	executeUninstall,
	getShellConfigFiles,
	cleanShellConfig,
	type InstallMethod,
} from "./installation.js";
