export function HowItWorks() {
	return (
		<div className="space-y-6">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">How it Works</h3>
			<div className="space-y-6">
				<div className="group border-primary/20 hover:border-primary/40 flex gap-4 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">01</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Paste a Github URL
						</h4>
						<p className="text-foreground/70 font-serif text-base leading-relaxed">
							Analyze any public repository, no signup required
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-4 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">02</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Explore with Confidence
						</h4>
						<p className="text-foreground/70 font-serif text-base leading-relaxed">
							Study summaries, navigate architectures, and chat with the codebase to develop your
							own understanding
						</p>
					</div>
				</div>

				<div className="group border-primary/20 hover:border-primary/40 flex gap-4 border-l-2 pl-5 transition-colors">
					<span className="text-muted-foreground font-mono text-sm">03</span>
					<div className="flex-1 space-y-1">
						<h4 className="text-foreground font-mono text-sm tracking-wide uppercase">
							Contribute Back
						</h4>
						<p className="text-foreground/70 font-serif text-base leading-relaxed">
							Find the root cause of your issue and submit a fix
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
