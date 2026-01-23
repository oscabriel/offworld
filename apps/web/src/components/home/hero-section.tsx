import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { InstallTabs } from "@/components/home/install-tabs";
import { Badge } from "@/components/ui/badge";

export function HeroSection() {
	const heroRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	return (
		<div
			ref={heroRef}
			className="relative flex flex-col items-center justify-center px-5 pb-13"
		>
			<div
				className={`mx-auto flex w-full max-w-4xl flex-col items-center transition-all duration-1000 ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
				}`}
				style={{ transitionDelay: "100ms" }}
			>
				<a
					href="https://docs.offworld.sh/cli"
					target="_blank"
					rel="noopener noreferrer"
					className="group border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 mb-8 inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs transition-colors"
				>
					<Badge variant="secondary" className="bg-green-500/20 text-green-500">
						NEW
					</Badge>
					<span className="text-muted-foreground">v2.0 — Offworld CLI!</span>
					<ArrowRight className="text-muted-foreground size-3 transition-transform group-hover:translate-x-0.5" />
				</a>

				<h1 className="text-primary mb-5 text-center font-serif text-5xl tracking-tight md:text-6xl lg:text-7xl">
					Create skills for any repo
				</h1>

				<p className="text-muted-foreground mb-13 max-w-xl text-center font-serif text-lg leading-relaxed">
					Generate documentation skills from any GitHub repo. Works with Claude Code, Cursor,
					OpenCode, and more.
				</p>
			</div>

			<div
				className={`mx-auto w-full max-w-2xl transition-all duration-1000 ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
				}`}
				style={{ transitionDelay: "400ms" }}
			>
				<InstallTabs />
			</div>
		</div>
	);
}
