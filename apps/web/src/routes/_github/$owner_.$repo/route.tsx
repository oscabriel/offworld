import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { MobileTabNav } from "@/components/repo/mobile-tab-nav";
import { RepoHeader } from "@/components/repo/repo-header";
import { RepoNavigation } from "@/components/repo/repo-navigation";

export const Route = createFileRoute("/_github/$owner_/$repo")({
	component: RepoLayout,
});

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
			<div className="container mx-auto max-w-7xl px-4 py-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="mb-6 space-y-2 border-b pb-6">
					<div className="h-10 w-64 animate-pulse bg-muted" />
					<div className="h-4 w-96 animate-pulse bg-muted" />
				</div>
			</div>
		);
	}

	const isNotIndexed = repoData === null;

	return (
		<div className="min-h-screen pt-14">
			{/* Header */}
			<RepoHeader owner={owner} repo={repo} repoData={repoData} />

			{/* Two-column layout */}
			<div className="container mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				{/* Left Navigation (Desktop only) */}
				<aside className="sticky top-6 hidden w-60 shrink-0 self-start lg:block">
					<RepoNavigation disabled={isNotIndexed} />
				</aside>

				{/* Main Content */}
				<main className="min-w-0 flex-1">
					<MobileTabNav className="mb-6 lg:hidden" disabled={isNotIndexed} />
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
