import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";
import { MarkdownContent } from "@/components/repo/markdown-content";

export const Route = createFileRoute("/_github/$owner_/$repo/")({
	component: RepoAnalysisPage,
});

function ContentSkeleton() {
	return (
		<div className="space-y-5">
			<div className="bg-muted h-8 w-3/4 animate-pulse" />
			<div className="bg-muted h-5 w-full animate-pulse" />
			<div className="bg-muted h-5 w-full animate-pulse" />
			<div className="bg-muted h-5 w-2/3 animate-pulse" />
		</div>
	);
}

function RepoAnalysisPage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const analysisQuery = useQuery(convexQuery(api.analyses.get, { fullName }));
	const analysis = analysisQuery.data;
	const isLoading = analysisQuery.isLoading;

	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<ContentSkeleton />
				</div>
			</div>
		);
	}

	if (!analysis) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="border-primary/10 border p-8">
						<div className="flex items-start gap-5">
							<div className="bg-muted/50 border-primary/10 flex size-13 shrink-0 items-center justify-center border">
								<Terminal className="text-muted-foreground size-5" />
							</div>
							<div className="space-y-3">
								<h3 className="font-serif text-xl">No Skill Generated</h3>
								<p className="text-muted-foreground max-w-lg font-serif leading-relaxed">
									This repository doesn't have a skill yet. Use the install command above to analyze
									the codebase and generate a skill that can be used by AI coding agents.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<article className="border-primary/10 border p-8">
					<MarkdownContent content={analysis.summary} />
				</article>
			</div>
		</div>
	);
}
