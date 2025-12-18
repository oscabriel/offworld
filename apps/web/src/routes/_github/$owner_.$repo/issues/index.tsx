import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
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

export const Route = createFileRoute("/_github/$owner_/$repo/issues/")({
	component: IssuesPage,
	// Note: Parent layout ($owner_.$repo/route.tsx) already preloads repo data
	// No additional loader needed here - avoids redundant preloading
});

function IssuesPage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;
	const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
	const [sortBy, setSortBy] = useState<"difficulty" | "number">("difficulty");

	// Use TanStack Query with convexQuery for proper auth handling with expectAuth: true
	const { data: repoData } = useSuspenseQuery(
		convexQuery(api.repos.getByFullName, { fullName }),
	);

	const isProcessing = repoData?.indexingStatus === "processing";
	const issues = repoData?.issues || [];

	// Filter and sort issues
	const filteredAndSortedIssues = useMemo(() => {
		let filtered = issues.filter((issue) => issue.state === "open");

		// Filter by difficulty
		if (difficultyFilter !== "all") {
			const targetDifficulty = Number.parseInt(difficultyFilter, 10);
			filtered = filtered.filter(
				(issue) => issue.difficulty === targetDifficulty,
			);
		}

		// Sort
		const sorted = [...filtered].sort((a, b) => {
			if (sortBy === "difficulty") {
				return (a.difficulty || 5) - (b.difficulty || 5);
			}
			return b.number - a.number;
		});

		return sorted;
	}, [issues, difficultyFilter, sortBy]);

	if (!repoData) {
		return (
			<ContentCard title="Repository Not Indexed">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					This repository hasn't been analyzed yet. Please index the repository
					first to view issues.
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
					⚡ Analyzing Issues
				</h3>
				<p className="font-mono text-muted-foreground text-sm">
					Issue analysis is in progress. Results will appear as they're
					generated.
				</p>
			</ContentCard>
		);
	}

	if (issues.length === 0) {
		return (
			<ContentCard>
				<h2 className="mb-4 font-mono font-semibold text-2xl">Issues</h2>
				<p className="font-serif text-lg text-muted-foreground">
					No issues found for this repository.
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
						Issues ({filteredAndSortedIssues.length})
					</h2>
					<p className="mt-1 font-mono text-muted-foreground text-sm">
						Top {issues.filter((i) => i.state === "open").length} open issues in
						this repository chosen for difficulty and skills required.
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					{/* Difficulty Filter Dropdown */}
					<Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
						<SelectTrigger className="w-48">
							<SelectValue placeholder="Filter by difficulty" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Difficulties</SelectItem>
							<SelectItem value="1">Good First Issue</SelectItem>
							<SelectItem value="2">Easy</SelectItem>
							<SelectItem value="3">Moderate</SelectItem>
							<SelectItem value="4">Challenging</SelectItem>
							<SelectItem value="5">Advanced</SelectItem>
						</SelectContent>
					</Select>

					{/* Sort Dropdown */}
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as "difficulty" | "number")}
					>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="difficulty">By Difficulty</SelectItem>
							<SelectItem value="number">Newest First</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Issues Table */}
			<div className="overflow-hidden border border-primary/10 bg-card">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-primary/10 border-b bg-muted/50">
								<th className="p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Issue
								</th>
								<th className="p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Difficulty
								</th>
								<th className="hidden p-4 text-left font-mono text-muted-foreground text-xs uppercase tracking-wider md:table-cell">
									Skills
								</th>
								<th className="w-20 p-4 text-center font-mono text-muted-foreground text-xs uppercase tracking-wider">
									GitHub
								</th>
							</tr>
						</thead>
						<tbody>
							{filteredAndSortedIssues.map((issue) => (
								<tr
									key={issue._id}
									className="border-primary/10 border-b transition-colors hover:bg-accent/50"
								>
									<td className="p-4">
										<Link
											to="/$owner/$repo/issues/$number"
											params={{ owner, repo, number: issue.number.toString() }}
											className="group block"
										>
											<div className="mb-1 flex items-center gap-3">
												<span className="font-mono text-muted-foreground text-sm">
													#{issue.number}
												</span>
												<span className="font-mono font-semibold text-sm transition-colors group-hover:text-primary">
													{issue.title}
												</span>
											</div>
										</Link>
									</td>
									<td className="p-4">
										<DifficultyBadge
											difficulty={issue.difficulty || 3}
											size="sm"
										/>
									</td>
									<td className="hidden p-4 md:table-cell">
										{issue.skillsRequired &&
											issue.skillsRequired.length > 0 && (
												<div className="flex flex-wrap gap-1">
													{issue.skillsRequired.slice(0, 3).map((skill) => (
														<Badge
															key={skill}
															variant="outline"
															className="text-xs"
														>
															{skill}
														</Badge>
													))}
													{issue.skillsRequired.length > 3 && (
														<Badge variant="outline" className="text-xs">
															+{issue.skillsRequired.length - 3}
														</Badge>
													)}
												</div>
											)}
									</td>
									<td className="p-4 text-center">
										<a
											href={issue.githubUrl}
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

function DifficultyBadge({
	difficulty,
	size = "default",
}: {
	difficulty: number;
	size?: "sm" | "default";
}) {
	const config = getDifficultyConfig(difficulty);
	const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs";

	return (
		<div
			className={`inline-flex items-center gap-2 rounded-full border ${sizeClass} ${config.bgClass} ${config.borderClass}`}
		>
			<div className={`size-2 rounded-full ${config.dotClass}`} />
			<span className={`font-mono ${config.textClass}`}>{config.label}</span>
		</div>
	);
}

function getDifficultyConfig(difficulty: number) {
	const configs: Record<
		number,
		{
			label: string;
			bgClass: string;
			borderClass: string;
			dotClass: string;
			textClass: string;
		}
	> = {
		1: {
			label: "Good First Issue",
			bgClass: "bg-green-500/10",
			borderClass: "border-green-500/20",
			dotClass: "bg-green-500",
			textClass: "text-green-600 dark:text-green-400",
		},
		2: {
			label: "Easy",
			bgClass: "bg-blue-500/10",
			borderClass: "border-blue-500/20",
			dotClass: "bg-blue-500",
			textClass: "text-blue-600 dark:text-blue-400",
		},
		3: {
			label: "Moderate",
			bgClass: "bg-yellow-500/10",
			borderClass: "border-yellow-500/20",
			dotClass: "bg-yellow-500",
			textClass: "text-yellow-600 dark:text-yellow-400",
		},
		4: {
			label: "Challenging",
			bgClass: "bg-orange-500/10",
			borderClass: "border-orange-500/20",
			dotClass: "bg-orange-500",
			textClass: "text-orange-600 dark:text-orange-400",
		},
		5: {
			label: "Advanced",
			bgClass: "bg-red-500/10",
			borderClass: "border-red-500/20",
			dotClass: "bg-red-500",
			textClass: "text-red-600 dark:text-red-400",
		},
	};

	return configs[difficulty] || configs[3];
}
