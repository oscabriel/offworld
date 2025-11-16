import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ContentCard } from "@/components/repo/content-card";
import { LoadingCard } from "@/components/repo/loading-card";
import { MarkdownContent } from "@/components/repo/markdown-content";

export const Route = createFileRoute("/_github/$owner_/$repo/arch/")({
	component: ArchitecturePage,
});

function ArchitecturePage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const repoStatus = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const isProcessing = repoStatus?.indexingStatus === "processing";

	// Architecture Section - Show if exists, skeleton if processing without it
	if (repoStatus?.architecture) {
		return (
			<ContentCard title="Architecture">
				<MarkdownContent content={repoStatus.architecture} />
			</ContentCard>
		);
	}

	if (isProcessing) {
		return (
			<LoadingCard
				title="Architecture"
				message="Generating architecture overview..."
			/>
		);
	}

	// No architecture yet
	return (
		<div className="space-y-8">
			<ContentCard title="Architecture Overview">
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					No architecture analysis available yet. Index this repository to
					generate architecture documentation.
				</p>
			</ContentCard>
		</div>
	);
}
