import { z } from "zod";

/**
 * Supported AI coding agents for skill symlinks.
 * Each agent has a different skill directory location - see packages/sdk/src/agents.ts for registry.
 */
export const AgentSchema = z.enum([
	"opencode",
	"claude-code",
	"codex",
	"amp",
	"antigravity",
	"cursor",
]);

export const ConfigSchema = z.object({
	repoRoot: z.string().default("~/ow"),
	defaultShallow: z.boolean().default(true),
	/** Default model in provider/model format (e.g., anthropic/claude-sonnet-4-20250514) */
	defaultModel: z.string().default("anthropic/claude-sonnet-4-20250514"),
	/** Agents to create skill symlinks for. Auto-detected if empty. */
	agents: z.array(AgentSchema).default([]),
});

export const GitProviderSchema = z.enum(["github", "gitlab", "bitbucket"]);

export const RemoteRepoSourceSchema = z.object({
	type: z.literal("remote"),
	provider: GitProviderSchema,
	owner: z.string(),
	repo: z.string(),
	fullName: z.string(),
	qualifiedName: z.string(),
	cloneUrl: z.string(),
});

export const LocalRepoSourceSchema = z.object({
	type: z.literal("local"),
	path: z.string(),
	name: z.string(),
	qualifiedName: z.string(),
});

export const RepoSourceSchema = z.discriminatedUnion("type", [
	RemoteRepoSourceSchema,
	LocalRepoSourceSchema,
]);

export const ProjectTypeSchema = z.enum(["monorepo", "library", "cli", "app", "framework"]);

export const EntityTypeSchema = z.enum(["package", "module", "feature", "util", "config"]);

export const EntitySchema = z.object({
	name: z.string(),
	type: EntityTypeSchema,
	path: z.string(),
	description: z.string(),
	responsibilities: z.array(z.string()),
	exports: z.array(z.string()).optional(),
	dependencies: z.array(z.string()).optional(),
});

export const RelationshipSchema = z.object({
	from: z.string(),
	to: z.string(),
	type: z.string(),
});

export const ArchitectureSchema = z.object({
	projectType: ProjectTypeSchema,
	entities: z.array(EntitySchema),
	relationships: z.array(RelationshipSchema),
	keyFiles: z.array(
		z.object({
			path: z.string(),
			role: z.string(),
		}),
	),
	patterns: z.object({
		framework: z.string().optional(),
		buildTool: z.string().optional(),
		testFramework: z.string().optional(),
		language: z.string().optional(),
	}),
});

export const FileRoleSchema = z.enum(["entry", "core", "types", "config", "test", "util", "doc"]);

export const FileIndexEntrySchema = z.object({
	path: z.string(),
	importance: z.number().min(0).max(1),
	type: FileRoleSchema,
	exports: z.array(z.string()).optional(),
	imports: z.array(z.string()).optional(),
	summary: z.string().optional(),
});

export const FileIndexSchema = z.array(FileIndexEntrySchema);

export const AnalysisMetaSchema = z.object({
	analyzedAt: z.string(),
	commitSha: z.string(),
	version: z.string(),
	tokenCost: z.number().optional(),
});

/**
 * Data payload for push/pull operations.
 * Replaces legacy AnalysisData/SkillData.
 */
export const ReferenceDataSchema = z.object({
	fullName: z.string(),
	referenceName: z.string(),
	description: z.string(),
	content: z.string(),
	commitSha: z.string(),
	generatedAt: z.string(),
});

/**
 * Entry for a single repo in the global map.
 */
export const GlobalMapRepoEntrySchema = z.object({
	localPath: z.string(),
	references: z.array(z.string()),
	primary: z.string(),
	keywords: z.array(z.string()).default([]),
	updatedAt: z.string(),
});

/**
 * Global map (local-only, at ~/.local/share/offworld/skill/offworld/assets/map.json).
 */
export const GlobalMapSchema = z.object({
	repos: z.record(z.string(), GlobalMapRepoEntrySchema),
});

/**
 * Entry for a single repo in a project map.
 */
export const ProjectMapRepoEntrySchema = z.object({
	localPath: z.string(),
	reference: z.string(),
	keywords: z.array(z.string()).default([]),
});

/**
 * Project map (at ./.offworld/map.json).
 */
export const ProjectMapSchema = z.object({
	version: z.number().default(1),
	scope: z.literal("project"),
	globalMapPath: z.string(),
	repos: z.record(z.string(), ProjectMapRepoEntrySchema),
});

/**
 * Options for ow init command
 */
export interface InitOptions {
	yes?: boolean;
	/** Skip auth check (useful for testing) */
	skipAuth?: boolean;
}
