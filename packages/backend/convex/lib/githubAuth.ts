/**
 * GitHub App authentication for API requests
 *
 * Uses GitHub App with installation token for higher rate limits (15,000 req/hr)
 */

import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export function getOctokit(): Octokit {
	const appId = process.env.GITHUB_APP_ID;
	const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
	const installationId = process.env.GITHUB_INSTALLATION_ID;

	if (!appId || !privateKey || !installationId) {
		throw new Error(
			"Missing GitHub App credentials. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_INSTALLATION_ID",
		);
	}

	const octokit = new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: Number.parseInt(appId, 10),
			privateKey: privateKey,
			installationId: Number.parseInt(installationId, 10),
		},
	});

	return octokit;
}
