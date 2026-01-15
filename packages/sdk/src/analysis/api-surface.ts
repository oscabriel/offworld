/**
 * API Surface Extraction
 * Deterministic extraction of public API from package.json exports and entry points
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { ParsedFile, ExtractedSymbol } from "../ast/parser.js";

// ============================================================================
// Types
// ============================================================================

export interface ImportPattern {
	/** The import statement (e.g., "import { z } from 'zod'") */
	statement: string;
	/** Purpose description (e.g., "Main schema builder") */
	purpose: string;
	/** Exported symbols available via this import */
	exports: string[];
}

export interface PublicExport {
	/** Export name */
	name: string;
	/** File path relative to package root */
	path: string;
	/** Type signature or function signature */
	signature: string;
	/** Kind of export */
	kind: "function" | "class" | "interface" | "type" | "const" | "enum";
	/** Brief description inferred from name/context */
	description: string;
}

export interface SubpathExport {
	/** Subpath (e.g., "./client", "./server") */
	subpath: string;
	/** Exports available from this subpath */
	exports: PublicExport[];
}

export interface APISurface {
	/** Package name from package.json */
	packageName: string;
	/** Common import patterns with purpose */
	imports: ImportPattern[];
	/** All public exports from main entry */
	exports: PublicExport[];
	/** Subpath exports (e.g., "package/client", "package/server") */
	subpaths: SubpathExport[];
	/** Type-only exports (interfaces, types) */
	typeExports: PublicExport[];
}

// ============================================================================
// Package.json Parsing
// ============================================================================

interface PackageJson {
	name?: string;
	private?: boolean;
	main?: string;
	module?: string;
	types?: string;
	exports?: Record<string, unknown>;
}

function readPackageJson(repoPath: string): PackageJson | null {
	const pkgPath = join(repoPath, "package.json");
	if (!existsSync(pkgPath)) return null;

	try {
		const content = readFileSync(pkgPath, "utf-8");
		return JSON.parse(content) as PackageJson;
	} catch {
		return null;
	}
}

function resolveExportPath(exportValue: unknown): string | null {
	if (typeof exportValue === "string") {
		return exportValue;
	}

	if (exportValue && typeof exportValue === "object") {
		const obj = exportValue as Record<string, unknown>;

		const resolveField = (field: unknown): string | null => {
			if (typeof field === "string") return field;
			if (field && typeof field === "object") {
				const nested = field as Record<string, unknown>;
				return (
					(typeof nested.default === "string" ? nested.default : null) ??
					(typeof nested.types === "string" ? nested.types : null)
				);
			}
			return null;
		};

		return (
			resolveField(obj.import) ??
			resolveField(obj.require) ??
			resolveField(obj.default) ??
			resolveField(obj.types) ??
			null
		);
	}

	return null;
}

// ============================================================================
// Monorepo Detection
// ============================================================================

interface MonorepoPackageInfo {
	/** Absolute path to package directory */
	packagePath: string;
	/** Package name from package.json */
	packageName: string;
	/** Path relative to repo root (e.g., "packages/react-query") */
	relativePath: string;
	/** Package.json contents */
	pkg: PackageJson;
}

function isMonorepo(pkg: PackageJson): boolean {
	// Private root package or generic root name indicates monorepo
	return pkg.private === true || pkg.name === "root" || !pkg.name;
}

function findMonorepoPackages(repoPath: string): MonorepoPackageInfo[] {
	const packages: MonorepoPackageInfo[] = [];
	const packageDirs = ["packages", "apps", "libs"];

	for (const dir of packageDirs) {
		const dirPath = join(repoPath, dir);
		if (!existsSync(dirPath)) continue;

		try {
			const entries = readdirSync(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;

				const pkgDir = join(dirPath, entry.name);
				const pkgJsonPath = join(pkgDir, "package.json");

				if (!existsSync(pkgJsonPath)) continue;

				try {
					const content = readFileSync(pkgJsonPath, "utf-8");
					const subPkg = JSON.parse(content) as PackageJson;

					// Only include non-private packages with a name
					if (subPkg.name && !subPkg.private) {
						packages.push({
							packagePath: pkgDir,
							packageName: subPkg.name,
							relativePath: `${dir}/${entry.name}`,
							pkg: subPkg,
						});
					}
				} catch {
					// Skip packages we can't parse
				}
			}
		} catch {
			// Directory read failed
		}
	}

	return packages;
}

// ============================================================================
// Entry Point Detection
// ============================================================================

interface EntryPointInfo {
	path: string;
	subpath: string | null; // null = main entry, otherwise subpath like "./client"
}

function findEntryPoints(repoPath: string, pkg: PackageJson): EntryPointInfo[] {
	const entries: EntryPointInfo[] = [];
	const seen = new Set<string>();

	// 1. Check package.json exports field
	if (pkg.exports) {
		for (const [subpath, exportValue] of Object.entries(pkg.exports)) {
			const resolved = resolveExportPath(exportValue);
			if (resolved && !seen.has(resolved)) {
				seen.add(resolved);
				const normalizedSubpath = subpath === "." ? null : subpath;
				entries.push({ path: resolved, subpath: normalizedSubpath });
			}
		}
	}

	// 2. Fallback to main/module fields
	if (entries.length === 0) {
		const mainEntry = pkg.module ?? pkg.main;
		if (mainEntry && !seen.has(mainEntry)) {
			seen.add(mainEntry);
			entries.push({ path: mainEntry, subpath: null });
		}
	}

	// 3. Fallback to common entry point patterns
	if (entries.length === 0) {
		const commonEntries = [
			"src/index.ts",
			"src/index.js",
			"lib/index.ts",
			"lib/index.js",
			"index.ts",
			"index.js",
		];
		for (const entry of commonEntries) {
			if (existsSync(join(repoPath, entry)) && !seen.has(entry)) {
				seen.add(entry);
				entries.push({ path: entry, subpath: null });
				break;
			}
		}
	}

	return entries;
}

// ============================================================================
// Export Extraction
// ============================================================================

function inferDescription(name: string, kind: PublicExport["kind"]): string {
	const words = name
		.replace(/([A-Z]+)(?=[A-Z][a-z])/g, "$1_")
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[_-]/g, " ")
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);

	if (words.length === 0) return name;

	if (words[0] === "create" || words[0] === "make") {
		return `Create ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "use" && kind === "function") {
		return `React hook for ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "get") {
		return `Retrieve ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "set") {
		return `Set ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "is" || words[0] === "has" || words[0] === "can") {
		return `Check if ${words.slice(1).join(" ")}`;
	}

	if (kind === "const" && name === name.toUpperCase()) {
		return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	}

	return `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${words.join(" ")}`;
}

function symbolToExport(symbol: ExtractedSymbol, filePath: string): PublicExport {
	let kind: PublicExport["kind"];
	switch (symbol.kind) {
		case "class":
			kind = "class";
			break;
		case "interface":
			kind = "interface";
			break;
		case "enum":
			kind = "enum";
			break;
		case "function":
		case "method":
			kind = "function";
			break;
		default:
			kind = "function";
	}

	return {
		name: symbol.name,
		path: filePath,
		signature: symbol.signature ?? symbol.name,
		kind,
		description: inferDescription(symbol.name, kind),
	};
}

function extractExportsFromParsed(
	parsedFile: ParsedFile,
	filePath: string,
): { exports: PublicExport[]; typeExports: PublicExport[] } {
	const exports: PublicExport[] = [];
	const typeExports: PublicExport[] = [];

	// Extract exported functions
	for (const fn of parsedFile.functions) {
		if (fn.isExported) {
			exports.push(symbolToExport(fn, filePath));
		}
	}

	// Extract exported classes/interfaces/enums
	for (const cls of parsedFile.classes) {
		if (cls.isExported) {
			const exp = symbolToExport(cls, filePath);
			if (cls.kind === "interface" || cls.kind === "trait") {
				typeExports.push(exp);
			} else {
				exports.push(exp);
			}
		}
	}

	for (const exp of parsedFile.exports) {
		if (exp.startsWith("* from ")) continue;

		const names = exp
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);
		for (const name of names) {
			const alreadyHave =
				exports.some((e) => e.name === name) || typeExports.some((e) => e.name === name);
			if (!alreadyHave) {
				exports.push({
					name,
					path: filePath,
					signature: name,
					kind: "const",
					description: inferDescription(name, "const"),
				});
			}
		}
	}

	return { exports, typeExports };
}

// ============================================================================
// Import Pattern Generation
// ============================================================================

function inferSubpathPurpose(subpath: string): string {
	const parts = subpath.split("/");
	const lastPart = parts[parts.length - 1] ?? subpath;
	return lastPart
		.replace(/^@[^/]+\//, "")
		.replace(/-/g, " ")
		.split(" ")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function generateImportPatterns(
	packageName: string,
	exports: PublicExport[],
	subpaths: SubpathExport[],
): ImportPattern[] {
	const patterns: ImportPattern[] = [];

	if (exports.length > 0) {
		const topExports = exports.slice(0, 5).map((e) => e.name);
		patterns.push({
			statement: `import { ${topExports.join(", ")} } from '${packageName}'`,
			purpose: "Main entry point",
			exports: exports.map((e) => e.name),
		});
	}

	for (const subpath of subpaths) {
		if (subpath.exports.length === 0) continue;

		const isFullPackageName = subpath.subpath.startsWith("@") || !subpath.subpath.startsWith("./");
		const importPath = isFullPackageName
			? subpath.subpath
			: `${packageName}/${subpath.subpath.replace("./", "")}`;

		const topExports = subpath.exports.slice(0, 3).map((e) => e.name);
		patterns.push({
			statement: `import { ${topExports.join(", ")} } from '${importPath}'`,
			purpose: `${inferSubpathPurpose(importPath)} utilities`,
			exports: subpath.exports.map((e) => e.name),
		});
	}

	return patterns;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

function extractPackageAPISurface(
	packagePath: string,
	relativePath: string,
	pkg: PackageJson,
	parsedFiles: Map<string, ParsedFile>,
	onDebug?: (msg: string) => void,
): { exports: PublicExport[]; typeExports: PublicExport[] } {
	const entryPoints = findEntryPoints(packagePath, pkg);
	const exports: PublicExport[] = [];
	const typeExports: PublicExport[] = [];
	onDebug?.(`  Package ${relativePath}: ${entryPoints.length} entry points`);

	for (const entry of entryPoints) {
		const normalizedPath = entry.path.replace(/^\.\//, "");
		const fullPath = `${relativePath}/${normalizedPath}`;

		let parsedFile: ParsedFile | undefined;
		for (const [path, parsed] of parsedFiles) {
			if (path === fullPath || path.endsWith(normalizedPath)) {
				parsedFile = parsed;
				break;
			}
		}

		if (!parsedFile) continue;

		const extracted = extractExportsFromParsed(parsedFile, fullPath);
		exports.push(...extracted.exports);
		typeExports.push(...extracted.typeExports);
	}

	if (exports.length === 0) {
		const srcIndexPath = `${relativePath}/src/index.ts`;
		const srcIndexJsPath = `${relativePath}/src/index.js`;

		onDebug?.(`    Looking for ${srcIndexPath} in parsedFiles`);
		const parsed = parsedFiles.get(srcIndexPath) ?? parsedFiles.get(srcIndexJsPath);
		if (parsed) {
			onDebug?.(`    Found! Extracting exports...`);
			const extracted = extractExportsFromParsed(parsed, srcIndexPath);
			exports.push(...extracted.exports);
			typeExports.push(...extracted.typeExports);
			onDebug?.(`    Extracted ${exports.length} exports, ${typeExports.length} typeExports`);
		} else {
			onDebug?.(`    NOT FOUND`);
		}
	}

	return { exports, typeExports };
}

export function extractAPISurface(
	repoPath: string,
	parsedFiles: Map<string, ParsedFile>,
	onDebug?: (msg: string) => void,
): APISurface {
	const pkg = readPackageJson(repoPath);
	const packageName = pkg?.name ?? basename(repoPath);

	const mainExports: PublicExport[] = [];
	const allTypeExports: PublicExport[] = [];
	const subpaths: SubpathExport[] = [];

	if (pkg && isMonorepo(pkg)) {
		const monoPackages = findMonorepoPackages(repoPath);
		onDebug?.(`Detected monorepo with ${monoPackages.length} packages`);

		for (const monoPkg of monoPackages) {
			const { exports, typeExports } = extractPackageAPISurface(
				monoPkg.packagePath,
				monoPkg.relativePath,
				monoPkg.pkg,
				parsedFiles,
				onDebug,
			);

			if (exports.length > 0 || typeExports.length > 0) {
				subpaths.push({
					subpath: monoPkg.packageName,
					exports: [...exports, ...typeExports],
				});
			}
		}
	} else {
		const entryPoints = pkg ? findEntryPoints(repoPath, pkg) : [];

		for (const entry of entryPoints) {
			const normalizedPath = entry.path.replace(/^\.\//, "");

			let parsedFile: ParsedFile | undefined;
			for (const [path, parsed] of parsedFiles) {
				if (path === normalizedPath || path.endsWith(normalizedPath)) {
					parsedFile = parsed;
					break;
				}
			}

			if (!parsedFile) continue;

			const { exports, typeExports } = extractExportsFromParsed(parsedFile, normalizedPath);

			if (entry.subpath === null) {
				mainExports.push(...exports);
				allTypeExports.push(...typeExports);
			} else {
				subpaths.push({
					subpath: entry.subpath,
					exports: [...exports, ...typeExports],
				});
			}
		}

		if (mainExports.length === 0 && entryPoints.length === 0) {
			for (const [path, parsed] of parsedFiles) {
				if (path.endsWith("index.ts") || path.endsWith("index.js")) {
					const { exports, typeExports } = extractExportsFromParsed(parsed, path);
					mainExports.push(...exports);
					allTypeExports.push(...typeExports);
				}
			}
		}
	}

	const imports = generateImportPatterns(packageName, mainExports, subpaths);

	return {
		packageName,
		imports,
		exports: mainExports,
		subpaths,
		typeExports: allTypeExports,
	};
}

// ============================================================================
// Markdown Formatting
// ============================================================================

export function formatAPISurfaceMd(surface: APISurface): string {
	const lines: string[] = ["# API Reference", ""];

	// Import Patterns section
	lines.push("## Import Patterns", "");
	if (surface.imports.length > 0) {
		for (const pattern of surface.imports) {
			lines.push(`**${pattern.purpose}:**`);
			lines.push("");
			lines.push("```typescript");
			lines.push(pattern.statement);
			lines.push("```");
			lines.push("");
		}
	} else {
		lines.push("No import patterns detected.");
		lines.push("");
	}

	// Public Exports section
	lines.push("## Public Exports", "");
	if (surface.exports.length > 0) {
		lines.push("| Name | Kind | Path | Description |");
		lines.push("|------|------|------|-------------|");
		for (const exp of surface.exports) {
			const desc = exp.description.replace(/\|/g, "\\|").slice(0, 60);
			lines.push(`| \`${exp.name}\` | ${exp.kind} | \`${exp.path}\` | ${desc} |`);
		}
		lines.push("");
	} else {
		lines.push("No public exports detected.");
		lines.push("");
	}

	// Subpath Exports section
	if (surface.subpaths.length > 0) {
		lines.push("## Subpath Exports", "");
		for (const subpath of surface.subpaths) {
			lines.push(`### ${subpath.subpath}`, "");
			if (subpath.exports.length > 0) {
				lines.push("| Name | Kind | Description |");
				lines.push("|------|------|-------------|");
				for (const exp of subpath.exports) {
					const desc = exp.description.replace(/\|/g, "\\|").slice(0, 60);
					lines.push(`| \`${exp.name}\` | ${exp.kind} | ${desc} |`);
				}
				lines.push("");
			} else {
				lines.push("No exports detected.");
				lines.push("");
			}
		}
	}

	// Type Exports section
	if (surface.typeExports.length > 0) {
		lines.push("## Type Exports", "");
		lines.push("| Name | Kind | Path | Description |");
		lines.push("|------|------|------|-------------|");
		for (const exp of surface.typeExports) {
			const desc = exp.description.replace(/\|/g, "\\|").slice(0, 60);
			lines.push(`| \`${exp.name}\` | ${exp.kind} | \`${exp.path}\` | ${desc} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
