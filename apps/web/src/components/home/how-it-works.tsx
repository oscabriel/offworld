export function HowItWorks() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">How it Works</h3>
			<div className="space-y-8">
				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">01</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Pick a Repo
						</h4>
						<p className="text-muted-foreground font-serif text-base leading-relaxed">
							Paste a GitHub URL here, or run <code className="text-primary">ow project init</code>{" "}
							to hit your whole package.json
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">02</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							AI Reads the Code
						</h4>
						<p className="text-muted-foreground font-serif text-base leading-relaxed">
							We clone the repo, let an AI explore it, and produce a skill file—a cheat sheet for
							other AIs
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">03</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Install Once, Use Everywhere
						</h4>
						<p className="text-muted-foreground font-serif text-base leading-relaxed">
							The skill gets symlinked to all your AI tools. No manual setup per agent.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
