/**
 * Mock for git command execution
 * Used to test clone.ts without actually executing git commands
 */

import { vi, type Mock } from "vitest";

export interface GitMockConfig {
	/** Mock git clone behavior */
	clone?: {
		shouldSucceed?: boolean;
		errorMessage?: string;
	};
	/** Mock git fetch behavior */
	fetch?: {
		shouldSucceed?: boolean;
		errorMessage?: string;
	};
	/** Mock git pull behavior */
	pull?: {
		shouldSucceed?: boolean;
		errorMessage?: string;
	};
	/** Mock git rev-parse HEAD output */
	revParse?: {
		sha?: string;
		shouldSucceed?: boolean;
		errorMessage?: string;
	};
	/** Custom command handler */
	customHandler?: (command: string, args: string[], cwd: string | undefined) => string;
}

const defaultConfig: GitMockConfig = {
	clone: { shouldSucceed: true },
	fetch: { shouldSucceed: true },
	pull: { shouldSucceed: true },
	revParse: { sha: "abc123def456abc123def456abc123def456abc1", shouldSucceed: true },
};

let currentConfig: GitMockConfig = { ...defaultConfig };

/**
 * Mock implementation of execSync for git commands
 */
export function createExecSyncMock(): Mock {
	return vi.fn((command: string, options?: { cwd?: string }) => {
		const cwd = options?.cwd;

		const parts = command.split(" ");
		if (parts[0] !== "git") {
			throw new Error(`Expected git command, got: ${command}`);
		}

		const gitCommand = parts[1]!;
		const args = parts.slice(2);

		if (currentConfig.customHandler) {
			return currentConfig.customHandler(gitCommand, args, cwd);
		}

		switch (gitCommand) {
			case "clone": {
				const config = currentConfig.clone ?? defaultConfig.clone;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "Clone failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 128;
					error.stderr = config?.errorMessage ?? "fatal: repository not found";
					throw error;
				}
				return "";
			}

			case "fetch": {
				const config = currentConfig.fetch ?? defaultConfig.fetch;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "Fetch failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 1;
					error.stderr = config?.errorMessage ?? "fatal: unable to access";
					throw error;
				}
				return "";
			}

			case "pull": {
				const config = currentConfig.pull ?? defaultConfig.pull;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "Pull failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 1;
					error.stderr = config?.errorMessage ?? "error: pull failed";
					throw error;
				}
				return "Already up to date.";
			}

			case "rev-parse": {
				const config = currentConfig.revParse ?? defaultConfig.revParse;
				if (!config?.shouldSucceed) {
					const error = new Error(config?.errorMessage ?? "rev-parse failed") as Error & {
						status: number;
						stderr: string;
					};
					error.status = 128;
					error.stderr = config?.errorMessage ?? "fatal: not a git repository";
					throw error;
				}
				return config?.sha ?? "abc123def456abc123def456abc123def456abc1";
			}

			case "sparse-checkout":
				return "";

			case "checkout":
				return "";

			default:
				throw new Error(`Unhandled git command: ${gitCommand}`);
		}
	});
}

/**
 * Configure the git mock behavior
 */
export function configureGitMock(config: Partial<GitMockConfig>): void {
	currentConfig = { ...defaultConfig, ...config };
}

/**
 * Reset git mock to default configuration
 */
export function resetGitMock(): void {
	currentConfig = { ...defaultConfig };
}

/**
 * Create mock for child_process module
 */
export function mockChildProcess() {
	const execSyncMock = createExecSyncMock();

	vi.mock("node:child_process", () => ({
		execSync: execSyncMock,
	}));

	return { execSync: execSyncMock };
}
