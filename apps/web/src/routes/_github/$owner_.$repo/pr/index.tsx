import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner_/$repo/pr/")({
	component: PullRequestsPage,
});

function PullRequestsPage() {
	return (
		<div className="space-y-8">
			<div className="rounded-lg border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">Pull Requests</h2>
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					Coming soon: PR analysis with impact areas, review complexity, and
					difficulty ratings.
				</p>
			</div>
		</div>
	);
}
