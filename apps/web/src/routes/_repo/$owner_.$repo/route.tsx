import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { RepoHeader } from "@/components/repo/repo-header";

export const Route = createFileRoute("/_repo/$owner_/$repo")({
	component: RepoLayout,
	loader: async ({ context, params }) => {
		const fullName = `${params.owner}/${params.repo}`;
		const isServer = !!context.convexQueryClient.serverHttpClient;
		if (isServer) {
			await context.queryClient.ensureQueryData(convexQuery(api.analyses.get, { fullName }));
		}
	},
});

function RepoLayout() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const { data: analysisData } = useQuery(convexQuery(api.analyses.get, { fullName }));

	const fetchGitHubMetadata = useAction(api.github.fetchRepoMetadata);
	const [githubMetadata, setGithubMetadata] = useState<{
		description?: string;
		stars?: number;
		language?: string;
	} | null>(null);
	const [metadataLoading, setMetadataLoading] = useState(true);

	useEffect(() => {
		if (owner && repo) {
			setMetadataLoading(true);
			fetchGitHubMetadata({ owner, name: repo })
				.then((metadata) => {
					if (metadata) {
						setGithubMetadata({
							description: metadata.description,
							stars: metadata.stars,
							language: metadata.language,
						});
					}
				})
				.catch(() => {
					setGithubMetadata(null);
				})
				.finally(() => {
					setMetadataLoading(false);
				});
		}
	}, [owner, repo, fetchGitHubMetadata]);

	return (
		<div className="flex flex-1 flex-col pt-14">
			<RepoHeader
				owner={owner}
				repo={repo}
				analysisData={analysisData}
				githubMetadata={githubMetadata}
				loading={metadataLoading}
			/>
			<Outlet />
		</div>
	);
}
