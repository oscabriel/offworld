import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ContentCard } from "@/components/repo/content-card";
import { LoadingCard } from "@/components/repo/loading-card";
import { MarkdownContent } from "@/components/repo/markdown-content";
import { RepoStats } from "@/components/repo/repo-stats";

export const Route = createFileRoute("/_github/$owner_/$repo/")({
	component: RepoSummaryPage,
});

function RepoSummaryPage() {
	const { owner, repo } = Route.useParams();
	const [isIndexing, setIsIndexing] = useState(false);

	const fullName = `${owner}/${repo}`;
	const startAnalysis = useMutation(api.repos.startAnalysis);

	// Query repository status - THIS IS REACTIVE and auto-updates
	const repoStatus = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const handleStartIndexing = async () => {
		setIsIndexing(true);
		try {
			await startAnalysis({
				repoUrl: `https://github.com/${owner}/${repo}`,
			});
		} catch (error) {
			console.error("Failed to start analysis:", error);
			setIsIndexing(false);
		}
	};

	// Processing state - show what we have so far, skeleton for the rest
	const isProcessing = repoStatus?.indexingStatus === "processing";

	if (isProcessing || repoStatus?.indexingStatus === "completed") {
		return (
			<div className="space-y-8">
				{/* Processing info box - only show while processing */}
				{isProcessing && (
					<ContentCard variant="warning">
						<h3 className="mb-2 font-mono font-semibold text-lg">
							⚡ Analysis in Progress
						</h3>
						<p className="font-mono text-muted-foreground text-sm">
							Results will stream in as they're generated. This typically takes
							5-15 minutes.
						</p>
						{repoStatus.workflowId && (
							<p className="mt-2 font-mono text-muted-foreground text-xs">
								Workflow: {repoStatus.workflowId}
							</p>
						)}
					</ContentCard>
				)}

				{/* Summary Section - Show if exists, skeleton if processing without it */}
				{repoStatus.summary ? (
					<ContentCard title="Summary">
						<MarkdownContent content={repoStatus.summary} />
					</ContentCard>
				) : isProcessing ? (
					<LoadingCard title="Summary" message="Generating summary..." />
				) : null}

				{/* Stats - Show real numbers or placeholders */}
				<RepoStats
					chunkCount={repoStatus.chunkCount}
					issueCount={repoStatus.issueCount}
					isProcessing={isProcessing}
				/>

				{/* GitHub link */}
				<div className="border border-primary/10 bg-card p-4">
					<a
						href={`https://github.com/${owner}/${repo}`}
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-primary underline hover:no-underline"
					>
						View on GitHub →
					</a>
				</div>
			</div>
		);
	}

	// Error state - repo not found or failed
	if (repoStatus?.indexingStatus === "failed") {
		return (
			<ContentCard variant="error">
				<h1 className="font-serif text-4xl text-red-600">Analysis Failed</h1>
				<p className="font-serif text-lg text-muted-foreground">
					{repoStatus.errorMessage ||
						"Failed to analyze this repository. It may be private, archived, or unavailable."}
				</p>
				<a
					href="/"
					className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
				>
					Try Another Repository
				</a>
			</ContentCard>
		);
	}

	// Repository not indexed - show option to index
	if (repoStatus === null) {
		return (
			<div className="space-y-8">
				{/* Main content styled like Summary section */}
				<ContentCard title="Repository Not Indexed">
					<p className="font-serif text-lg text-muted-foreground leading-relaxed">
						This repository hasn't been analyzed yet. Would you like to index
						it?
					</p>
					<button
						type="button"
						onClick={handleStartIndexing}
						disabled={isIndexing}
						className="border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isIndexing ? "Starting Analysis..." : "Index This Repository"}
					</button>
				</ContentCard>
			</div>
		);
	}

	// Initial loading state (while checking if repo exists)
	return (
		<div className="space-y-6 border border-primary/10 bg-card p-8">
			<div className="h-12 w-48 animate-pulse rounded bg-muted" />
			<div className="h-6 w-32 animate-pulse rounded bg-muted" />
		</div>
	);
}
