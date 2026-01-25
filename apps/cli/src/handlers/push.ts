/**
 * Push command handler
 */

import * as p from "@clack/prompts";
import {
	parseRepoInput,
	getToken,
	getMetaPath,
	getSkillPath,
	getCommitSha,
	getClonedRepoPath,
	isRepoCloned,
	pushAnalysis,
	validatePushAllowed,
	fetchGitHubMetadata,
	NotLoggedInError,
	TokenExpiredError,
	PushNotAllowedError,
	AuthenticationError,
	RateLimitError,
	ConflictError,
	type AnalysisData,
} from "@offworld/sdk";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";

// ============================================================================
// Types
// ============================================================================

export interface PushOptions {
	repo: string;
}

export interface PushResult {
	success: boolean;
	message: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load local skill data from the AI-only format.
 * Format: SKILL.md + meta.json
 */
function loadLocalAnalysis(metaDir: string, skillDir: string): AnalysisData | null {
	const skillMdPath = join(skillDir, "SKILL.md");
	const metaPath = join(metaDir, "meta.json");

	// Check required files for new format
	if (!existsSync(skillMdPath) || !existsSync(metaPath)) {
		return null;
	}

	try {
		const skillContent = readFileSync(skillMdPath, "utf-8");
		const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
			commitSha: string;
			analyzedAt: string;
		};

		// Extract name and description from SKILL.md frontmatter
		const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
		let name = "unknown";
		let description = "";

		if (frontmatterMatch?.[1]) {
			const frontmatter = frontmatterMatch[1];
			const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
			const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
			if (nameMatch?.[1]) name = nameMatch[1].trim();
			if (descMatch?.[1]) description = descMatch[1].trim();
		}

		return {
			fullName: "",
			skillName: name,
			skillDescription: description,
			skillContent,
			commitSha: meta.commitSha,
			analyzedAt: meta.analyzedAt,
		};
	} catch {
		return null;
	}
}

// ============================================================================
// Push Handler
// ============================================================================

/**
 * Main push handler
 * Uploads local analysis to offworld.sh
 */
export async function pushHandler(options: PushOptions): Promise<PushResult> {
	const { repo } = options;
	const s = createSpinner();

	try {
		// Step 1: Check authentication
		let token: string;
		try {
			token = await getToken();
		} catch (err) {
			if (err instanceof NotLoggedInError || err instanceof TokenExpiredError) {
				p.log.error(err.message);
				return {
					success: false,
					message: err.message,
				};
			}
			throw err;
		}

		// Step 2: Parse repository input
		s.start("Parsing repository...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");

		// Step 3: Validate push is allowed (local, provider, stars)
		s.start("Validating push eligibility...");
		try {
			await validatePushAllowed(source);
			s.stop("Push validated");
		} catch (err) {
			s.stop("Push not allowed");
			if (err instanceof PushNotAllowedError) {
				p.log.error(err.message);

				// Provide more specific guidance based on reason
				if (err.reason === "local") {
					p.log.info("Local repositories cannot be shared on offworld.sh.");
					p.log.info("Only remote GitHub repositories can be pushed.");
				} else if (err.reason === "not-github") {
					p.log.info("GitLab and Bitbucket support coming soon!");
				} else if (err.reason === "low-stars") {
					p.log.info("We require 5+ stars to ensure quality analyses on offworld.sh.");
				}

				return {
					success: false,
					message: err.message,
				};
			}
			throw err;
		}

		// At this point we know source is remote
		if (source.type !== "remote") {
			throw new Error("Unexpected: source should be remote after validation");
		}

		// Step 4: Check if repo is cloned locally
		if (!isRepoCloned(source.qualifiedName)) {
			p.log.error(`Repository ${source.fullName} is not cloned locally.`);
			p.log.info(`Run 'ow pull ${source.fullName}' first to clone and analyze.`);
			return {
				success: false,
				message: "Repository not cloned locally",
			};
		}

		// Step 5: Load local analysis
		s.start("Loading local analysis...");
		const metaDir = getMetaPath(source.fullName);
		const skillDir = getSkillPath(source.fullName);

		if (!existsSync(metaDir)) {
			s.stop("No analysis found");
			p.log.error(`No analysis found for ${source.fullName}.`);
			p.log.info(`Run 'ow generate ${source.fullName}' to generate analysis.`);
			return {
				success: false,
				message: "No local analysis found",
			};
		}

		const localAnalysis = loadLocalAnalysis(metaDir, skillDir);

		if (!localAnalysis) {
			s.stop("Invalid analysis");
			p.log.error("Local analysis is incomplete or corrupted.");
			p.log.info(`Run 'ow generate ${source.fullName} --force' to regenerate.`);
			return {
				success: false,
				message: "Local analysis incomplete",
			};
		}

		// Set the fullName on the analysis data
		localAnalysis.fullName = source.fullName;

		// Verify commit SHA matches current repo state
		const repoPath = getClonedRepoPath(source.qualifiedName);
		if (repoPath) {
			const currentSha = getCommitSha(repoPath);
			if (currentSha !== localAnalysis.commitSha) {
				s.stop("Analysis outdated");
				p.log.warn("Local analysis was generated for a different commit.");
				p.log.info(`Analysis: ${localAnalysis.commitSha.slice(0, 7)}`);
				p.log.info(`Current:  ${currentSha.slice(0, 7)}`);
				p.log.info(`Run 'ow generate ${source.fullName} --force' to regenerate.`);
				return {
					success: false,
					message: "Analysis outdated - run generate to update",
				};
			}
		}

		s.stop("Analysis loaded");

		// Step 6: Fetch GitHub metadata
		s.start("Fetching repository metadata...");
		const githubMetadata = await fetchGitHubMetadata(source.owner, source.repo);
		if (githubMetadata) {
			localAnalysis.repoDescription = githubMetadata.description;
			localAnalysis.repoStars = githubMetadata.stars;
			localAnalysis.repoLanguage = githubMetadata.language;
			localAnalysis.repoDefaultBranch = githubMetadata.defaultBranch;
		}
		s.stop("Metadata fetched");

		// Step 7: Push to offworld.sh
		s.start("Uploading to offworld.sh...");
		try {
			const result = await pushAnalysis(localAnalysis, token);

			if (result.success) {
				s.stop("Analysis uploaded!");
				p.log.success(`Successfully pushed analysis for ${source.fullName}`);
				p.log.info(`View at: https://offworld.sh/${source.owner}/${source.repo}`);
				return {
					success: true,
					message: "Analysis pushed successfully",
				};
			} else {
				s.stop("Upload failed");
				p.log.error(result.message || "Unknown error during upload");
				return {
					success: false,
					message: result.message || "Upload failed",
				};
			}
		} catch (err) {
			s.stop("Upload failed");

			if (err instanceof AuthenticationError) {
				p.log.error("Authentication failed. Please run 'ow auth login' again.");
				return {
					success: false,
					message: "Authentication failed",
				};
			}

			if (err instanceof RateLimitError) {
				p.log.error("Rate limit exceeded.");
				p.log.info("You can push up to 3 times per repository per day.");
				p.log.info("Please try again tomorrow.");
				return {
					success: false,
					message: "Rate limit exceeded",
				};
			}

			if (err instanceof ConflictError) {
				p.log.error("A newer analysis already exists on offworld.sh.");
				if (err.remoteCommitSha) {
					p.log.info(`Remote: ${err.remoteCommitSha.slice(0, 7)}`);
					p.log.info(`Local:  ${localAnalysis.commitSha.slice(0, 7)}`);
				}
				p.log.info("Pull the latest analysis with 'ow pull' or use '--force' if you're sure.");
				return {
					success: false,
					message: "Conflict - newer analysis exists",
				};
			}

			throw err;
		}
	} catch (error) {
		s.stop("Failed");
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			message,
		};
	}
}
