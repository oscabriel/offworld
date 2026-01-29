import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { InstallTabs } from "@/components/home/install-tabs";
import { Badge } from "@/components/ui/badge";

export function HeroSection() {
	const heroRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	return (
		<div ref={heroRef} className="relative flex flex-col items-center justify-center px-5 pb-34">
			<div
				className={`mx-auto flex w-full max-w-4xl flex-col items-center transition-all duration-1000 ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
				}`}
				style={{ transitionDelay: "100ms" }}
			>
				<Link
					to="/cli"
					className="group border-primary/20 bg-background/30 hover:border-primary/40 hover:bg-background/50 mb-8 inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs backdrop-blur-sm transition-colors"
				>
					<Badge variant="secondary" className="bg-green-500/20 text-green-500">
						NEW
					</Badge>
					<span className="text-muted-foreground">Offworld CLI!</span>
					<ArrowRight className="text-muted-foreground size-3 transition-transform group-hover:translate-x-0.5" />
				</Link>

				<h1 className="text-primary mb-5 text-center font-serif text-5xl tracking-tight md:text-6xl lg:text-7xl">
					One skill for your <em>whole</em> stack
				</h1>

<p className="text-muted-foreground mb-13 max-w-xl text-center font-mono text-base md:text-xl">
	CLI tool that gives your coding agents instant, up-to-date context on any open source
	repo.
</p>
			</div>

			<div
				className={`mx-auto w-full max-w-2xl transition-all duration-1000 ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
				}`}
				style={{ transitionDelay: "400ms" }}
			>
				<InstallTabs />
				<p className="text-muted-foreground mt-5 text-center font-mono text-base italic">
					or{" "}
					<Link to="/cli" hash="install-agent" className="text-primary hover:underline">
						let your agent do it!
					</Link>
				</p>
			</div>
		</div>
	);
}
