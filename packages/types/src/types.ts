import type { z } from "zod";
import type { ConfigSchema, GitProviderSchema } from "./schemas";

// Inferred types from Zod schemas
export type Config = z.infer<typeof ConfigSchema>;
export type GitProvider = z.infer<typeof GitProviderSchema>;
