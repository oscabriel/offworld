import { convexAction, convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { RepoCard } from "@/components/repo/repo-card";

export const Route = createFileRoute("/_github/$owner/")({
	component: OwnerPage,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.repository.listByOwner, { owner: params.owner }),
		);
	},
});

function OwnerHeaderSkeleton() {
	return (
		<div className="flex items-start gap-8">
			<div className="border-primary/10 bg-muted size-21 shrink-0 animate-pulse border" />
			<div className="space-y-3">
				<div className="bg-muted h-13 w-48 animate-pulse" />
				<div className="bg-muted h-5 w-64 animate-pulse" />
			</div>
		</div>
	);
}

function RepoGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="border-primary/10 space-y-3 border p-5">
					<div className="bg-muted h-6 w-3/4 animate-pulse" />
					<div className="bg-muted h-4 w-full animate-pulse" />
					<div className="bg-muted h-4 w-2/3 animate-pulse" />
				</div>
			))}
		</div>
	);
}

function OwnerPage() {
	const { owner } = Route.useParams();
	const { data: indexedRepos } = useSuspenseQuery(
		convexQuery(api.repository.listByOwner, { owner }),
	);

	const {
		data: ownerInfo,
		isLoading: ownerLoading,
		isError: ownerError,
	} = useQuery(convexAction(api.github.fetchOwnerInfo, { owner }));

	const { data: repos, isLoading: reposLoading } = useQuery(
		convexAction(api.github.fetchOwnerRepos, { owner, perPage: 30 }),
	);

	const indexedRepoNames = new Set(indexedRepos.map((r) => r.fullName));

	if (ownerLoading || reposLoading) {
		return <OwnerPageSkeleton />;
	}

	if (ownerError || !ownerInfo) {
		return (
			<div className="container mx-auto max-w-7xl px-5 pb-13 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="border-destructive/20 bg-destructive/5 border p-8">
					<h1 className="text-destructive font-serif text-2xl">Error</h1>
					<p className="text-muted-foreground mt-2 font-mono">Owner not found</p>
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
						className="border-primary/10 size-21 shrink-0 border"
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
							{repos.map((repo) => (
								<RepoCard
									key={repo.fullName}
									fullName={repo.fullName}
									displayName={repo.name}
									stars={repo.stars ?? 0}
									description={repo.description}
									language={repo.language}
									indexed={indexedRepoNames.has(repo.fullName)}
								/>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function OwnerPageSkeleton() {
	return (
		<div className="container mx-auto max-w-7xl px-5 pb-13 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
			<div className="space-y-13">
				<OwnerHeaderSkeleton />
				<section className="space-y-8">
					<div className="bg-muted h-8 w-48 animate-pulse" />
					<RepoGridSkeleton count={6} />
				</section>
			</div>
		</div>
	);
}
