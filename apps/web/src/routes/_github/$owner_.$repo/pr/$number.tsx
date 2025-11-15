import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner_/$repo/pr/$number")({
	component: PullRequestDetailPage,
});

function PullRequestDetailPage() {
	const { number } = Route.useParams();

	return (
		<div className="space-y-8">
			<div className="border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">
					Pull Request #{number}
				</h2>
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					Coming soon: PR impact analysis with review complexity and files
					changed.
				</p>
			</div>
		</div>
	);
}
