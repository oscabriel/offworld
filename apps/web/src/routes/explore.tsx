import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RepoUrlInput } from "@/components/home/repo-url-input";
import { RepoCard } from "@/components/repo/repo-card";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/explore")({
	component: ExploreComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.analyses.list, {}));
	},
});

function ExploreComponent() {
	const [error, setError] = useState<string | null>(null);

	const { data: analyses } = useSuspenseQuery(convexQuery(api.analyses.list, {}));

	return (
		<div className="relative flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-5 pb-21 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-13">
					<div className="space-y-5">
						<h1 className="font-serif text-6xl tracking-tight md:text-7xl">Browse Skills</h1>
					</div>

					<div>
						<RepoUrlInput
							labelText="Search for any public repo"
							buttonText="Search"
							onError={setError}
						/>
						{error && <p className="text-destructive mt-2 font-mono text-sm">{error}</p>}
					</div>

					<div className="space-y-8">
						{!analyses || analyses.length === 0 ? (
							<Card className="border-primary/10 p-13 text-center">
								<p className="text-muted-foreground font-serif text-lg">
									No skills have been generated yet. Be the first!
								</p>
							</Card>
						) : (
							<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
								{analyses.map((analysis) => (
									<RepoCard
										key={analysis.fullName}
										fullName={analysis.fullName}
										pullCount={analysis.pullCount}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
