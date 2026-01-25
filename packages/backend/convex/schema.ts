import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Offworld Backend Schema
 * Convex schema for skill storage
 */

export default defineSchema({
	// Repository table - GitHub metadata
	repository: defineTable({
		// GitHub identification
		fullName: v.string(), // owner/repo format
		owner: v.string(),
		name: v.string(),

		// GitHub metadata
		description: v.optional(v.string()),
		stars: v.number(),
		language: v.optional(v.string()),
		defaultBranch: v.string(),
		githubUrl: v.string(),

		// Timestamps
		fetchedAt: v.string(), // when we last synced from GitHub
	})
		.index("by_fullName", ["fullName"])
		.index("by_owner", ["owner"])
		.index("by_stars", ["stars"])
		.index("by_fetchedAt", ["fetchedAt"]),

	// Skill table - references repository
	skill: defineTable({
		repositoryId: v.id("repository"),

		// Skill content
		skillName: v.string(),
		skillDescription: v.string(),
		skillContent: v.string(), // markdown

		// Metadata
		commitSha: v.string(),
		analyzedAt: v.string(), // ISO timestamp

		// Stats
		pullCount: v.number(),
		isVerified: v.boolean(), // verified by offworld team

		// User who pushed (optional)
		workosId: v.optional(v.string()),
	})
		.index("by_repositoryId", ["repositoryId"])
		.index("by_repositoryId_skillName", ["repositoryId", "skillName"])
		.index("by_pullCount", ["pullCount"])
		.index("by_analyzedAt", ["analyzedAt"]),

	// Push logs for rate limiting
	pushLog: defineTable({
		fullName: v.string(),
		workosId: v.string(),
		pushedAt: v.string(), // ISO timestamp
		commitSha: v.string(),
	})
		.index("by_repo_date", ["fullName", "pushedAt"])
		.index("by_workos_date", ["workosId", "pushedAt"]),

	user: defineTable({
		workosId: v.string(), // WorkOS user ID (JWT subject claim)
		email: v.string(),
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		createdAt: v.string(),
	})
		.index("by_email", ["email"])
		.index("by_workosId", ["workosId"]),
});
