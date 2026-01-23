import { v } from "convex/values";
import { action } from "./_generated/server";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubOwnerResponse {
	login: string;
	name: string | null;
	avatar_url: string;
	bio: string | null;
	type: "User" | "Organization";
	public_repos: number;
	followers: number;
	following: number;
	html_url: string;
}

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

export const fetchOwnerInfo = action({
	args: { owner: v.string() },
	handler: async (_ctx, args) => {
		const response = await fetch(`${GITHUB_API_BASE}/users/${args.owner}`, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "offworld-web",
			},
		});

		if (response.status === 404) return null;
		if (response.status === 403) {
			console.warn("GitHub API rate limited");
			return null;
		}
		if (!response.ok) {
			console.error(`GitHub API error: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = (await response.json()) as GitHubOwnerResponse;

		return {
			login: data.login,
			name: data.name ?? data.login,
			avatarUrl: data.avatar_url,
			bio: data.bio ?? undefined,
			type: data.type.toLowerCase() as "user" | "organization",
			publicRepos: data.public_repos,
			followers: data.followers,
			htmlUrl: data.html_url,
		};
	},
});

export const fetchOwnerRepos = action({
	args: {
		owner: v.string(),
		perPage: v.optional(v.number()),
	},
	handler: async (_ctx, args) => {
		const perPage = args.perPage ?? 30;
		const response = await fetch(
			`${GITHUB_API_BASE}/users/${args.owner}/repos?per_page=${perPage}&sort=updated`,
			{
				headers: {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "offworld-web",
				},
			},
		);

		if (response.status === 404) return null;
		if (response.status === 403) {
			console.warn("GitHub API rate limited");
			return null;
		}
		if (!response.ok) {
			console.error(`GitHub API error: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = (await response.json()) as GitHubRepoResponse[];

		return data.map((repo) => ({
			owner: repo.owner.login,
			name: repo.name,
			fullName: repo.full_name,
			description: repo.description ?? undefined,
			stars: repo.stargazers_count,
			language: repo.language ?? undefined,
		}));
	},
});
