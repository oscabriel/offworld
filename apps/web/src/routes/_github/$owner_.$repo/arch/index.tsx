import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";

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
			<div className="space-y-6 rounded-lg border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">Architecture</h2>
				<div className="markdown-content font-serif text-lg leading-relaxed [&>code]:rounded [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:font-mono [&>code]:text-sm [&>h1]:mb-4 [&>h1]:font-mono [&>h1]:font-semibold [&>h1]:text-2xl [&>h2]:mb-3 [&>h2]:font-mono [&>h2]:font-semibold [&>h2]:text-xl [&>h3]:mb-2 [&>h3]:font-mono [&>h3]:font-semibold [&>h3]:text-lg [&>li]:leading-relaxed [&>ol]:mb-4 [&>ol]:ml-6 [&>ol]:list-decimal [&>ol]:space-y-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>strong]:font-semibold [&>strong]:text-foreground [&>ul]:mb-4 [&>ul]:ml-6 [&>ul]:list-disc [&>ul]:space-y-2">
					<ReactMarkdown>{repoStatus.architecture}</ReactMarkdown>
				</div>
			</div>
		);
	}

	if (isProcessing) {
		return (
			<div className="space-y-6 rounded-lg border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl text-muted-foreground">
					Architecture
				</h2>
				<div className="space-y-3">
					<div className="h-4 w-full animate-pulse rounded bg-muted" />
					<div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
				</div>
				<p className="pt-2 font-mono text-muted-foreground text-sm">
					Generating architecture overview...
				</p>
			</div>
		);
	}

	// No architecture yet
	return (
		<div className="space-y-8">
			<div className="rounded-lg border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">
					Architecture Overview
				</h2>
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					No architecture analysis available yet. Index this repository to
					generate architecture documentation.
				</p>
			</div>
		</div>
	);
}
