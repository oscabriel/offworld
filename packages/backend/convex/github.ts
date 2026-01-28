import { v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
import { GITHUB_API, getGitHubHeaders } from "./lib/githubAuth";

// Zod schemas for runtime validation of GitHub API responses
const GitHubRepoResponseSchema = z.object({
	full_name: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	stargazers_count: z.number(),
	language: z.string().nullable(),
	html_url: z.string(),
	default_branch: z.string(),
	owner: z.object({
		login: z.string(),
	}),
});

const GitHubOwnerResponseSchema = z.object({
	login: z.string(),
	name: z.string().nullable(),
	avatar_url: z.string(),
	bio: z.string().nullable(),
	type: z.enum(["User", "Organization"]),
	public_repos: z.number(),
	followers: z.number(),
	html_url: z.string(),
});

export const fetchRepoMetadata = action({
	args: {
		owner: v.string(),
		name: v.string(),
	},
	handler: async (_ctx, args) => {
		const response = await fetch(`${GITHUB_API}/repos/${args.owner}/${args.name}`, {
			headers: await getGitHubHeaders(),
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

		const json = await response.json();
		const parsed = GitHubRepoResponseSchema.safeParse(json);
		if (!parsed.success) {
			console.error("Invalid GitHub repo response:", parsed.error.message);
			return null;
		}
		const data = parsed.data;

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
		const response = await fetch(`${GITHUB_API}/users/${args.owner}`, {
			headers: await getGitHubHeaders(),
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

		const json = await response.json();
		const parsed = GitHubOwnerResponseSchema.safeParse(json);
		if (!parsed.success) {
			console.error("Invalid GitHub owner response:", parsed.error.message);
			return null;
		}
		const data = parsed.data;

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
			`${GITHUB_API}/users/${args.owner}/repos?per_page=${perPage}&sort=updated`,
			{ headers: await getGitHubHeaders() },
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

		const json = await response.json();
		const parsed = z.array(GitHubRepoResponseSchema).safeParse(json);
		if (!parsed.success) {
			console.error("Invalid GitHub repos response:", parsed.error.message);
			return null;
		}

		return parsed.data.map((repo) => ({
			owner: repo.owner.login,
			name: repo.name,
			fullName: repo.full_name,
			description: repo.description ?? undefined,
			stars: repo.stargazers_count,
			language: repo.language ?? undefined,
		}));
	},
});
