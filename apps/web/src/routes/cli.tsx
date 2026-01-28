import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { CopyableBlock } from "@/components/ui/copyable-block";
import { CodeBlock } from "@/components/cli/code-block";
import { OptionBadge } from "@/components/cli/option-badge";
import { NodeInstallTabs } from "@/components/cli/node-install-tabs";
import { TableOfContents } from "@/components/cli/table-of-contents";
import {
	globalOptions,
	commands,
	subcommands,
	agentInstallContent,
	toCommandId,
	toSubcommandId,
	buildTocSections,
	type TocSection,
} from "@/lib/cli-data";

export const Route = createFileRoute("/cli")({
	component: CliPage,
});

const initExtraContent = (
	<div className="mt-8 space-y-5">
		<p className="text-muted-foreground font-mono text-sm">
			The <code className="text-primary">init</code> command performs a complete one-time setup:
		</p>
		<ul className="text-muted-foreground list-inside list-disc space-y-2 font-mono text-sm">
			<li>Prompts to authenticate with offworld.sh (optional, for push/pull shared references)</li>
			<li>
				Configures where to clone repositories (default: <code className="text-primary">~/ow</code>)
			</li>
			<li>Selects your AI provider and model for local reference generation</li>
			<li>Detects and selects which coding agents to symlink skill directory to</li>
			<li>
				Installs the{" "}
				<a
					href="https://github.com/anomalyco/offworld/blob/main/packages/sdk/src/templates/SKILL.md"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:underline"
				>
					SKILL.md
				</a>{" "}
				directory to <code className="text-primary">~/.local/share/offworld/skill/offworld/</code>.
			</li>
		</ul>
	</div>
);

const extraContentMap: Record<string, React.ReactNode> = {
	init: initExtraContent,
};

function CliPage() {
	const [activeSection, setActiveSection] = useState("overview");
	const observerRef = useRef<IntersectionObserver | null>(null);
	const tocSections = useMemo(() => buildTocSections(), []);

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
	}, [tocSections]);

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
								Offworld provides a CLI for creating reference files and managing git clones.
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
										<span className="text-muted-foreground">2.</span> Pull reference files for any
										repo
									</p>
									<CodeBlock code="ow pull tanstack/router" />
								</div>
								<div>
									<p className="mb-3 font-mono">
										<span className="text-muted-foreground">3.</span> Use the reference file in your
										agent
									</p>
									<CopyableBlock
										title="Example prompt"
										content="Use the offworld skill. How do I set up file-based routing with tanstack/router?"
										markdown={false}
									/>
									<p className="text-muted-foreground mt-3 font-mono text-sm italic">
										The agent will read the reference, search the cloned source code, and answer
										questions fast.
									</p>
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
									, which scans your manifest files and generates reference files for your
									dependencies.
								</p>
								<CodeBlock code="ow project init" />
							</div>
						</section>

						{/* Commands */}
						<section id="commands" className="pt-21">
							<h2 className="mb-5 font-serif text-3xl tracking-tight">Commands</h2>
							<p className="text-muted-foreground mb-8 font-mono text-sm">
								Core commands for managing reference files and repositories.
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
															<code className="text-primary shrink-0 font-mono text-sm">
																{flag.flag}
															</code>
															<span className="text-muted-foreground font-mono text-sm">
																{flag.description}
															</span>
														</div>
													))}
												</div>
											</div>
										)}
										{cmd.extraContentKey && extraContentMap[cmd.extraContentKey]}
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
							<TableOfContents sections={tocSections} activeSection={activeSection} />
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}
