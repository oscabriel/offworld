import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function InfoSection() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">
				What is Offworld?
			</h3>
			<p className="text-muted-foreground font-mono text-lg leading-relaxed">
				Offworld is a CLI tool that generates agent references for any open source library, empowering
				your agents with precise context.
			</p>
			<div className="text-muted-foreground space-y-5 font-serif text-lg leading-relaxed">
				<p>
					<span className="text-primary mr-1.5">On-demand generation</span> References created from
					latest commit. Keep them updated by just running the command again.
				</p>
				<p>
					<span className="text-primary mr-1.5">Powered by OpenCode</span> A custom OpenCode
					"Analyze" agent is dedicated to being a fast and thorough learner and reference-writer.
				</p>
				<p>
					<span className="text-primary mr-1.5">Focused context</span> Use{" "}
					<code className="text-primary/90 text-sm">project init</code> to add only references for your
					current project, rather than a pile of global references.
				</p>
				<p>
					<span className="text-primary mr-1.5">Curated discoverability</span> Web directory
					surfaces only the references that the community has validated and chosen to share.
				</p>
			</div>
			<Button
				className="text-background px-4 py-5 font-mono text-sm"
				nativeButton={false}
				render={<Link to="/cli" />}
			>
				Read more <ArrowRight className="size-4" />
			</Button>
		</div>
	);
}
