const GITHUB_API = "https://api.github.com";
const MIN_STARS = 5;

// GitHub App token from environment (set via Convex dashboard)
function getGitHubToken(): string | undefined {
	return process.env.GITHUB_APP_TOKEN;
}

function getAuthHeaders(): Record<string, string> {
	const token = getGitHubToken();
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "offworld-backend",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
}

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
			headers: getAuthHeaders(),
		});

		if (response.status === 404) {
			return { valid: false, error: "Repository not found on GitHub" };
		}

		if (!response.ok) {
			return { valid: false, error: `GitHub API error: ${response.status}` };
		}

		const data = (await response.json()) as {
			stargazers_count?: number;
			private?: boolean;
			description?: string | null;
			full_name?: string;
		};

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
			headers: getAuthHeaders(),
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
