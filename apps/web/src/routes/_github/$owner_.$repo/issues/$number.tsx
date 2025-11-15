import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner_/$repo/issues/$number")({
	component: IssueDetailPage,
});

function IssueDetailPage() {
	const { number } = Route.useParams();

	return (
		<div className="space-y-8">
			<div className="rounded-lg border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">Issue #{number}</h2>
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					Coming soon: Detailed AI analysis for this issue including difficulty,
					files to touch, and getting started recommendations.
				</p>
			</div>
		</div>
	);
}
