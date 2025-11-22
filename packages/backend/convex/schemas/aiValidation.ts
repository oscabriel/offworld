import { z } from "zod";

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

export const ArchitectureIterationSchema = z.object({
	overview: z.string(),
	pattern: z.string().optional(),
	entities: z.array(ArchitectureEntitySchema),
});

export const IssueAnalysisSchema = z.object({
	difficulty: z.number().min(1).max(5),
	summary: z.string(),
	filesLikelyTouched: z.array(z.string()).default([]),
	skillsRequired: z.array(z.string()).default([]),
});

export function safeParseAIResponse<T>(
	schema: z.ZodSchema<T>,
	data: unknown,
	fallback: T,
): T {
	try {
		return schema.parse(data);
	} catch (err) {
		console.error("Schema validation error:", err);
		return fallback;
	}
}
