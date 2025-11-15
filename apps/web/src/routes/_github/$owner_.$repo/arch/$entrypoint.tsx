import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_github/$owner_/$repo/arch/$entrypoint")(
	{
		component: EntrypointDetailPage,
	},
);

function EntrypointDetailPage() {
	const { entrypoint } = Route.useParams();

	return (
		<div className="space-y-8">
			<div className="border border-primary/10 bg-card p-8">
				<h2 className="font-mono font-semibold text-2xl">
					Entrypoint: {entrypoint}
				</h2>
				<p className="mt-4 font-serif text-lg text-muted-foreground">
					Coming soon: Detailed analysis for this specific entrypoint.
				</p>
			</div>
		</div>
	);
}
