import { ArrowRight } from "lucide-react";

export function InfoSection() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">
				What is Offworld?
			</h3>
			<p className="text-muted-foreground font-serif text-lg leading-relaxed">
				Offworld is a CLI tool that generates agent skills for any open source library, empowering
				your agents with precise context.
			</p>
			<div className="text-muted-foreground space-y-5 font-serif text-lg leading-relaxed">
				<p>
					<span className="text-primary mr-1.5">On-demand generation</span> Skills created from latest
					commit. Keep them updated by just running the command again.
				</p>
				<p>
					<span className="text-primary mr-1.5">Powered by OpenCode</span> A custom OpenCode “Analyze”
					agent is dedicated to being a fast and thorough learner and skill-writer.
				</p>
				<p>
					<span className="text-primary mr-1.5">Focused context</span> Use{" "}
					<code className="text-primary/90 text-sm">project init</code> to add only skills for your current
					project, rather than a pile of global skills.
				</p>
				<p>
					<span className="text-primary mr-1.5">Curated discoverability</span> Web directory surfaces only
					the skills that the community has validated and chosen to share.
				</p>
			</div>
			<a
				href="https://docs.offworld.sh"
				className="border-foreground text-foreground hover:bg-foreground hover:text-background inline-flex items-center gap-2 border px-5 py-3 font-mono text-sm transition-colors"
			>
				Read docs
				<ArrowRight className="h-4 w-4" />
			</a>
		</div>
	);
}
