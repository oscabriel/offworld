import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, Download, Search, Star } from "lucide-react";
import { useState, useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/browse")({
	component: BrowsePage,
});

function BrowsePage() {
	const [search, setSearch] = useState("");

	const analysesQuery = useQuery(convexQuery(api.analyses.list, { limit: 100 }));
	const analyses = analysesQuery.data ?? [];
	const isLoading = analysesQuery.isLoading;

	const filteredAnalyses = analyses.filter((a) =>
		a.fullName.toLowerCase().includes(search.toLowerCase())
	);

	return (
		<div className="container mx-auto max-w-4xl py-10">
			<div className="mb-8">
				<h1 className="mb-2 text-3xl font-bold">Browse Repositories</h1>
				<p className="text-muted-foreground">
					Explore analyzed repositories sorted by popularity
				</p>
			</div>

			<div className="mb-6">
				<div className="relative">
					<Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
					<Input
						placeholder="Search repositories..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10"
					/>
				</div>
			</div>

			{isLoading ? (
				<div className="space-y-4">
					{[...Array(5)].map((_, i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-4 w-32" />
							</CardHeader>
						</Card>
					))}
				</div>
			) : filteredAnalyses.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center">
						<p className="text-muted-foreground">
							{search
								? `No repositories found matching "${search}"`
								: "No analyses available yet"}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{filteredAnalyses.map((analysis) => (
						<RepoCard key={analysis.fullName} analysis={analysis} />
					))}
				</div>
			)}
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
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	return (
		<Link to="/repo/$owner/$repo" params={{ owner, repo }}>
			<Card className="transition-colors hover:bg-muted/50">
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="text-lg">{analysis.fullName}</CardTitle>
							<CardDescription className="mt-1 flex items-center gap-3">
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{formattedDate}
								</span>
								<span className="flex items-center gap-1">
									<Download className="h-3 w-3" />
									{analysis.pullCount} pulls
								</span>
								{stars !== null && (
									<span className="flex items-center gap-1">
										<Star className="h-3 w-3 text-yellow-500" />
										{stars.toLocaleString()}
									</span>
								)}
							</CardDescription>
						</div>
						{analysis.isVerified && (
							<span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
								<Check className="h-3 w-3" />
								Verified
							</span>
						)}
					</div>
				</CardHeader>
			</Card>
		</Link>
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
