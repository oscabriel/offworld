import { z } from "zod";
import { streamPrompt } from "../ai/index.js";
import { validateProseQuality, type QualityReport } from "../validation/quality.js";
import type { SkillSkeleton } from "./skeleton.js";

/**
 * Relationship between entities
 */
export interface EntityRelationship {
	from: string;
	to: string;
	type: string;
}

/**
 * Schema for AI-generated prose enhancements
 */
export const ProseEnhancementsSchema = z.object({
	summary: z.string().min(50, "Summary must be at least 50 characters"),
	whenToUse: z.array(z.string()).min(3, "Must have at least 3 use cases"),
	entityDescriptions: z.record(z.string(), z.string()),
	relationships: z.array(
		z.object({
			from: z.string(),
			to: z.string(),
			type: z.string(),
		}),
	),
});

export type ProseEnhancements = z.infer<typeof ProseEnhancementsSchema>;

/**
 * Options for prose generation
 */
export interface ProseGenerateOptions {
	onDebug?: (message: string) => void;
	onStream?: (text: string) => void;
}

/**
 * Generate prose enhancements for a skill skeleton using AI.
 * The AI generates ONLY prose content (summary, descriptions, relationships).
 * Structure (quickPaths, searchPatterns, entities) comes from the skeleton.
 */
export async function generateProseEnhancements(
	skeleton: SkillSkeleton,
	options: ProseGenerateOptions = {},
): Promise<ProseEnhancements> {
	const entityNames = skeleton.entities.map((e) => e.name);

	const prompt = buildProsePrompt(skeleton, entityNames);

	const result = await streamPrompt({
		prompt,
		cwd: skeleton.repoPath,
		systemPrompt: `You are a technical documentation expert.
Generate ONLY valid JSON output that matches the EXACT schema specified.
Do not include any text before or after the JSON.
Do not include markdown code fences.
Output raw JSON only.`,
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	const json = extractJSON(result.text);
	const parsed = ProseEnhancementsSchema.parse(json);

	return parsed;
}

/**
 * Build the prompt for prose generation
 */
function buildProsePrompt(skeleton: SkillSkeleton, entityNames: string[]): string {
	const { name, detectedPatterns, quickPaths, entities } = skeleton;

	const entityList = entityNames.map((n) => `"${n}"`).join(", ");
	const fileList = quickPaths
		.slice(0, 10)
		.map((qp) => `- ${qp.path}: ${qp.reason}`)
		.join("\n");
	const entityPaths = entities
		.map((e) => `- ${e.name}: ${e.files.length} files in ${e.path || "root"}`)
		.join("\n");

	return `Analyze this repository and generate prose content.

Repository: ${name}
Framework: ${detectedPatterns.framework ?? "None detected"}
Language: ${detectedPatterns.language}
Has Tests: ${detectedPatterns.hasTests}
Has Docs: ${detectedPatterns.hasDocs}

Key Files:
${fileList}

Directory Structure:
${entityPaths}

Generate a JSON object with EXACTLY this schema:
{
  "summary": "A detailed 2-3 sentence summary of what this repository does and its main purpose (min 50 chars)",
  "whenToUse": [
    "Use case 1 - when you would consult this repository",
    "Use case 2 - another scenario",
    "Use case 3 - third scenario"
  ],
  "entityDescriptions": {
    ${entityNames.map((n) => `"${n}": "Description of what the ${n} directory contains and its purpose"`).join(",\n    ")}
  },
  "relationships": [
    {"from": "entity1", "to": "entity2", "type": "imports|depends on|extends|uses"}
  ]
}

CRITICAL REQUIREMENTS:
1. Output ONLY the JSON object, no other text
2. summary must be at least 50 characters
3. whenToUse must have at least 3 items
4. entityDescriptions must include ALL of these entities: ${entityList}
5. relationships should only reference entities from: ${entityList}
6. Each relationship "type" should be: imports, depends on, extends, uses, configures, or tests`;
}

/**
 * Extract JSON from AI response, handling various formats:
 * - Direct JSON
 * - ```json code blocks
 * - Object boundary extraction
 */
export function extractJSON(text: string): unknown {
	const trimmed = text.trim();

	// Try direct JSON parse first
	try {
		return JSON.parse(trimmed);
	} catch {
		// Continue to other extraction methods
	}

	// Try extracting from ```json code block
	const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
	if (codeBlockMatch?.[1]) {
		try {
			return JSON.parse(codeBlockMatch[1].trim());
		} catch {
			// Continue
		}
	}

	// Try extracting from ``` code block (no json specifier)
	const genericBlockMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
	if (genericBlockMatch?.[1]) {
		try {
			return JSON.parse(genericBlockMatch[1].trim());
		} catch {
			// Continue
		}
	}

	// Try object boundary extraction (find { ... })
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");

	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		const extracted = trimmed.slice(firstBrace, lastBrace + 1);
		try {
			return JSON.parse(extracted);
		} catch {
			// Continue
		}
	}

	// Final attempt: try parsing the whole thing with lenient cleanup
	const cleaned = trimmed
		.replace(/^[^{]*/, "") // Remove leading non-JSON
		.replace(/[^}]*$/, ""); // Remove trailing non-JSON

	try {
		return JSON.parse(cleaned);
	} catch {
		throw new Error(`Failed to extract JSON from AI response: ${trimmed.slice(0, 200)}...`);
	}
}

/**
 * Result from prose generation with retry
 */
export interface ProseWithRetryResult {
	prose: ProseEnhancements;
	qualityReport: QualityReport;
	attempts: number;
}

/**
 * Generate prose enhancements with a single retry on failure.
 * - First attempt runs generateProseEnhancements normally
 * - Quality validation runs after first attempt
 * - If quality fails, single retry with feedback prompt
 * - If JSON parse fails, single retry without feedback
 * - Max 2 total attempts (1 original + 1 retry)
 */
export async function generateProseWithRetry(
	skeleton: SkillSkeleton,
	options: ProseGenerateOptions = {},
): Promise<ProseWithRetryResult> {
	const entityNames = skeleton.entities.map((e) => e.name);
	let attempts = 0;

	// First attempt
	attempts++;
	try {
		const prose = await generateProseEnhancements(skeleton, options);
		const qualityReport = validateProseQuality(prose);

		if (qualityReport.passed) {
			return { prose, qualityReport, attempts };
		}

		// Quality failed - retry with feedback
		options.onDebug?.(
			`Quality validation failed: ${qualityReport.issues.map((i) => i.message).join(", ")}`,
		);
		options.onDebug?.("Retrying prose generation with feedback...");

		attempts++;
		const feedbackPrompt = buildRetryPrompt(skeleton, entityNames, qualityReport);
		const retryResult = await streamPrompt({
			prompt: feedbackPrompt,
			cwd: skeleton.repoPath,
			systemPrompt: `You are a technical documentation expert.
Generate ONLY valid JSON output that matches the EXACT schema specified.
Do not include any text before or after the JSON.
Do not include markdown code fences.
Output raw JSON only.
IMPORTANT: Your previous response had quality issues. Address them carefully.`,
			onDebug: options.onDebug,
			onStream: options.onStream,
		});

		const retryJson = extractJSON(retryResult.text);
		const retryProse = ProseEnhancementsSchema.parse(retryJson);
		const retryQualityReport = validateProseQuality(retryProse);

		return { prose: retryProse, qualityReport: retryQualityReport, attempts };
	} catch (error) {
		// JSON parse or Zod validation failed
		if (attempts >= 2) {
			throw error;
		}

		const isJsonError = error instanceof Error && error.message.includes("Failed to extract JSON");
		const isZodError = (error as { issues?: unknown })?.issues !== undefined;

		if (!isJsonError && !isZodError) {
			throw error;
		}

		options.onDebug?.(
			`First attempt failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		options.onDebug?.("Retrying prose generation...");

		// Retry without feedback (just re-run)
		attempts++;
		const prose = await generateProseEnhancements(skeleton, options);
		const qualityReport = validateProseQuality(prose);

		return { prose, qualityReport, attempts };
	}
}

/**
 * Build a retry prompt with feedback about quality issues
 */
function buildRetryPrompt(
	skeleton: SkillSkeleton,
	entityNames: string[],
	qualityReport: QualityReport,
): string {
	const basePrompt = buildProsePrompt(skeleton, entityNames);

	const issues = qualityReport.issues.map((i) => `- ${i.field}: ${i.message}`).join("\n");

	return `${basePrompt}

IMPORTANT: Your previous response had these quality issues:
${issues}

Please fix these issues in your response:
- Ensure summary is specific and detailed (avoid generic phrases like "this is a", "provides functionality", etc.)
- Ensure all use cases are descriptive (at least 20 characters each)
- Ensure entity descriptions are specific and detailed (at least 20 characters each)`;
}
