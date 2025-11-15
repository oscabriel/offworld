import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { MobileTabNav } from "@/components/repo/mobile-tab-nav";
import { RepoNavigation } from "@/components/repo/repo-navigation";

export const Route = createFileRoute("/_github/$owner_/$repo")({
	component: RepoLayout,
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

function RepoLayout() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	// Query repository data for header
	const repoData = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	// Show loading skeleton while fetching
	if (repoData === undefined) {
		return (
			<div className="container mx-auto max-w-screen-2xl px-4 py-6">
				<div className="mb-6 space-y-2 border-b pb-6">
					<div className="h-10 w-64 animate-pulse rounded bg-muted" />
					<div className="h-4 w-96 animate-pulse rounded bg-muted" />
				</div>
			</div>
		);
	}

	// Repository not found - show minimal error
	if (repoData === null) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-24">
				<Outlet />
			</div>
		);
	}

	const isCompleted = repoData.indexingStatus === "completed";
	const isProcessing = repoData.indexingStatus === "processing";

	return (
		<div className="min-h-screen pt-14">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto max-w-screen-2xl px-4 py-6">
					<div className="space-y-2">
						<h1 className="font-serif text-5xl tracking-tight">
							{owner}/{repo}
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
											: isProcessing
												? "bg-yellow-500/10 text-yellow-600"
												: "bg-gray-500/10 text-gray-600"
									}`}
								>
									{repoData.indexingStatus}
								</span>
							</div>
							{isCompleted && repoData.lastAnalyzedAt && (
								<span className="font-mono text-muted-foreground text-sm">
									Analyzed {formatTimestamp(repoData.lastAnalyzedAt)}
								</span>
							)}
							{repoData.stars !== undefined && (
								<span className="font-mono text-muted-foreground text-sm">
									⭐ {repoData.stars.toLocaleString()} stars
								</span>
							)}
							{repoData.language && (
								<span className="font-mono text-muted-foreground text-sm">
									{repoData.language}
								</span>
							)}
							<a
								href={`https://github.com/${owner}/${repo}`}
								target="_blank"
								rel="noopener noreferrer"
								className="font-mono text-primary text-sm underline hover:no-underline"
							>
								View on GitHub →
							</a>
						</div>
						{repoData.description && (
							<p className="font-mono text-base text-muted-foreground">
								{repoData.description}
							</p>
						)}
					</div>
				</div>
			</header>

			{/* Three-column layout */}
			<div className="container mx-auto flex max-w-screen-2xl gap-6 px-4 py-6">
				{/* Left Navigation (Desktop only) */}
				<aside className="sticky top-6 hidden w-60 shrink-0 self-start lg:block">
					<RepoNavigation />
				</aside>

				{/* Main Content */}
				<main className="min-w-0 flex-1">
					<MobileTabNav className="mb-6 lg:hidden" />
					<Outlet />
				</main>

				{/* Right Chat Sidebar (Large Desktop + Authenticated - will implement later) */}
				{/* TODO: Implement ChatSidebar component */}
				{/* {isCompleted && (
					<aside className="w-96 shrink-0 sticky top-6 self-start hidden xl:block">
						<ChatSidebar repoId={repoData._id} />
					</aside>
				)} */}
			</div>
		</div>
	);
}
