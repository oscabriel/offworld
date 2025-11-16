import { internalMutation } from "./_generated/server";

/**
 * Remove pull requests that were mistakenly stored as issues
 * PRs have URLs like: https://github.com/owner/repo/pull/123
 * Issues have URLs like: https://github.com/owner/repo/issues/123
 */
export const removePullRequestsFromIssues = internalMutation({
	args: {},
	handler: async (ctx) => {
		// Find all issues with "/pull/" in their GitHub URL
		const allIssues = await ctx.db.query("issues").collect();

		const pullRequests = allIssues.filter((issue) =>
			issue.githubUrl.includes("/pull/"),
		);

		// Delete each PR
		for (const pr of pullRequests) {
			await ctx.db.delete(pr._id);
		}

		return {
			totalIssues: allIssues.length,
			pullRequestsRemoved: pullRequests.length,
			remainingIssues: allIssues.length - pullRequests.length,
		};
	},
});
