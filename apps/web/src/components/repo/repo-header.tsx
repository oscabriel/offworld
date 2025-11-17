import { ExternalLink } from "lucide-react";
import { StatusBadge } from "./status-badge";

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

interface RepoHeaderProps {
	owner: string;
	repo: string;
	repoData?: {
		indexingStatus?: string;
		lastAnalyzedAt?: number;
		stars?: number;
		language?: string;
		description?: string;
	} | null;
	githubMetadata?: {
		description?: string;
		stars?: number;
		language?: string;
		githubUrl?: string;
	} | null;
}

export function RepoHeader({
	owner,
	repo,
	repoData,
	githubMetadata,
}: RepoHeaderProps) {
	const isCompleted = repoData?.indexingStatus === "completed";
	const isNotIndexed = repoData === null;

	// Use GitHub metadata for unindexed repos, DB data for indexed repos
	const displayData =
		isNotIndexed && githubMetadata ? githubMetadata : repoData;

	return (
		<header>
			<div className="container mx-auto max-w-7xl px-4 py-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-2">
					<h1 className="group font-serif text-3xl tracking-tight sm:text-5xl">
						<a
							href={`https://github.com/${owner}/${repo}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 transition-colors hover:text-muted-foreground"
						>
							{owner}/{repo}
							<ExternalLink className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
						</a>
					</h1>
					<div className="flex flex-wrap items-center gap-4">
						{!isNotIndexed && repoData?.indexingStatus && (
							<>
								<div className="flex items-center gap-3">
									<span className="font-mono text-muted-foreground text-sm">
										Status:
									</span>
									<StatusBadge status={repoData.indexingStatus} />
								</div>
								{isCompleted && repoData.lastAnalyzedAt && (
									<span className="font-mono text-muted-foreground text-sm">
										Analyzed {formatTimestamp(repoData.lastAnalyzedAt)}
									</span>
								)}
							</>
						)}
						{/* Show metadata from GitHub or DB */}
						{displayData?.stars !== undefined && (
							<span className="font-mono text-muted-foreground text-sm">
								⭐ {displayData.stars.toLocaleString()} stars
							</span>
						)}
						{displayData?.language && (
							<span className="font-mono text-muted-foreground text-sm">
								{displayData.language}
							</span>
						)}
					</div>
					{displayData?.description && (
						<p className="font-mono text-base text-muted-foreground">
							{displayData.description}
						</p>
					)}
				</div>
			</div>
		</header>
	);
}
