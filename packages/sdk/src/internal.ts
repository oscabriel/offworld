export * from "./public.js";

export { updateAgentFiles, appendReferencesSection, type InstalledReference } from "./agents-md.js";

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
