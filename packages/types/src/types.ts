import type { z } from "zod";
import type {
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
} from "./schemas";

// PRD 2.1: Config type
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
