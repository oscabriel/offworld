import type { z } from "zod";
import type {
	AIProviderSchema,
	ConfigSchema,
	GitProviderSchema,
	RemoteRepoSourceSchema,
	LocalRepoSourceSchema,
	RepoSourceSchema,
	ProjectTypeSchema,
	EntityTypeSchema,
	EntitySchema,
	RelationshipSchema,
	ArchitectureSchema,
	FileRoleSchema,
	FileIndexEntrySchema,
	FileIndexSchema,
	AnalysisMetaSchema,
	SkillSchema,
	RepoIndexEntrySchema,
	RepoIndexSchema,
} from "./schemas";

// PRD 2.1 / 3.10: Config and AI provider types
export type AIProvider = z.infer<typeof AIProviderSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// PRD 2.2: Git provider and repo source types
export type GitProvider = z.infer<typeof GitProviderSchema>;
export type RemoteRepoSource = z.infer<typeof RemoteRepoSourceSchema>;
export type LocalRepoSource = z.infer<typeof LocalRepoSourceSchema>;
export type RepoSource = z.infer<typeof RepoSourceSchema>;

// PRD 2.3: Architecture and entity types
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;

// PRD 2.4: File index and analysis meta types
export type FileRole = z.infer<typeof FileRoleSchema>;
export type FileIndexEntry = z.infer<typeof FileIndexEntrySchema>;
export type FileIndex = z.infer<typeof FileIndexSchema>;
export type AnalysisMeta = z.infer<typeof AnalysisMetaSchema>;

// PRD 2.5: Skill type
export type Skill = z.infer<typeof SkillSchema>;

// PRD 3.6: Repo index types
export type RepoIndexEntry = z.infer<typeof RepoIndexEntrySchema>;
export type RepoIndex = z.infer<typeof RepoIndexSchema>;
