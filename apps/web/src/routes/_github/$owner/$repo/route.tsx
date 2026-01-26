import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export function repoReferencesQuery(owner: string, repo: string) {
	return convexQuery(api.references.listByRepo, { fullName: `${owner}/${repo}`.toLowerCase() });
}

export const Route = createFileRoute("/_github/$owner/$repo")({
	staticData: {
		crumbs: (params) => [
			{
				label: params.repo,
				to: "/$owner/$repo",
				params: { owner: params.owner, repo: params.repo },
			},
		],
	},
	component: () => <Outlet />,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(repoReferencesQuery(params.owner, params.repo));
	},
});
