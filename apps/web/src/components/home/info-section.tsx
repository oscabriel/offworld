export function InfoSection() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">
				What is Offworld?
			</h3>
			<div className="text-muted-foreground space-y-5 font-serif text-lg leading-relaxed">
				<p>
					Your AI coding agent doesn't understand your dependencies. It hallucinates old APIs,
					suggests deprecated patterns, or asks you to paste the docs.
				</p>
				<p>
					Offworld generates skill files from source—for any repo, on demand. One command skills
					your entire dependency tree across every agent you use.
				</p>
			</div>
		</div>
	);
}
