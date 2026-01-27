export {
	type Config,
	type RepoSource,
	type GlobalMap,
	type GlobalMapRepoEntry,
	type ProjectMap,
	type ProjectMapRepoEntry,
	type FileIndexEntry,
	type FileIndex,
	type FileRole,
} from "@offworld/types";

export { VERSION, DEFAULT_IGNORE_PATTERNS } from "./constants.js";

export {
	getMetaRoot,
	getRepoRoot,
	getRepoPath,
	getReferencePath,
	getMetaPath,
	getConfigPath,
	loadConfig,
	saveConfig,
	toReferenceName,
	toReferenceFileName,
	toMetaDirName,
} from "./config.js";

export { expandTilde, Paths } from "./paths.js";

export {
	parseRepoInput,
	getReferenceFileNameForSource,
	RepoSourceError,
	PathNotFoundError,
	NotGitRepoError,
} from "./repo-source.js";

export {
	readGlobalMap,
	writeGlobalMap,
	upsertGlobalMapEntry,
	removeGlobalMapEntry,
	writeProjectMap,
} from "./index-manager.js";

export {
	resolveRepoKey,
	getMapEntry,
	searchMap,
	getProjectMapPath,
	type MapEntry,
	type SearchResult,
	type GetMapEntryOptions,
	type SearchMapOptions,
} from "./map.js";

export {
	cloneRepo,
	updateRepo,
	removeRepo,
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
	InvalidReferenceError,
	RepoNotFoundError as SyncRepoNotFoundError,
	LowStarsError,
	PrivateRepoError,
	CommitNotFoundError,
	GitHubError,
	PushNotAllowedError,
	pullReference,
	pullReferenceByName,
	pushReference,
	checkRemote,
	checkRemoteByName,
	checkStaleness,
	fetchRepoStars,
	fetchGitHubMetadata,
	canPushToWeb,
	validatePushAllowed,
	type ReferenceData,
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
	generateReferenceWithAI,
	installGlobalSkill,
	installReference,
	type GenerateReferenceOptions,
	type GenerateReferenceResult,
	type InstallReferenceMeta,
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
	matchDependenciesToReferences,
	isReferenceInstalled,
	type ReferenceStatus,
	type ReferenceMatch,
} from "./reference-matcher.js";

export { updateAgentFiles, appendReferencesSection, type InstalledReference } from "./agents-md.js";

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
