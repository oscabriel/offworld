/**
 * Zod schemas for external API responses.
 * Runtime validation for untrusted external data (GitHub, WorkOS, npm, etc.)
 */
import { z } from "zod";

// ============================================================================
// GitHub API Schemas
// ============================================================================

export const GitHubRepoResponseSchema = z.object({
	full_name: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	stargazers_count: z.number(),
	language: z.string().nullable(),
	html_url: z.string(),
	default_branch: z.string(),
	private: z.boolean().optional(),
	owner: z.object({
		login: z.string(),
	}),
});

export const GitHubOwnerResponseSchema = z.object({
	login: z.string(),
	name: z.string().nullable(),
	avatar_url: z.string(),
	bio: z.string().nullable(),
	type: z.enum(["User", "Organization"]),
	public_repos: z.number(),
	followers: z.number(),
	following: z.number(),
	html_url: z.string(),
});

export const GitHubRepoMetadataSchema = z.object({
	stargazers_count: z.number().optional(),
	description: z.string().nullable().optional(),
	language: z.string().nullable().optional(),
	default_branch: z.string().optional(),
});

// ============================================================================
// WorkOS API Schemas
// ============================================================================

export const WorkOSDeviceAuthResponseSchema = z.object({
	device_code: z.string(),
	user_code: z.string(),
	verification_uri: z.string(),
	verification_uri_complete: z.string(),
	expires_in: z.number(),
	interval: z.number(),
});

export const WorkOSUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
});

export const WorkOSTokenResponseSchema = z.object({
	user: WorkOSUserSchema,
	access_token: z.string(),
	refresh_token: z.string(),
	expires_at: z.number().optional(),
	organizationId: z.string().optional(),
});

export const WorkOSAuthErrorResponseSchema = z.object({
	error: z
		.enum(["authorization_pending", "slow_down", "access_denied", "expired_token"])
		.or(z.string()),
	error_description: z.string().optional(),
});

// ============================================================================
// npm Registry Schemas
// ============================================================================

export const NpmPackageResponseSchema = z.object({
	version: z.string().optional(),
	repository: z
		.object({
			url: z.string().optional(),
		})
		.optional(),
});

// ============================================================================
// models.dev Schemas
// ============================================================================

export const ModelsDevModelSchema = z.object({
	id: z.string(),
	name: z.string(),
	family: z.string().optional(),
	release_date: z.string().optional(),
	attachment: z.boolean().optional(),
	reasoning: z.boolean().optional(),
	temperature: z.boolean().optional(),
	tool_call: z.boolean().optional(),
	cost: z
		.object({
			input: z.number().optional(),
			output: z.number().optional(),
			cache_read: z.number().optional(),
			cache_write: z.number().optional(),
		})
		.optional(),
	limit: z
		.object({
			context: z.number().optional(),
			input: z.number().optional(),
			output: z.number().optional(),
		})
		.optional(),
	experimental: z.boolean().optional(),
	status: z.enum(["alpha", "beta", "deprecated"]).optional(),
});

export const ModelsDevProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	api: z.string().optional(),
	env: z.array(z.string()).optional(),
	npm: z.string().optional(),
	models: z.record(z.string(), ModelsDevModelSchema),
});

export const ModelsDevDataSchema = z.record(z.string(), ModelsDevProviderSchema);

// ============================================================================
// Type Exports
// ============================================================================

export type GitHubRepoResponse = z.infer<typeof GitHubRepoResponseSchema>;
export type GitHubOwnerResponse = z.infer<typeof GitHubOwnerResponseSchema>;
export type GitHubRepoMetadata = z.infer<typeof GitHubRepoMetadataSchema>;
export type WorkOSDeviceAuthResponse = z.infer<typeof WorkOSDeviceAuthResponseSchema>;
export type WorkOSTokenResponse = z.infer<typeof WorkOSTokenResponseSchema>;
export type WorkOSAuthErrorResponse = z.infer<typeof WorkOSAuthErrorResponseSchema>;
export type NpmPackageResponse = z.infer<typeof NpmPackageResponseSchema>;
export type ModelsDevProvider = z.infer<typeof ModelsDevProviderSchema>;
export type ModelsDevData = z.infer<typeof ModelsDevDataSchema>;
