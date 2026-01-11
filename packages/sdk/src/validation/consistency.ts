import type { ProseEnhancements } from "../analysis/prose.js"
import type { SkillSkeleton } from "../analysis/skeleton.js"

/**
 * Type of consistency issue
 */
export type ConsistencyIssueType =
	| "orphaned_reference"
	| "missing_description"
	| "invalid_relationship"

/**
 * Severity of the issue
 */
export type ConsistencySeverity = "error" | "warning"

/**
 * A consistency issue found during validation
 */
export interface ConsistencyIssue {
	type: ConsistencyIssueType
	severity: ConsistencySeverity
	message: string
}

/**
 * Report from consistency validation
 */
export interface ConsistencyReport {
	passed: boolean
	issues: ConsistencyIssue[]
}

/**
 * Validate that AI-generated prose is consistent with the deterministic skeleton.
 * Checks:
 * 1. All skeleton entities have descriptions in prose
 * 2. No prose descriptions reference non-existent entities
 * 3. No relationships reference non-existent entities
 */
export function validateConsistency(
	skeleton: SkillSkeleton,
	prose: ProseEnhancements,
): ConsistencyReport {
	const issues: ConsistencyIssue[] = []
	const entityNames = new Set(skeleton.entities.map((e) => e.name))

	// Check all skeleton entities have descriptions
	for (const entity of skeleton.entities) {
		if (!prose.entityDescriptions[entity.name]) {
			issues.push({
				type: "missing_description",
				severity: "warning",
				message: `Entity "${entity.name}" is missing a description`,
			})
		}
	}

	// Check for descriptions of non-existent entities
	for (const entityName of Object.keys(prose.entityDescriptions)) {
		if (!entityNames.has(entityName)) {
			issues.push({
				type: "orphaned_reference",
				severity: "error",
				message: `Description provided for non-existent entity "${entityName}"`,
			})
		}
	}

	// Check relationships reference valid entities
	for (const rel of prose.relationships) {
		if (!entityNames.has(rel.from)) {
			issues.push({
				type: "invalid_relationship",
				severity: "error",
				message: `Relationship "from" references non-existent entity "${rel.from}"`,
			})
		}
		if (!entityNames.has(rel.to)) {
			issues.push({
				type: "invalid_relationship",
				severity: "error",
				message: `Relationship "to" references non-existent entity "${rel.to}"`,
			})
		}
	}

	// passed is false if any error-severity issues exist
	const passed = !issues.some((issue) => issue.severity === "error")

	return { passed, issues }
}
