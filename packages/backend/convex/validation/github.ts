import { getOctokit } from "../lib/githubAuth";

const MIN_STARS = 5;

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
		const octokit = getOctokit();
		const parts = fullName.split("/");
		const owner = parts[0];
		const repo = parts[1];

		if (!owner || !repo) {
			return { valid: false, error: "Invalid repository name format" };
		}

		const { data } = await octokit.repos.get({ owner, repo });

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
	} catch (error: unknown) {
		if (error && typeof error === "object" && "status" in error && error.status === 404) {
			return { valid: false, error: "Repository not found on GitHub" };
		}
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
		const octokit = getOctokit();
		const parts = fullName.split("/");
		const owner = parts[0];
		const repo = parts[1];

		if (!owner || !repo) {
			return { valid: false, error: "Invalid repository name format" };
		}

		await octokit.repos.getCommit({ owner, repo, ref: commitSha });

		return { valid: true };
	} catch (error: unknown) {
		if (error && typeof error === "object" && "status" in error && error.status === 404) {
			return { valid: false, error: "Commit not found in repository" };
		}
		return {
			valid: false,
			error: `Failed to verify commit: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}
