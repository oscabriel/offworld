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
		summary: v.optional(v.string()),
		architecture: v.optional(v.string()),
		projectStructure: v.optional(v.any()), // JSON tree structure
		workflowId: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
		architectureMetadata: v.optional(
			v.object({
				totalIterations: v.number(),
				completedIterations: v.number(),
				discoveredPackages: v.number(),
				discoveredModules: v.number(),
				discoveredComponents: v.number(),
				lastIterationAt: v.number(),
			}),
		),
		diagrams: v.optional(
			v.object({
				architecture: v.optional(v.string()), // Mermaid syntax
				dataFlow: v.optional(v.string()), // Mermaid syntax
				routing: v.optional(v.string()), // Mermaid syntax
			}),
		),
	})
		.index("fullName", ["fullName"])
		.index("indexingStatus", ["indexingStatus"])
		.index("lastAnalyzedAt", ["lastAnalyzedAt"]),

	architectureEntities: defineTable({
		repositoryId: v.id("repositories"),
		type: v.union(
			v.literal("package"),
			v.literal("module"),
			v.literal("component"),
			v.literal("service"),
			v.literal("directory"),
		),
		name: v.string(), // Display name: "Button", "api", "react-reconciler"
		slug: v.string(), // URL-safe: "button", "api", "react-reconciler"
		path: v.string(), // File/directory path: "packages/react-reconciler"
		description: v.string(), // AI-generated description
		purpose: v.string(), // What it does / why it exists
		dependencies: v.array(v.string()), // What it depends on (names)
		usedBy: v.array(v.string()), // What uses it (names)
		keyFiles: v.array(v.string()), // Important files in this entity
		complexity: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
		),
		iteration: v.number(), // Which analysis iteration discovered this (1-3)
		codeSnippet: v.optional(v.string()), // Representative code sample
	})
		.index("by_repository", ["repositoryId"])
		.index("by_type", ["repositoryId", "type"])
		.index("by_slug", ["repositoryId", "slug"])
		.index("by_iteration", ["repositoryId", "iteration"]),

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

	conversations: defineTable({
		userId: v.string(), // From Better Auth
		repositoryId: v.id("repositories"),
		title: v.string(),
		threadId: v.string(), // Agent component's thread ID
		lastMessageAt: v.number(),
		messageCount: v.number(),
	})
		.index("by_user_time", ["userId", "lastMessageAt"])
		.index("by_repo", ["repositoryId"])
		.index("by_thread", ["threadId"]),
});
