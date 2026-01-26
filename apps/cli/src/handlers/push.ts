/**
 * Push command handler
 */

import * as p from "@clack/prompts";
import {
	parseRepoInput,
	getToken,
	getMetaPath,
	getReferencePath,
	toSkillDirName,
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

const DESCRIPTION_MAX = 200;

function extractDescription(referenceContent: string, fallback: string): string {
	const lines = referenceContent.split(/\r?\n/);
	let sawTitle = false;
	let description = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]?.trim() ?? "";
		if (!line) continue;
		if (line.startsWith("# ")) {
			sawTitle = true;
			continue;
		}
		if (!sawTitle || line.startsWith("#")) continue;

		description = line;
		for (let j = i + 1; j < lines.length; j++) {
			const next = lines[j]?.trim() ?? "";
			if (!next || next.startsWith("#")) break;
			description += ` ${next}`;
		}
		break;
	}

	description = description.replace(/\s+/g, " ").trim();
	if (!description) description = fallback;
	if (description.length > DESCRIPTION_MAX) description = description.slice(0, DESCRIPTION_MAX).trim();
	if (!description) description = fallback.slice(0, DESCRIPTION_MAX);
	return description;
}

/**
 * Load local reference data from the reference format.
 * Format: reference file + meta.json
 */
function loadLocalAnalysis(
	metaDir: string,
	referencePath: string,
	fullName: string,
): ReferenceData | null {
	const metaPath = join(metaDir, "meta.json");

	// Check required files for new format
	if (!existsSync(referencePath) || !existsSync(metaPath)) {
		return null;
	}

	try {
		const referenceContent = readFileSync(referencePath, "utf-8");
		const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
			commitSha: string;
			analyzedAt: string;
		};
		const referenceName = toSkillDirName(fullName);
		const referenceDescription = extractDescription(
			referenceContent,
			`Reference for ${fullName}`,
		);

		return {
			fullName: "",
			referenceName,
			referenceDescription,
			referenceContent,
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
 * Uploads local reference to offworld.sh
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

		// Step 5: Load local reference
		s.start("Loading local reference...");
		const metaDir = getMetaPath(source.fullName);
		const referencePath = getReferencePath(source.fullName);

		if (!existsSync(metaDir) || !existsSync(referencePath)) {
			s.stop("No reference found");
			p.log.error(`No reference found for ${source.fullName}.`);
			p.log.info(`Run 'ow generate ${source.fullName}' to generate reference.`);
			return { success: false, message: "No local reference found" };
		}

		const localAnalysis = loadLocalAnalysis(metaDir, referencePath, source.fullName);

		if (!localAnalysis) {
			s.stop("Invalid reference");
			p.log.error("Local reference is incomplete or corrupted.");
			p.log.info(`Run 'ow generate ${source.fullName} --force' to regenerate.`);
			return { success: false, message: "Local reference incomplete" };
		}

		localAnalysis.fullName = source.fullName;

		// Verify commit SHA matches current repo state
		const repoPath = getClonedRepoPath(source.qualifiedName);
		if (repoPath) {
			const currentSha = getCommitSha(repoPath);
			if (currentSha !== localAnalysis.commitSha) {
				s.stop("Reference outdated");
				p.log.warn("Local reference was generated for a different commit.");
				p.log.info(`Reference: ${localAnalysis.commitSha.slice(0, 7)}`);
				p.log.info(`Current:  ${currentSha.slice(0, 7)}`);
				p.log.info(`Run 'ow generate ${source.fullName} --force' to regenerate.`);
				return { success: false, message: "Reference outdated - run generate to update" };
			}
		}

		s.stop("Reference loaded");

		// Step 6: Push to offworld.sh (all validation happens server-side)
		s.start("Uploading to offworld.sh...");
		try {
			const result = await pushAnalysis(localAnalysis, token);

			if (result.success) {
				s.stop("Reference uploaded!");
				p.log.success(`Successfully pushed reference for ${source.fullName}`);
				p.log.info(`View at: https://offworld.sh/${source.owner}/${source.repo}`);
				return { success: true, message: "Reference pushed successfully" };
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
