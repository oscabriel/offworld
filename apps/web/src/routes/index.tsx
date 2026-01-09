import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock, Download, Star, Terminal } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const healthCheck = useQuery(convexQuery(api.healthCheck.get, {}));
	const analysesQuery = useQuery(convexQuery(api.analyses.list, { limit: 6 }));
	const analyses = analysesQuery.data ?? [];

	return (
		<div className="container mx-auto max-w-4xl px-4 py-10">
			<div className="mb-12 text-center">
				<h1 className="mb-4 text-4xl font-bold tracking-tight">Offworld</h1>
				<p className="text-muted-foreground mx-auto max-w-lg text-lg">
					Generate AI-powered skills for any repository. Make your AI coding assistant
					an expert in any codebase.
				</p>
			</div>

			<div className="mb-12 rounded-lg border bg-muted/30 p-6">
				<h2 className="mb-3 flex items-center gap-2 font-semibold">
					<Terminal className="h-5 w-5" />
					Quick Start
				</h2>
				<p className="text-muted-foreground mb-4 text-sm">
					Install the CLI and generate your first skill in seconds:
				</p>
				<div className="space-y-2 font-mono text-sm">
					<div className="bg-background rounded border p-3">
						<span className="text-muted-foreground"># Install globally</span>
						<br />
						<span className="text-green-400">$</span> npm install -g offworld
					</div>
					<div className="bg-background rounded border p-3">
						<span className="text-muted-foreground"># Or use directly with bunx/npx</span>
						<br />
						<span className="text-green-400">$</span> bunx offworld pull tanstack/router
					</div>
				</div>
			</div>

			<div className="mb-8 flex items-center justify-between">
				<h2 className="text-xl font-semibold">Popular Repositories</h2>
				<Link to="/browse">
					<Button variant="ghost" size="sm">
						Browse all
						<ArrowRight className="ml-1 h-4 w-4" />
					</Button>
				</Link>
			</div>

			{analyses.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center">
						<p className="text-muted-foreground">
							No analyses available yet. Be the first to contribute!
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2">
					{analyses.map((analysis) => (
						<RepoCard key={analysis.fullName} analysis={analysis} />
					))}
				</div>
			)}

			<div className="mt-12 grid gap-6 sm:grid-cols-3">
				<FeatureCard
					title="Generate Skills"
					description="Automatically analyze any repository and generate SKILL.md files for Claude Code and OpenCode."
				/>
				<FeatureCard
					title="Share Knowledge"
					description="Push your analyses to offworld.sh and share them with the community."
				/>
				<FeatureCard
					title="Stay Updated"
					description="Pull the latest analysis from the community or regenerate when repos update."
				/>
			</div>

			<div className="text-muted-foreground mt-12 border-t pt-6 text-center text-sm">
				<div className="flex items-center justify-center gap-2">
					<div
						className={`h-2 w-2 rounded-full ${healthCheck.data === "OK" ? "bg-green-500" : healthCheck.isLoading ? "bg-orange-400" : "bg-red-500"}`}
					/>
					<span>
						{healthCheck.isLoading
							? "Checking..."
							: healthCheck.data === "OK"
								? "Connected"
								: "Error"}
					</span>
				</div>
			</div>
		</div>
	);
}

interface AnalysisListItem {
	fullName: string;
	provider: string;
	pullCount: number;
	analyzedAt: string;
	commitSha: string;
	isVerified: boolean;
}

function RepoCard({ analysis }: { analysis: AnalysisListItem }) {
	const [owner, repo] = analysis.fullName.split("/");
	const { stars } = useGitHubStars(owner, repo);

	const formattedDate = new Date(analysis.analyzedAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	return (
		<Link to="/repo/$owner/$repo" params={{ owner, repo }}>
			<Card className="h-full transition-colors hover:bg-muted/50">
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<CardTitle className="text-base">{analysis.fullName}</CardTitle>
						{analysis.isVerified && (
							<Check className="h-4 w-4 text-green-500" />
						)}
					</div>
					<CardDescription className="flex items-center gap-3 text-xs">
						<span className="flex items-center gap-1">
							<Download className="h-3 w-3" />
							{analysis.pullCount}
						</span>
						{stars !== null && (
							<span className="flex items-center gap-1">
								<Star className="h-3 w-3 text-yellow-500" />
								{stars.toLocaleString()}
							</span>
						)}
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formattedDate}
						</span>
					</CardDescription>
				</CardHeader>
			</Card>
		</Link>
	);
}

function FeatureCard({ title, description }: { title: string; description: string }) {
	return (
		<div className="rounded-lg border p-4">
			<h3 className="mb-2 font-medium">{title}</h3>
			<p className="text-muted-foreground text-sm">{description}</p>
		</div>
	);
}

function useGitHubStars(owner: string, repo: string) {
	const [stars, setStars] = useState<number | null>(null);

	useEffect(() => {
		async function fetchStars() {
			try {
				const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
				if (response.ok) {
					const data = await response.json();
					setStars(data.stargazers_count);
				}
			} catch {
				// Silently fail
			}
		}
		fetchStars();
	}, [owner, repo]);

	return { stars };
}
