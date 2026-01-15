import { z } from "zod";

export const AIConfigSchema = z.object({
	provider: z.string().default("opencode"),
	model: z.string().default("claude-opus-4-5"),
});

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
	metaRoot: z.string().default("~/.config/offworld"),
	skillDir: z.string().default("~/.config/opencode/skill"),
	defaultShallow: z.boolean().default(true),
	autoAnalyze: z.boolean().default(true),
	ai: AIConfigSchema.default({ provider: "opencode", model: "claude-opus-4-5" }),
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

export const QuickPathSchema = z.object({
	path: z.string(),
	description: z.string(),
});

export const SearchPatternSchema = z.object({
	find: z.string(),
	pattern: z.string(),
	path: z.string(),
});

export const CommonPatternSchema = z.object({
	name: z.string(),
	steps: z.array(z.string()),
});

export const ImportPatternSchema = z.object({
	import: z.string(),
	purpose: z.string(),
});

export const TroubleshootingEntrySchema = z.object({
	symptom: z.string(),
	cause: z.string(),
	fix: z.string(),
});

export const ArchitectureConceptSchema = z.object({
	name: z.string(),
	purpose: z.string(),
	location: z.string(),
});

export const ExtensionPointSchema = z.object({
	type: z.string(),
	interface: z.string(),
	purpose: z.string(),
	example: z.string().optional(),
});

export const CodebaseMapEntrySchema = z.object({
	path: z.string(),
	purpose: z.string(),
	exports: z.array(z.string()).optional(),
});

export const SkillSchema = z.object({
	// Required fields
	name: z.string(),
	description: z.string(),
	// Core skill fields (now optional for AI-only approach)
	whenToUse: z.array(z.string()).optional(),
	bestPractices: z.array(z.string()).optional(),
	commonPatterns: z.array(CommonPatternSchema).optional(),
	// Legacy fields for API compatibility (optional)
	basePaths: z
		.object({
			repo: z.string(),
			analysis: z.string(),
		})
		.optional(),
	quickPaths: z.array(QuickPathSchema).optional(),
	searchPatterns: z.array(SearchPatternSchema).optional(),
	importPatterns: z.array(ImportPatternSchema).optional(),
	quickStartCode: z.string().optional(),
	commonOperations: z.array(z.string()).optional(),
	troubleshooting: z.array(TroubleshootingEntrySchema).optional(),
	architecture: z.array(ArchitectureConceptSchema).optional(),
	extensionPoints: z.array(ExtensionPointSchema).optional(),
	codebaseMap: z.array(CodebaseMapEntrySchema).optional(),
});

export const RepoIndexEntrySchema = z.object({
	fullName: z.string(),
	qualifiedName: z.string(),
	localPath: z.string(),
	analyzedAt: z.string().optional(),
	commitSha: z.string().optional(),
	hasSkill: z.boolean().default(false),
});

export const RepoIndexSchema = z.object({
	version: z.string().default("1"),
	repos: z.record(z.string(), RepoIndexEntrySchema),
});
