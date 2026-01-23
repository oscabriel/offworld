import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ArrowRight, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/repo/status-badge";

type OwnerInfo = {
	login: string;
	name: string;
	avatarUrl: string;
	bio?: string;
	type: "user" | "organization";
	publicRepos: number;
	followers: number;
	htmlUrl: string;
};

type GitHubRepo = {
	owner: string;
	name: string;
	fullName: string;
	description?: string;
	stars: number;
	language?: string;
};

export const Route = createFileRoute("/_github/$owner")({
	component: OwnerPage,
});

function OwnerPage() {
	const { owner } = Route.useParams();

	const { data: allAnalyses } = useQuery(
		convexQuery(api.analyses.list, { limit: 200 }),
	);

	const indexedRepoNames = new Set(
		allAnalyses
			?.filter((a) => a.fullName.toLowerCase().startsWith(`${owner.toLowerCase()}/`))
			.map((a) => a.fullName.toLowerCase()) ?? [],
	);

	const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
	const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchOwnerInfo = useAction(api.github.fetchOwnerInfo);
	const fetchOwnerRepos = useAction(api.github.fetchOwnerRepos);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const [info, repoList] = await Promise.all([
					fetchOwnerInfo({ owner }),
					fetchOwnerRepos({ owner, perPage: 30 }),
				]);

				if (cancelled) return;

				if (!info) {
					setError("Owner not found");
					setLoading(false);
					return;
				}

				setOwnerInfo(info);
				setRepos(repoList ?? []);
				setLoading(false);
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load");
					setLoading(false);
				}
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, [owner, fetchOwnerInfo, fetchOwnerRepos]);

	if (loading) {
		return (
			<div className="container mx-auto max-w-7xl px-5 pb-13 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="flex items-start gap-8">
					<div className="size-21 shrink-0 animate-pulse border border-primary/10 bg-muted" />
					<div className="space-y-3">
						<div className="h-13 w-48 animate-pulse bg-muted" />
						<div className="h-5 w-64 animate-pulse bg-muted" />
					</div>
				</div>
			</div>
		);
	}

	if (error || !ownerInfo) {
		return (
			<div className="container mx-auto max-w-7xl px-5 pb-13 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="border border-destructive/20 bg-destructive/5 p-8">
					<h1 className="font-serif text-2xl text-destructive">Error</h1>
					<p className="text-muted-foreground mt-2 font-mono">{error ?? "Owner not found"}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-7xl px-5 pb-13 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
			<div className="space-y-13">
				<header className="flex items-start gap-8">
					<img
						src={ownerInfo.avatarUrl}
						alt={ownerInfo.name}
						className="size-21 shrink-0 border border-primary/10"
					/>
					<div className="space-y-2">
						<h1 className="font-serif text-5xl tracking-tight">{ownerInfo.name}</h1>
						<p className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-sm">
							<span>@{ownerInfo.login}</span>
							<span className="capitalize">{ownerInfo.type}</span>
							<span>{ownerInfo.publicRepos} public repos</span>
							<span>{ownerInfo.followers} followers</span>
						</p>
						<a
							href={ownerInfo.htmlUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-foreground hover:text-muted-foreground inline-flex items-center gap-1 font-mono text-sm underline underline-offset-2 transition-colors"
						>
							View on GitHub <ArrowRight className="size-3" />
						</a>
					</div>
				</header>

				<section className="space-y-8">
					<h2 className="font-serif text-3xl">Public Repositories</h2>

					{!repos || repos.length === 0 ? (
						<p className="text-muted-foreground font-serif">No public repositories found.</p>
					) : (
						<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
							{repos.map((repo) => {
								const isIndexed = indexedRepoNames.has(repo.fullName.toLowerCase());
								return (
									<Link
										key={repo.fullName}
										to="/$owner/$repo"
										params={{ owner: repo.owner, repo: repo.name }}
										className="group flex min-h-34 flex-col justify-between border border-primary/10 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30"
									>
										<div className="space-y-2">
											<div className="flex items-start justify-between gap-3">
												<h3 className="font-mono font-semibold group-hover:text-primary">
													{repo.name}
												</h3>
												{isIndexed && <StatusBadge status="indexed" variant="compact" />}
											</div>
											{repo.description && (
												<p className="text-muted-foreground line-clamp-2 font-serif text-sm">
													{repo.description}
												</p>
											)}
										</div>
										<div className="text-muted-foreground mt-3 flex items-center gap-5 font-mono text-xs">
											{repo.language && <span>{repo.language}</span>}
											<span className="flex items-center gap-1">
												<Star className="size-3" />
												{repo.stars.toLocaleString()}
											</span>
										</div>
									</Link>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
