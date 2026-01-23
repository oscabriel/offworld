import type { z } from "zod";
import type {
	AgentSchema,
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
	QuickPathSchema,
	SearchPatternSchema,
	CommonPatternSchema,
	SkillSchema,
	RepoIndexEntrySchema,
	RepoIndexSchema,
} from "./schemas";

export type Agent = z.infer<typeof AgentSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export type GitProvider = z.infer<typeof GitProviderSchema>;
export type RemoteRepoSource = z.infer<typeof RemoteRepoSourceSchema>;
export type LocalRepoSource = z.infer<typeof LocalRepoSourceSchema>;
export type RepoSource = z.infer<typeof RepoSourceSchema>;

export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;

export type FileRole = z.infer<typeof FileRoleSchema>;
export type FileIndexEntry = z.infer<typeof FileIndexEntrySchema>;
export type FileIndex = z.infer<typeof FileIndexSchema>;
export type AnalysisMeta = z.infer<typeof AnalysisMetaSchema>;

export type QuickPath = z.infer<typeof QuickPathSchema>;
export type SearchPattern = z.infer<typeof SearchPatternSchema>;
export type CommonPattern = z.infer<typeof CommonPatternSchema>;
export type Skill = z.infer<typeof SkillSchema>;

export type RepoIndexEntry = z.infer<typeof RepoIndexEntrySchema>;
export type RepoIndex = z.infer<typeof RepoIndexSchema>;
