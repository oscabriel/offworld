import { z } from "zod";

// Placeholder schemas - will be implemented in Phase 2
export const ConfigSchema = z.object({
  repoRoot: z.string().default("~/ow"),
  metaRoot: z.string().default("~/.ow"),
  skillDir: z.string().default("~/.config/opencode/skill"),
  defaultShallow: z.boolean().default(true),
  autoAnalyze: z.boolean().default(true),
});

export const GitProviderSchema = z.enum(["github", "gitlab", "bitbucket"]);
