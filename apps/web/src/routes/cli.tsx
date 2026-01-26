import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CopyableBlock } from "@/components/ui/copyable-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/cli")({
	component: CliPage,
});

const globalOptions = [
	{ flag: "--help", short: "-h", description: "Show help message" },
	{ flag: "--version", short: "-V", description: "Show version" },
] as const;

interface CommandFlag {
	flag: string;
	description: string;
}

interface Command {
	name: string;
	description: string;
	usage: string;
	aliases?: string[];
	flags?: CommandFlag[];
}

const commands: Command[] = [
	{
		name: "project init",
		description: "Scan manifest, install references, update AGENTS.md",
		usage: "ow project init [OPTIONS]",
		flags: [
			{ flag: "--all", description: "Select all detected dependencies" },
			{ flag: "--deps", description: "Comma-separated deps to include" },
			{ flag: "--skip", description: "Comma-separated deps to exclude" },
			{ flag: "--generate, -g", description: "Generate references for deps without existing ones" },
			{ flag: "--dry-run, -d", description: "Show what would be done" },
			{ flag: "--yes, -y", description: "Skip confirmations" },
		],
	},
	{
		name: "pull",
		description: "Clone a repository and fetch or generate its reference",
		usage: "ow pull <repo> [OPTIONS]",
		flags: [
			{ flag: "--reference, -r", description: "Reference name to pull (defaults to owner-repo)" },
			{ flag: "--shallow", description: "Use shallow clone (--depth 1)" },
			{ flag: "--sparse", description: "Use sparse checkout (only src/, lib/, packages/, docs/)" },
			{ flag: "--branch", description: "Branch to clone" },
			{ flag: "--force, -f", description: "Force re-generation" },
			{ flag: "--model, -m", description: "Model override (provider/model)" },
		],
	},
	{
		name: "generate",
		description: "Generate reference locally (ignores remote)",
		usage: "ow generate <repo> [OPTIONS]",
		aliases: ["gen"],
		flags: [
			{ flag: "--force, -f", description: "Force even if remote exists" },
			{ flag: "--model, -m", description: "Model override (provider/model)" },
		],
	},
	{
		name: "push",
		description: "Push local reference to offworld.sh",
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
		description: "Remove a cloned repository and its reference",
		usage: "ow remove <repo> [OPTIONS]",
		aliases: ["rm"],
		flags: [
			{ flag: "--yes, -y", description: "Skip confirmation" },
			{ flag: "--reference-only", description: "Only remove reference files (keep repo)" },
			{ flag: "--repo-only", description: "Only remove cloned repo (keep reference)" },
			{ flag: "--dry-run, -d", description: "Show what would be done" },
		],
	},
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
	},
];

const subcommands = {
	auth: {
		description: "Authenticate with offworld.sh to push and pull shared references.",
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
} as const;

interface TocSection {
	id: string;
	label: string;
	children?: TocSection[];
}

// Helper to generate URL-friendly IDs from command names
const toCommandId = (name: string) => `cmd-${name.replace(/\s+/g, "-")}`;
const toSubcommandId = (group: string) => `sub-${group}`;

const tocSections: TocSection[] = [
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

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function CodeBlock({
	code,
	label,
	className,
}: {
	code: string;
	label?: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	const copyCode = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className={cn("bg-card border-primary/10 border", className)}>
			{label && (
				<div className="text-muted-foreground border-primary/10 border-b px-5 py-3 text-left font-mono text-xs">
					{label}
				</div>
			)}
			<button
				type="button"
				onClick={copyCode}
				className="group flex w-full cursor-pointer items-center gap-2 overflow-x-auto px-5 py-3"
			>
				<code className="text-foreground group-hover:text-muted-foreground flex items-center gap-2 font-mono text-base whitespace-nowrap transition-colors">
					<span className="select-none">$</span>
					<span>{code}</span>
				</code>
				{copied ? (
					<Check className="size-4 text-green-500" />
				) : (
					<Copy className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
				)}
			</button>
		</div>
	);
}

function OptionBadge({ children }: { children: React.ReactNode }) {
	return (
		<code className="bg-background border-primary/20 text-primary border px-2 py-1 font-mono whitespace-nowrap">
			{children}
		</code>
	);
}

const nodeInstallCommands = [
	{ id: "npm", label: "npm", command: "npm install -g offworld" },
	{ id: "bun", label: "bun", command: "bun add -g offworld" },
	{ id: "pnpm", label: "pnpm", command: "pnpm add -g offworld" },
	{ id: "yarn", label: "yarn", command: "yarn global add offworld" },
] as const;

function NodeInstallTabs() {
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState<string>("npm");

	const activeCommand = nodeInstallCommands.find((c) => c.id === activeTab)?.command ?? "";

	const copyCommand = () => {
		navigator.clipboard.writeText(activeCommand);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
			{nodeInstallCommands.map((cmd) => (
				<TabsContent
					key={cmd.id}
					value={cmd.id}
					className="border-primary/10 bg-card group border px-5 py-3"
				>
					<button
						type="button"
						onClick={copyCommand}
						className="group/cmd flex w-full cursor-pointer items-center gap-2 overflow-x-auto"
					>
						<code className="text-foreground group-hover/cmd:text-muted-foreground flex items-center gap-2 font-mono text-base whitespace-nowrap transition-colors">
							<span className="select-none">$ </span>
							{cmd.command}
						</code>
						{copied ? (
							<Check className="size-4 shrink-0 text-green-500" />
						) : (
							<Copy className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover/cmd:opacity-100" />
						)}
					</button>
				</TabsContent>
			))}

			<div className="border-primary/10 bg-card flex items-stretch border-x border-b">
				<TabsList variant="line" className="h-auto flex-1 justify-start gap-0 bg-transparent p-0">
					{nodeInstallCommands.map((cmd) => (
						<TabsTrigger
							key={cmd.id}
							value={cmd.id}
							className={cn(
								"data-active:bg-primary/5 data-active:text-primary relative h-full px-5 py-2 font-mono text-base transition-colors",
								"hover:bg-primary/5",
								"border-none after:hidden",
								"data-active:before:bg-primary data-active:before:absolute data-active:before:inset-x-0 data-active:before:top-0 data-active:before:h-px",
							)}
						>
							{cmd.label}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
		</Tabs>
	);
}

const agentInstallContent = `If you're an LLM agent helping set up Offworld CLI, follow these steps:

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
- Configure which agents to sync references to

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
- Prompt the user to select which dependencies to create references for
- Fetch or generate references for selected dependencies
- Update AGENTS.md with a table of installed references

#### Step 5: Verify setup

List the installed references:
\`\`\`bash
ow list
\`\`\`

The user should see their selected dependencies with reference files ready.

#### Troubleshooting

If references aren't appearing, check:
1. Is the config valid? \`ow config show\`
2. Are agents configured? \`ow config agents\`
3. Check reference directory: \`ls ~/.local/share/offworld/skill/offworld/references/\``;

function TableOfContents({
	activeSection,
	className,
}: {
	activeSection: string;
	className?: string;
}) {
	const renderTocItem = (section: TocSection, isChild = false) => {
		const isActive = activeSection === section.id;
		const hasActiveChild = section.children?.some((child) => activeSection === child.id);

		return (
			<div key={section.id}>
				<a
					href={section.id === "overview" ? "#" : `#${section.id}`}
					className={cn(
						"block py-1.5 font-mono transition-colors",
						isChild && "pl-3 text-sm",
						isActive || hasActiveChild
							? "text-primary"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{section.label}
				</a>
				{section.children && (
					<div className="border-primary/10 ml-1 border-l">
						{section.children.map((child) => renderTocItem(child, true))}
					</div>
				)}
			</div>
		);
	};

	return (
		<nav className={cn("space-y-1", className)}>
			<p className="text-muted-foreground mb-4 font-mono text-xs tracking-widest uppercase">
				On this page
			</p>
			{tocSections.map((section) => renderTocItem(section))}
		</nav>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function CliPage() {
	const [activeSection, setActiveSection] = useState("overview");
	const observerRef = useRef<IntersectionObserver | null>(null);

	useEffect(() => {
		const handleIntersection = (entries: IntersectionObserverEntry[]) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					setActiveSection(entry.target.id);
				}
			}
		};

		observerRef.current = new IntersectionObserver(handleIntersection, {
			rootMargin: "-20% 0px -70% 0px",
			threshold: 0,
		});

		// Collect all section IDs including nested children
		const getAllSectionIds = (sections: TocSection[]): string[] => {
			return sections.flatMap((section) => [
				section.id,
				...(section.children ? getAllSectionIds(section.children) : []),
			]);
		};

		for (const sectionId of getAllSectionIds(tocSections)) {
			const element = document.getElementById(sectionId);
			if (element) {
				observerRef.current.observe(element);
			}
		}

		return () => observerRef.current?.disconnect();
	}, []);

	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-5 pb-21 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="relative flex gap-13">
					{/* Main content */}
					<div className="min-w-0 flex-1">
						{/* Overview */}
						<section id="overview" className="space-y-5">
							<h1 className="font-serif text-6xl tracking-tight md:text-7xl">CLI</h1>
							<p className="text-muted-foreground font-mono text-lg">
								Offworld provides a CLI for creating and managing git clones and reference files.
							</p>
						</section>

						{/* Installation */}
						<section id="installation" className="pt-13">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Installation</h2>

							{/* Install Script */}
							<div id="install-script" className="scroll-mt-24 space-y-3">
								<h3 className="text-primary font-mono">Install Script</h3>
								<p className="text-muted-foreground font-mono text-sm">
									The native install script is the recommended way to get started with Offworld.
								</p>
								<CodeBlock code="curl -fsSL https://offworld.sh/install | bash" />
							</div>

							{/* Node.js */}
							<div id="install-nodejs" className="mt-13 scroll-mt-24 space-y-3">
								<h3 className="text-primary font-mono">Node.js</h3>
								<p className="text-muted-foreground font-mono text-sm">
									Using your node package manager of choice.
								</p>
								<NodeInstallTabs />
							</div>

							{/* Homebrew */}
							<div id="install-homebrew" className="mt-13 scroll-mt-24 space-y-3">
								<h3 className="text-primary font-mono">Homebrew</h3>
								<p className="text-muted-foreground font-mono text-sm">
									Using Homebrew on macOS or Linux.
								</p>
								<CodeBlock code="brew install oscabriel/tap/offworld" />
							</div>

							{/* Agent-native */}
							<div id="install-agent" className="mt-13 scroll-mt-24 space-y-3">
								<h3 className="text-primary font-mono">Agent-native</h3>
								<p className="text-muted-foreground font-mono text-sm">
									Copy this prompt to let your coding agent install, configure, and initialize
									Offworld for you.
								</p>
								<CopyableBlock
									title="Install prompt"
									content={agentInstallContent}
									maxHeight="max-h-96"
								/>
							</div>
						</section>

						{/* Quick Start */}
						<section id="quick-start" className="pt-21">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Quick Start</h2>
							<p className="text-muted-foreground mb-8 font-mono text-lg leading-relaxed">
								After installing, get started in three steps.
							</p>
							<div className="space-y-8">
								<div>
									<p className="mb-3 font-mono">
										<span className="text-muted-foreground">1.</span> Initialize in your project
									</p>
									<CodeBlock code="ow project init" />
								</div>
								<div>
									<p className="mb-3 font-mono">
										<span className="text-muted-foreground">2.</span> Pull references for any repo
									</p>
									<CodeBlock code="ow pull tanstack/router" />
								</div>
								<div>
									<p className="mb-3 font-mono">
										<span className="text-muted-foreground">3.</span> Use the reference in your
										agent
									</p>
									<CopyableBlock
										title="Example prompt"
										content="Use the tanstack-router reference. How do I set up file-based routing?"
										markdown={false}
									/>
								</div>
							</div>
						</section>

						{/* Usage */}
						<section id="usage" className="pt-21">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Usage</h2>
							<p className="text-muted-foreground mb-8 font-mono text-sm">
								The CLI accepts commands in the following format.
							</p>
							<CodeBlock code="ow [OPTIONS] COMMAND [ARGS]" />

							<div className="mt-8 space-y-5">
								<p className="text-muted-foreground font-mono text-sm">
									The primary workflow is{" "}
									<code className="text-primary bg-background border-primary/20 border px-2 py-0.5 font-mono">
										project init
									</code>
									, which scans your manifest files and generates references for your dependencies.
								</p>
								<CodeBlock code="ow project init" />
							</div>
						</section>

						{/* Commands */}
						<section id="commands" className="pt-21">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Commands</h2>
							<p className="text-muted-foreground mb-8 font-mono text-sm">
								Core commands for managing references and repositories.
							</p>

							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-primary/10 border-b">
											<th className="text-muted-foreground pr-8 pb-3 text-left font-mono text-xs tracking-widest uppercase">
												Command
											</th>
											<th className="text-muted-foreground pb-3 text-left font-mono text-xs tracking-widest uppercase">
												Description
											</th>
										</tr>
									</thead>
									<tbody>
										{commands.map((cmd) => (
											<tr key={cmd.name} className="border-primary/5 border-b">
												<td className="py-4 pr-8">
													<OptionBadge>{cmd.name}</OptionBadge>
												</td>
												<td className="text-muted-foreground py-4 font-mono text-sm">
													{cmd.description}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Expanded command details */}
							<div className="mt-13 space-y-13">
								{commands.map((cmd) => (
									<div
										key={cmd.name}
										id={toCommandId(cmd.name)}
										className="border-primary/10 scroll-mt-24 border-l-2 pl-5"
									>
										<div className="mb-3 flex items-center gap-3">
											<h3 className="font-mono text-xl">{cmd.name}</h3>
											{cmd.aliases && (
												<span className="text-muted-foreground font-mono text-sm">
													alias: {cmd.aliases.join(", ")}
												</span>
											)}
										</div>
										<p className="text-muted-foreground mb-4 font-mono text-sm">
											{cmd.description}
										</p>
										<CodeBlock code={cmd.usage} className="mb-4" />
										{cmd.flags && cmd.flags.length > 0 && (
											<div className="mt-4">
												<p className="text-muted-foreground mb-3 font-mono text-xs tracking-widest uppercase">
													Flags
												</p>
												<div className="space-y-3">
													{cmd.flags.map((flag) => (
														<div key={flag.flag} className="flex items-start gap-4">
															<code className="text-primary shrink-0 font-mono">{flag.flag}</code>
															<span className="text-muted-foreground font-mono text-sm">
																{flag.description}
															</span>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						</section>

						{/* Subcommands */}
						<section id="subcommands" className="pt-21">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Subcommands</h2>
							<p className="text-muted-foreground mb-8 font-mono text-sm">
								Additional commands organized by category.
							</p>

							<div className="mt-13 space-y-13">
								{Object.entries(subcommands).map(([group, { description, commands: cmds }]) => (
									<div
										key={group}
										id={toSubcommandId(group)}
										className="border-primary/10 scroll-mt-24 border-l-2 pl-5"
									>
										<h3 className="mb-3 font-mono text-xl">ow {group}</h3>
										<p className="text-muted-foreground mb-4 font-mono text-sm">{description}</p>
										<table className="w-full">
											<thead>
												<tr className="border-primary/10 border-b">
													<th className="text-muted-foreground pr-8 pb-3 text-left font-mono text-xs tracking-widest uppercase">
														Command
													</th>
													<th className="text-muted-foreground pb-3 text-left font-mono text-xs tracking-widest uppercase">
														Description
													</th>
												</tr>
											</thead>
											<tbody>
												{cmds.map((cmd) => (
													<tr key={cmd.name} className="border-primary/5 border-b">
														<td className="py-4 pr-8">
															<OptionBadge>{cmd.name}</OptionBadge>
														</td>
														<td className="text-muted-foreground py-4 font-mono text-sm">
															{cmd.description}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								))}
							</div>
						</section>

						{/* Global Options */}
						<section id="global-options" className="pt-21">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Global Options</h2>
							<p className="text-muted-foreground mb-8 font-mono text-sm">
								Options available for all commands.
							</p>
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-primary/10 border-b">
											<th className="text-muted-foreground pr-8 pb-3 text-left font-mono text-xs tracking-widest uppercase">
												Option
											</th>
											<th className="text-muted-foreground pr-8 pb-3 text-left font-mono text-xs tracking-widest uppercase">
												Short
											</th>
											<th className="text-muted-foreground pb-3 text-left font-mono text-xs tracking-widest uppercase">
												Description
											</th>
										</tr>
									</thead>
									<tbody>
										{globalOptions.map((opt) => (
											<tr key={opt.flag} className="border-primary/5 border-b">
												<td className="py-4 pr-8">
													<OptionBadge>{opt.flag}</OptionBadge>
												</td>
												<td className="text-muted-foreground py-4 pr-8 font-mono">{opt.short}</td>
												<td className="text-muted-foreground py-4 font-mono text-sm">
													{opt.description}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>

						{/* Footer link */}
						<div className="border-primary/10 mt-21 border-t pt-13">
							<a
								href="https://docs.offworld.sh/cli"
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground hover:text-primary group inline-flex items-center gap-2 font-mono transition-colors"
							>
								Full documentation
								<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
							</a>
						</div>
					</div>

					{/* Table of Contents - sticky sidebar */}
					<aside className="hidden w-48 shrink-0 xl:block">
						<div className="sticky top-24">
							<TableOfContents activeSection={activeSection} />
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}
