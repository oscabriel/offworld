import type { ParsedFile, ExtractedSymbol } from "../ast/parser.js";
import type { DependencyGraph } from "./imports.js";

export type RelationshipType = "imports" | "extends" | "implements" | "exports" | "re-exports";
export type LayerType = "ui" | "api" | "domain" | "infra" | "util" | "config" | "test" | "other";

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

export interface EntryPoint {
	path: string;
	type: "main" | "cli" | "server" | "worker" | "index" | "config";
	exports: string[];
}

export interface CoreModule {
	path: string;
	purpose: string;
	exports: string[];
}

export interface DependencyHub {
	path: string;
	importerCount: number;
	exports: string[];
}

export interface InheritanceRelation {
	child: string;
	childFile: string;
	parent: string;
	parentFile: string;
	type: "extends" | "implements";
}

export interface LayerGroup {
	layer: LayerType;
	files: string[];
}

export interface DirectoryNode {
	name: string;
	path: string;
	isHub: boolean;
	hubCount?: number;
	children: DirectoryNode[];
}

export interface FindingEntry {
	pattern: string;
	location: string;
	examples: string[];
}

export interface MonorepoPackage {
	name: string;
	path: string;
	entryPoints: EntryPoint[];
	coreModules: CoreModule[];
	hubs: DependencyHub[];
	layers: LayerGroup[];
	inheritance: InheritanceRelation[];
}

export interface ArchitectureSection {
	entryPoints: EntryPoint[];
	coreModules: CoreModule[];
	hubs: DependencyHub[];
	layers: LayerGroup[];
	inheritance: InheritanceRelation[];
	directoryTree: DirectoryNode;
	findingTable: FindingEntry[];
	packages?: MonorepoPackage[];
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

const ENTRY_POINT_PATTERNS: [EntryPoint["type"], RegExp][] = [
	["main", /(?:^|\/)(?:main|index|app|entry)\.(ts|js|tsx|jsx|py|rs|go)$/],
	["cli", /(?:^|\/)(?:cli|bin|cmd)\//],
	["server", /(?:^|\/)(?:server|api|routes)\.(ts|js)$/],
	["worker", /(?:^|\/)(?:worker|job|queue)\.(ts|js)$/],
	["index", /(?:^|\/)index\.(ts|js|tsx|jsx)$/],
	["config", /(?:^|\/)(?:config|settings)\.(ts|js|json)$/],
];

function detectEntryPointType(path: string): EntryPoint["type"] | null {
	for (const [type, pattern] of ENTRY_POINT_PATTERNS) {
		if (pattern.test(path)) return type;
	}
	return null;
}

function detectMonorepoPackages(filePaths: string[]): string[] {
	const packagePaths = new Set<string>();
	const monorepoPatterns = [/^(packages|apps|libs)\/([^/]+)\//, /^([^/]+)\//];

	for (const filePath of filePaths) {
		for (const pattern of monorepoPatterns) {
			const match = filePath.match(pattern);
			if (match) {
				const prefix = match[1];
				if (prefix === "packages" || prefix === "apps" || prefix === "libs") {
					packagePaths.add(`${prefix}/${match[2]}`);
				}
				break;
			}
		}
	}

	return Array.from(packagePaths);
}

function buildDirectoryTree(filePaths: string[], hubPaths: Map<string, number>): DirectoryNode {
	const root: DirectoryNode = { name: ".", path: ".", isHub: false, children: [] };

	for (const filePath of filePaths) {
		const parts = filePath.split("/");
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!part) continue;

			const childPath = parts.slice(0, i + 1).join("/");
			let child = current.children.find((c) => c.name === part);

			if (!child) {
				const hubCount = hubPaths.get(childPath);
				child = {
					name: part,
					path: childPath,
					isHub: hubCount !== undefined && hubCount >= 3,
					hubCount,
					children: [],
				};
				current.children.push(child);
			}

			current = child;
		}
	}

	return root;
}

function generateFindingTable(
	parsedFiles: Map<string, ParsedFile>,
	_graph: ArchitectureGraph,
): FindingEntry[] {
	const entries: FindingEntry[] = [];
	const patterns: Map<string, { location: string; examples: string[] }> = new Map();

	for (const [filePath, parsed] of parsedFiles) {
		const layer = classifyLayer(filePath);

		if (parsed.classes.length > 0) {
			const key = layer ? `${layer} classes` : "classes";
			const entry = patterns.get(key) ?? { location: "", examples: [] };
			const dir = filePath.split("/").slice(0, -1).join("/");
			if (!entry.location) entry.location = dir;
			entry.examples.push(...parsed.classes.slice(0, 2).map((c) => c.name));
			patterns.set(key, entry);
		}

		if (parsed.functions.length > 0) {
			const key = layer ? `${layer} functions` : "functions";
			const entry = patterns.get(key) ?? { location: "", examples: [] };
			const dir = filePath.split("/").slice(0, -1).join("/");
			if (!entry.location) entry.location = dir;
			entry.examples.push(...parsed.functions.slice(0, 2).map((f) => f.name));
			patterns.set(key, entry);
		}
	}

	for (const [pattern, data] of patterns) {
		entries.push({
			pattern,
			location: data.location || ".",
			examples: [...new Set(data.examples)].slice(0, 3),
		});
	}

	return entries;
}

export function buildArchitectureSection(
	parsedFiles: Map<string, ParsedFile>,
	dependencyGraph: DependencyGraph,
	graph: ArchitectureGraph,
): ArchitectureSection {
	const filePaths = Array.from(parsedFiles.keys());
	const hubThreshold = 3;

	const entryPoints: EntryPoint[] = [];
	for (const [filePath, parsed] of parsedFiles) {
		const type = detectEntryPointType(filePath);
		if (type) {
			entryPoints.push({
				path: filePath,
				type,
				exports: parsed.exports.filter((e) => !e.startsWith("* from ")),
			});
		}
	}

	const coreModules: CoreModule[] = [];
	for (const node of graph.nodes) {
		if (node.symbols.length >= 3) {
			const parsed = parsedFiles.get(node.path);
			coreModules.push({
				path: node.path,
				purpose: inferPurpose(node.path, parsed),
				exports: node.symbols,
			});
		}
	}

	const hubs: DependencyHub[] = dependencyGraph.hubs
		.filter((h) => h.inDegree >= hubThreshold)
		.map((h) => ({
			path: h.path,
			importerCount: h.inDegree,
			exports: graph.nodes.find((n) => n.path === h.path)?.symbols ?? [],
		}));

	const layerGroups = new Map<LayerType, string[]>();
	for (const node of graph.nodes) {
		const layer = (node.layer ?? "other") as LayerType;
		const files = layerGroups.get(layer) ?? [];
		files.push(node.path);
		layerGroups.set(layer, files);
	}
	const layers: LayerGroup[] = Array.from(layerGroups.entries()).map(([layer, files]) => ({
		layer,
		files,
	}));

	const inheritance: InheritanceRelation[] = [];
	for (const edge of graph.edges) {
		if (edge.type === "extends" || edge.type === "implements") {
			inheritance.push({
				child: edge.sourceSymbol ?? "",
				childFile: edge.source,
				parent: edge.targetSymbol ?? "",
				parentFile: edge.target,
				type: edge.type,
			});
		}
	}

	const hubPathCounts = new Map<string, number>();
	for (const hub of dependencyGraph.hubs) {
		hubPathCounts.set(hub.path, hub.inDegree);
	}

	const directoryTree = buildDirectoryTree(filePaths, hubPathCounts);
	const findingTable = generateFindingTable(parsedFiles, graph);

	const monorepoPackagePaths = detectMonorepoPackages(filePaths);
	let packages: MonorepoPackage[] | undefined;

	if (monorepoPackagePaths.length > 1) {
		packages = monorepoPackagePaths.map((pkgPath) => {
			const pkgFiles = new Map<string, ParsedFile>();
			for (const [path, parsed] of parsedFiles) {
				if (path.startsWith(pkgPath + "/")) {
					pkgFiles.set(path, parsed);
				}
			}

			const pkgEntries = entryPoints.filter((e) => e.path.startsWith(pkgPath + "/"));
			const pkgCoreModules = coreModules.filter((m) => m.path.startsWith(pkgPath + "/"));
			const pkgHubs = hubs.filter((h) => h.path.startsWith(pkgPath + "/"));
			const pkgInheritance = inheritance.filter((i) => i.childFile.startsWith(pkgPath + "/"));

			const pkgLayers: LayerGroup[] = [];
			for (const [layer, files] of layerGroups) {
				const pkgLayerFiles = files.filter((f) => f.startsWith(pkgPath + "/"));
				if (pkgLayerFiles.length > 0) {
					pkgLayers.push({ layer, files: pkgLayerFiles });
				}
			}

			return {
				name: pkgPath.split("/").pop() ?? pkgPath,
				path: pkgPath,
				entryPoints: pkgEntries,
				coreModules: pkgCoreModules,
				hubs: pkgHubs,
				layers: pkgLayers,
				inheritance: pkgInheritance,
			};
		});
	}

	return {
		entryPoints,
		coreModules,
		hubs,
		layers,
		inheritance,
		directoryTree,
		findingTable,
		packages,
	};
}

function inferPurpose(path: string, parsed: ParsedFile | undefined): string {
	const fileName = path.split("/").pop() ?? path;
	const baseName = fileName.replace(/\.(ts|js|tsx|jsx|py|rs|go|java|rb|php|c|cpp|h|hpp)$/, "");

	if (!parsed) return baseName;

	if (parsed.classes.length > 0) {
		return `${parsed.classes[0]?.name ?? baseName} and related`;
	}
	if (parsed.functions.length > 0) {
		return `${parsed.functions[0]?.name ?? baseName} utilities`;
	}
	return baseName;
}

function formatDirectoryTree(node: DirectoryNode, prefix = "", isLast = true): string {
	const lines: string[] = [];
	const connector = isLast ? "└── " : "├── ";
	const hubAnnotation = node.isHub && node.hubCount ? ` [HUB: ${node.hubCount}←]` : "";

	if (node.name !== ".") {
		lines.push(`${prefix}${connector}${node.name}${hubAnnotation}`);
	}

	const childPrefix = prefix + (isLast ? "    " : "│   ");
	const sortedChildren = [...node.children].sort((a, b) => {
		const aIsDir = a.children.length > 0;
		const bIsDir = b.children.length > 0;
		if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	for (let i = 0; i < sortedChildren.length; i++) {
		const child = sortedChildren[i];
		if (!child) continue;
		const childIsLast = i === sortedChildren.length - 1;
		const childLines = formatDirectoryTree(
			child,
			node.name === "." ? "" : childPrefix,
			childIsLast,
		);
		lines.push(childLines);
	}

	return lines.join("\n");
}

function generateLayerDiagram(layers: LayerGroup[]): string {
	const lines = ["flowchart TB"];
	const layerOrder: LayerType[] = [
		"ui",
		"api",
		"domain",
		"infra",
		"util",
		"config",
		"test",
		"other",
	];

	const orderedLayers = layers
		.filter((l) => l.files.length > 0)
		.sort((a, b) => layerOrder.indexOf(a.layer) - layerOrder.indexOf(b.layer));

	for (const layer of orderedLayers) {
		const id = layer.layer;
		const count = layer.files.length;
		lines.push(`    ${id}["${layer.layer} (${count} files)"]`);
	}

	for (let i = 0; i < orderedLayers.length - 1; i++) {
		const current = orderedLayers[i];
		const next = orderedLayers[i + 1];
		if (current && next) {
			lines.push(`    ${current.layer} --> ${next.layer}`);
		}
	}

	return lines.join("\n");
}

function generateInheritanceDiagram(inheritance: InheritanceRelation[]): string {
	if (inheritance.length === 0) return "";

	const lines = ["classDiagram"];
	const seen = new Set<string>();

	for (const rel of inheritance) {
		const arrow = rel.type === "extends" ? "<|--" : "<|..";
		const key = `${rel.parent}${arrow}${rel.child}`;

		if (!seen.has(key)) {
			seen.add(key);
			lines.push(`    ${rel.parent} ${arrow} ${rel.child}`);
		}
	}

	return lines.join("\n");
}

export function formatArchitectureMd(section: ArchitectureSection): string {
	const lines: string[] = ["# Architecture"];

	if (section.packages && section.packages.length > 1) {
		lines.push("");
		lines.push("## Monorepo Packages");
		lines.push("");
		for (const pkg of section.packages) {
			lines.push(`- **${pkg.name}** - \`${pkg.path}\``);
		}
	}

	lines.push("");
	lines.push("## Entry Points");
	lines.push("");
	if (section.entryPoints.length > 0) {
		lines.push("| Path | Type | Exports |");
		lines.push("|------|------|---------|");
		for (const ep of section.entryPoints) {
			const exports = ep.exports.slice(0, 3).join(", ") || "-";
			lines.push(`| \`${ep.path}\` | ${ep.type} | ${exports} |`);
		}
	} else {
		lines.push("No entry points detected.");
	}

	lines.push("");
	lines.push("## Core Modules");
	lines.push("");
	if (section.coreModules.length > 0) {
		lines.push("| Path | Purpose | Key Exports |");
		lines.push("|------|---------|-------------|");
		for (const mod of section.coreModules.slice(0, 20)) {
			const exports = mod.exports.slice(0, 3).join(", ");
			lines.push(`| \`${mod.path}\` | ${mod.purpose} | ${exports} |`);
		}
	} else {
		lines.push("No core modules detected.");
	}

	lines.push("");
	lines.push("## Dependency Hubs");
	lines.push("");
	lines.push("Files imported by 3+ other files:");
	lines.push("");
	if (section.hubs.length > 0) {
		lines.push("| Path | Importers | Exports |");
		lines.push("|------|-----------|---------|");
		for (const hub of section.hubs.slice(0, 15)) {
			const exports = hub.exports.slice(0, 3).join(", ") || "-";
			lines.push(`| \`${hub.path}\` | ${hub.importerCount}← | ${exports} |`);
		}
	} else {
		lines.push("No dependency hubs detected.");
	}

	lines.push("");
	lines.push("## Layer Diagram");
	lines.push("");
	lines.push("```mermaid");
	lines.push(generateLayerDiagram(section.layers));
	lines.push("```");

	if (section.inheritance.length > 0) {
		lines.push("");
		lines.push("## Inheritance");
		lines.push("");
		lines.push("```mermaid");
		lines.push(generateInheritanceDiagram(section.inheritance));
		lines.push("```");
	}

	lines.push("");
	lines.push("## Directory Structure");
	lines.push("");
	lines.push("```");
	lines.push(formatDirectoryTree(section.directoryTree));
	lines.push("```");

	lines.push("");
	lines.push("## Finding Things");
	lines.push("");
	if (section.findingTable.length > 0) {
		lines.push("| Pattern | Location | Examples |");
		lines.push("|---------|----------|----------|");
		for (const entry of section.findingTable) {
			const examples = entry.examples.join(", ") || "-";
			lines.push(`| ${entry.pattern} | \`${entry.location}\` | ${examples} |`);
		}
	} else {
		lines.push("No patterns detected.");
	}

	if (section.packages && section.packages.length > 1) {
		for (const pkg of section.packages) {
			lines.push("");
			lines.push(`## Package: ${pkg.name}`);
			lines.push("");
			lines.push(`Path: \`${pkg.path}\``);

			if (pkg.entryPoints.length > 0) {
				lines.push("");
				lines.push("### Entry Points");
				lines.push("");
				for (const ep of pkg.entryPoints) {
					lines.push(`- \`${ep.path}\` (${ep.type})`);
				}
			}

			if (pkg.hubs.length > 0) {
				lines.push("");
				lines.push("### Hubs");
				lines.push("");
				for (const hub of pkg.hubs.slice(0, 5)) {
					lines.push(`- \`${hub.path}\` (${hub.importerCount}←)`);
				}
			}
		}
	}

	return lines.join("\n");
}
