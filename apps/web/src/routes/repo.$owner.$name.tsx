import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/repo/$owner/$name")({
	component: RepoPage,
});

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

function RepoPage() {
	const { owner, name } = Route.useParams();
	const analysisTriggered = useRef(false);

	const fullName = `${owner}/${name}`;
	const startAnalysis = useMutation(api.repos.startAnalysis);

	// Query repository status - THIS IS REACTIVE and auto-updates
	const repoStatus = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	// Auto-trigger analysis if repo doesn't exist (only once)
	useEffect(() => {
		if (repoStatus === null && !analysisTriggered.current) {
			// Repo not found, start analysis
			analysisTriggered.current = true;
			startAnalysis({
				repoUrl: `https://github.com/${owner}/${name}`,
			}).catch((error) => {
				console.error("Failed to start analysis:", error);
			});
		}
	}, [repoStatus, owner, name, startAnalysis]);

	// Processing state - show what we have so far, skeleton for the rest
	const isProcessing = repoStatus?.indexingStatus === "processing";

	if (isProcessing || repoStatus?.indexingStatus === "completed") {
		const isCompleted = repoStatus.indexingStatus === "completed";

		return (
			<div className="container mx-auto max-w-4xl px-4 py-24">
				<div className="space-y-8">
					{/* Header */}
					<div className="space-y-2">
						<h1 className="font-serif text-5xl tracking-tight">
							{owner}/{name}
						</h1>
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-3">
								<span className="font-mono text-muted-foreground text-sm">
									Status:
								</span>
								<span
									className={`inline-flex items-center rounded-full px-3 py-1 font-medium font-mono text-xs ${
										isCompleted
											? "bg-green-500/10 text-green-600"
											: "bg-yellow-500/10 text-yellow-600"
									}`}
								>
									{repoStatus.indexingStatus}
								</span>
							</div>
							{isCompleted && repoStatus.lastAnalyzedAt && (
								<span className="font-mono text-muted-foreground text-sm">
									Analyzed {formatTimestamp(repoStatus.lastAnalyzedAt)}
								</span>
							)}
							{repoStatus.stars !== undefined && (
								<span className="font-mono text-muted-foreground text-sm">
									⭐ {repoStatus.stars.toLocaleString()} stars
								</span>
							)}
							{repoStatus.language && (
								<span className="font-mono text-muted-foreground text-sm">
									{repoStatus.language}
								</span>
							)}
						</div>
						{repoStatus.description && (
							<p className="font-serif text-lg text-muted-foreground">
								{repoStatus.description}
							</p>
						)}
					</div>

					{/* Processing info box - only show while processing */}
					{isProcessing && (
						<div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-6">
							<h3 className="mb-2 font-mono font-semibold text-lg">
								⚡ Analysis in Progress
							</h3>
							<p className="font-mono text-muted-foreground text-sm">
								Results will stream in as they're generated. This typically
								takes 5-15 minutes.
							</p>
							{repoStatus.workflowId && (
								<p className="mt-2 font-mono text-muted-foreground text-xs">
									Workflow: {repoStatus.workflowId}
								</p>
							)}
						</div>
					)}

					{/* Summary Section - Show if exists, skeleton if processing without it */}
					{repoStatus.summary ? (
						<div className="space-y-3 rounded-lg border border-primary/10 bg-card p-6">
							<h2 className="font-mono font-semibold text-2xl">Summary</h2>
							<div className="prose prose-lg dark:prose-invert max-w-none">
								<ReactMarkdown>{repoStatus.summary}</ReactMarkdown>
							</div>
						</div>
					) : isProcessing ? (
						<div className="space-y-3 rounded-lg border border-primary/10 bg-card p-6">
							<h2 className="font-mono font-semibold text-2xl text-muted-foreground">
								Summary
							</h2>
							<div className="space-y-2">
								<div className="h-4 w-full animate-pulse rounded bg-muted" />
								<div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
								<div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
							</div>
							<p className="pt-2 font-mono text-muted-foreground text-sm">
								Generating summary...
							</p>
						</div>
					) : null}

					{/* Architecture Section - Show if exists, skeleton if processing without it */}
					{repoStatus.architecture ? (
						<div className="space-y-3 rounded-lg border border-primary/10 bg-card p-6">
							<h2 className="font-mono font-semibold text-2xl">Architecture</h2>
							<div className="prose prose-lg dark:prose-invert max-w-none">
								<ReactMarkdown>{repoStatus.architecture}</ReactMarkdown>
							</div>
						</div>
					) : isProcessing ? (
						<div className="space-y-3 rounded-lg border border-primary/10 bg-card p-6">
							<h2 className="font-mono font-semibold text-2xl text-muted-foreground">
								Architecture
							</h2>
							<div className="space-y-2">
								<div className="h-4 w-full animate-pulse rounded bg-muted" />
								<div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
							</div>
							<p className="pt-2 font-mono text-muted-foreground text-sm">
								Generating architecture overview...
							</p>
						</div>
					) : null}

					{/* Stats - Show real numbers or placeholders */}
					<div className="flex gap-6 rounded-lg border border-primary/10 bg-card p-6">
						<div className="flex flex-col">
							<span className="font-mono text-muted-foreground text-xs uppercase">
								Code Chunks
							</span>
							{repoStatus.chunkCount !== undefined &&
							repoStatus.chunkCount > 0 ? (
								<span className="mt-1 font-mono font-semibold text-3xl">
									{repoStatus.chunkCount}
								</span>
							) : (
								<span className="mt-1 font-mono text-3xl text-muted-foreground">
									{isProcessing ? "..." : "0"}
								</span>
							)}
						</div>
						<div className="flex flex-col">
							<span className="font-mono text-muted-foreground text-xs uppercase">
								Issues Analyzed
							</span>
							{repoStatus.issueCount !== undefined &&
							repoStatus.issueCount > 0 ? (
								<span className="mt-1 font-mono font-semibold text-3xl">
									{repoStatus.issueCount}
								</span>
							) : (
								<span className="mt-1 font-mono text-3xl text-muted-foreground">
									{isProcessing ? "..." : "0"}
								</span>
							)}
						</div>
					</div>

					{/* GitHub link */}
					<div className="rounded-lg border border-primary/10 bg-card p-4">
						<a
							href={`https://github.com/${owner}/${name}`}
							target="_blank"
							rel="noopener noreferrer"
							className="font-mono text-primary underline hover:no-underline"
						>
							View on GitHub →
						</a>
					</div>
				</div>
			</div>
		);
	}

	// Error state - repo not found or failed
	if (repoStatus?.indexingStatus === "failed") {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-24">
				<div className="space-y-6 rounded-lg border border-red-500/20 bg-card p-8">
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
				</div>
			</div>
		);
	}

	// Initial loading state (while checking if repo exists)
	return (
		<div className="container mx-auto max-w-4xl px-4 py-24">
			<div className="space-y-6 rounded-lg border border-primary/10 bg-card p-8">
				<div className="h-12 w-48 animate-pulse rounded bg-muted" />
				<div className="h-6 w-32 animate-pulse rounded bg-muted" />
			</div>
		</div>
	);
}
