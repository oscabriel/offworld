export function HowItWorks() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">How it Works</h3>
			<div className="space-y-8">
				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">01</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							One Skill for All Agents
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							Install a single{" "}
							<a
								href="https://github.com/oscabriel/offworld/blob/main/skills/offworld/SKILL.md"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:underline"
							>
								<code className="text-primary font-mono text-base">SKILL.md</code>
							</a>{" "}
							file that is symlinked to all your coding agents automatically.
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">02</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Clone the Repo
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							CLI creates managed git clones on your machine that you and your agents can read at
							any time.
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-5 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">03</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Generate Reference File from Source
						</h4>
						<p className="text-muted-foreground font-serif text-lg leading-relaxed">
							Agent explores the cloned repo and creates a{" "}
							<a
								href="https://agentskills.io/specification#references/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								reference file
							</a>{" "}
							with common patterns, API details, and best practices.
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
							Ask your agent about one of your clones and watch it read the reference, search the
							code, and answer questions fast.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
