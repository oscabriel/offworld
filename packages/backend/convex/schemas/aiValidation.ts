import { z } from "zod";

/**
 * Zod schemas for validating AI-generated responses
 * Ensures type safety and runtime validation of LLM outputs
 */

// Architecture entity schema
export const ArchitectureEntitySchema = z.object({
	name: z.string(),
	type: z.enum(["package", "directory", "module", "service", "component"]),
	slug: z.string(),
	path: z.string().default(""),
	description: z.string(),
	purpose: z.string(),
	dependencies: z.array(z.string()).default([]),
	usedBy: z.array(z.string()).default([]),
	keyFiles: z.array(z.string()).default([]),
	complexity: z.enum(["low", "medium", "high"]),
	codeSnippet: z.string().optional(),

	// Phase 4C fields - Optional to allow gradual adoption
	layer: z.enum(["public", "internal", "extension", "utility"]).optional(),
	importance: z.number().min(0).max(1).optional(),
	dataFlow: z
		.object({
			entry: z.string(),
			processing: z.array(z.string()),
			output: z.string(),
			narrative: z.string(),
		})
		.optional(),
	githubUrl: z.string().optional(),
	rank: z.number().optional(),
	relatedGroup: z.string().optional(),
	relatedEntities: z.array(z.string()).default([]),
});

// Architecture iteration response schema
export const ArchitectureIterationSchema = z.object({
	overview: z.string(),
	pattern: z.string().optional(),
	entities: z.array(ArchitectureEntitySchema),
});

// Issue analysis schema
export const IssueAnalysisSchema = z.object({
	difficulty: z.number().min(1).max(5),
	summary: z.string(),
	filesLikelyTouched: z.array(z.string()).default([]),
	skillsRequired: z.array(z.string()).default([]),
});

/**
 * Helper to safely parse AI responses with fallback
 * @param schema - Zod schema to validate against
 * @param data - Unvalidated data from AI
 * @param fallback - Default value if validation fails
 * @returns Validated data or fallback
 */
export function safeParseAIResponse<T>(
	schema: z.ZodSchema<T>,
	data: unknown,
	fallback: T,
): T {
	try {
		return schema.parse(data);
	} catch (error) {
		console.error("AI response validation failed:", error);
		if (error instanceof z.ZodError) {
			console.error("Validation errors:", error.issues);
		}
		return fallback;
	}
}
