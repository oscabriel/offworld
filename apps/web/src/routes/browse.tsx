import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RepoUrlInput } from "@/components/home/repo-url-input";
import { Footer } from "@/components/layout/footer";
import { RepoCard } from "@/components/repo/repo-card";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/browse")({
	component: BrowseComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.analyses.list, {}));
	},
});

function BrowseComponent() {
	const [error, setError] = useState<string | null>(null);

	const { data: analyses } = useSuspenseQuery(convexQuery(api.analyses.list, {}));

	return (
		<div className="relative flex min-h-screen flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-14">
					{/* Header */}
					<div className="space-y-6">
						<h1 className="font-serif text-6xl tracking-tight md:text-7xl">Explore Repositories</h1>
					</div>

					{/* URL Input Section */}
					<div>
						<RepoUrlInput
							labelText="Search for a repository"
							buttonText="Search"
							onError={setError}
						/>
						{error && <p className="mt-2 font-mono text-red-500 text-sm">{error}</p>}
					</div>

					{/* Pre-Indexed Repositories Grid */}
					<div className="space-y-8">
						{!analyses || analyses.length === 0 ? (
							<Card className="rounded-none border-primary/10 p-12 text-center shadow-none">
								<p className="font-serif text-lg text-muted-foreground">
									No repositories have been analyzed yet. Be the first!
								</p>
							</Card>
						) : (
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
			<Footer />
		</div>
	);
}
