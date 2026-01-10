import { z } from "zod";

// ============================================================================
// PRD 2.1: ConfigSchema for CLI configuration
// ============================================================================
export const AIProviderSchema = z.enum(["claude-code", "opencode"]);

export const ConfigSchema = z.object({
	repoRoot: z.string().default("~/ow"),
	metaRoot: z.string().default("~/.ow"),
	skillDir: z.string().default("~/.config/opencode/skill"),
	defaultShallow: z.boolean().default(true),
	autoAnalyze: z.boolean().default(true),
	preferredProvider: AIProviderSchema.optional(),
});

// ============================================================================
// PRD 2.2: GitProvider and RepoSource schemas
// ============================================================================
export const GitProviderSchema = z.enum(["github", "gitlab", "bitbucket"]);

export const RemoteRepoSourceSchema = z.object({
	type: z.literal("remote"),
	provider: GitProviderSchema,
	owner: z.string(),
	repo: z.string(),
	fullName: z.string(), // "owner/repo"
	qualifiedName: z.string(), // "github:owner/repo"
	cloneUrl: z.string(),
});

export const LocalRepoSourceSchema = z.object({
	type: z.literal("local"),
	path: z.string(),
	name: z.string(),
	qualifiedName: z.string(), // "local:<hash>"
});

export const RepoSourceSchema = z.discriminatedUnion("type", [
	RemoteRepoSourceSchema,
	LocalRepoSourceSchema,
]);

// ============================================================================
// PRD 2.3: Architecture and Entity schemas
// ============================================================================
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

// ============================================================================
// PRD 2.4: FileIndex and AnalysisMeta schemas
// ============================================================================
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
	analyzedAt: z.string(), // ISO date string
	commitSha: z.string(),
	version: z.string(),
	tokenCost: z.number().optional(),
});

// ============================================================================
// PRD 2.5: Skill schema for SKILL.md generation
// ============================================================================
export const SkillSchema = z.object({
	name: z.string(),
	description: z.string(),
	allowedTools: z.array(z.string()),
	repositoryStructure: z.array(
		z.object({
			path: z.string(),
			purpose: z.string(),
		}),
	),
	keyFiles: z.array(
		z.object({
			path: z.string(),
			description: z.string(),
		}),
	),
	searchStrategies: z.array(z.string()),
	whenToUse: z.array(z.string()),
});

// ============================================================================
// PRD 3.6: RepoIndex schemas for global repo index
// ============================================================================
export const RepoIndexEntrySchema = z.object({
	fullName: z.string(), // "owner/repo" or local name
	qualifiedName: z.string(), // "github:owner/repo" or "local:<hash>"
	localPath: z.string(), // Absolute path to cloned repo
	analyzedAt: z.string().optional(), // ISO date string
	commitSha: z.string().optional(), // Commit SHA at analysis time
	hasSkill: z.boolean().default(false), // Whether SKILL.md was generated
});

export const RepoIndexSchema = z.object({
	version: z.string().default("1"),
	repos: z.record(z.string(), RepoIndexEntrySchema), // Keyed by qualifiedName
});
