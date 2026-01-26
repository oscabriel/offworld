/**
 * Map manager for global and project maps
 *
 * Manages:
 * - Global map: ~/.local/share/offworld/skill/offworld/assets/map.json
 * - Project map: ./.offworld/map.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	GlobalMapSchema,
	ProjectMapSchema,
	type GlobalMap,
	type GlobalMapRepoEntry,
	type ProjectMap,
	type ProjectMapRepoEntry,
} from "@offworld/types";
import { Paths } from "./paths.js";

/**
 * Reads the global map from ~/.local/share/offworld/skill/offworld/assets/map.json
 * Returns empty map if file doesn't exist or is invalid
 */
export function readGlobalMap(): GlobalMap {
	const mapPath = Paths.offworldGlobalMapPath;

	if (!existsSync(mapPath)) {
		return { repos: {} };
	}

	try {
		const content = readFileSync(mapPath, "utf-8");
		const data = JSON.parse(content);
		return GlobalMapSchema.parse(data);
	} catch {
		// If parsing fails, return empty map
		return { repos: {} };
	}
}

/**
 * Writes the global map to ~/.local/share/offworld/skill/offworld/assets/map.json
 * Creates directory if it doesn't exist
 */
export function writeGlobalMap(map: GlobalMap): void {
	const mapPath = Paths.offworldGlobalMapPath;
	const mapDir = dirname(mapPath);

	// Ensure directory exists
	if (!existsSync(mapDir)) {
		mkdirSync(mapDir, { recursive: true });
	}

	// Validate and write
	const validated = GlobalMapSchema.parse(map);
	writeFileSync(mapPath, JSON.stringify(validated, null, 2), "utf-8");
}

/**
 * Adds or updates a repo entry in the global map
 *
 * @param qualifiedName - The qualified repo name (owner/repo)
 * @param entry - The map entry to add/update
 */
export function upsertGlobalMapEntry(qualifiedName: string, entry: GlobalMapRepoEntry): void {
	const map = readGlobalMap();
	map.repos[qualifiedName] = entry;
	writeGlobalMap(map);
}

/**
 * Removes a repo entry from the global map
 *
 * @param qualifiedName - The qualified repo name (owner/repo)
 * @returns true if repo was removed, false if not found
 */
export function removeGlobalMapEntry(qualifiedName: string): boolean {
	const map = readGlobalMap();

	if (!(qualifiedName in map.repos)) {
		return false;
	}

	delete map.repos[qualifiedName];
	writeGlobalMap(map);
	return true;
}

/**
 * Writes a project map to ./.offworld/map.json
 *
 * @param projectRoot - Absolute path to project root
 * @param entries - Map of qualified repo names to project map entries
 */
export function writeProjectMap(
	projectRoot: string,
	entries: Record<string, ProjectMapRepoEntry>,
): void {
	const mapPath = join(projectRoot, ".offworld", "map.json");
	const mapDir = dirname(mapPath);

	// Ensure directory exists
	if (!existsSync(mapDir)) {
		mkdirSync(mapDir, { recursive: true });
	}

	const projectMap: ProjectMap = {
		version: 1,
		scope: "project",
		globalMapPath: Paths.offworldGlobalMapPath,
		repos: entries,
	};

	// Validate and write
	const validated = ProjectMapSchema.parse(projectMap);
	writeFileSync(mapPath, JSON.stringify(validated, null, 2), "utf-8");
}
