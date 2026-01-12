import { homedir } from "node:os";
import { relative } from "node:path";
import type { QuickPath, SearchPattern, Skill } from "@offworld/types";
import type { ProseEnhancements, EntityRelationship } from "./prose.js";
import type { SkillSkeleton } from "./skeleton.js";

function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return homedir() + path.slice(1);
	}
	return path;
}

function computeRepoRelativePath(repoPath: string, repoRoot?: string): string {
	const root = expandTilde(repoRoot ?? "~/ow");
	const rel = relative(root, repoPath);
	return rel.startsWith("..") ? repoPath : rel;
}

/**
 * Entity with description from prose merge
 */
export interface MergedEntity {
	name: string;
	type: "directory";
	path: string;
	description: string;
}

/**
 * Key file from skeleton
 */
export interface MergedKeyFile {
	path: string;
	role: "implementation";
}

export interface MergedSkillResult {
	skill: Skill;
	entities: MergedEntity[];
	relationships: EntityRelationship[];
	keyFiles: MergedKeyFile[];
	prose: ProseEnhancements;
}

/** Options for merging prose into skeleton */
export interface MergeOptions {
	qualifiedName?: string;
	repoRoot?: string;
	metaRoot?: string;
}

/**
 * Merge AI-generated prose enhancements into the deterministic skeleton
 * to produce the final Skill type plus additional analysis data.
 */
export function mergeProseIntoSkeleton(
	skeleton: SkillSkeleton,
	prose: ProseEnhancements,
	options: MergeOptions = {},
): MergedSkillResult {
	const entityNames = new Set(skeleton.entities.map((e) => e.name));

	// Build quick paths with ${REPO}/ prefix
	const quickPaths: QuickPath[] = skeleton.quickPaths.map((qp) => ({
		path: `\${REPO}/${qp.path}`,
		description: qp.reason,
	}));

	// Build search patterns with pattern and scoped path
	const searchPatterns: SearchPattern[] = skeleton.searchPatterns.map((sp) => ({
		find: sp.pattern,
		pattern: sp.pattern,
		path: sp.scope ? `\${REPO}/${sp.scope}` : "${REPO}",
	}));

	// Build entities with descriptions from prose
	const entities: MergedEntity[] = skeleton.entities.map((entity) => ({
		name: entity.name,
		type: "directory" as const,
		path: entity.path || ".",
		description:
			prose.entityDescriptions[entity.name] ?? `Directory containing ${entity.files.length} files`,
	}));

	// Filter relationships to only include valid entity references
	const relationships = prose.relationships.filter(
		(rel) => entityNames.has(rel.from) && entityNames.has(rel.to),
	);

	// Build key files from top quick paths
	const keyFiles: MergedKeyFile[] = skeleton.quickPaths.slice(0, 10).map((qp) => ({
		path: qp.path,
		role: "implementation" as const,
	}));

	const analysisKey = options.qualifiedName ?? skeleton.name;
	const repoRelative = computeRepoRelativePath(skeleton.repoPath, options.repoRoot);
	const analysisRelative = `analyses/${analysisKey.replace(/\//g, "--")}`;

	const skill: Skill = {
		name: skeleton.name,
		description: prose.summary,
		basePaths: {
			repo: `\${OW_REPOS}/${repoRelative}`,
			analysis: `\${OW_META}/${analysisRelative}`,
		},
		quickPaths,
		searchPatterns,
		whenToUse: prose.whenToUse,
		bestPractices: [],
		commonPatterns: [],
	};

	return {
		skill,
		entities,
		relationships,
		keyFiles,
		prose,
	};
}
