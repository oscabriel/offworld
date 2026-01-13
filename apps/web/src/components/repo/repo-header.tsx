import { ExternalLink } from "lucide-react";

function formatStars(stars: number): string {
	if (stars < 10) return stars.toString();
	if (stars < 100) return `${Math.floor(stars / 10) * 10}+`;
	if (stars < 1000) return `${Math.floor(stars / 100) * 100}+`;
	if (stars < 10000) return `${Math.floor(stars / 1000)}K+`;
	return `${Math.floor(stars / 10000) * 10}K+`;
}

interface RepoHeaderProps {
	owner: string;
	repo: string;
	analysisData?: {
		commitSha?: string;
		pullCount?: number;
		isVerified?: boolean;
	} | null;
	githubMetadata?: {
		description?: string;
		stars?: number;
		language?: string;
	} | null;
	loading?: boolean;
}

export function RepoHeader({
	owner,
	repo,
	analysisData,
	githubMetadata,
	loading,
}: RepoHeaderProps) {
	const hasAnalysis = analysisData !== null && analysisData !== undefined;

	return (
		<header className="border-primary/10 border-b">
			<div className="container mx-auto max-w-7xl px-4 py-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-2">
					<h1 className="group font-serif text-3xl tracking-tight sm:text-5xl">
						<a
							href={`https://github.com/${owner}/${repo}`}
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-muted-foreground inline-flex items-center gap-2 transition-colors"
						>
							{owner}/{repo}
							<ExternalLink className="text-muted-foreground h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 sm:h-8 sm:w-8" />
						</a>
					</h1>
					<div className="text-muted-foreground flex flex-wrap items-center gap-4 font-mono text-sm">
						{hasAnalysis && (
							<>
								<span className="rounded bg-green-500/10 px-2 py-0.5 text-green-500">Analyzed</span>
								{analysisData.commitSha && (
									<span>Commit: {analysisData.commitSha.slice(0, 7)}</span>
								)}
								{analysisData.pullCount !== undefined && (
									<span>{analysisData.pullCount} pulls</span>
								)}
								{analysisData.isVerified && <span className="text-green-500">Verified</span>}
							</>
						)}
						{!hasAnalysis && (
							<span className="rounded bg-yellow-500/10 px-2 py-0.5 text-yellow-600">
								Not Analyzed
							</span>
						)}
						{loading && <span className="bg-muted h-4 w-16 animate-pulse rounded" />}
						{!loading && githubMetadata?.stars !== undefined && (
							<span>⭐ {formatStars(githubMetadata.stars)} stars</span>
						)}
						{!loading && githubMetadata?.language && <span>{githubMetadata.language}</span>}
					</div>
					{loading && <div className="bg-muted h-5 w-64 animate-pulse rounded" />}
					{!loading && githubMetadata?.description && (
						<p className="text-muted-foreground font-mono text-base">
							{githubMetadata.description}
						</p>
					)}
				</div>
			</div>
		</header>
	);
}
