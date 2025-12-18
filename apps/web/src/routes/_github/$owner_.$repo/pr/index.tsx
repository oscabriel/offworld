import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, GitMerge } from "lucide-react";
import { useMemo, useState } from "react";
import { ContentCard } from "@/components/repo/content-card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_github/$owner_/$repo/pr/")({
	component: PRsPage,
	// Note: Parent layout ($owner_.$repo/route.tsx) already preloads repo data
	// No additional loader needed here - avoids redundant preloading
});

function PRsPage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;
	const [stateFilter, setStateFilter] = useState<string>("all");
	const [sortBy, setSortBy] = useState<"difficulty" | "updated">("difficulty");

	// Use TanStack Query with convexQuery for proper auth handling with expectAuth: true
	const { data: repoData } = useSuspenseQuery(
		convexQuery(api.repos.getByFullName, { fullName }),
	);

	const isProcessing = repoData?.indexingStatus === "processing";
	const pullRequests = repoData?.pullRequests || [];

	// Filter and sort PRs
	const filteredAndSortedPRs = useMemo(() => {
		let filtered = pullRequests;

		// Filter by state
		if (stateFilter !== "all") {
			filtered = filtered.filter((pr) => pr.state === stateFilter);
		}

		// Sort
		const sorted = [...filtered].sort((a, b) => {
			if (sortBy === "difficulty") {
				return (a.difficulty || 3) - (b.difficulty || 3);
			}
			return b.createdAt - a.createdAt;
		});

		return sorted;
	}, [pullRequests, stateFilter, sortBy]);

	if (!repoData) {
		return (
			<ContentCard title="Repository Not Indexed">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					This repository hasn't been analyzed yet. Please index the repository
					first to view pull requests.
				</p>
				<Link
					to="/$owner/$repo"
					params={{ owner, repo }}
					className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
				>
					Go to Summary to Index
				</Link>
			</ContentCard>
		);
	}

	if (isProcessing) {
		return (
			<ContentCard variant="warning">
				<h3 className="mb-2 font-mono font-semibold text-lg">
					⚡ Analyzing Pull Requests
				</h3>
				<p className="font-mono text-muted-foreground text-sm">
					PR analysis is in progress. Results will appear as they're generated.
				</p>
			</ContentCard>
		);
	}

	if (pullRequests.length === 0) {
		return (
			<ContentCard>
				<h2 className="mb-4 font-mono font-semibold text-2xl">Pull Requests</h2>
				<p className="font-serif text-lg text-muted-foreground">
					No pull requests found for this repository.
				</p>
			</ContentCard>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with dropdown filters */}
			<div className="flex flex-col gap-4 border border-primary/10 bg-card p-6 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="font-mono font-semibold text-2xl">
						Pull Requests ({filteredAndSortedPRs.length})
					</h2>
					<p className="mt-1 font-mono text-muted-foreground text-sm">
						Recent PRs chosen due to review complexity and impact
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					{/* State Filter Dropdown */}
					<Select value={stateFilter} onValueChange={setStateFilter}>
						<SelectTrigger className="w-36">
							<SelectValue placeholder="Filter by state" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All States</SelectItem>
							<SelectItem value="open">Open</SelectItem>
							<SelectItem value="closed">Closed</SelectItem>
							<SelectItem value="merged">Merged</SelectItem>
						</SelectContent>
					</Select>

					{/* Sort Dropdown */}
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as "difficulty" | "updated")}
					>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="difficulty">By Difficulty</SelectItem>
							<SelectItem value="updated">Most Recent</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* PRs Table */}
			<div className="overflow-hidden border border-primary/10 bg-card">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-primary/10 border-b bg-muted/50">
								<th className="p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Pull Request
								</th>
								<th className="p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Author
								</th>
								<th className="hidden p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider md:table-cell">
									Complexity
								</th>
								<th className="hidden p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider md:table-cell">
									Changes
								</th>
								<th className="w-20 p-4 text-center font-mono text-muted-foreground text-xs uppercase tracking-wider">
									GitHub
								</th>
							</tr>
						</thead>
						<tbody>
							{filteredAndSortedPRs.map((pr) => (
								<tr
									key={pr._id}
									className="border-primary/10 border-b transition-colors hover:bg-accent/50"
								>
									<td className="p-4">
										<Link
											to="/$owner/$repo/pr/$number"
											params={{ owner, repo, number: pr.number.toString() }}
											className="group block"
										>
											<div className="mb-1 flex items-center gap-3">
												<GitMerge className="size-4 text-muted-foreground" />
												<span className="font-mono text-muted-foreground text-sm">
													#{pr.number}
												</span>
												<span className="font-mono font-semibold text-sm transition-colors group-hover:text-primary">
													{pr.title}
												</span>
												<PRStateBadge state={pr.state} />
											</div>
										</Link>
									</td>
									<td className="p-4">
										<span className="font-mono text-sm">{pr.author}</span>
									</td>
									<td className="hidden p-4 md:table-cell">
										{pr.reviewComplexity && (
											<ComplexityBadge complexity={pr.reviewComplexity} />
										)}
									</td>
									<td className="hidden p-4 md:table-cell">
										<div className="flex items-center gap-2 font-mono text-xs">
											<span className="text-green-600 dark:text-green-400">
												+{pr.linesAdded}
											</span>
											<span className="text-red-600 dark:text-red-400">
												-{pr.linesDeleted}
											</span>
										</div>
									</td>
									<td className="p-4 text-center">
										<a
											href={pr.githubUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-primary"
											onClick={(e) => e.stopPropagation()}
										>
											<ExternalLink className="size-4" />
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function PRStateBadge({ state }: { state: string }) {
	const config = {
		open: {
			label: "Open",
			className:
				"bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
		},
		closed: {
			label: "Closed",
			className:
				"bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
		},
		merged: {
			label: "Merged",
			className:
				"bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
		},
	}[state] || {
		label: state,
		className: "bg-muted/50 border-muted text-muted-foreground",
	};

	return (
		<Badge
			variant="outline"
			className={`font-mono text-xs ${config.className}`}
		>
			{config.label}
		</Badge>
	);
}

function ComplexityBadge({ complexity }: { complexity: string }) {
	const config = {
		simple: {
			label: "Simple",
			className:
				"bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
		},
		moderate: {
			label: "Moderate",
			className:
				"bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
		},
		complex: {
			label: "Complex",
			className:
				"bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
		},
	}[complexity] || {
		label: complexity,
		className: "bg-muted/50 border-muted text-muted-foreground",
	};

	return (
		<Badge
			variant="outline"
			className={`font-mono text-xs ${config.className}`}
		>
			{config.label}
		</Badge>
	);
}
