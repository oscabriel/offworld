import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function InfoSection() {
	return (
		<div className="space-y-5">
			<h3 className="text-primary font-mono text-sm tracking-[0.3em] uppercase">
				What is Offworld?
			</h3>
			<p className="text-muted-foreground font-mono text-base leading-relaxed">
				Offworld is a CLI tool that scans your project, clones your dependencies, and writes a map
				that points your agents straight to the source.
			</p>
			<div className="text-muted-foreground space-y-5 font-serif text-lg leading-relaxed">
				<p>
					<span className="text-primary mr-1.5">Agent-native</span> Built for coding agents. CLI
					commands easily used as tools to find and search local git clone directories.
				</p>
				<p>
					<span className="text-primary mr-1.5">On-demand generation</span> References created from
					latest commit. Keep them updated by running the command again.
				</p>
				<p>
					<span className="text-primary mr-1.5">Focused context</span> Use{" "}
					<code className="text-primary/90 text-base">project init</code> to add only reference
					files for your current project, rather than a pile of global ones.
				</p>
				<p>
					<span className="text-primary mr-1.5">Curated discoverability</span> Web directory
					surfaces only the reference files that the community has validated and chosen to share.
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
