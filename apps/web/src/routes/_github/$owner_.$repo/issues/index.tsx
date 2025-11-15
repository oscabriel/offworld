import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner_/$repo/issues/")({
	component: IssuesPage,
});

function IssuesPage() {
	return (
		<div className="space-y-8">
			<div className="border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">Good First Issues</h2>
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					Coming soon: Analyzed issues with difficulty ratings and contribution
					opportunities.
				</p>
			</div>
		</div>
	);
}
