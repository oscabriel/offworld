import { createFileRoute } from "@tanstack/react-router";
import { InstallTabs } from "@/components/home/install-tabs";

export const Route = createFileRoute("/cli")({
	component: CliPage,
});

function CliPage() {
	return (
		<div className="relative flex flex-1 flex-col">
			<div className="border-primary/10 border-b pb-21">
				<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="max-w-3xl space-y-5">
						<h1 className="font-serif text-5xl tracking-tight md:text-6xl">
							One command. Every dependency. Every agent.
						</h1>
						<p className="text-muted-foreground font-serif text-xl leading-relaxed">
							Scan your manifest, generate skills for your entire dependency tree, distribute to all
							your AI coding agents. No manual setup.
						</p>
					</div>
				</div>
			</div>

			<div className="border-primary/10 border-b py-21">
				<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="space-y-5">
						<h2 className="text-muted-foreground font-mono text-base tracking-[0.2em] uppercase">
							Installation
						</h2>
						<div className="max-w-2xl">
							<InstallTabs />
						</div>
					</div>
				</div>
			</div>

			<div className="border-primary/10 border-b py-21">
				<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="space-y-13">
						<h2 className="text-muted-foreground font-mono text-base tracking-[0.2em] uppercase">
							Core Commands
						</h2>

						<div className="grid gap-13 md:grid-cols-2 md:gap-21">
							<div className="space-y-5">
								<div className="border-primary/20 bg-card/50 border p-5">
									<code className="text-primary font-mono text-base">
										<span className="text-muted-foreground select-none">$ </span>
										ow project init
									</code>
								</div>
								<div className="space-y-3">
									<p className="font-serif text-lg leading-relaxed">
										The primary workflow. Scans your manifest files—package.json, pyproject.toml,
										Cargo.toml, go.mod—resolves each dependency to its GitHub repo, and generates
										skills.
									</p>
									<p className="text-muted-foreground font-serif text-base leading-relaxed">
										Skills auto-distribute to OpenCode, Claude Code, Codex, Amp, Antigravity, and
										Cursor.
									</p>
								</div>
							</div>

							<div className="space-y-8">
								<div className="space-y-3">
									<div className="border-primary/20 bg-card/50 border p-5">
										<code className="text-primary font-mono text-base">
											<span className="text-muted-foreground select-none">$ </span>
											ow pull owner/repo
										</code>
									</div>
									<p className="text-muted-foreground font-serif text-base leading-relaxed">
										Pull a skill for any GitHub repo. Useful for dependencies outside your manifest
										or for quick one-offs.
									</p>
								</div>

								<div className="space-y-3">
									<div className="border-primary/20 bg-card/50 border p-5">
										<code className="text-primary font-mono text-base">
											<span className="text-muted-foreground select-none">$ </span>
											ow list
										</code>
									</div>
									<p className="text-muted-foreground font-serif text-base leading-relaxed">
										See what skills are installed across all your agents.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="border-primary/10 border-b py-21">
				<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="space-y-13">
						<h2 className="text-muted-foreground font-mono text-base tracking-[0.2em] uppercase">
							Why Offworld
						</h2>

						<div className="grid gap-13 md:grid-cols-3">
							<div className="space-y-3">
								<h3 className="font-serif text-xl">Generated, not curated</h3>
								<p className="text-muted-foreground font-serif text-base leading-relaxed">
									Unlike tools that ship pre-made skill packs, Offworld generates skills for any
									repo via AI. No waiting for someone to add your obscure library.
								</p>
							</div>

							<div className="space-y-3">
								<h3 className="font-serif text-xl">Auto-scan dependencies</h3>
								<p className="text-muted-foreground font-serif text-base leading-relaxed">
									One command reads your manifest and processes your entire dependency tree. No
									manual listing, no maintenance.
								</p>
							</div>

							<div className="space-y-3">
								<h3 className="font-serif text-xl">Multi-agent distribution</h3>
								<p className="text-muted-foreground font-serif text-base leading-relaxed">
									Skills install once and appear in all your agents. Switch between Claude Code and
									Cursor without re-configuring.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="py-21">
				<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="border-primary/20 bg-card/50 flex flex-col items-start gap-5 border p-8 md:flex-row md:items-center md:justify-between">
						<div className="space-y-2">
							<h3 className="font-serif text-xl">Full reference</h3>
							<p className="text-muted-foreground font-serif text-base">
								All commands, flags, and configuration options.
							</p>
						</div>
						<a
							href="https://docs.offworld.sh/cli"
							target="_blank"
							rel="noopener noreferrer"
							className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 border px-8 py-3 font-mono text-sm tracking-wide transition-colors"
						>
							Read the docs
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
