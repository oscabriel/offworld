import * as path from "node:path";
import * as fs from "node:fs";
import type { ParsedFile } from "../ast/parser.js";

/**
 * An edge in the dependency graph representing an import relationship
 */
export interface ImportEdge {
	source: string;
	target: string;
	type: "import" | "require";
}

/**
 * A node in the dependency graph with degree information
 */
export interface GraphNode {
	path: string;
	inDegree: number;
	outDegree: number;
}

/**
 * The complete dependency graph built from import analysis
 */
export interface DependencyGraph {
	nodes: GraphNode[];
	edges: ImportEdge[];
	hubs: GraphNode[];
	leaves: GraphNode[];
}

/**
 * Common file extensions to try when resolving imports
 */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ""];

/**
 * Index file names to try when resolving directory imports
 */
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs"];

/**
 * Resolve an import path to an actual file path.
 * Returns null for external packages (non-relative imports).
 */
export function resolveImport(
	importPath: string,
	sourceFile: string,
	repoPath: string,
): string | null {
	// Skip external packages (non-relative imports)
	if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
		return null;
	}

	const sourceDir = path.dirname(sourceFile);
	const absoluteImport = path.resolve(sourceDir, importPath);

	// Try the path as-is first (might include extension)
	if (fs.existsSync(absoluteImport) && fs.statSync(absoluteImport).isFile()) {
		return path.relative(repoPath, absoluteImport);
	}

	// Try with various extensions
	for (const ext of EXTENSIONS) {
		const withExt = absoluteImport + ext;
		if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
			return path.relative(repoPath, withExt);
		}
	}

	// Try as directory with index file
	if (fs.existsSync(absoluteImport) && fs.statSync(absoluteImport).isDirectory()) {
		for (const indexFile of INDEX_FILES) {
			const indexPath = path.join(absoluteImport, indexFile);
			if (fs.existsSync(indexPath)) {
				return path.relative(repoPath, indexPath);
			}
		}
	}

	// Could not resolve
	return null;
}

/**
 * Build a dependency graph from parsed files.
 * Extracts import edges and calculates node degrees.
 */
export function buildDependencyGraph(
	parsedFiles: Map<string, ParsedFile>,
	repoPath: string,
): DependencyGraph {
	const edges: ImportEdge[] = [];
	const nodeMap = new Map<string, GraphNode>();

	// Initialize nodes for all parsed files
	for (const filePath of parsedFiles.keys()) {
		nodeMap.set(filePath, {
			path: filePath,
			inDegree: 0,
			outDegree: 0,
		});
	}

	// Build edges from imports
	for (const [sourcePath, parsedFile] of parsedFiles) {
		const absoluteSource = path.join(repoPath, sourcePath);

		for (const importPath of parsedFile.imports) {
			const resolvedTarget = resolveImport(importPath, absoluteSource, repoPath);

			if (resolvedTarget === null) {
				// External package, skip
				continue;
			}

			// Normalize the path
			const normalizedTarget = resolvedTarget.replace(/\\/g, "/");

			// Only add edge if target is in our parsed files
			if (parsedFiles.has(normalizedTarget)) {
				// Determine import type based on path syntax
				const isRequire = importPath.includes("require(") || parsedFile.language === "commonjs";

				edges.push({
					source: sourcePath,
					target: normalizedTarget,
					type: isRequire ? "require" : "import",
				});

				// Update degrees
				const sourceNode = nodeMap.get(sourcePath);
				const targetNode = nodeMap.get(normalizedTarget);

				if (sourceNode) {
					sourceNode.outDegree++;
				}
				if (targetNode) {
					targetNode.inDegree++;
				}
			}
		}
	}

	const nodes = Array.from(nodeMap.values());

	// Hubs: files that are imported the most (highest inDegree)
	const hubs = [...nodes].filter((n) => n.inDegree > 0).sort((a, b) => b.inDegree - a.inDegree);

	// Leaves: files with the most dependencies (highest outDegree)
	const leaves = [...nodes]
		.filter((n) => n.outDegree > 0)
		.sort((a, b) => b.outDegree - a.outDegree);

	return {
		nodes,
		edges,
		hubs,
		leaves,
	};
}
