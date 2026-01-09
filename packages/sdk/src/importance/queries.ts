/**
 * Import Extraction Queries
 * PRD 3.8: Extract imports from source files using Tree-sitter AST
 */

import type { SupportedLanguage } from "../constants.js";
import {
	type SyntaxNode,
	type Tree,
	initializeParser,
	isParserInitialized,
	parse,
} from "./parser.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Extracted import information
 */
export interface ExtractedImport {
	/** The module specifier (package name, relative path, etc.) */
	module: string;
	/** Whether this is a relative import (starts with . or ..) */
	isRelative: boolean;
}

// ============================================================================
// Node Traversal Helpers
// ============================================================================

/**
 * Recursively traverse all nodes in a tree, calling visitor for each node.
 */
function traverse(node: SyntaxNode, visitor: (node: SyntaxNode) => void): void {
	visitor(node);
	for (let i = 0; i < node.childCount; i++) {
		const child = node.child(i);
		if (child) {
			traverse(child, visitor);
		}
	}
}

/**
 * Get text content of a node, removing surrounding quotes if present.
 */
function getStringContent(node: SyntaxNode): string {
	const text = node.text;
	// Remove surrounding quotes (single, double, or backtick)
	if (
		(text.startsWith('"') && text.endsWith('"')) ||
		(text.startsWith("'") && text.endsWith("'")) ||
		(text.startsWith("`") && text.endsWith("`"))
	) {
		return text.slice(1, -1);
	}
	return text;
}

/**
 * Check if a module path is relative.
 */
function isRelativeImport(modulePath: string): boolean {
	return modulePath.startsWith(".") || modulePath.startsWith("/");
}

// ============================================================================
// TypeScript/JavaScript Import Extraction
// ============================================================================

/**
 * Extract imports from TypeScript/JavaScript AST.
 *
 * Handles:
 * - ES6 imports: import x from "module", import { x } from "module"
 * - Type imports: import type { T } from "module"
 * - Namespace imports: import * as x from "module"
 * - Side-effect imports: import "module"
 * - Re-exports: export { x } from "module"
 * - CommonJS require: const x = require("module")
 */
function extractTsJsImports(tree: Tree): ExtractedImport[] {
	const imports: ExtractedImport[] = [];
	const seen = new Set<string>();

	traverse(tree.rootNode, (node) => {
		// ES6 import declaration: import ... from "module"
		if (node.type === "import_statement") {
			const sourceNode = node.childForFieldName("source");
			if (sourceNode && sourceNode.type === "string") {
				const module = getStringContent(sourceNode);
				if (!seen.has(module)) {
					seen.add(module);
					imports.push({ module, isRelative: isRelativeImport(module) });
				}
			}
		}

		// Re-export: export { x } from "module"
		if (node.type === "export_statement") {
			const sourceNode = node.childForFieldName("source");
			if (sourceNode && sourceNode.type === "string") {
				const module = getStringContent(sourceNode);
				if (!seen.has(module)) {
					seen.add(module);
					imports.push({ module, isRelative: isRelativeImport(module) });
				}
			}
		}

		// CommonJS require: require("module")
		if (node.type === "call_expression") {
			const functionNode = node.childForFieldName("function");
			if (functionNode && functionNode.text === "require") {
				const argsNode = node.childForFieldName("arguments");
				if (argsNode && argsNode.childCount >= 2) {
					// arguments node structure: (arg1, arg2, ...)
					// First child is "(", second is the argument
					const firstArg = argsNode.child(1);
					if (firstArg && firstArg.type === "string") {
						const module = getStringContent(firstArg);
						// Skip dynamic requires with template literals
						if (!module.includes("${") && !seen.has(module)) {
							seen.add(module);
							imports.push({ module, isRelative: isRelativeImport(module) });
						}
					}
				}
			}
		}
	});

	return imports;
}

// ============================================================================
// Python Import Extraction
// ============================================================================

/**
 * Extract imports from Python AST.
 *
 * Handles:
 * - import module
 * - import module as alias
 * - from module import x
 * - from module import x, y, z
 * - from . import x (relative)
 * - from ..module import x (relative)
 */
function extractPythonImports(tree: Tree): ExtractedImport[] {
	const imports: ExtractedImport[] = [];
	const seen = new Set<string>();

	traverse(tree.rootNode, (node) => {
		// import statement: import module
		if (node.type === "import_statement") {
			// Children: import, dotted_name (or aliased_import)
			for (let i = 0; i < node.childCount; i++) {
				const child = node.child(i);
				if (child) {
					if (child.type === "dotted_name") {
						// Get the top-level module name only
						const module = getTopLevelPythonModule(child.text);
						if (!seen.has(module)) {
							seen.add(module);
							imports.push({ module, isRelative: false });
						}
					} else if (child.type === "aliased_import") {
						const nameNode = child.childForFieldName("name");
						if (nameNode) {
							const module = getTopLevelPythonModule(nameNode.text);
							if (!seen.has(module)) {
								seen.add(module);
								imports.push({ module, isRelative: false });
							}
						}
					}
				}
			}
		}

		// from ... import statement: from module import x
		if (node.type === "import_from_statement") {
			const moduleNode = node.childForFieldName("module_name");

			// Check for relative imports (starts with dots)
			let isRelative = false;
			let moduleName = "";

			if (moduleNode) {
				moduleName = moduleNode.text;
			}

			// Check for relative import prefix (. or ..)
			for (let i = 0; i < node.childCount; i++) {
				const child = node.child(i);
				if (child && child.type === "relative_import") {
					isRelative = true;
					// Get the import prefix for relative imports
					const dotsChild = child.childForFieldName("dots");
					const nameChild = child.childForFieldName("name");
					if (nameChild) {
						moduleName = nameChild.text;
					} else if (dotsChild) {
						// Pure relative import like "from . import x"
						moduleName = dotsChild.text;
					}
					break;
				}
			}

			// Also check if first child after "from" is "." or ".."
			let hasRelativePrefix = false;
			for (let i = 0; i < node.childCount; i++) {
				const child = node.child(i);
				if (child && (child.text === "." || child.text === "..")) {
					hasRelativePrefix = true;
					isRelative = true;
				}
			}

			if (moduleName && !seen.has(moduleName)) {
				const topLevel = isRelative ? moduleName : getTopLevelPythonModule(moduleName);
				seen.add(topLevel);
				imports.push({ module: topLevel, isRelative });
			} else if (hasRelativePrefix && !moduleName) {
				// from . import x - relative import from current package
				// We'll mark it as relative but module will be "."
				if (!seen.has(".")) {
					seen.add(".");
					imports.push({ module: ".", isRelative: true });
				}
			}
		}
	});

	return imports;
}

/**
 * Get the top-level module name from a dotted name.
 * e.g., "flask.jsonify" -> "flask", "os.path" -> "os"
 */
function getTopLevelPythonModule(dottedName: string): string {
	const parts = dottedName.split(".");
	return parts[0] ?? dottedName;
}

// ============================================================================
// Go Import Extraction
// ============================================================================

/**
 * Extract imports from Go AST.
 *
 * Handles:
 * - import "module"
 * - import alias "module"
 * - import (
 *     "module1"
 *     alias "module2"
 * )
 */
function extractGoImports(tree: Tree): ExtractedImport[] {
	const imports: ExtractedImport[] = [];
	const seen = new Set<string>();

	traverse(tree.rootNode, (node) => {
		// import_declaration can contain import_spec or import_spec_list
		if (node.type === "import_declaration") {
			traverse(node, (importChild) => {
				if (importChild.type === "import_spec") {
					// Get the path from import_spec
					const pathNode = importChild.childForFieldName("path");
					if (pathNode && pathNode.type === "interpreted_string_literal") {
						const module = getStringContent(pathNode);
						if (!seen.has(module)) {
							seen.add(module);
							// Go imports are never "relative" in the ./ sense,
							// but local packages start with module path
							imports.push({ module, isRelative: false });
						}
					}
				}
			});
		}
	});

	return imports;
}

// ============================================================================
// Rust Import Extraction
// ============================================================================

/**
 * Extract imports from Rust AST.
 *
 * Handles:
 * - use crate::module;
 * - use module::item;
 * - extern crate module;
 */
function extractRustImports(tree: Tree): ExtractedImport[] {
	const imports: ExtractedImport[] = [];
	const seen = new Set<string>();

	traverse(tree.rootNode, (node) => {
		// use declaration: use crate::module;
		if (node.type === "use_declaration") {
			// Get the first scoped identifier
			traverse(node, (useChild) => {
				if (useChild.type === "scoped_identifier" || useChild.type === "identifier") {
					// Get the root module name
					const fullPath = useChild.text;
					const parts = fullPath.split("::");
					const module = parts[0] ?? fullPath;

					// Skip internal Rust modules (self, super, crate)
					if (!["self", "super", "crate"].includes(module) && !seen.has(module)) {
						seen.add(module);
						imports.push({
							module,
							isRelative: ["self", "super", "crate"].includes(module),
						});
					}
					// Only get the first identifier in use tree
					return;
				}
			});
		}

		// extern crate declaration
		if (node.type === "extern_crate_declaration") {
			const nameNode = node.childForFieldName("name");
			if (nameNode) {
				const module = nameNode.text;
				if (!seen.has(module)) {
					seen.add(module);
					imports.push({ module, isRelative: false });
				}
			}
		}
	});

	return imports;
}

// ============================================================================
// Main Extract Function
// ============================================================================

/**
 * Extract imports from source code.
 *
 * @param content - The source code content
 * @param language - The programming language
 * @returns Array of extracted imports
 *
 * @example
 * ```ts
 * await initializeParser();
 * const imports = await extractImports('import React from "react";', 'typescript');
 * // [{ module: 'react', isRelative: false }]
 * ```
 */
export async function extractImports(
	content: string,
	language: SupportedLanguage,
): Promise<ExtractedImport[]> {
	// Ensure parser is initialized
	if (!isParserInitialized()) {
		await initializeParser();
	}

	// Parse the content
	const tree = await parse(content, language);

	// Extract imports based on language
	switch (language) {
		case "typescript":
		case "javascript":
			return extractTsJsImports(tree);
		case "python":
			return extractPythonImports(tree);
		case "go":
			return extractGoImports(tree);
		case "rust":
			return extractRustImports(tree);
		default:
			return [];
	}
}

/**
 * Extract module names from source code.
 * Convenience wrapper that returns just the module strings.
 *
 * @param content - The source code content
 * @param language - The programming language
 * @returns Array of module names/paths
 */
export async function extractModuleNames(
	content: string,
	language: SupportedLanguage,
): Promise<string[]> {
	const imports = await extractImports(content, language);
	return imports.map((i) => i.module);
}
