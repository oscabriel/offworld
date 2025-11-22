import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ContentCard } from "@/components/repo/content-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_github/$owner_/$repo/refresh")({
	component: RefreshPage,
});

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function getTimeUntilRefresh(lastAnalyzedAt: number): string | null {
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	if (lastAnalyzedAt > sevenDaysAgo) {
		const nextRefreshTime = lastAnalyzedAt + 7 * 24 * 60 * 60 * 1000;
		const msUntilRefresh = nextRefreshTime - Date.now();
		const daysUntilRefresh = Math.ceil(msUntilRefresh / (24 * 60 * 60 * 1000));
		return `${daysUntilRefresh} day${daysUntilRefresh === 1 ? "" : "s"}`;
	}
	return null;
}

function RefreshPage() {
	const { owner, repo } = Route.useParams();
	const [isReindexing, setIsReindexing] = useState(false);
	const [_error, setError] = useState<string | null>(null);

	const fullName = `${owner}/${repo}`;
	const reindexRepository = useMutation(api.repos.reindexRepository);

	// Check authentication status
	const currentUser = useQuery(api.auth.getCurrentUserSafe);
	const isAuthenticated = currentUser !== null && currentUser !== undefined;

	// Query repository status
	const repoData = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const handleReindex = async () => {
		setIsReindexing(true);
		setError(null);
		try {
			await reindexRepository({ fullName });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start re-indexing",
			);
			setIsReindexing(false);
		}
	};

	// Not authenticated
	if (!isAuthenticated) {
		return (
			<div className="space-y-6">
				<ContentCard title="Authentication Required">
					<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
						You need to be signed in to refresh repository analysis.
					</p>
					<Link
						to="/sign-in"
						className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
					>
						Sign In
					</Link>
				</ContentCard>
			</div>
		);
	}

	// Repository not indexed yet
	if (repoData === null) {
		return (
			<div className="space-y-6">
				<ContentCard title="Repository Not Indexed">
					<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
						This repository hasn't been analyzed yet. Please index it first from
						the summary page.
					</p>
					<Link
						to="/$owner/$repo"
						params={{ owner, repo }}
						className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
					>
						Go to Summary
					</Link>
				</ContentCard>
			</div>
		);
	}

	// Loading state
	if (repoData === undefined) {
		return (
			<div className="space-y-6 border border-primary/10 bg-card p-8">
				<div className="h-12 w-48 animate-pulse rounded bg-muted" />
				<div className="h-6 w-32 animate-pulse rounded bg-muted" />
			</div>
		);
	}

	const isCompleted = repoData.indexingStatus === "completed";
	const timeUntilRefresh = repoData.lastAnalyzedAt
		? getTimeUntilRefresh(repoData.lastAnalyzedAt)
		: null;
	const canRefresh = isCompleted && !timeUntilRefresh;

	return (
		<div className="space-y-6">
			<ContentCard title="Refresh this Analysis">
				<div className="space-y-6">
					{repoData.lastAnalyzedAt && (
						<div>
							<span className="mb-2 font-mono text-muted-foreground text-sm">
								Last analyzed:
							</span>{" "}
							<span className="font-serif text-lg">
								{formatTimestamp(repoData.lastAnalyzedAt)}
							</span>
						</div>
					)}

					{!isCompleted && (
						<div className="border border-yellow-500/20 bg-yellow-500/10 p-4">
							<p className="font-mono text-sm text-yellow-700 dark:text-yellow-600">
								Repository is currently being indexed. Please wait until the
								analysis is complete before refreshing.
							</p>
						</div>
					)}

					{timeUntilRefresh && (
						<div className="border p-4">
							<p className="text font-mono text-sm">
								This repository was recently analyzed. You can refresh it again
								in {timeUntilRefresh}.
							</p>
						</div>
					)}

					<Button
						size="lg"
						onClick={handleReindex}
						disabled={!canRefresh || isReindexing}
						className="border border-primary bg-primary px-6 py-3 font-mono text-base text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isReindexing ? "Refreshing..." : "Refresh Repository"}
					</Button>
				</div>
			</ContentCard>
		</div>
	);
}
