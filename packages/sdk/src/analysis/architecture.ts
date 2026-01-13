import type { ParsedFile, ExtractedSymbol } from "../ast/parser.js";
import type { DependencyGraph } from "./imports.js";

export type RelationshipType = "imports" | "extends" | "implements" | "exports" | "re-exports";

export interface ArchitectureEdge {
	source: string;
	target: string;
	type: RelationshipType;
	sourceSymbol?: string;
	targetSymbol?: string;
}

export interface ArchitectureNode {
	path: string;
	symbols: string[];
	isHub: boolean;
	layer?: string;
}

export interface SymbolEntry {
	name: string;
	file: string;
	kind: ExtractedSymbol["kind"];
	isExported: boolean;
}

export interface ArchitectureGraph {
	nodes: ArchitectureNode[];
	edges: ArchitectureEdge[];
	symbolTable: Map<string, SymbolEntry>;
}

const LAYER_PATTERNS: [string, RegExp][] = [
	["ui", /^(components|pages|views|screens|ui)\//],
	["api", /^(api|routes|endpoints|handlers)\//],
	["domain", /^(domain|models|entities|core)\//],
	["infra", /^(infra|database|db|repositories|services)\//],
	["util", /^(utils|helpers|lib|shared|common)\//],
	["config", /^(config|settings)\//],
	["test", /^(__tests__|tests?|spec)\//],
];

function classifyLayer(path: string): string | undefined {
	for (const [layer, pattern] of LAYER_PATTERNS) {
		if (pattern.test(path)) return layer;
	}
	return undefined;
}

export function buildSymbolTable(parsedFiles: Map<string, ParsedFile>): Map<string, SymbolEntry> {
	const table = new Map<string, SymbolEntry>();

	for (const [filePath, parsed] of parsedFiles) {
		for (const cls of parsed.classes) {
			if (cls.isExported) {
				table.set(cls.name, {
					name: cls.name,
					file: filePath,
					kind: cls.kind,
					isExported: true,
				});
			}
		}

		for (const fn of parsed.functions) {
			if (fn.isExported) {
				table.set(fn.name, {
					name: fn.name,
					file: filePath,
					kind: fn.kind,
					isExported: true,
				});
			}
		}
	}

	return table;
}

export function buildArchitectureGraph(
	parsedFiles: Map<string, ParsedFile>,
	dependencyGraph: DependencyGraph,
): ArchitectureGraph {
	const symbolTable = buildSymbolTable(parsedFiles);
	const edges: ArchitectureEdge[] = [];
	const hubPaths = new Set(dependencyGraph.hubs.slice(0, 20).map((h) => h.path));

	for (const edge of dependencyGraph.edges) {
		edges.push({
			source: edge.source,
			target: edge.target,
			type: "imports",
		});
	}

	for (const [filePath, parsed] of parsedFiles) {
		for (const cls of parsed.classes) {
			if (cls.extends) {
				const parentEntry = symbolTable.get(cls.extends);
				if (parentEntry) {
					edges.push({
						source: filePath,
						target: parentEntry.file,
						type: "extends",
						sourceSymbol: cls.name,
						targetSymbol: cls.extends,
					});
				}
			}

			if (cls.implements) {
				for (const ifaceName of cls.implements) {
					const ifaceEntry = symbolTable.get(ifaceName);
					if (ifaceEntry) {
						edges.push({
							source: filePath,
							target: ifaceEntry.file,
							type: "implements",
							sourceSymbol: cls.name,
							targetSymbol: ifaceName,
						});
					}
				}
			}
		}

		for (const exp of parsed.exports) {
			if (exp.startsWith("* from ")) {
				const reExportPath = exp.slice(7);
				edges.push({
					source: filePath,
					target: reExportPath,
					type: "re-exports",
				});
			}
		}
	}

	const nodes: ArchitectureNode[] = [];
	for (const [filePath, parsed] of parsedFiles) {
		const symbols = [
			...parsed.classes.filter((c) => c.isExported).map((c) => c.name),
			...parsed.functions.filter((f) => f.isExported).map((f) => f.name),
		];

		nodes.push({
			path: filePath,
			symbols,
			isHub: hubPaths.has(filePath),
			layer: classifyLayer(filePath),
		});
	}

	return {
		nodes,
		edges,
		symbolTable,
	};
}

const ARROW_STYLES: Record<RelationshipType, string> = {
	imports: "-->",
	extends: "--|>",
	implements: "..|>",
	exports: "-->",
	"re-exports": "-.->",
};

export function generateMermaidDiagram(
	graph: ArchitectureGraph,
	options: { maxNodes?: number; groupByLayer?: boolean } = {},
): string {
	const { maxNodes = 30, groupByLayer = true } = options;
	const lines = ["flowchart TB"];

	const significantNodes = graph.nodes
		.filter((n) => n.isHub || n.symbols.length > 0)
		.slice(0, maxNodes);

	const nodePathSet = new Set(significantNodes.map((n) => n.path));

	if (groupByLayer) {
		const layerGroups = new Map<string, ArchitectureNode[]>();
		for (const node of significantNodes) {
			const layer = node.layer ?? "other";
			const group = layerGroups.get(layer) ?? [];
			group.push(node);
			layerGroups.set(layer, group);
		}

		for (const [layer, nodes] of layerGroups) {
			lines.push(`    subgraph ${layer}`);
			for (const node of nodes) {
				const id = sanitizeMermaidId(node.path);
				const label = formatNodeLabel(node);
				lines.push(`        ${id}["${label}"]`);
			}
			lines.push("    end");
		}
	} else {
		for (const node of significantNodes) {
			const id = sanitizeMermaidId(node.path);
			const label = formatNodeLabel(node);
			lines.push(`    ${id}["${label}"]`);
		}
	}

	const significantEdges = graph.edges.filter(
		(e) => nodePathSet.has(e.source) && nodePathSet.has(e.target) && e.source !== e.target,
	);

	const edgeSet = new Set<string>();
	for (const edge of significantEdges) {
		const key = `${edge.source}|${edge.target}|${edge.type}`;
		if (edgeSet.has(key)) continue;
		edgeSet.add(key);

		const sourceId = sanitizeMermaidId(edge.source);
		const targetId = sanitizeMermaidId(edge.target);
		const arrow = ARROW_STYLES[edge.type];

		if (edge.sourceSymbol && edge.targetSymbol) {
			lines.push(`    ${sourceId} ${arrow}|${edge.type}| ${targetId}`);
		} else {
			lines.push(`    ${sourceId} ${arrow} ${targetId}`);
		}
	}

	return lines.join("\n");
}

function sanitizeMermaidId(path: string): string {
	return (
		path
			.replace(/[^a-zA-Z0-9]/g, "_")
			.replace(/^_+|_+$/g, "")
			.toLowerCase() || "node"
	);
}

function formatNodeLabel(node: ArchitectureNode): string {
	const fileName = node.path.split("/").pop() ?? node.path;
	if (node.symbols.length === 0) return fileName;
	if (node.symbols.length <= 2) return `${fileName}\\n${node.symbols.join(", ")}`;
	return `${fileName}\\n${node.symbols.slice(0, 2).join(", ")}...`;
}
