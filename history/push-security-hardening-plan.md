# Push Security Hardening Plan

**Status:** Planned  
**Created:** 2025-01-23  
**Updated:** 2025-01-23  
**Effort:** ~1.5 days

## Overview

Harden the `ow push` command to prevent abuse while maintaining the community-driven model where **anyone can generate and share skills for any public repo**.

### Design Principles

1. **Community-driven** — Anyone can push skills for any repo (no ownership requirement)
2. **Immutable by commit** — Once pushed for a commit SHA, that skill is locked
3. **Self-correcting** — Bad skill at commit A? Push better one at commit B
4. **Quality-gated** — Only repos with >=5 GitHub stars allowed
5. **Server-authoritative** — All validation happens server-side (no bypassable client checks)

---

## Current State

| Check                 | Location                 | Issue                       |
| --------------------- | ------------------------ | --------------------------- |
| Auth required         | Backend                  | OK                          |
| Rate limit 3/repo/day | Backend                  | Per-repo, uses `.collect()` |
| Star gate >=5         | SDK (client)             | Bypassable                  |
| Conflict by timestamp | Backend                  | Allows overwrites           |
| Content validation    | None                     | Missing                     |
| Input validation      | Convex `v.string()` only | No length/format limits     |

---

## Target State

| Check                         | Location       | Implementation                               |
| ----------------------------- | -------------- | -------------------------------------------- |
| Auth required                 | Backend action | WorkOS identity                              |
| Rate limit 20/day/user global | Backend action | Existing `by_workos_date` index, `.take(21)` |
| Star gate >=5                 | Backend action | Server-side GitHub API (authenticated)       |
| Repo exists                   | Backend action | Server-side GitHub API                       |
| Commit exists                 | Backend action | Server-side GitHub API                       |
| Immutable by commit           | Backend action | Reject if (fullName, commitSha) exists       |
| Input validation              | Backend action | Convex validators with bounds                |
| Content validation            | Backend action | remark AST-based validation                  |
| Content safety                | Backend action | Reject HTML nodes, unsafe links              |

---

## Architecture Change

Convert `push` mutation to action + internal mutation pattern:

```
CLI -> push (action) -> validates everything -> pushInternal (internalMutation)
```

**Why:** Actions can `fetch()` GitHub API. Internal mutations prevent direct external invocation.

```ts
// Before: single public mutation (bypassable)
export const push = mutation({ ... })

// After: public action + internal mutation
export const push = action({ ... })           // validation + GitHub checks
export const pushInternal = internalMutation({ ... })  // DB write only
```

---

## Implementation Details

### 1. Schema Changes

**File:** `packages/backend/convex/schema.ts`

Add new index for commit-based immutability (only change needed):

```ts
skill: defineTable({
	// ... existing fields
})
	.index("by_fullName", ["fullName"])
	.index("by_fullName_skillName", ["fullName", "skillName"])
	.index("by_fullName_analyzedAt", ["fullName", "analyzedAt"])
	.index("by_fullName_commitSha", ["fullName", "commitSha"]) // NEW
	.index("by_pullCount", ["pullCount"])
	.index("by_analyzedAt", ["analyzedAt"]);
```

**Note:** `by_workos_date` index already exists on `pushLog` table for rate limiting.

---

### 2. Input Validation

**File:** `packages/backend/convex/validation/push.ts`

Uses Convex validators (no Zod dependency):

```ts
import { v } from "convex/values";

// Validation constants
export const FULLNAME_MIN = 3;
export const FULLNAME_MAX = 200;
export const SKILLNAME_MIN = 2;
export const SKILLNAME_MAX = 80;
export const DESCRIPTION_MAX = 200;
export const CONTENT_MIN = 500;
export const CONTENT_MAX = 200_000;
export const COMMIT_SHA_LENGTH = 40;

// Regex patterns
export const FULLNAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const SKILLNAME_PATTERN = /^[a-z0-9][a-z0-9-_.]*$/;
export const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

// Convex argument validators for push action
export const pushArgs = {
	fullName: v.string(),
	skillName: v.string(),
	skillDescription: v.string(),
	skillContent: v.string(),
	commitSha: v.string(),
	analyzedAt: v.string(),
};

// Runtime validation result
export interface ValidationResult {
	valid: boolean;
	error?: string;
	field?: string;
}

/**
 * Validates push arguments at runtime
 * Returns first validation error or { valid: true }
 */
export function validatePushArgs(args: {
	fullName: string;
	skillName: string;
	skillDescription: string;
	skillContent: string;
	commitSha: string;
	analyzedAt: string;
}): ValidationResult {
	// fullName
	if (args.fullName.length < FULLNAME_MIN || args.fullName.length > FULLNAME_MAX) {
		return {
			valid: false,
			error: `fullName must be ${FULLNAME_MIN}-${FULLNAME_MAX} chars`,
			field: "fullName",
		};
	}
	if (!FULLNAME_PATTERN.test(args.fullName)) {
		return { valid: false, error: "Invalid repo format (expected owner/repo)", field: "fullName" };
	}

	// skillName
	if (args.skillName.length < SKILLNAME_MIN || args.skillName.length > SKILLNAME_MAX) {
		return {
			valid: false,
			error: `skillName must be ${SKILLNAME_MIN}-${SKILLNAME_MAX} chars`,
			field: "skillName",
		};
	}
	if (!SKILLNAME_PATTERN.test(args.skillName)) {
		return { valid: false, error: "Invalid skillName format", field: "skillName" };
	}

	// skillDescription
	if (args.skillDescription.length === 0 || args.skillDescription.length > DESCRIPTION_MAX) {
		return {
			valid: false,
			error: `skillDescription must be 1-${DESCRIPTION_MAX} chars`,
			field: "skillDescription",
		};
	}

	// skillContent
	if (args.skillContent.length < CONTENT_MIN) {
		return {
			valid: false,
			error: `skillContent too short (min ${CONTENT_MIN} chars)`,
			field: "skillContent",
		};
	}
	if (args.skillContent.length > CONTENT_MAX) {
		return {
			valid: false,
			error: `skillContent too large (max ${CONTENT_MAX / 1000}KB)`,
			field: "skillContent",
		};
	}

	// commitSha
	if (args.commitSha.length !== COMMIT_SHA_LENGTH) {
		return { valid: false, error: "commitSha must be 40 characters", field: "commitSha" };
	}
	if (!COMMIT_SHA_PATTERN.test(args.commitSha)) {
		return { valid: false, error: "Invalid commit SHA format", field: "commitSha" };
	}

	// analyzedAt
	const timestamp = Date.parse(args.analyzedAt);
	if (Number.isNaN(timestamp)) {
		return { valid: false, error: "Invalid analyzedAt timestamp", field: "analyzedAt" };
	}
	if (timestamp > Date.now() + 5 * 60_000) {
		return {
			valid: false,
			error: "analyzedAt cannot be more than 5 minutes in the future",
			field: "analyzedAt",
		};
	}

	return { valid: true };
}
```

---

### 3. Content Validation (AST-based)

**File:** `packages/backend/convex/validation/skillContent.ts`

**Dependencies:**

```bash
bun add unified remark-parse remark-frontmatter unist-util-visit yaml
```

**Implementation:**

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";
import type { Root, Link, Yaml } from "mdast";

export interface ContentValidationResult {
	valid: boolean;
	error?: string;
	name?: string;
	description?: string;
}

export function validateSkillContent(content: string): ContentValidationResult {
	// Length bounds (defense in depth)
	if (content.length < 500) {
		return { valid: false, error: "Content too short (min 500 chars)" };
	}
	if (content.length > 200_000) {
		return { valid: false, error: "Content too large (max 200KB)" };
	}

	// Parse markdown to AST
	const tree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).parse(content) as Root;

	// CRITICAL: Reject ALL raw HTML nodes (no bypass possible)
	let htmlFound = false;
	visit(tree, "html", () => {
		htmlFound = true;
	});
	if (htmlFound) {
		return { valid: false, error: "Raw HTML not allowed in skill content" };
	}

	// Validate links use safe protocols only
	let unsafeLink: string | null = null;
	visit(tree, "link", (node: Link) => {
		const url = node.url.toLowerCase();
		if (url.startsWith("javascript:") || url.startsWith("data:") || url.startsWith("vbscript:")) {
			unsafeLink = node.url;
		}
	});
	if (unsafeLink) {
		return { valid: false, error: `Unsafe link protocol: ${unsafeLink}` };
	}

	// Extract and validate YAML frontmatter
	let frontmatter: { name?: string; description?: string } | null = null;
	visit(tree, "yaml", (node: Yaml) => {
		try {
			frontmatter = parseYaml(node.value);
		} catch {
			frontmatter = null;
		}
	});

	if (!frontmatter) {
		return { valid: false, error: "Missing or invalid YAML frontmatter" };
	}
	if (!frontmatter.name || typeof frontmatter.name !== "string") {
		return { valid: false, error: "Frontmatter missing required 'name' field" };
	}
	if (!frontmatter.description || typeof frontmatter.description !== "string") {
		return { valid: false, error: "Frontmatter missing required 'description' field" };
	}
	if (frontmatter.name.length > 100) {
		return { valid: false, error: "Frontmatter 'name' too long (max 100 chars)" };
	}
	if (frontmatter.description.length > 200) {
		return { valid: false, error: "Frontmatter 'description' too long (max 200 chars)" };
	}

	return {
		valid: true,
		name: frontmatter.name,
		description: frontmatter.description,
	};
}
```

---

### 4. Server-Side GitHub Verification (with App Token)

**File:** `packages/backend/convex/validation/github.ts`

```ts
const GITHUB_API = "https://api.github.com";
const MIN_STARS = 5;

// GitHub App token from environment (set via Convex dashboard)
function getGitHubToken(): string | undefined {
	return process.env.GITHUB_APP_TOKEN;
}

function getAuthHeaders(): HeadersInit {
	const token = getGitHubToken();
	const headers: HeadersInit = {
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

		return { valid: true, stars };
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
```

**Environment Setup:** Add `GITHUB_APP_TOKEN` to Convex dashboard environment variables.

---

### 5. Refactored Push Handler

**File:** `packages/backend/convex/analyses.ts`

```ts
import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { pushArgs, validatePushArgs } from "./validation/push";
import { validateSkillContent } from "./validation/skillContent";
import { validateRepo, validateCommit } from "./validation/github";

// Error types for structured responses
export type PushError =
	| "auth_required"
	| "invalid_input"
	| "invalid_skill"
	| "repo_not_found"
	| "low_stars"
	| "private_repo"
	| "commit_not_found"
	| "commit_already_exists"
	| "rate_limit"
	| "github_error";

export type PushResult = { success: true } | { success: false; error: PushError; message?: string };

/**
 * Push skill - public action with full validation
 */
export const push = action({
	args: pushArgs,
	handler: async (ctx, args): Promise<PushResult> => {
		// 1. Auth check
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "auth_required" };
		}
		const workosId = identity.subject;

		// 2. Input validation (runtime checks)
		const validation = validatePushArgs(args);
		if (!validation.valid) {
			return {
				success: false,
				error: "invalid_input",
				message: validation.error,
			};
		}

		// 3. Content validation (AST-based)
		const contentResult = validateSkillContent(args.skillContent);
		if (!contentResult.valid) {
			return {
				success: false,
				error: "invalid_skill",
				message: contentResult.error,
			};
		}

		// 4. GitHub: repo exists + stars + public
		const repoResult = await validateRepo(args.fullName);
		if (!repoResult.valid) {
			let error: PushError = "github_error";
			if (repoResult.error?.includes("not found")) {
				error = "repo_not_found";
			} else if (repoResult.error?.includes("stars")) {
				error = "low_stars";
			} else if (repoResult.error?.includes("Private")) {
				error = "private_repo";
			}
			return { success: false, error, message: repoResult.error };
		}

		// 5. GitHub: commit exists
		const commitResult = await validateCommit(args.fullName, args.commitSha);
		if (!commitResult.valid) {
			return {
				success: false,
				error: "commit_not_found",
				message: commitResult.error,
			};
		}

		// 6. Delegate to internal mutation for DB operations
		return await ctx.runMutation(internal.analyses.pushInternal, {
			...args,
			workosId,
		});
	},
});

/**
 * Internal mutation - DB operations only, not directly callable
 */
export const pushInternal = internalMutation({
	args: {
		fullName: v.string(),
		skillName: v.string(),
		skillDescription: v.string(),
		skillContent: v.string(),
		commitSha: v.string(),
		analyzedAt: v.string(),
		workosId: v.string(),
	},
	handler: async (ctx, args): Promise<PushResult> => {
		const { workosId, ...skillData } = args;

		// 1. Global rate limit: 20 pushes/day/user
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const recentPushes = await ctx.db
			.query("pushLog")
			.withIndex("by_workos_date", (q) => q.eq("workosId", workosId).gte("pushedAt", oneDayAgo))
			.take(21);

		if (recentPushes.length >= 20) {
			return { success: false, error: "rate_limit" };
		}

		// 2. Immutability check: reject if (fullName, commitSha) exists
		const existing = await ctx.db
			.query("skill")
			.withIndex("by_fullName_commitSha", (q) =>
				q.eq("fullName", args.fullName).eq("commitSha", args.commitSha),
			)
			.first();

		if (existing) {
			return {
				success: false,
				error: "commit_already_exists",
				message: "A skill already exists for this commit",
			};
		}

		// 3. Ensure user exists
		const existingUser = await ctx.db
			.query("user")
			.withIndex("by_workosId", (q) => q.eq("workosId", workosId))
			.first();

		if (!existingUser) {
			await ctx.db.insert("user", {
				workosId,
				email: "",
				createdAt: new Date().toISOString(),
			});
		}

		// 4. Insert new skill (no updates, immutable by commit)
		await ctx.db.insert("skill", {
			...skillData,
			pullCount: 0,
			isVerified: false,
			workosId,
		});

		// 5. Log push for rate limiting
		await ctx.db.insert("pushLog", {
			fullName: args.fullName,
			workosId,
			pushedAt: new Date().toISOString(),
			commitSha: args.commitSha,
		});

		return { success: true };
	},
});
```

---

### 6. SDK Error Handling Updates

**File:** `packages/sdk/src/sync.ts`

Remove client-side validation and add new error types:

```ts
// ============================================================================
// Error Types (add new error classes)
// ============================================================================

export class SyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SyncError";
	}
}

export class NetworkError extends SyncError {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message);
		this.name = "NetworkError";
	}
}

export class AuthenticationError extends SyncError {
	constructor(message = "Authentication required. Please run 'ow auth login' first.") {
		super(message);
		this.name = "AuthenticationError";
	}
}

export class RateLimitError extends SyncError {
	constructor(message = "Rate limit exceeded. You can push up to 20 times per day.") {
		super(message);
		this.name = "RateLimitError";
	}
}

export class CommitExistsError extends SyncError {
	constructor(message = "A skill already exists for this commit SHA.") {
		super(message);
		this.name = "CommitExistsError";
	}
}

export class InvalidInputError extends SyncError {
	constructor(message: string) {
		super(message);
		this.name = "InvalidInputError";
	}
}

export class InvalidSkillError extends SyncError {
	constructor(message: string) {
		super(message);
		this.name = "InvalidSkillError";
	}
}

export class RepoNotFoundError extends SyncError {
	constructor(message = "Repository not found on GitHub.") {
		super(message);
		this.name = "RepoNotFoundError";
	}
}

export class LowStarsError extends SyncError {
	constructor(message = "Repository has less than 5 stars.") {
		super(message);
		this.name = "LowStarsError";
	}
}

export class PrivateRepoError extends SyncError {
	constructor(message = "Private repositories are not supported.") {
		super(message);
		this.name = "PrivateRepoError";
	}
}

export class CommitNotFoundError extends SyncError {
	constructor(message = "Commit not found in repository.") {
		super(message);
		this.name = "CommitNotFoundError";
	}
}

export class GitHubError extends SyncError {
	constructor(message = "GitHub API error.") {
		super(message);
		this.name = "GitHubError";
	}
}

// ============================================================================
// Updated pushAnalysis function
// ============================================================================

/**
 * Pushes analysis to the remote server
 * All validation happens server-side
 */
export async function pushAnalysis(analysis: AnalysisData, token: string): Promise<PushResponse> {
	const client = createClient(token);
	try {
		const result = await client.action(api.analyses.push, {
			fullName: analysis.fullName,
			skillName: analysis.skillName,
			skillDescription: analysis.skillDescription,
			skillContent: analysis.skillContent,
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
		});

		if (!result.success) {
			switch (result.error) {
				case "auth_required":
					throw new AuthenticationError();
				case "rate_limit":
					throw new RateLimitError();
				case "commit_already_exists":
					throw new CommitExistsError(result.message);
				case "invalid_input":
					throw new InvalidInputError(result.message ?? "Invalid input");
				case "invalid_skill":
					throw new InvalidSkillError(result.message ?? "Invalid skill content");
				case "repo_not_found":
					throw new RepoNotFoundError(result.message);
				case "low_stars":
					throw new LowStarsError(result.message);
				case "private_repo":
					throw new PrivateRepoError(result.message);
				case "commit_not_found":
					throw new CommitNotFoundError(result.message);
				case "github_error":
					throw new GitHubError(result.message);
				default:
					throw new SyncError(result.message ?? "Unknown error");
			}
		}

		return { success: true };
	} catch (error) {
		if (error instanceof SyncError) throw error;
		throw new NetworkError(
			`Failed to push analysis: ${error instanceof Error ? error.message : error}`,
		);
	}
}

// ============================================================================
// Remove these functions (validation now server-side):
// ============================================================================
// - fetchRepoStars
// - canPushToWeb
// - validatePushAllowed
// - PushNotAllowedError class
// - MIN_STARS_FOR_PUSH constant
// - GITHUB_API_BASE constant (if only used for push validation)
```

---

### 7. CLI Handler Updates

**File:** `apps/cli/src/handlers/push.ts`

Update to handle new error types and remove client-side validation:

```ts
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
	RepoNotFoundError,
	LowStarsError,
	PrivateRepoError,
	CommitNotFoundError,
	GitHubError,
	type AnalysisData,
} from "@offworld/sdk";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSpinner } from "../utils/spinner";

// ... (keep existing types and loadLocalAnalysis helper)

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

		// Step 3: Basic client-side checks (quick fails, server validates everything)
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
			} else {
				s.stop("Upload failed");
				p.log.error(result.message || "Unknown error during upload");
				return { success: false, message: result.message || "Upload failed" };
			}
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

			if (err instanceof RepoNotFoundError) {
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
```

---

### 8. Tests

**File:** `packages/backend/convex/__tests__/push.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validatePushArgs } from "../validation/push";
import { validateSkillContent } from "../validation/skillContent";

describe("Push Input Validation", () => {
	describe("validatePushArgs", () => {
		const validArgs = {
			fullName: "owner/repo",
			skillName: "my-skill",
			skillDescription: "A test skill",
			skillContent: "a".repeat(500),
			commitSha: "a".repeat(40),
			analyzedAt: new Date().toISOString(),
		};

		it("accepts valid args", () => {
			expect(validatePushArgs(validArgs)).toEqual({ valid: true });
		});

		it("rejects short fullName", () => {
			const result = validatePushArgs({ ...validArgs, fullName: "a/b" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("fullName");
		});

		it("rejects invalid fullName format", () => {
			const result = validatePushArgs({ ...validArgs, fullName: "invalid" });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("owner/repo");
		});

		it("rejects invalid skillName format", () => {
			const result = validatePushArgs({ ...validArgs, skillName: "Invalid-Name" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("skillName");
		});

		it("rejects short content", () => {
			const result = validatePushArgs({ ...validArgs, skillContent: "short" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("skillContent");
		});

		it("rejects oversized content", () => {
			const result = validatePushArgs({ ...validArgs, skillContent: "a".repeat(200_001) });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("skillContent");
		});

		it("rejects invalid commit SHA", () => {
			const result = validatePushArgs({ ...validArgs, commitSha: "invalid" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("commitSha");
		});

		it("rejects future-dated analyzedAt", () => {
			const future = new Date(Date.now() + 10 * 60_000).toISOString();
			const result = validatePushArgs({ ...validArgs, analyzedAt: future });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("analyzedAt");
		});
	});
});

describe("Skill Content Validation", () => {
	const validContent = `---
name: Test Skill
description: A test skill for testing
---

# Test Skill

This is a test skill with enough content to pass validation.

${"Lorem ipsum ".repeat(50)}
`;

	it("accepts valid content", () => {
		const result = validateSkillContent(validContent);
		expect(result.valid).toBe(true);
		expect(result.name).toBe("Test Skill");
		expect(result.description).toBe("A test skill for testing");
	});

	it("rejects content without frontmatter", () => {
		const result = validateSkillContent("a".repeat(500));
		expect(result.valid).toBe(false);
		expect(result.error).toContain("frontmatter");
	});

	it("rejects content with HTML", () => {
		const htmlContent = `---
name: Test
description: Test
---

<script>alert('xss')</script>

${"a".repeat(500)}
`;
		const result = validateSkillContent(htmlContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("HTML");
	});

	it("rejects javascript: links", () => {
		const jsContent = `---
name: Test
description: Test
---

[Click me](javascript:alert('xss'))

${"a".repeat(500)}
`;
		const result = validateSkillContent(jsContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsafe link");
	});

	it("rejects content too short", () => {
		const result = validateSkillContent("short");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("too short");
	});

	it("rejects missing name in frontmatter", () => {
		const content = `---
description: A test
---

${"a".repeat(500)}
`;
		const result = validateSkillContent(content);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("name");
	});

	it("rejects missing description in frontmatter", () => {
		const content = `---
name: Test
---

${"a".repeat(500)}
`;
		const result = validateSkillContent(content);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("description");
	});
});

describe("Push Integration", () => {
	// These tests would require mocking Convex context
	// Add integration tests here for:
	// - auth_required (no identity)
	// - rate_limit (21+ pushes)
	// - commit_already_exists (duplicate push)
	// - Full success flow

	it.todo("returns auth_required when not authenticated");
	it.todo("returns rate_limit after 20 pushes");
	it.todo("returns commit_already_exists for duplicate");
	it.todo("successfully pushes valid skill");
});
```

---

## File Summary

| File                                                 | Action                               |
| ---------------------------------------------------- | ------------------------------------ |
| `packages/backend/convex/schema.ts`                  | Add `by_fullName_commitSha` index    |
| `packages/backend/convex/validation/push.ts`         | Create (Convex validators)           |
| `packages/backend/convex/validation/skillContent.ts` | Create (AST validation)              |
| `packages/backend/convex/validation/github.ts`       | Create (GitHub App token)            |
| `packages/backend/convex/analyses.ts`                | Refactor push to action pattern      |
| `packages/backend/convex/__tests__/push.test.ts`     | Create (validation tests)            |
| `packages/sdk/src/sync.ts`                           | Add error classes, remove validation |
| `apps/cli/src/handlers/push.ts`                      | Handle all new error types           |
| `packages/backend/package.json`                      | Add deps                             |

---

## Dependencies to Add

```bash
# In packages/backend
bun add unified remark-parse remark-frontmatter unist-util-visit yaml
```

---

## Environment Variables

Add to Convex dashboard:

| Variable           | Description                                   |
| ------------------ | --------------------------------------------- |
| `GITHUB_APP_TOKEN` | GitHub App installation token (5000 req/hour) |

---

## Security Summary

| Threat                             | Mitigation                                    |
| ---------------------------------- | --------------------------------------------- |
| Bypass CLI, call mutation directly | Action + internalMutation pattern             |
| Push for fake repo                 | Server-side GitHub repo verification          |
| Push for fake commit               | Server-side GitHub commit verification        |
| Push for low-quality repo          | Server-side star gate (>=5)                   |
| Push for private repo              | Server-side privacy check                     |
| Overwrite existing skill           | Immutable by (fullName, commitSha)            |
| Spam/DoS                           | 20 pushes/day/user global limit               |
| Malicious HTML/XSS                 | AST-based validation rejects all HTML nodes   |
| Malicious links                    | Block javascript:, data:, vbscript: protocols |
| Garbage content                    | Validate SKILL.md structure (frontmatter)     |
| Oversized content                  | 500 char min, 200KB max                       |
| Invalid input formats              | Convex validators + runtime checks            |
| Future-dated timestamps            | Reject analyzedAt > now + 5min                |
| GitHub API rate limits             | Use GitHub App token (5000 req/hour)          |

---

## Testing Checklist

- [ ] Push with invalid auth -> `auth_required`
- [ ] Push with malformed fullName -> `invalid_input`
- [ ] Push with short content -> `invalid_input`
- [ ] Push with HTML in content -> `invalid_skill`
- [ ] Push with javascript: link -> `invalid_skill`
- [ ] Push with missing frontmatter -> `invalid_skill`
- [ ] Push for non-existent repo -> `repo_not_found`
- [ ] Push for repo with <5 stars -> `low_stars`
- [ ] Push for private repo -> `private_repo`
- [ ] Push for non-existent commit -> `commit_not_found`
- [ ] Push same commit twice -> `commit_already_exists`
- [ ] Push 21st skill in a day -> `rate_limit`
- [ ] Valid push -> `success: true`
