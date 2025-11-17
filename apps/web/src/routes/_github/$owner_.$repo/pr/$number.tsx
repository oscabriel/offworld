import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, ExternalLink, FileCode, GitMerge } from "lucide-react";
import { ContentCard } from "@/components/repo/content-card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_github/$owner_/$repo/pr/$number")({
	component: PRDetailPage,
});

function PRDetailPage() {
	const { owner, repo, number } = Route.useParams();
	const fullName = `${owner}/${repo}`;
	const prNumber = Number.parseInt(number, 10);

	const repoData = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const pr = repoData?.pullRequests?.find((p) => p.number === prNumber);
	const isNotIndexed = repoData === null;

	// Show "Repository Not Indexed" for unindexed repos
	if (isNotIndexed) {
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

	if (!repoData || !pr) {
		return (
			<ContentCard>
				<Link
					to="/$owner/$repo/pr"
					params={{ owner, repo }}
					className="mb-4 inline-flex items-center gap-2 font-mono text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="size-4" />
					Back to Pull Requests
				</Link>
				<h2 className="font-mono font-semibold text-2xl">
					{repoData === undefined ? "Loading..." : "Pull request not found"}
				</h2>
			</ContentCard>
		);
	}

	return (
		<div className="space-y-6">
			{/* Back link */}
			<Link
				to="/$owner/$repo/pr"
				params={{ owner, repo }}
				className="inline-flex items-center gap-2 font-mono text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				Back to Pull Requests
			</Link>

			{/* PR header */}
			<div className="border border-primary/10 bg-card p-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="min-w-0 flex-1">
						<div className="mb-2 flex flex-wrap items-center gap-3">
							<GitMerge className="size-5 text-muted-foreground" />
							<span className="font-mono text-muted-foreground">
								#{pr.number}
							</span>
							<PRStateBadge state={pr.state} />
							{pr.reviewComplexity && (
								<ComplexityBadge complexity={pr.reviewComplexity} />
							)}
						</div>
						<h1 className="break-words font-bold font-mono text-3xl">
							{pr.title}
						</h1>
						<div className="mt-3 flex items-center gap-2 font-mono text-muted-foreground text-sm">
							<span>by {pr.author}</span>
							<span>•</span>
							<span>
								{new Date(pr.createdAt).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
							</span>
						</div>
					</div>
					<a
						href={pr.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex shrink-0 items-center gap-2 font-mono text-primary text-sm hover:underline"
					>
						View on GitHub
						<ExternalLink className="size-4" />
					</a>
				</div>
			</div>

			{/* AI Summary */}
			{pr.aiSummary && (
				<ContentCard title="Summary">
					<p className="font-serif text-lg leading-relaxed">{pr.aiSummary}</p>
				</ContentCard>
			)}

			{/* Changes Summary */}
			<ContentCard title="Changes">
				<div className="flex items-center gap-4 font-mono">
					<span className="text-green-600 text-lg dark:text-green-400">
						+{pr.linesAdded} additions
					</span>
					<span className="text-lg text-red-600 dark:text-red-400">
						-{pr.linesDeleted} deletions
					</span>
				</div>
			</ContentCard>

			{/* Impact Areas */}
			{pr.impactAreas && pr.impactAreas.length > 0 && (
				<ContentCard title="Impact Areas">
					<div className="flex flex-wrap gap-2">
						{pr.impactAreas.map((area) => (
							<Badge key={area} variant="outline" className="font-mono">
								{area}
							</Badge>
						))}
					</div>
				</ContentCard>
			)}

			{/* Files Changed - WITH CLICKABLE GITHUB LINKS */}
			{pr.filesChanged && pr.filesChanged.length > 0 && (
				<ContentCard title="Files Changed">
					<ul className="space-y-2">
						{pr.filesChanged.map((file) => (
							<li key={file} className="flex items-center gap-2">
								<FileCode className="size-4 shrink-0 text-muted-foreground" />
								<a
									href={`https://github.com/${fullName}/blob/${repoData?.defaultBranch || "main"}/${file}`}
									target="_blank"
									rel="noopener noreferrer"
									className="break-all font-mono text-primary text-sm hover:underline"
								>
									{file}
								</a>
							</li>
						))}
					</ul>
				</ContentCard>
			)}
		</div>
	);
}

function PRStateBadge({ state }: { state: string }) {
	const config = {
		open: {
			label: "Open",
			bgClass: "bg-green-500/10",
			borderClass: "border-green-500/20",
			textClass: "text-green-600 dark:text-green-400",
		},
		closed: {
			label: "Closed",
			bgClass: "bg-red-500/10",
			borderClass: "border-red-500/20",
			textClass: "text-red-600 dark:text-red-400",
		},
		merged: {
			label: "Merged",
			bgClass: "bg-purple-500/10",
			borderClass: "border-purple-500/20",
			textClass: "text-purple-600 dark:text-purple-400",
		},
	}[state] || {
		label: state,
		bgClass: "bg-muted/50",
		borderClass: "border-muted",
		textClass: "text-muted-foreground",
	};

	return (
		<Badge
			variant="outline"
			className={`font-mono text-xs ${config.bgClass} ${config.borderClass} ${config.textClass}`}
		>
			{config.label}
		</Badge>
	);
}

function ComplexityBadge({ complexity }: { complexity: string }) {
	const config = {
		simple: {
			label: "Simple Review",
			bgClass: "bg-green-500/10",
			borderClass: "border-green-500/20",
			textClass: "text-green-600 dark:text-green-400",
		},
		moderate: {
			label: "Moderate Review",
			bgClass: "bg-yellow-500/10",
			borderClass: "border-yellow-500/20",
			textClass: "text-yellow-600 dark:text-yellow-400",
		},
		complex: {
			label: "Complex Review",
			bgClass: "bg-red-500/10",
			borderClass: "border-red-500/20",
			textClass: "text-red-600 dark:text-red-400",
		},
	}[complexity] || {
		label: complexity,
		bgClass: "bg-muted/50",
		borderClass: "border-muted",
		textClass: "text-muted-foreground",
	};

	return (
		<div
			className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${config.bgClass} ${config.borderClass}`}
		>
			<span className={`font-mono text-xs ${config.textClass}`}>
				{config.label}
			</span>
		</div>
	);
}
