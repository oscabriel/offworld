import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";

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

	const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | undefined>(undefined);
	const [repos, setRepos] = useState<RepoWithStatus[] | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);

	const getOwnerInfoAction = useAction(api.repos.getOwnerInfo);
	const getOwnerReposAction = useAction(api.repos.getOwnerRepos);

	useEffect(() => {
		async function fetchData() {
			try {
				const [ownerData, reposData] = await Promise.all([
					getOwnerInfoAction({ owner }),
					getOwnerReposAction({ owner, perPage: 30 }),
				]);
				setOwnerInfo(ownerData);
				setRepos(reposData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch data");
			}
		}
		fetchData();
	}, [owner, getOwnerInfoAction, getOwnerReposAction]);

	// Error state
	if (error) {
		return (
			<div className="container mx-auto max-w-6xl px-4 py-24">
				<div className="space-y-6 rounded-lg border border-red-500/20 bg-card p-8">
					<h1 className="font-serif text-4xl text-red-600">Error</h1>
					<p className="font-serif text-lg text-muted-foreground">{error}</p>
				</div>
			</div>
		);
	}

	// Loading state
	if (ownerInfo === undefined || repos === undefined) {
		return (
			<div className="container mx-auto max-w-6xl px-4 py-24">
				<div className="space-y-6">
					<div className="h-32 w-32 animate-pulse rounded-full bg-muted" />
					<div className="h-8 w-64 animate-pulse rounded bg-muted" />
					<div className="h-6 w-96 animate-pulse rounded bg-muted" />
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-6xl px-4 py-24">
			<div className="space-y-12">
				{/* Owner Header */}
				<div className="flex items-start gap-6">
					<img
						src={ownerInfo.avatarUrl}
						alt={ownerInfo.name}
						className="h-32 w-32 rounded-full border-2 border-primary/20"
					/>
					<div className="flex-1 space-y-3">
						<h1 className="font-serif text-5xl tracking-tight">
							{ownerInfo.name}
						</h1>
						<div className="flex flex-wrap items-center gap-4">
							<span className="font-mono text-muted-foreground text-sm">
								@{ownerInfo.login}
							</span>
							<span className="font-mono text-muted-foreground text-sm capitalize">
								{ownerInfo.type}
							</span>
							<span className="font-mono text-muted-foreground text-sm">
								{ownerInfo.publicRepos} public repos
							</span>
							{ownerInfo.followers !== undefined && (
								<span className="font-mono text-muted-foreground text-sm">
									{ownerInfo.followers.toLocaleString()} followers
								</span>
							)}
						</div>
						{ownerInfo.bio && (
							<p className="max-w-2xl font-serif text-lg text-muted-foreground">
								{ownerInfo.bio}
							</p>
						)}
						<a
							href={ownerInfo.htmlUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-block font-mono text-primary underline hover:no-underline"
						>
							View on GitHub →
						</a>
					</div>
				</div>

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
									className="group space-y-3 rounded-lg border border-primary/10 bg-card p-6 transition-colors hover:border-primary/30"
								>
									{/* Repo name and status */}
									<div className="flex items-start justify-between gap-2">
										<h3 className="font-mono font-semibold text-lg group-hover:text-primary">
											{repo.name}
										</h3>
										{repo.isIndexed && (
											<span
												className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 font-mono text-xs ${
													repo.indexingStatus === "completed"
														? "bg-green-500/10 text-green-600"
														: repo.indexingStatus === "processing"
															? "bg-yellow-500/10 text-yellow-600"
															: "bg-muted text-muted-foreground"
												}`}
											>
												{repo.indexingStatus === "completed"
													? "Indexed"
													: repo.indexingStatus === "processing"
														? "Processing"
														: "Indexed"}
											</span>
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
