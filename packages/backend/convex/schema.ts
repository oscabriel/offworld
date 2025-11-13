import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	repositories: defineTable({
		owner: v.string(),
		name: v.string(),
		fullName: v.string(), // "owner/name"
		description: v.optional(v.string()),
		stars: v.number(),
		language: v.optional(v.string()),
		githubUrl: v.string(),
		defaultBranch: v.string(), // "main" or "master"
		indexedAt: v.number(),
		lastAnalyzedAt: v.number(),
		indexingStatus: v.union(
			v.literal("queued"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("failed"),
		),
		// AI-generated content
		summary: v.optional(v.string()),
		architecture: v.optional(v.string()),
		projectStructure: v.optional(v.any()), // JSON tree structure
		// Workflow tracking
		workflowId: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
	})
		.index("fullName", ["fullName"])
		.index("indexingStatus", ["indexingStatus"])
		.index("lastAnalyzedAt", ["lastAnalyzedAt"]),

	codeChunks: defineTable({
		repositoryId: v.id("repositories"),
		filePath: v.string(),
		content: v.string(),
		startLine: v.number(),
		endLine: v.number(),
		embedding: v.array(v.float64()), // 768 dimensions for Gemini text-embedding-004
	})
		.index("repositoryId", ["repositoryId"])
		.vectorIndex("embedding", {
			vectorField: "embedding",
			dimensions: 768,
			filterFields: ["repositoryId"],
		}),

	issues: defineTable({
		repositoryId: v.id("repositories"),
		githubIssueId: v.number(),
		number: v.number(), // Issue number (e.g., #123)
		title: v.string(),
		body: v.optional(v.string()),
		labels: v.array(v.string()),
		state: v.string(), // "open", "closed"
		githubUrl: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		// AI-generated analysis
		aiSummary: v.optional(v.string()),
		filesLikelyTouched: v.optional(v.array(v.string())),
		difficulty: v.optional(v.number()), // 1-5 scale
		skillsRequired: v.optional(v.array(v.string())),
	})
		.index("repositoryId", ["repositoryId"])
		.index("githubIssueId", ["githubIssueId"])
		.index("state", ["state"])
		.index("difficulty", ["difficulty"]),

	savedRepos: defineTable({
		userId: v.string(), // From Better Auth
		repositoryId: v.id("repositories"),
		savedAt: v.number(),
	})
		.index("userId", ["userId"])
		.index("repositoryId", ["repositoryId"])
		.index("userId_repositoryId", ["userId", "repositoryId"]),

	savedIssues: defineTable({
		userId: v.string(), // From Better Auth
		issueId: v.id("issues"),
		savedAt: v.number(),
	})
		.index("userId", ["userId"])
		.index("issueId", ["issueId"])
		.index("userId_issueId", ["userId", "issueId"]),
});
