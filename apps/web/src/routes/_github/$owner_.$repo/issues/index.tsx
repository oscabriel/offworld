import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ExternalLink, GitBranch } from "lucide-react";
import { useMemo, useState } from "react";
import { ContentCard } from "@/components/repo/content-card";
import { LoadingCard } from "@/components/repo/loading-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_github/$owner_/$repo/issues/")({
	component: IssuesPage,
});

function IssuesPage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;
	const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null);
	const [sortBy, setSortBy] = useState<"difficulty" | "number">("difficulty");

	// Query repository and issues
	const repoData = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const isProcessing = repoData?.indexingStatus === "processing";
	const issues = repoData?.issues || [];

	// Filter and sort issues
	const filteredAndSortedIssues = useMemo(() => {
		let filtered = issues;

		// Filter by difficulty if selected
		if (difficultyFilter !== null) {
			filtered = filtered.filter(
				(issue) => issue.difficulty === difficultyFilter,
			);
		}

		// Only show open issues
		filtered = filtered.filter((issue) => issue.state === "open");

		// Sort issues
		const sorted = [...filtered].sort((a, b) => {
			if (sortBy === "difficulty") {
				return (a.difficulty || 5) - (b.difficulty || 5);
			}
			return b.number - a.number; // Newest first
		});

		return sorted;
	}, [issues, difficultyFilter, sortBy]);

	// Group issues by difficulty
	const groupedIssues = useMemo(() => {
		const groups: Record<number, typeof issues> = {
			1: [],
			2: [],
			3: [],
			4: [],
			5: [],
		};

		for (const issue of filteredAndSortedIssues) {
			const difficulty = issue.difficulty || 3;
			if (groups[difficulty]) {
				groups[difficulty].push(issue);
			}
		}

		return groups;
	}, [filteredAndSortedIssues]);

	if (!repoData) {
		return <LoadingCard title="Issues" message="Loading issues..." />;
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
			{/* Header with filters */}
			<div className="flex flex-col gap-4 border border-primary/10 bg-card p-6 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="font-mono font-semibold text-2xl">
						Issues ({filteredAndSortedIssues.length})
					</h2>
					<p className="mt-1 font-mono text-muted-foreground text-sm">
						AI-analyzed contribution opportunities
					</p>
				</div>

				<div className="flex flex-wrap gap-2">
					{/* Difficulty Filter */}
					<Button
						variant={difficultyFilter === null ? "default" : "outline"}
						size="sm"
						onClick={() => setDifficultyFilter(null)}
					>
						All
					</Button>
					{[1, 2, 3, 4, 5].map((diff) => (
						<Button
							key={diff}
							variant={difficultyFilter === diff ? "default" : "outline"}
							size="sm"
							onClick={() => setDifficultyFilter(diff)}
						>
							{getDifficultyLabel(diff)}
						</Button>
					))}

					{/* Sort Toggle */}
					<div className="ml-4 flex gap-2">
						<Button
							variant={sortBy === "difficulty" ? "default" : "outline"}
							size="sm"
							onClick={() => setSortBy("difficulty")}
						>
							By Difficulty
						</Button>
						<Button
							variant={sortBy === "number" ? "default" : "outline"}
							size="sm"
							onClick={() => setSortBy("number")}
						>
							Newest
						</Button>
					</div>
				</div>
			</div>

			{/* Issues grouped by difficulty */}
			{difficultyFilter === null ? (
				<div className="space-y-8">
					{[1, 2, 3, 4, 5].map((difficulty) => {
						const difficultyIssues = groupedIssues[difficulty];
						if (difficultyIssues.length === 0) return null;

						return (
							<div key={difficulty}>
								<h3 className="mb-4 font-mono font-semibold text-lg">
									{getDifficultyLabel(difficulty)} ({difficultyIssues.length})
								</h3>
								<div className="space-y-4">
									{difficultyIssues.map((issue) => (
										<IssueCard key={issue._id} issue={issue} />
									))}
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="space-y-4">
					{filteredAndSortedIssues.map((issue) => (
						<IssueCard key={issue._id} issue={issue} />
					))}
				</div>
			)}
		</div>
	);
}

interface IssueCardProps {
	issue: {
		_id: string;
		number: number;
		title: string;
		difficulty?: number;
		aiSummary?: string;
		skillsRequired?: string[];
		filesLikelyTouched?: string[];
		githubUrl: string;
		labels: string[];
	};
}

function IssueCard({ issue }: IssueCardProps) {
	return (
		<div className="group border border-primary/10 bg-card p-6 transition-colors hover:border-primary/20">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					{/* Title and number */}
					<div className="mb-3 flex items-center gap-3">
						<span className="font-mono text-muted-foreground text-sm">
							#{issue.number}
						</span>
						<h3 className="font-mono font-semibold text-lg leading-tight">
							{issue.title}
						</h3>
					</div>

					{/* AI Summary */}
					{issue.aiSummary && (
						<p className="mb-4 font-serif text-muted-foreground leading-relaxed">
							{issue.aiSummary}
						</p>
					)}

					{/* Skills and Files */}
					<div className="space-y-3">
						{issue.skillsRequired && issue.skillsRequired.length > 0 && (
							<div>
								<span className="mb-2 inline-block font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Skills Required
								</span>
								<div className="flex flex-wrap gap-2">
									{issue.skillsRequired.map((skill) => (
										<Badge key={skill} variant="outline">
											{skill}
										</Badge>
									))}
								</div>
							</div>
						)}

						{issue.filesLikelyTouched &&
							issue.filesLikelyTouched.length > 0 && (
								<div>
									<span className="mb-2 inline-block font-mono text-muted-foreground text-xs uppercase tracking-wider">
										Files Likely Touched
									</span>
									<div className="flex flex-wrap gap-2">
										{issue.filesLikelyTouched.map((file) => (
											<Badge key={file} variant="secondary">
												<GitBranch className="size-3" />
												{file}
											</Badge>
										))}
									</div>
								</div>
							)}
					</div>
				</div>

				{/* Right side: Difficulty badge and GitHub link */}
				<div className="flex shrink-0 flex-col items-end gap-3">
					<DifficultyBadge difficulty={issue.difficulty || 3} />

					<a
						href={issue.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 font-mono text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						View on GitHub
						<ExternalLink className="size-3" />
					</a>
				</div>
			</div>
		</div>
	);
}

function DifficultyBadge({ difficulty }: { difficulty: number }) {
	const config = getDifficultyConfig(difficulty);

	return (
		<div
			className={`flex items-center gap-2 rounded-full border px-3 py-1 ${config.bgClass} ${config.borderClass}`}
		>
			<div className={`size-2 rounded-full ${config.dotClass}`} />
			<span className={`font-mono text-xs ${config.textClass}`}>
				{config.label}
			</span>
		</div>
	);
}

function getDifficultyLabel(difficulty: number): string {
	const labels: Record<number, string> = {
		1: "Good First Issue",
		2: "Easy",
		3: "Moderate",
		4: "Challenging",
		5: "Advanced",
	};
	return labels[difficulty] || "Moderate";
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
