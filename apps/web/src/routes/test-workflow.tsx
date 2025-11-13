import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/test-workflow")({
	component: TestWorkflow,
});

function TestWorkflow() {
	const [repoUrl, setRepoUrl] = useState("https://github.com/lukeed/clsx");
	const [workflowId, setWorkflowId] = useState<string | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	const startAnalysis = useMutation(api.repos.startAnalysis);
	const clearAllData = useMutation(api.dev.clearAllData);

	// Extract owner/name from URL for querying
	const fullName =
		repoUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] || "";

	// Query repository status if we're analyzing
	const repoStatus = useQuery(
		api.repos.getByFullName,
		isAnalyzing && fullName ? { fullName } : "skip",
	);

	const handleStart = async () => {
		try {
			const result = await startAnalysis({ repoUrl });
			console.log("Analysis started:", result);

			if ("workflowId" in result) {
				setWorkflowId(result.workflowId as string);
			}

			setIsAnalyzing(true);
		} catch (error) {
			console.error("Failed to start analysis:", error);
			alert(
				error instanceof Error ? error.message : "Failed to start analysis",
			);
		}
	};

	const handleClearData = async () => {
		if (
			!confirm("⚠️ This will DELETE ALL DATA from the database. Are you sure?")
		) {
			return;
		}

		try {
			const result = await clearAllData({});
			console.log("Data cleared:", result);
			alert(
				`Cleared: ${result.deleted.repositories} repos, ${result.deleted.codeChunks} chunks, ${result.deleted.issues} issues`,
			);
			setWorkflowId(null);
			setIsAnalyzing(false);
		} catch (error) {
			console.error("Failed to clear data:", error);
			alert(error instanceof Error ? error.message : "Failed to clear data");
		}
	};

	return (
		<div className="container mx-auto max-w-4xl px-4 py-24">
			<div className="space-y-8">
				<div>
					<h1 className="font-normal font-serif text-5xl tracking-tight">
						Test Workflow
					</h1>
					<p className="mt-3 font-medium font-mono text-lg text-muted-foreground">
						Test repository analysis workflow
					</p>
				</div>

				<div className="space-y-4 rounded-lg border-2 border-primary/10 p-8">
					<div className="space-y-2">
						<label htmlFor="repoUrl" className="font-medium font-mono text-sm">
							Repository URL
						</label>
						<input
							id="repoUrl"
							type="text"
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							className="w-full rounded border border-primary/20 bg-background px-4 py-2 font-mono"
							placeholder="https://github.com/owner/repo"
						/>
					</div>

					<div className="flex gap-4">
						<button
							type="button"
							onClick={handleStart}
							className="rounded bg-primary px-6 py-2 font-medium font-mono text-primary-foreground hover:opacity-80"
						>
							Start Analysis
						</button>

						<button
							type="button"
							onClick={handleClearData}
							className="rounded border border-red-500 px-6 py-2 font-medium font-mono text-red-500 hover:bg-red-500 hover:text-white"
						>
							Clear All Data
						</button>
					</div>

					{workflowId && (
						<div className="mt-4 space-y-2 rounded bg-muted p-4">
							<p className="font-mono text-sm">
								<strong>Workflow ID:</strong> {workflowId}
							</p>
							<p className="font-mono text-muted-foreground text-xs">
								Check Convex dashboard for workflow progress
							</p>
						</div>
					)}

					{repoStatus && (
						<div className="mt-6 space-y-6">
							{/* Status Badge */}
							<div className="flex items-center gap-3">
								<span className="font-medium font-mono text-muted-foreground text-sm">
									Status:
								</span>
								<span
									className={`inline-flex items-center rounded-full px-3 py-1 font-medium font-mono text-xs ${
										repoStatus.indexingStatus === "completed"
											? "bg-green-500/10 text-green-600"
											: repoStatus.indexingStatus === "processing"
												? "bg-yellow-500/10 text-yellow-600"
												: repoStatus.indexingStatus === "failed"
													? "bg-red-500/10 text-red-600"
													: "bg-blue-500/10 text-blue-600"
									}`}
								>
									{repoStatus.indexingStatus}
								</span>
							</div>

							{/* Summary Section */}
							{repoStatus.summary && (
								<div className="space-y-3 rounded-lg border border-primary/10 bg-card p-6">
									<h3 className="font-mono font-semibold text-lg">Summary</h3>
									<div className="prose prose-sm dark:prose-invert max-w-none">
										<ReactMarkdown>{repoStatus.summary}</ReactMarkdown>
									</div>
								</div>
							)}

							{/* Architecture Section */}
							{repoStatus.architecture && (
								<div className="space-y-3 rounded-lg border border-primary/10 bg-card p-6">
									<h3 className="font-mono font-semibold text-lg">
										Architecture
									</h3>
									<div className="prose prose-sm dark:prose-invert max-w-none">
										<ReactMarkdown>{repoStatus.architecture}</ReactMarkdown>
									</div>
								</div>
							)}

							{/* Stats */}
							<div className="flex gap-6 rounded-lg border border-primary/10 bg-card p-4">
								{repoStatus.chunkCount !== undefined && (
									<div className="flex flex-col">
										<span className="font-mono text-muted-foreground text-xs uppercase">
											Code Chunks
										</span>
										<span className="mt-1 font-mono font-semibold text-2xl">
											{repoStatus.chunkCount}
										</span>
									</div>
								)}
								{repoStatus.issueCount !== undefined && (
									<div className="flex flex-col">
										<span className="font-mono text-muted-foreground text-xs uppercase">
											Issues Analyzed
										</span>
										<span className="mt-1 font-mono font-semibold text-2xl">
											{repoStatus.issueCount}
										</span>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				<div className="rounded bg-muted p-4">
					<p className="font-mono text-muted-foreground text-xs">
						<strong>Test repos:</strong>
						<br />• https://github.com/lukeed/clsx (tiny, ~5 files)
						<br />• https://github.com/colinhacks/zod (medium, ~50 files)
						<br />
						Note: Analysis will take 5-15 minutes depending on repo size.
					</p>
				</div>
			</div>
		</div>
	);
}
