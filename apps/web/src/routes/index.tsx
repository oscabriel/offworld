import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackgroundImage } from "../components/background-image";
import { Footer } from "../components/footer";
import { RepoCard } from "../components/repo/repo-card";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const [repoUrl, setRepoUrl] = useState("");
	const navigate = useNavigate();
	const repos = useQuery(api.repos.list);
	const heroRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	const handleAnalyze = () => {
		// Parse GitHub URL to extract owner/name
		const match = repoUrl.match(
			/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
		);

		if (match) {
			const [, owner, name] = match;
			navigate({ to: "/$owner/$repo", params: { owner, repo: name } });
		} else {
			// Try parsing as just "owner/repo" format
			const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);
			if (simpleMatch) {
				const [, owner, name] = simpleMatch;
				navigate({ to: "/$owner/$repo", params: { owner, repo: name } });
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleAnalyze();
		}
	};

	const completedRepos =
		repos?.filter((r) => r.indexingStatus === "completed") || [];

	return (
		<div className="relative min-h-screen overflow-x-hidden bg-background">
			<BackgroundImage />

			<div className="pointer-events-none fixed inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />

			<div
				ref={heroRef}
				className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 pt-20 pb-32"
			>
				<div
					className={`transition-all duration-1000 ${
						isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
					}`}
					style={{ transitionDelay: "100ms" }}
				>
					<img
						src="/logotype-mobile.svg"
						alt="OFFWORLD"
						className="min-w-[85vw] md:hidden"
					/>
					<img
						src="/logotype.svg"
						alt="OFFWORLD"
						className="hidden min-w-[80vw] md:block"
					/>
				</div>

				<div
					className={`mt-16 w-full max-w-3xl px-4 transition-all duration-1000 md:mt-20 ${
						isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
					}`}
					style={{ transitionDelay: "500ms" }}
				>
					<Label
						htmlFor="repo-url"
						className="mb-4 block text-center font-mono text-base text-muted-foreground uppercase tracking-[0.3em]"
					>
						A New Codebase Awaits You...
					</Label>
					<div className="flex flex-col gap-3 sm:flex-row">
						<Input
							id="repo-url"
							type="text"
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="github.com/username/repo"
							className="h-auto flex-1 rounded-none border-2 border-primary/20 bg-background/50 px-6 py-4 font-mono text-foreground text-xl backdrop-blur-sm transition-all duration-300 focus-visible:border-primary focus-visible:bg-background focus-visible:ring-0"
						/>
						<Button
							onClick={handleAnalyze}
							disabled={!repoUrl}
							size="lg"
							className="h-auto rounded-none border-2 border-primary bg-primary px-10 py-4 font-mono text-lg text-primary-foreground transition-all duration-300 hover:bg-background hover:text-primary disabled:cursor-not-allowed"
						>
							Get Started
						</Button>
					</div>
				</div>
			</div>

			{completedRepos.length > 0 && (
				<div className="relative border-primary/10 border-y bg-background/30 py-16 backdrop-blur-sm">
					<div className="container mx-auto max-w-7xl px-4">
						<div className="mb-8 flex items-baseline justify-between">
							<h2 className="font-mono text-muted-foreground text-sm uppercase tracking-[0.3em]">
								Recently Indexed
							</h2>
							<Link
								to="/explore"
								className="font-mono text-primary text-xs uppercase tracking-wider hover:underline"
							>
								View All →
							</Link>
						</div>

						<Carousel
							opts={{
								align: "start",
								loop: false,
							}}
							className="w-full"
						>
							<CarouselContent className="-ml-2 md:-ml-4">
								{completedRepos.slice(0, 10).map((repo) => (
									<CarouselItem
										key={repo._id}
										className="pl-2 md:basis-1/2 md:pl-4 lg:basis-1/3"
									>
										<RepoCard
											owner={repo.owner}
											name={repo.name}
											description={repo.description}
											language={repo.language}
											stars={repo.stars}
										/>
									</CarouselItem>
								))}
							</CarouselContent>
							<CarouselPrevious className="-left-4 md:-left-12" />
							<CarouselNext className="-right-4 md:-right-12" />
						</Carousel>
					</div>
				</div>
			)}

			<div className="relative border-primary/10 border-b py-32">
				<div className="container mx-auto max-w-5xl px-4">
					<div className="grid gap-16 md:grid-cols-2 md:gap-20">
						<div className="space-y-6">
							<h3 className="font-mono text-primary text-sm uppercase tracking-[0.3em]">
								What is Offworld?
							</h3>
							<div className="space-y-4 font-serif text-foreground/80 text-lg leading-relaxed">
								<p>
									Developers spend 60% of their time reading code. Understanding
									unfamiliar codebases is the #1 barrier to contributing to open
									source.
								</p>
								<p>
									Offworld helps you deeply understand the open source libraries
									you use, so you can fix issues yourself and contribute back to
									your communities—instead of waiting for or burdening
									maintainers.
								</p>
							</div>
						</div>

						<div className="space-y-6">
							<h3 className="font-mono text-primary text-sm uppercase tracking-[0.3em]">
								How it Works
							</h3>
							<div className="space-y-5">
								<div className="group flex gap-4 border-primary/20 border-l-2 pl-5 transition-colors hover:border-primary/40">
									<span className="font-mono text-muted-foreground text-sm">
										01
									</span>
									<div className="flex-1 space-y-1">
										<h4 className="font-mono text-foreground text-sm uppercase tracking-wide">
											Paste GitHub URL
										</h4>
										<p className="font-serif text-foreground/70 text-sm leading-relaxed">
											Analyze any public repository in minutes, not months
										</p>
									</div>
								</div>

								<div className="group flex gap-4 border-primary/20 border-l-2 pl-5 transition-colors hover:border-primary/40">
									<span className="font-mono text-muted-foreground text-sm">
										02
									</span>
									<div className="flex-1 space-y-1">
										<h4 className="font-mono text-foreground text-sm uppercase tracking-wide">
											Get Instant Understanding
										</h4>
										<p className="font-serif text-foreground/70 text-sm leading-relaxed">
											AI generates architecture summaries, explains design
											decisions, and maps contribution opportunities
										</p>
									</div>
								</div>

								<div className="group flex gap-4 border-primary/20 border-l-2 pl-5 transition-colors hover:border-primary/40">
									<span className="font-mono text-muted-foreground text-sm">
										03
									</span>
									<div className="flex-1 space-y-1">
										<h4 className="font-mono text-foreground text-sm uppercase tracking-wide">
											Fix & Contribute
										</h4>
										<p className="font-serif text-foreground/70 text-sm leading-relaxed">
											Chat with the codebase, find good first issues, and make
											your first contribution with confidence
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<Footer />
		</div>
	);
}
