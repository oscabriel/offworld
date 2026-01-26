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
	NotLoggedInError,
	TokenExpiredError,
	AuthenticationError,
	RateLimitError,
	CommitExistsError,
	InvalidInputError,
	InvalidSkillError,
	SyncRepoNotFoundError,
	LowStarsError,
	PrivateRepoError,
	CommitNotFoundError,
	GitHubError,
	type ReferenceData,
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
function loadLocalAnalysis(metaDir: string, skillDir: string): ReferenceData | null {
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
			referenceName: name,
			referenceDescription: description,
			referenceContent: skillContent,
			commitSha: meta.commitSha,
			generatedAt: meta.analyzedAt,
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
				return { success: false, message: err.message };
			}
			throw err;
		}

		// Step 2: Parse repository input
		s.start("Parsing repository...");
		const source = parseRepoInput(repo);
		s.stop("Repository parsed");

		// Step 3: Quick client-side checks (server validates everything else)
		if (source.type === "local") {
			p.log.error("Local repositories cannot be pushed to offworld.sh.");
			p.log.info("Only remote GitHub repositories can be pushed.");
			return { success: false, message: "Local repositories not supported" };
		}

		if (source.provider !== "github") {
			p.log.error(`${source.provider} repositories are not yet supported.`);
			p.log.info("GitHub support only for now - GitLab and Bitbucket coming soon!");
			return { success: false, message: "Only GitHub repositories supported" };
		}

		// Step 4: Check if repo is cloned locally
		if (!isRepoCloned(source.qualifiedName)) {
			p.log.error(`Repository ${source.fullName} is not cloned locally.`);
			p.log.info(`Run 'ow pull ${source.fullName}' first to clone and analyze.`);
			return { success: false, message: "Repository not cloned locally" };
		}

		// Step 5: Load local analysis
		s.start("Loading local analysis...");
		const metaDir = getMetaPath(source.fullName);
		const skillDir = getSkillPath(source.fullName);

		if (!existsSync(metaDir)) {
			s.stop("No analysis found");
			p.log.error(`No analysis found for ${source.fullName}.`);
			p.log.info(`Run 'ow generate ${source.fullName}' to generate analysis.`);
			return { success: false, message: "No local analysis found" };
		}

		const localAnalysis = loadLocalAnalysis(metaDir, skillDir);

		if (!localAnalysis) {
			s.stop("Invalid analysis");
			p.log.error("Local analysis is incomplete or corrupted.");
			p.log.info(`Run 'ow generate ${source.fullName} --force' to regenerate.`);
			return { success: false, message: "Local analysis incomplete" };
		}

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
				return { success: false, message: "Analysis outdated - run generate to update" };
			}
		}

		s.stop("Analysis loaded");

		// Step 6: Push to offworld.sh (all validation happens server-side)
		s.start("Uploading to offworld.sh...");
		try {
			const result = await pushAnalysis(localAnalysis, token);

			if (result.success) {
				s.stop("Analysis uploaded!");
				p.log.success(`Successfully pushed analysis for ${source.fullName}`);
				p.log.info(`View at: https://offworld.sh/${source.owner}/${source.repo}`);
				return { success: true, message: "Analysis pushed successfully" };
			}
			s.stop("Upload failed");
			p.log.error(result.message || "Unknown error during upload");
			return { success: false, message: result.message || "Upload failed" };
		} catch (err) {
			s.stop("Upload failed");

			if (err instanceof AuthenticationError) {
				p.log.error("Authentication failed.");
				p.log.info("Please run 'ow auth login' again.");
				return { success: false, message: "Authentication failed" };
			}

			if (err instanceof RateLimitError) {
				p.log.error("Rate limit exceeded.");
				p.log.info("You can push up to 20 skills per day.");
				p.log.info("Please try again tomorrow.");
				return { success: false, message: "Rate limit exceeded" };
			}

			if (err instanceof CommitExistsError) {
				p.log.error("A skill already exists for this commit.");
				p.log.info(`Commit: ${localAnalysis.commitSha.slice(0, 7)}`);
				p.log.info(
					"Skills are immutable per commit. Update the repo and regenerate to push a new version.",
				);
				return { success: false, message: "Skill already exists for this commit" };
			}

			if (err instanceof InvalidInputError) {
				p.log.error("Invalid input data.");
				p.log.info(err.message);
				return { success: false, message: err.message };
			}

			if (err instanceof InvalidSkillError) {
				p.log.error("Invalid skill content.");
				p.log.info(err.message);
				p.log.info(`Run 'ow generate ${source.fullName} --force' to regenerate.`);
				return { success: false, message: err.message };
			}

			if (err instanceof SyncRepoNotFoundError) {
				p.log.error("Repository not found on GitHub.");
				p.log.info("Ensure the repository exists and is public.");
				return { success: false, message: "Repository not found" };
			}

			if (err instanceof LowStarsError) {
				p.log.error("Repository does not meet star requirements.");
				p.log.info("Repositories need at least 5 stars to be pushed to offworld.sh.");
				p.log.info("This helps ensure quality skills for the community.");
				return { success: false, message: "Repository needs 5+ stars" };
			}

			if (err instanceof PrivateRepoError) {
				p.log.error("Private repositories are not supported.");
				p.log.info("Only public GitHub repositories can be pushed to offworld.sh.");
				return { success: false, message: "Private repos not supported" };
			}

			if (err instanceof CommitNotFoundError) {
				p.log.error("Commit not found in repository.");
				p.log.info("The analyzed commit may have been rebased or removed.");
				p.log.info(
					`Run 'ow generate ${source.fullName} --force' to regenerate with current commit.`,
				);
				return { success: false, message: "Commit not found" };
			}

			if (err instanceof GitHubError) {
				p.log.error("GitHub API error.");
				p.log.info(err.message);
				p.log.info("Please try again later.");
				return { success: false, message: "GitHub API error" };
			}

			throw err;
		}
	} catch (error) {
		s.stop("Failed");
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return { success: false, message };
	}
}
