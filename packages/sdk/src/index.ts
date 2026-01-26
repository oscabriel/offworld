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

// Deprecated exports for backwards compatibility (TODO: remove after US-006)
/** @deprecated */
export type RepoIndex = { version: number; repos: Record<string, any> };
/** @deprecated */
export type RepoIndexEntry = any;

export { VERSION, DEFAULT_IGNORE_PATTERNS } from "./constants.js";

export {
	getMetaRoot,
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

import { Paths as PathsImport } from "./paths.js";
export { expandTilde, Paths } from "./paths.js";

// Backward-compatible alias for US-005 migration
/** @deprecated Use Paths.state instead */
export function getStateRoot(): string {
	return PathsImport.state;
}

export {
	parseRepoInput,
	getAnalysisPathForSource,
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
	// Deprecated (TODO: remove after US-006)
	getIndex,
	saveIndex,
	updateIndex,
	removeFromIndex,
	getIndexEntry,
	listIndexedRepos,
	getIndexPath,
} from "./index-manager.js";

export {
	cloneRepo,
	updateRepo,
	removeRepo,
	removeReferenceByName,
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
	InvalidReferenceError,
	InvalidSkillError,
	RepoNotFoundError as SyncRepoNotFoundError,
	LowStarsError,
	PrivateRepoError,
	CommitNotFoundError,
	GitHubError,
	PushNotAllowedError,
	pullReference,
	pullReferenceByName,
	pushReference,
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
	type ReferenceData,
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
	generateReferenceWithAI,
	installSkill,
	installGlobalSkill,
	installReference,
	type GenerateReferenceOptions,
	type GenerateReferenceResult,
	type InstallSkillMeta,
} from "./generate.js";

// Backward-compatible alias for US-005 migration
/** @deprecated Use generateReferenceWithAI instead */
export { generateReferenceWithAI as generateSkillWithAI } from "./generate.js";

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
