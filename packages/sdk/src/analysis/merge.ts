import type { QuickPath, SearchPattern, Skill } from "@offworld/types"
import type { ProseEnhancements, EntityRelationship } from "./prose.js"
import type { SkillSkeleton } from "./skeleton.js"

/**
 * Entity with description from prose merge
 */
export interface MergedEntity {
	name: string
	type: "directory"
	path: string
	description: string
}

/**
 * Key file from skeleton
 */
export interface MergedKeyFile {
	path: string
	role: "implementation"
}

/**
 * Extended skill result that includes entities, relationships, and keyFiles
 * which are not part of the base Skill type but useful for analysis
 */
export interface MergedSkillResult {
	skill: Skill
	entities: MergedEntity[]
	relationships: EntityRelationship[]
	keyFiles: MergedKeyFile[]
}

/**
 * Merge AI-generated prose enhancements into the deterministic skeleton
 * to produce the final Skill type plus additional analysis data.
 */
export function mergeProseIntoSkeleton(skeleton: SkillSkeleton, prose: ProseEnhancements): MergedSkillResult {
	const entityNames = new Set(skeleton.entities.map((e) => e.name))

	// Build quick paths with ${REPO}/ prefix
	const quickPaths: QuickPath[] = skeleton.quickPaths.map((qp) => ({
		path: `\${REPO}/${qp.path}`,
		description: qp.reason,
	}))

	// Build search patterns with pattern and scoped path
	const searchPatterns: SearchPattern[] = skeleton.searchPatterns.map((sp) => ({
		find: sp.pattern,
		pattern: sp.pattern,
		path: sp.scope ? `\${REPO}/${sp.scope}` : "${REPO}",
	}))

	// Build entities with descriptions from prose
	const entities: MergedEntity[] = skeleton.entities.map((entity) => ({
		name: entity.name,
		type: "directory" as const,
		path: entity.path || ".",
		description: prose.entityDescriptions[entity.name] ?? `Directory containing ${entity.files.length} files`,
	}))

	// Filter relationships to only include valid entity references
	const relationships = prose.relationships.filter(
		(rel) => entityNames.has(rel.from) && entityNames.has(rel.to),
	)

	// Build key files from top quick paths
	const keyFiles: MergedKeyFile[] = skeleton.quickPaths.slice(0, 10).map((qp) => ({
		path: qp.path,
		role: "implementation" as const,
	}))

	const skill: Skill = {
		name: skeleton.name,
		description: prose.summary,
		basePaths: {
			repo: skeleton.repoPath,
			analysis: `\${HOME}/.ow/analyses/${skeleton.name.replace(/\//g, "--")}`,
		},
		quickPaths,
		searchPatterns,
		whenToUse: prose.whenToUse,
		bestPractices: [],
		commonPatterns: [],
	}

	return {
		skill,
		entities,
		relationships,
		keyFiles,
	}
}
