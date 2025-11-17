import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "convex/react";
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
	onReindex?: () => void;
	isReindexing?: boolean;
}

export function RepoHeader({
	owner,
	repo,
	repoData,
	onReindex,
	isReindexing,
}: RepoHeaderProps) {
	const isCompleted = repoData?.indexingStatus === "completed";
	const isNotIndexed = repoData === null;

	// Check authentication status
	const currentUser = useQuery(api.auth.getCurrentUserSafe);
	const isAuthenticated = currentUser !== null && currentUser !== undefined;

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
								{repoData.stars !== undefined && (
									<span className="font-mono text-muted-foreground text-sm">
										⭐ {repoData.stars.toLocaleString()} stars
									</span>
								)}
								{repoData.language && (
									<span className="font-mono text-muted-foreground text-sm">
										{repoData.language}
									</span>
								)}
							</>
						)}
					</div>
					{!isNotIndexed && repoData?.description && (
						<div className="flex items-end justify-between gap-4">
							<p className="font-mono text-base text-muted-foreground">
								{repoData.description}
							</p>
							{isCompleted && onReindex && isAuthenticated && (
								<button
									type="button"
									onClick={onReindex}
									disabled={isReindexing}
									className="shrink-0 border border-primary/20 bg-card px-3 py-1.5 font-mono text-muted-foreground text-sm hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
								>
									{isReindexing ? "Re-indexing..." : "Re-index"}
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
