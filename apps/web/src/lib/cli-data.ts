/**
 * Static data for the CLI documentation page
 */

export interface CommandFlag {
	flag: string;
	description: string;
}

export interface Command {
	name: string;
	description: string;
	usage: string;
	aliases?: string[];
	flags?: CommandFlag[];
	/** Key to look up extra content in the component */
	extraContentKey?: string;
}

export interface Subcommand {
	name: string;
	description: string;
}

export interface SubcommandGroup {
	description: string;
	commands: Subcommand[];
}

export interface TocSection {
	id: string;
	label: string;
	children?: TocSection[];
}

export const globalOptions = [
	{ flag: "--help", short: "-h", description: "Show help message" },
	{ flag: "--version", short: "-V", description: "Show version" },
] as const;

export const commands: Command[] = [
	{
		name: "init",
		description: "Initialize configuration with interactive setup",
		usage: "ow init [OPTIONS]",
		flags: [
			{ flag: "--yes, -y", description: "Skip confirmation prompts" },
			{ flag: "--force, -f", description: "Reconfigure even if config exists" },
			{ flag: "--model, -m", description: "AI provider/model" },
			{ flag: "--repo-root", description: "Where to clone repos" },
			{ flag: "--agents, -a", description: "Comma-separated agents" },
		],
		extraContentKey: "init",
	},
	{
		name: "project init",
		description: "Scan manifest, install reference files, update AGENTS.md",
		usage: "ow project init [OPTIONS]",
		flags: [
			{ flag: "--all", description: "Select all detected dependencies" },
			{ flag: "--deps", description: "Comma-separated deps to include" },
			{ flag: "--skip", description: "Comma-separated deps to exclude" },
			{
				flag: "--generate, -g",
				description: "Generate reference files for deps without existing ones",
			},
			{ flag: "--dry-run, -d", description: "Show what would be done" },
			{ flag: "--yes, -y", description: "Skip confirmations" },
		],
	},
	{
		name: "pull",
		description:
			"Git pull a repository and fetch a reference from offworld.sh or generate one locally",
		usage: "ow pull <repo> [OPTIONS]",
		flags: [
			{ flag: "--reference, -r", description: "Reference file name (defaults to owner-repo)" },
			{ flag: "--shallow", description: "Use shallow clone (--depth 1)" },
			{ flag: "--sparse", description: "Use sparse checkout (only src/, lib/, packages/, docs/)" },
			{ flag: "--branch", description: "Branch to clone" },
			{ flag: "--force, -f", description: "Force re-generation" },
			{ flag: "--model, -m", description: "Model override (provider/model)" },
		],
	},
	{
		name: "generate",
		description:
			"Generate reference file locally, if you want to always ignore the remote references",
		usage: "ow generate <repo> [OPTIONS]",
		aliases: ["gen"],
		flags: [
			{ flag: "--force, -f", description: "Force even if remote exists" },
			{ flag: "--model, -m", description: "Model override (provider/model)" },
		],
	},
	{
		name: "push",
		description:
			"Push local reference file to offworld.sh, making it available for all users to pull",
		usage: "ow push <repo>",
	},
	{
		name: "list",
		description: "List managed repositories",
		usage: "ow list [OPTIONS]",
		aliases: ["ls"],
		flags: [
			{ flag: "--json", description: "Output as JSON" },
			{ flag: "--paths", description: "Show full paths" },
			{ flag: "--stale", description: "Only show stale repos" },
			{ flag: "--pattern", description: "Filter by pattern (e.g. 'react-*')" },
		],
	},
	{
		name: "remove",
		description: "Remove a cloned repository and its reference file",
		usage: "ow remove <repo> [OPTIONS]",
		aliases: ["rm"],
		flags: [
			{ flag: "--yes, -y", description: "Skip confirmation" },
			{ flag: "--reference-only", description: "Only remove reference files (keep repo)" },
			{ flag: "--repo-only", description: "Only remove cloned repo (keep reference file)" },
			{ flag: "--dry-run, -d", description: "Show what would be done" },
		],
	},
	{
		name: "upgrade",
		description: "Upgrade offworld to latest or specific version",
		usage: "ow upgrade [VERSION]",
	},
	{
		name: "uninstall",
		description: "Uninstall offworld and remove related files",
		usage: "ow uninstall [OPTIONS]",
		flags: [
			{ flag: "--keep-config", description: "Keep configuration files" },
			{ flag: "--keep-data", description: "Keep data files (references, repos)" },
			{ flag: "--dry-run, -d", description: "Show what would be removed" },
			{ flag: "--force, -f", description: "Skip confirmation" },
		],
	},
];

export const subcommands: Record<string, SubcommandGroup> = {
	auth: {
		description: "Authenticate with offworld.sh to push and pull shared reference files",
		commands: [
			{ name: "login", description: "Login to offworld.sh" },
			{ name: "logout", description: "Logout from offworld.sh" },
			{ name: "status", description: "Show authentication status" },
		],
	},
	config: {
		description: "Manage your Offworld configuration settings",
		commands: [
			{ name: "show", description: "Show all config settings" },
			{ name: "set", description: "Set a config value" },
			{ name: "get", description: "Get a config value" },
			{ name: "reset", description: "Reset config to defaults" },
			{ name: "path", description: "Show config file location" },
			{ name: "agents", description: "Interactively select agents" },
		],
	},
	map: {
		description: "Fast repo routing by name or keyword. Used by agents to resolve references",
		commands: [
			{ name: "show <repo>", description: "Show map entry for a repo (path, reference, keywords)" },
			{ name: "search <term>", description: "Search map for repos matching a term or keyword" },
		],
	},
	repo: {
		description: "Manage your local repository clones and map",
		commands: [
			{ name: "list", description: "List managed repositories" },
			{ name: "update", description: "Update repos (git fetch + pull)" },
			{ name: "prune", description: "Remove stale map entries" },
			{ name: "status", description: "Show summary of managed repos" },
			{ name: "gc", description: "Garbage collect old/unused repos" },
			{ name: "discover", description: "Discover and map existing repos" },
		],
	},
};

export const nodeInstallCommands = [
	{ id: "npm", label: "npm", command: "npm install -g offworld" },
	{ id: "bun", label: "bun", command: "bun add -g offworld" },
	{ id: "pnpm", label: "pnpm", command: "pnpm add -g offworld" },
	{ id: "yarn", label: "yarn", command: "yarn global add offworld" },
] as const;

export const agentInstallContent = `If you're an LLM agent helping set up Offworld CLI, ask the user for preferences first, then run non-interactive commands based on their answers.

#### Step 0: Ask for preferences (agent-guided)

Ask the user for:
- Install method (install script vs package manager)
- Agents to sync (e.g. opencode, claude, codex)
- Clone directory (default \`~/ow\`)
- Model preference (provider/model) or use defaults
- Dependency selection (all vs a curated list)

Use their answers to fill flags in the commands below. Avoid running interactive CLI flows.

#### Step 1: Check for opencode

opencode is required for local AI reference generation. Verify it's installed:

\`\`\`bash
opencode --version
\`\`\`

If not installed:
\`\`\`bash
curl -fsSL https://opencode.ai/install | bash
\`\`\`

#### Step 2: Install the CLI

\`\`\`bash
curl -fsSL https://offworld.sh/install | bash
\`\`\`

Or use your preferred package manager:
\`\`\`bash
npm install -g offworld
\`\`\`

#### Step 3: Initialize Offworld (non-interactive)

\`\`\`bash
ow init --yes --agents "<agent-list>" --repo-root "<clone-dir>" --model "<provider/model>"
\`\`\`

This will:
- Create config at \`~/.config/offworld/config.json\`
- Set the clone directory (\`~/ow/\`)
- Configure which agents to sync reference files to
- Set the default model for reference generation

#### Step 4: Verify the installation

\`\`\`bash
ow --version
ow config show
\`\`\`

#### Step 5: Initialize in the current project (non-interactive)

\`\`\`bash
ow project init --yes --all --generate
\`\`\`

This will:
- Scan package.json (or other manifest files) for dependencies
- Install reference files for selected dependencies
- Generate missing references when needed
- Update AGENTS.md with a table of installed reference files

If you want a specific set of dependencies instead of \`--all\`:
\`\`\`bash
ow project init --yes --deps "zod,typescript,vitest" --generate
\`\`\`

Or exclude specific dependencies:
\`\`\`bash
ow project init --yes --all --skip "react,react-dom" --generate
\`\`\`

#### Step 6: Verify setup

List the installed reference files:
\`\`\`bash
ow list
\`\`\`

#### Troubleshooting

If reference files are not appearing, check:
1. Is the config valid? \`ow config show\`
2. Where is the config file? \`ow config path\`
3. Check the reference directory: \`ls ~/.local/share/offworld/skill/offworld/references/\``;

// Helper to generate URL-friendly IDs from command names
export const toCommandId = (name: string) => `cmd-${name.replace(/\s+/g, "-")}`;
export const toSubcommandId = (group: string) => `sub-${group}`;

export function buildTocSections(): TocSection[] {
	return [
		{ id: "overview", label: "Overview" },
		{ id: "prerequisites", label: "Prerequisites" },
		{
			id: "installation",
			label: "Installation",
			children: [
				{ id: "install-script", label: "Install Script" },
				{ id: "install-nodejs", label: "Node.js" },
				{ id: "install-homebrew", label: "Homebrew" },
				{ id: "install-agent", label: "Agent-native" },
			],
		},
		{ id: "quick-start", label: "Quick Start" },
		{ id: "usage", label: "Usage" },
		{
			id: "commands",
			label: "Commands",
			children: commands.map((cmd) => ({
				id: toCommandId(cmd.name),
				label: cmd.name,
			})),
		},
		{
			id: "subcommands",
			label: "Subcommands",
			children: Object.keys(subcommands).map((group) => ({
				id: toSubcommandId(group),
				label: `ow ${group}`,
			})),
		},
		{ id: "global-options", label: "Global Options" },
	];
}
