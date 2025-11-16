interface RepoStatsProps {
	chunkCount?: number;
	issueCount?: number;
	isProcessing?: boolean;
}

export function RepoStats({
	chunkCount,
	issueCount,
	isProcessing = false,
}: RepoStatsProps) {
	return (
		<div className="flex gap-6 border border-primary/10 bg-card p-6">
			<div className="flex flex-col">
				<span className="font-mono text-muted-foreground text-xs uppercase">
					Code Chunks
				</span>
				{chunkCount !== undefined && chunkCount > 0 ? (
					<span className="mt-1 font-mono font-semibold text-3xl">
						{chunkCount}
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
				{issueCount !== undefined && issueCount > 0 ? (
					<span className="mt-1 font-mono font-semibold text-3xl">
						{issueCount}
					</span>
				) : (
					<span className="mt-1 font-mono text-3xl text-muted-foreground">
						{isProcessing ? "..." : "0"}
					</span>
				)}
			</div>
		</div>
	);
}
