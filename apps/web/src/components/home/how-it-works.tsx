export function HowItWorks() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">How it Works</h3>
			<div className="space-y-8">
				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">01</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Clone the Repo
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							CLI creates easily-managed clones on your machine that you and your agents can read
							and work on at any time.
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">02</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Generate Skill from Source
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							Agent explores the codebase and creates a SKILL.md with common patterns, API
							references, and best practices.
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">03</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Symlink to All Agents
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							That one SKILL.md file is distributed to Claude Code, OpenCode, Codex, and other agent
							configs automatically.
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">04</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Query Your Clones
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							Ask your agent to load a skill and explore any cloned repo—get file summaries, search
							code, or answer questions about the source.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
