/**
 * CLI command handlers
 * Re-exports all handlers for CLI router
 */

// PRD 4.3: Pull command
export { pullHandler, installSkill, type PullOptions, type PullResult } from "./pull.js";

// PRD 4.4: Generate command
export { generateHandler, type GenerateOptions, type GenerateResult } from "./generate.js";

// PRD 4.6: List command
export { listHandler, type ListOptions, type ListResult, type RepoListItem } from "./list.js";

// PRD 4.7: Remove command
export { rmHandler, type RmOptions, type RmResult } from "./rm.js";

// PRD 4.9: Config commands
export {
	configShowHandler,
	configSetHandler,
	configGetHandler,
	configResetHandler,
	configPathHandler,
	type ConfigShowOptions,
	type ConfigShowResult,
	type ConfigSetOptions,
	type ConfigSetResult,
	type ConfigGetOptions,
	type ConfigGetResult,
	type ConfigResetResult,
	type ConfigPathResult,
} from "./config.js";

// PRD 4.8: Auth commands
export {
	authLoginHandler,
	authLogoutHandler,
	authStatusHandler,
	type AuthLoginResult,
	type AuthLogoutResult,
	type AuthStatusResult,
} from "./auth.js";
