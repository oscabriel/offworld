import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/repo/status-badge";
import { InstallCommandBox } from "@/components/repo/install-command-box";

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

	const fullName = `${owner}/${repo}`;

	return (
		<header>
			<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-5">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="space-y-3">
							<h1 className="group font-serif text-6xl tracking-tight md:text-7xl">
								<a
									href={`https://github.com/${owner}/${repo}`}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-muted-foreground inline-flex items-center gap-3 transition-colors"
								>
									{owner}/{repo}
									<ExternalLink className="text-muted-foreground size-8 opacity-0 transition-opacity group-hover:opacity-100 md:size-10" />
								</a>
							</h1>
							<div className="text-muted-foreground flex flex-wrap items-center gap-5 font-mono text-sm">
								{hasAnalysis && (
									<>
										<StatusBadge status="indexed" variant="compact" />
										{analysisData.commitSha && (
											<span>Commit: {analysisData.commitSha.slice(0, 7)}</span>
										)}
										{analysisData.pullCount !== undefined && (
											<span>{analysisData.pullCount} pulls</span>
										)}
										{analysisData.isVerified && <span className="text-green-500">Verified</span>}
									</>
								)}
								{!hasAnalysis && <StatusBadge status="not-indexed" variant="compact" />}
								{loading && <span className="bg-muted h-4 w-16 animate-pulse" />}
								{!loading && githubMetadata?.stars !== undefined && (
									<span>⭐ {formatStars(githubMetadata.stars)} stars</span>
								)}
								{!loading && githubMetadata?.language && <span>{githubMetadata.language}</span>}
							</div>
							{loading && <div className="bg-muted h-5 w-64 animate-pulse" />}
							{!loading && githubMetadata?.description && (
								<p className="text-muted-foreground font-mono text-base">
									{githubMetadata.description}
								</p>
							)}
						</div>
						<InstallCommandBox
							fullName={fullName}
							label={hasAnalysis ? "Install skill" : "Create skill"}
						/>
					</div>
				</div>
			</div>
		</header>
	);
}
