import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { OwnerHeader } from "@/components/owner/owner-header";
import { StatusBadge } from "@/components/repo/status-badge";

type RepoWithStatus = {
	owner: string;
	name: string;
	fullName: string;
	description?: string;
	stars: number;
	language?: string;
	githubUrl: string;
	defaultBranch: string;
	updatedAt: number;
	isIndexed: boolean;
	indexingStatus: "queued" | "processing" | "completed" | "failed" | null;
};

type OwnerInfo = {
	login: string;
	name: string;
	avatarUrl: string;
	bio?: string;
	type: "user" | "organization";
	publicRepos: number;
	followers?: number;
	following?: number;
	htmlUrl: string;
};

export const Route = createFileRoute("/_github/$owner")({
	component: OwnerPage,
});

function OwnerPage() {
	const { owner } = Route.useParams();

	// Use TanStack Query for indexed repos (cached, reactive)
	const { data: indexedRepos } = useQuery(
		convexQuery(api.repos.listByOwner, { owner }),
	);

	// State for GitHub API data (fetched via actions)
	const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | undefined>(undefined);
	const [githubRepos, setGithubRepos] = useState<RepoWithStatus[] | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | null>(null);

	const getOwnerInfoAction = useAction(api.repos.getOwnerInfo);
	const getOwnerReposAction = useAction(api.repos.getOwnerRepos);

	// Fetch GitHub data via actions (only runs once per owner)
	useEffect(() => {
		let isCancelled = false;

		async function fetchData() {
			try {
				const [ownerData, reposData] = await Promise.all([
					getOwnerInfoAction({ owner }),
					getOwnerReposAction({ owner, perPage: 30 }),
				]);

				if (!isCancelled) {
					setOwnerInfo(ownerData);
					setGithubRepos(reposData);
				}
			} catch (err) {
				if (!isCancelled) {
					setError(err instanceof Error ? err.message : "Failed to fetch data");
				}
			}
		}
		fetchData();

		return () => {
			isCancelled = true;
		};
	}, [owner, getOwnerInfoAction, getOwnerReposAction]);

	// Merge indexed repos data with GitHub repos for up-to-date status
	const repos: RepoWithStatus[] | undefined = githubRepos?.map((repo) => {
		const indexed = indexedRepos?.find(
			(r) => r.fullName.toLowerCase() === repo.fullName.toLowerCase(),
		);
		return {
			...repo,
			isIndexed: !!indexed,
			indexingStatus: indexed?.indexingStatus ?? null,
		};
	});

	// Error state
	if (error) {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-6 border border-red-500/20 bg-card p-8">
					<h1 className="font-serif text-4xl text-red-600">Error</h1>
					<p className="font-serif text-lg text-muted-foreground">{error}</p>
				</div>
			</div>
		);
	}

	// Loading state
	if (ownerInfo === undefined || repos === undefined) {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-6">
					<div className="h-32 w-32 animate-pulse bg-muted" />
					<div className="h-8 w-64 animate-pulse bg-muted" />
					<div className="h-6 w-96 animate-pulse bg-muted" />
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-7xl px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
			<div className="space-y-12">
				{/* Owner Header */}
				<OwnerHeader ownerInfo={ownerInfo} />

				{/* Repositories Section */}
				<div className="space-y-6">
					<h2 className="font-serif text-3xl">Public Repositories</h2>

					{repos.length === 0 ? (
						<p className="font-serif text-muted-foreground">
							No public repositories found.
						</p>
					) : (
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							{repos.map((repo: RepoWithStatus) => (
								<Link
									key={repo.fullName}
									to="/$owner/$repo"
									params={{ owner: repo.owner, repo: repo.name }}
									className="group space-y-3 border border-primary/10 bg-card p-6 transition-colors hover:border-primary/30"
								>
									{/* Repo name and status */}
									<div className="flex items-start justify-between gap-2">
										<h3 className="font-mono font-semibold text-lg group-hover:text-primary">
											{repo.name}
										</h3>
										{repo.isIndexed && repo.indexingStatus && (
											<StatusBadge
												status={repo.indexingStatus}
												variant="compact"
											/>
										)}
									</div>

									{/* Description */}
									{repo.description && (
										<p className="line-clamp-2 font-serif text-muted-foreground text-sm">
											{repo.description}
										</p>
									)}

									{/* Stats */}
									<div className="flex flex-wrap items-center gap-4 pt-2">
										{repo.language && (
											<span className="font-mono text-muted-foreground text-xs">
												{repo.language}
											</span>
										)}
										<span className="font-mono text-muted-foreground text-xs">
											⭐ {repo.stars.toLocaleString()}
										</span>
									</div>
								</Link>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
