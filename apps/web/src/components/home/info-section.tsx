export function InfoSection() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">
				What is Offworld?
			</h3>
			<div className="text-muted-foreground space-y-5 font-serif text-lg leading-relaxed">
				<p>
					You add 40 npm packages. Your AI has never seen half of them. It hallucinates old APIs,
					suggests deprecated patterns, or just asks you to paste the docs.
				</p>
				<p>
					Offworld fixes that. Point it at a repo, it generates a skill file. Run it on your
					project, it skills your entire dependency tree. Works with Claude Code, Cursor, OpenCode,
					and others.
				</p>
			</div>
		</div>
	);
}
