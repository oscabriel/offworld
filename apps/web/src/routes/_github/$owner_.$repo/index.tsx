import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

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
					<div className="border border-yellow-500/20 bg-yellow-500/5 p-6">
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
					</div>
				)}

				{/* Summary Section - Show if exists, skeleton if processing without it */}
				{repoStatus.summary ? (
					<div className="space-y-6 border border-primary/10 bg-card p-8">
						<h2 className="font-mono font-semibold text-2xl">Summary</h2>
						<div className="markdown-content font-serif text-lg leading-relaxed [&>code]:rounded [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:font-mono [&>code]:text-sm [&>h1]:mb-4 [&>h1]:font-mono [&>h1]:font-semibold [&>h1]:text-2xl [&>h2]:mb-3 [&>h2]:font-mono [&>h2]:font-semibold [&>h2]:text-xl [&>h3]:mb-2 [&>h3]:font-mono [&>h3]:font-semibold [&>h3]:text-lg [&>li]:leading-relaxed [&>ol]:mb-4 [&>ol]:ml-6 [&>ol]:list-decimal [&>ol]:space-y-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>strong]:font-semibold [&>strong]:text-foreground [&>ul]:mb-4 [&>ul]:ml-6 [&>ul]:list-disc [&>ul]:space-y-2">
							<ReactMarkdown>{repoStatus.summary}</ReactMarkdown>
						</div>
					</div>
				) : isProcessing ? (
					<div className="space-y-6 border border-primary/10 bg-card p-8">
						<h2 className="font-mono font-semibold text-2xl text-muted-foreground">
							Summary
						</h2>
						<div className="space-y-3">
							<div className="h-4 w-full animate-pulse bg-muted" />
							<div className="h-4 w-5/6 animate-pulse bg-muted" />
							<div className="h-4 w-4/6 animate-pulse bg-muted" />
						</div>
						<p className="pt-2 font-mono text-muted-foreground text-sm">
							Generating summary...
						</p>
					</div>
				) : null}

				{/* Stats - Show real numbers or placeholders */}
				<div className="flex gap-6 border border-primary/10 bg-card p-6">
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
			<div className="space-y-6 border border-red-500/20 bg-card p-8">
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
		);
	}

	// Repository not indexed - show option to index
	if (repoStatus === null) {
		return (
			<div className="space-y-8">
				{/* Main content styled like Summary section */}
				<div className="space-y-6 border border-primary/10 bg-card p-8">
					<h2 className="font-mono font-semibold text-2xl">
						Repository Not Indexed
					</h2>
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
				</div>
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
