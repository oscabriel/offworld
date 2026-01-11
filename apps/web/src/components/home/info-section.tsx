export function InfoSection() {
	return (
		<div className="space-y-6">
			<h3 className="font-mono text-primary text-sm uppercase tracking-[0.3em]">
				What is Offworld?
			</h3>
			<div className="space-y-4 font-serif text-foreground/80 text-lg leading-relaxed">
				<p>
					When you're blocked by an open source library, you typically have to either ask for help
					from maintainers and wait, or spend hours deciphering the project just to change a few
					lines of code.
				</p>
				<p>
					Offworld provides deep codebase analysis, architecture breakdowns, github issue summaries,
					and conversational code exploration, so you can get unblocked quickly and feel empowered
					to provide meaningful contributions to your favorite projects.
				</p>
			</div>
		</div>
	);
}
