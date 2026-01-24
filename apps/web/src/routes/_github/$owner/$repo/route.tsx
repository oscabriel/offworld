import { convexAction, convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RepoHeader } from "@/components/repo/repo-header";

export function repoSkillsQuery(owner: string, repo: string) {
	return convexQuery(api.analyses.listByRepo, { fullName: `${owner}/${repo}`.toLowerCase() });
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
	component: RepoLayout,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(repoSkillsQuery(params.owner, params.repo));
	},
});

function RepoLayout() {
	const { owner, repo } = Route.useParams();

	const { data: skills = [], isLoading: skillsLoading } = useQuery(repoSkillsQuery(owner, repo));
	const primarySkill = skills[0] ?? null;
	const analysisData = primarySkill
		? {
				commitSha: primarySkill.commitSha,
				pullCount: primarySkill.pullCount,
				isVerified: primarySkill.isVerified,
			}
		: null;

	const { data: githubMetadata = null, isLoading: metadataLoading } = useQuery(
		convexAction(api.github.fetchRepoMetadata, { owner, name: repo }),
	);

	return (
		<div className="flex flex-1 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				analysisData={analysisData}
				githubMetadata={githubMetadata}
				loading={skillsLoading || metadataLoading}
			/>
			<Outlet />
		</div>
	);
}
