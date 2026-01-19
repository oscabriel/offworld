import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Offworld Backend Schema
 * Convex schema for analyses storage
 */

// Entity schema for architecture entities
const entitySchema = v.object({
	name: v.string(),
	type: v.string(), // package, module, feature, util, config
	path: v.string(),
	description: v.string(),
	responsibilities: v.array(v.string()),
	exports: v.optional(v.array(v.string())),
	dependencies: v.optional(v.array(v.string())),
});

// Relationship schema for entity relationships
const relationshipSchema = v.object({
	from: v.string(),
	to: v.string(),
	type: v.string(), // imports, uses, extends, implements
});

// Key file schema
const keyFileSchema = v.object({
	path: v.string(),
	role: v.string(), // entry, core, types, config, test, util, doc
	description: v.optional(v.string()),
});

// Patterns schema
const patternsSchema = v.object({
	framework: v.optional(v.string()),
	buildTool: v.optional(v.string()),
	testFramework: v.optional(v.string()),
	stateManagement: v.optional(v.string()),
	styling: v.optional(v.string()),
	other: v.optional(v.array(v.string())),
});

// Architecture schema for stored analysis
const architectureSchema = v.object({
	projectType: v.string(), // monorepo, library, cli, app, framework
	entities: v.array(entitySchema),
	relationships: v.array(relationshipSchema),
	keyFiles: v.array(keyFileSchema),
	patterns: patternsSchema,
});

// Skill schema
const repositoryStructureSchema = v.object({
	path: v.string(),
	purpose: v.string(),
});

const keyFileSkillSchema = v.object({
	path: v.string(),
	description: v.string(),
});

const skillSchema = v.object({
	name: v.string(),
	description: v.string(),
	// Optional fields for AI-only approach (see packages/types SkillSchema)
	allowedTools: v.optional(v.array(v.string())),
	repositoryStructure: v.optional(v.array(repositoryStructureSchema)),
	keyFiles: v.optional(v.array(keyFileSkillSchema)),
	searchStrategies: v.optional(v.array(v.string())),
	whenToUse: v.optional(v.array(v.string())),
});

// File index entry schema
const fileIndexEntrySchema = v.object({
	path: v.string(),
	importance: v.number(), // 0-1
	type: v.string(), // entry, core, types, config, test, util, doc
	exports: v.optional(v.array(v.string())),
	imports: v.optional(v.array(v.string())),
	summary: v.optional(v.string()),
});

export default defineSchema({
	// Analyses table
	analyses: defineTable({
		// Repository identification
		fullName: v.string(), // owner/repo format
		provider: v.string(), // github, gitlab, bitbucket

		// Analysis content
		summary: v.string(), // markdown summary
		architecture: architectureSchema,
		skill: skillSchema,
		fileIndex: v.array(fileIndexEntrySchema),

		// Metadata
		commitSha: v.string(),
		analyzedAt: v.string(), // ISO timestamp
		version: v.string(), // offworld version that generated this

		// Stats
		pullCount: v.number(),
		isVerified: v.boolean(), // verified by offworld team

		// User who pushed (optional for public analyses)
		workosId: v.optional(v.string()),
	})
		.index("by_fullName", ["fullName"])
		.index("by_pullCount", ["pullCount"])
		.index("by_provider", ["provider"])
		.index("by_analyzedAt", ["analyzedAt"]),

	// Push logs for rate limiting
	pushLogs: defineTable({
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
