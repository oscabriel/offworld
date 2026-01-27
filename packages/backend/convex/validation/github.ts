import { z } from "zod";
import { GITHUB_API, getGitHubHeaders } from "../lib/github-auth";

const MIN_STARS = 5;

// Zod schema for GitHub repo validation response
const GitHubRepoValidationSchema = z.object({
	stargazers_count: z.number().optional(),
	private: z.boolean().optional(),
	description: z.string().nullable().optional(),
	full_name: z.string().optional(),
});

export interface RepoValidationResult {
	valid: boolean;
	error?: string;
	stars?: number;
	description?: string;
	canonicalFullName?: string;
}

export interface CommitValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Verify repo exists and has minimum stars
 */
export async function validateRepo(fullName: string): Promise<RepoValidationResult> {
	try {
		const response = await fetch(`${GITHUB_API}/repos/${fullName}`, {
			headers: await getGitHubHeaders(),
		});

		if (response.status === 404) {
			return { valid: false, error: "Repository not found on GitHub" };
		}

		if (!response.ok) {
			return { valid: false, error: `GitHub API error: ${response.status}` };
		}

		const json = await response.json();
		const parsed = GitHubRepoValidationSchema.safeParse(json);
		if (!parsed.success) {
			return { valid: false, error: "Invalid GitHub API response" };
		}
		const data = parsed.data;

		if (data.private) {
			return { valid: false, error: "Private repositories not supported" };
		}

		const stars = data.stargazers_count ?? 0;
		if (stars < MIN_STARS) {
			return {
				valid: false,
				error: `Repository has ${stars} stars (minimum ${MIN_STARS} required)`,
				stars,
			};
		}

		return {
			valid: true,
			stars,
			description: data.description ?? undefined,
			canonicalFullName: data.full_name,
		};
	} catch (error) {
		return {
			valid: false,
			error: `Failed to verify repository: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}

/**
 * Verify commit exists in repo
 */
export async function validateCommit(
	fullName: string,
	commitSha: string,
): Promise<CommitValidationResult> {
	try {
		const response = await fetch(`${GITHUB_API}/repos/${fullName}/commits/${commitSha}`, {
			headers: await getGitHubHeaders(),
		});

		if (response.status === 404) {
			return { valid: false, error: "Commit not found in repository" };
		}

		if (!response.ok) {
			return { valid: false, error: `GitHub API error: ${response.status}` };
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: `Failed to verify commit: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}
