export function HowItWorks() {
	return (
		<div className="space-y-6">
			<h3 className="font-mono text-primary text-sm uppercase tracking-[0.3em]">How it Works</h3>
			<div className="space-y-6">
				<div className="group flex gap-4 border-primary/20 border-l-2 pl-5 transition-colors hover:border-primary/40">
					<span className="font-mono text-muted-foreground text-sm">01</span>
					<div className="flex-1 space-y-1">
						<h4 className="font-mono text-foreground text-sm uppercase tracking-wide">
							Paste a Github URL
						</h4>
						<p className="font-serif text-base text-foreground/70 leading-relaxed">
							Analyze any public repository, no signup required
						</p>
					</div>
				</div>

				<div className="group flex gap-4 border-primary/20 border-l-2 pl-5 transition-colors hover:border-primary/40">
					<span className="font-mono text-muted-foreground text-sm">02</span>
					<div className="flex-1 space-y-1">
						<h4 className="font-mono text-foreground text-sm uppercase tracking-wide">
							Explore with Confidence
						</h4>
						<p className="font-serif text-base text-foreground/70 leading-relaxed">
							Study summaries, navigate architectures, and chat with the codebase to develop your
							own understanding
						</p>
					</div>
				</div>

				<div className="group flex gap-4 border-primary/20 border-l-2 pl-5 transition-colors hover:border-primary/40">
					<span className="font-mono text-muted-foreground text-sm">03</span>
					<div className="flex-1 space-y-1">
						<h4 className="font-mono text-foreground text-sm uppercase tracking-wide">
							Contribute Back
						</h4>
						<p className="font-serif text-base text-foreground/70 leading-relaxed">
							Find the root cause of your issue and submit a fix
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
