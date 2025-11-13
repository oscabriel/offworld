import { mutation } from "./_generated/server";

/**
 * Clear all data from all tables (development only!)
 * WARNING: This will delete everything
 */
export const clearAllData = mutation({
	args: {},
	handler: async (ctx) => {
		// Get all records from each table
		const repositories = await ctx.db.query("repositories").collect();
		const codeChunks = await ctx.db.query("codeChunks").collect();
		const issues = await ctx.db.query("issues").collect();
		const savedRepos = await ctx.db.query("savedRepos").collect();
		const savedIssues = await ctx.db.query("savedIssues").collect();

		// Delete all records
		for (const repo of repositories) {
			await ctx.db.delete(repo._id);
		}
		for (const chunk of codeChunks) {
			await ctx.db.delete(chunk._id);
		}
		for (const issue of issues) {
			await ctx.db.delete(issue._id);
		}
		for (const savedRepo of savedRepos) {
			await ctx.db.delete(savedRepo._id);
		}
		for (const savedIssue of savedIssues) {
			await ctx.db.delete(savedIssue._id);
		}

		return {
			deleted: {
				repositories: repositories.length,
				codeChunks: codeChunks.length,
				issues: issues.length,
				savedRepos: savedRepos.length,
				savedIssues: savedIssues.length,
			},
			message: "All data cleared successfully",
		};
	},
});
