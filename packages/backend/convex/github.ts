import { v } from "convex/values";
import { action } from "./_generated/server";
import { getOctokit } from "./lib/githubAuth";

export const fetchRepoMetadata = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			const { data: repo } = await octokit.repos.get({
				owner: args.owner,
				repo: args.name,
			});

			return {
				owner: repo.owner.login,
				name: repo.name,
				fullName: repo.full_name,
				description: repo.description || undefined,
				stars: repo.stargazers_count,
				language: repo.language || undefined,
				githubUrl: repo.html_url,
				defaultBranch: repo.default_branch,
			};
		} catch (error: unknown) {
			if (error && typeof error === "object" && "status" in error) {
				if (error.status === 404) {
					return null;
				}
				if (error.status === 403) {
					console.warn("GitHub API rate limited");
					return null;
				}
			}
			console.error(
				`GitHub API error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return null;
		}
	},
});

export const fetchOwnerInfo = action({
	args: { owner: v.string() },
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			const { data: user } = await octokit.users.getByUsername({
				username: args.owner,
			});

			return {
				login: user.login,
				name: user.name || user.login,
				avatarUrl: user.avatar_url,
				bio: user.bio || undefined,
				type: user.type.toLowerCase() as "user" | "organization",
				publicRepos: user.public_repos,
				followers: user.followers,
				htmlUrl: user.html_url,
			};
		} catch (error: unknown) {
			if (error && typeof error === "object" && "status" in error) {
				if (error.status === 404) {
					return null;
				}
				if (error.status === 403) {
					console.warn("GitHub API rate limited");
					return null;
				}
			}
			console.error(
				`GitHub API error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return null;
		}
	},
});

export const fetchOwnerRepos = action({
	args: {
		owner: v.string(),
		perPage: v.optional(v.number()),
	},
	handler: async (_ctx, args) => {
		const octokit = getOctokit();

		try {
			const { data: repos } = await octokit.repos.listForUser({
				username: args.owner,
				per_page: args.perPage ?? 30,
				sort: "updated",
			});

			return repos.map((repo) => ({
				owner: repo.owner.login,
				name: repo.name,
				fullName: repo.full_name,
				description: repo.description || undefined,
				stars: repo.stargazers_count,
				language: repo.language || undefined,
			}));
		} catch (error: unknown) {
			if (error && typeof error === "object" && "status" in error) {
				if (error.status === 404) {
					return null;
				}
				if (error.status === 403) {
					console.warn("GitHub API rate limited");
					return null;
				}
			}
			console.error(
				`GitHub API error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return null;
		}
	},
});
