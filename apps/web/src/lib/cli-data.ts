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
		description: "Clone a repository and fetch or generate its reference file",
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
		description: "Generate reference file locally (ignores remote)",
		usage: "ow generate <repo> [OPTIONS]",
		aliases: ["gen"],
		flags: [
			{ flag: "--force, -f", description: "Force even if remote exists" },
			{ flag: "--model, -m", description: "Model override (provider/model)" },
		],
	},
	{
		name: "push",
		description: "Push local reference file to offworld.sh",
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
		description: "Authenticate with offworld.sh to push and pull shared reference files.",
		commands: [
			{ name: "login", description: "Login to offworld.sh" },
			{ name: "logout", description: "Logout from offworld.sh" },
			{ name: "status", description: "Show authentication status" },
		],
	},
	config: {
		description: "Manage your Offworld configuration settings.",
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
		description: "Fast repo routing by name or keyword. Used by agents to resolve references.",
		commands: [
			{ name: "show <repo>", description: "Show map entry for a repo (path, reference, keywords)" },
			{ name: "search <term>", description: "Search map for repos matching a term or keyword" },
		],
	},
	repo: {
		description: "Manage your local repository clones and index.",
		commands: [
			{ name: "list", description: "List managed repositories" },
			{ name: "update", description: "Update repos (git fetch + pull)" },
			{ name: "prune", description: "Remove stale index entries" },
			{ name: "status", description: "Show summary of managed repos" },
			{ name: "gc", description: "Garbage collect old/unused repos" },
			{ name: "discover", description: "Discover and index existing repos" },
		],
	},
};

export const nodeInstallCommands = [
	{ id: "npm", label: "npm", command: "npm install -g offworld" },
	{ id: "bun", label: "bun", command: "bun add -g offworld" },
	{ id: "pnpm", label: "pnpm", command: "pnpm add -g offworld" },
	{ id: "yarn", label: "yarn", command: "yarn global add offworld" },
] as const;

export const agentInstallContent = `If you're an LLM agent helping set up Offworld CLI, follow these steps:

#### Step 1: Install the CLI

\`\`\`bash
curl -fsSL https://offworld.sh/install | bash
\`\`\`

Or use your preferred package manager:
\`\`\`bash
npm install -g offworld
\`\`\`

#### Step 2: Initialize Offworld

Run the interactive setup:
\`\`\`bash
ow init
\`\`\`

This will:
- Create config at \`~/.config/offworld/config.json\`
- Set up the default clone directory (\`~/ow/\`)
- Configure which agents to sync reference files to

#### Step 3: Verify the installation

\`\`\`bash
ow --version
\`\`\`

#### Step 4: Initialize in the current project

\`\`\`bash
ow project init
\`\`\`

This will:
- Scan package.json (or other manifest files) for dependencies
- Prompt the user to select which dependencies to create reference files for
- Fetch or generate reference files for selected dependencies
- Update AGENTS.md with a table of installed reference files

#### Step 5: Verify setup

List the installed reference files:
\`\`\`bash
ow list
\`\`\`

The user should see their selected dependencies with reference files ready.

#### Troubleshooting

If reference files aren't appearing, check:
1. Is the config valid? \`ow config show\`
2. Are agents configured? \`ow config agents\`
3. Check reference file directory: \`ls ~/.local/share/offworld/skill/offworld/references/\``;

// Helper to generate URL-friendly IDs from command names
export const toCommandId = (name: string) => `cmd-${name.replace(/\s+/g, "-")}`;
export const toSubcommandId = (group: string) => `sub-${group}`;

export function buildTocSections(): TocSection[] {
	return [
		{ id: "overview", label: "Overview" },
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
