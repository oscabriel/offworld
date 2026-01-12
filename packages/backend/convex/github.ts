import { v } from "convex/values";
import { action } from "./_generated/server";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubRepoResponse {
	full_name: string;
	description: string | null;
	stargazers_count: number;
	language: string | null;
	html_url: string;
	default_branch: string;
	owner: {
		login: string;
	};
	name: string;
}

export const fetchRepoMetadata = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (_ctx, args) => {
		const response = await fetch(`${GITHUB_API_BASE}/repos/${args.owner}/${args.name}`, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "offworld-web",
			},
		});

		if (response.status === 404) {
			return null;
		}

		// GitHub returns 403 when rate limited (60 req/hour unauthenticated)
		if (response.status === 403) {
			console.warn("GitHub API rate limited");
			return null;
		}

		if (!response.ok) {
			console.error(`GitHub API error: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = (await response.json()) as GitHubRepoResponse;

		return {
			owner: data.owner.login,
			name: data.name,
			fullName: data.full_name,
			description: data.description ?? undefined,
			stars: data.stargazers_count,
			language: data.language ?? undefined,
			githubUrl: data.html_url,
			defaultBranch: data.default_branch,
		};
	},
});
