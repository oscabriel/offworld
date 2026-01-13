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
	overview: z.string().min(100, "Overview must be at least 100 characters"),
	problemsSolved: z.string().min(50, "Problems solved must be at least 50 characters"),
	features: z.string().min(50, "Features must be at least 50 characters"),
	patterns: z.string().min(50, "Patterns must be at least 50 characters"),
	targetUseCases: z.string().min(50, "Target use cases must be at least 50 characters"),
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
	/** AI provider ID (e.g., "anthropic", "openai") */
	provider?: string;
	/** AI model ID */
	model?: string;
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
		provider: options.provider,
		model: options.model,
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	options.onDebug?.(`Raw AI response (${result.text.length} chars):`);
	options.onDebug?.(result.text.slice(0, 500));

	let json: unknown;
	try {
		json = extractJSON(result.text);
	} catch (error) {
		options.onDebug?.(`JSON extraction failed: ${error}`);
		throw error;
	}

	try {
		const parsed = ProseEnhancementsSchema.parse(json);
		return parsed;
	} catch (error) {
		options.onDebug?.(`Schema validation failed. Extracted JSON: ${JSON.stringify(json, null, 2)}`);
		throw error;
	}
}

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

	return `You are analyzing a codebase. Output ONLY valid JSON matching this exact schema.
Do not use markdown. Do not use code blocks. Do not explain.
Just output the raw JSON object.

Repository: ${name} (${detectedPatterns.language})

Key Files:
${fileList}

Directories:
${entityPaths}

Required schema:
{
  "overview": "string (100+ chars, 3-5 bullet points)",
  "problemsSolved": "string (50+ chars, 3-5 bullet points)",
  "features": "string (50+ chars, 3-5 bullet points)",
  "patterns": "string (50+ chars, 3-5 bullet points)",
  "targetUseCases": "string (50+ chars, 3-5 bullet points)",
  "summary": "string (50+ chars, one sentence description)",
  "whenToUse": ["string (trigger phrase)", ...at least 3],
  "entityDescriptions": { ${entityList.split(", ").map((e) => `${e}: "description"`).join(", ")} },
  "relationships": [{"from": "string", "to": "string", "type": "string"}, ...]
}

Output raw JSON only.`;
}

export function extractJSON(text: string): unknown {
	const trimmed = text.trim();

	try {
		return JSON.parse(trimmed);
	} catch {
		// continue
	}

	const jsonBlocks = [...trimmed.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
	for (let i = jsonBlocks.length - 1; i >= 0; i--) {
		const match = jsonBlocks[i];
		const content = match?.[1]?.trim();
		if (content) {
			try {
				return JSON.parse(content);
			} catch {
				// continue
			}
		}
	}

	const codeBlocks = [...trimmed.matchAll(/```\s*([\s\S]*?)\s*```/g)];
	for (let i = codeBlocks.length - 1; i >= 0; i--) {
		const match = codeBlocks[i];
		const content = match?.[1]?.trim();
		if (content?.startsWith("{")) {
			try {
				return JSON.parse(content);
			} catch {
				// continue
			}
		}
	}

	const lastBrace = trimmed.lastIndexOf("}");
	if (lastBrace !== -1) {
		let depth = 0;
		let startBrace = -1;
		for (let i = lastBrace; i >= 0; i--) {
			if (trimmed[i] === "}") depth++;
			if (trimmed[i] === "{") {
				depth--;
				if (depth === 0) {
					startBrace = i;
					break;
				}
			}
		}
		if (startBrace !== -1) {
			const extracted = trimmed.slice(startBrace, lastBrace + 1);
			try {
				return JSON.parse(extracted);
			} catch {
				// continue
			}
		}
	}

	throw new Error(`Failed to extract JSON from AI response: ${trimmed.slice(-500)}`);
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
			provider: options.provider,
			model: options.model,
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

Fix these issues:
- Write specific, detailed prose (avoid "this is a", "provides functionality", etc.)
- Each prose section should be substantive (100+ chars for overview, 50+ for others)
- Use cases must be descriptive (20+ chars each)
- Entity descriptions must be specific (20+ chars each)`;
}
