import type { ProseEnhancements } from "../analysis/prose.js";

/**
 * Quality issue severity
 */
export type QualitySeverity = "error" | "warning";

/**
 * A quality issue found during validation
 */
export interface QualityIssue {
	severity: QualitySeverity;
	field: string;
	message: string;
}

/**
 * Report from quality validation
 */
export interface QualityReport {
	passed: boolean;
	issues: QualityIssue[];
}

/**
 * Generic phrases that indicate low-quality AI prose
 */
const GENERIC_PHRASES = [
	"this is a",
	"this repository",
	"this project",
	"contains code",
	"provides functionality",
	"implements features",
	"handles various",
	"manages different",
	"a collection of",
	"designed to",
	"used for",
	"allows users to",
	"enables you to",
];

/**
 * Validate the quality of AI-generated prose.
 * Checks:
 * 1. Summary is at least 50 characters
 * 2. Summary doesn't use generic phrasing
 * 3. whenToUse has at least 3 items
 * 4. Use cases are at least 20 characters
 * 5. Entity descriptions are at least 20 characters
 * 6. Entity descriptions don't use generic phrasing
 */
export function validateProseQuality(prose: ProseEnhancements): QualityReport {
	const issues: QualityIssue[] = [];

	// Check summary length
	if (prose.summary.length < 50) {
		issues.push({
			severity: "error",
			field: "summary",
			message: `Summary is only ${prose.summary.length} characters, needs at least 50`,
		});
	}

	// Check summary for generic phrasing
	const summaryLower = prose.summary.toLowerCase();
	for (const phrase of GENERIC_PHRASES) {
		if (summaryLower.includes(phrase)) {
			issues.push({
				severity: "warning",
				field: "summary",
				message: `Summary contains generic phrase "${phrase}"`,
			});
			break; // Only flag one generic phrase per field
		}
	}

	// Check whenToUse count
	if (prose.whenToUse.length < 3) {
		issues.push({
			severity: "error",
			field: "whenToUse",
			message: `Only ${prose.whenToUse.length} use cases, needs at least 3`,
		});
	}

	// Check whenToUse item lengths
	for (let i = 0; i < prose.whenToUse.length; i++) {
		const useCase = prose.whenToUse[i];
		if (useCase && useCase.length < 20) {
			issues.push({
				severity: "warning",
				field: `whenToUse[${i}]`,
				message: `Use case is only ${useCase.length} characters, should be at least 20`,
			});
		}
	}

	// Check entity descriptions
	for (const [entityName, description] of Object.entries(prose.entityDescriptions)) {
		// Check length
		if (description.length < 20) {
			issues.push({
				severity: "warning",
				field: `entityDescriptions.${entityName}`,
				message: `Description is only ${description.length} characters, should be at least 20`,
			});
		}

		// Check for generic phrasing
		const descLower = description.toLowerCase();
		for (const phrase of GENERIC_PHRASES) {
			if (descLower.includes(phrase)) {
				issues.push({
					severity: "warning",
					field: `entityDescriptions.${entityName}`,
					message: `Description contains generic phrase "${phrase}"`,
				});
				break; // Only flag one generic phrase per field
			}
		}
	}

	// passed is false if any error-severity issues exist
	const passed = !issues.some((issue) => issue.severity === "error");

	return { passed, issues };
}
