import { parse } from "@ast-grep/napi"
import { detectLanguage, isBuiltinLang } from "./index"
import {
	CLASS_PATTERNS,
	EXPORT_PATTERNS,
	FUNCTION_PATTERNS,
	IMPORT_PATTERNS,
	type PatternLanguage,
	getPatternLanguage,
} from "./patterns"

/**
 * Represents an extracted symbol from source code
 */
export interface ExtractedSymbol {
	name: string
	kind: "function" | "class" | "method" | "struct" | "enum" | "trait" | "interface"
	line: number
	signature?: string
	isAsync?: boolean
	isExported?: boolean
}

/**
 * Represents a parsed file with extracted information
 */
export interface ParsedFile {
	path: string
	language: string
	functions: ExtractedSymbol[]
	classes: ExtractedSymbol[]
	imports: string[]
	exports: string[]
	hasTests: boolean
}

/**
 * Parse a source file and extract symbols, imports, and exports
 * @param filePath - Path to the file
 * @param content - Source code content
 * @returns ParsedFile or null if parsing fails
 */
export function parseFile(filePath: string, content: string): ParsedFile | null {
	const lang = detectLanguage(filePath)
	if (!lang) {
		return null
	}

	try {
		const root = parse(isBuiltinLang(lang) ? lang : lang, content)
		const patternLang = getPatternLanguage(lang.toString())

		if (!patternLang) {
			return null
		}

		const functions = extractSymbols(root, patternLang, "function")
		const classes = extractSymbols(root, patternLang, "class")
		const imports = extractImports(root, patternLang, content)
		const exports = extractExports(root, patternLang, content)
		const hasTests = detectTests(filePath, content)

		return {
			path: filePath,
			language: lang.toString(),
			functions,
			classes,
			imports,
			exports,
			hasTests,
		}
	} catch {
		// Syntax error or parsing failure
		return null
	}
}

/**
 * Extract function or class symbols from parsed AST
 */
export function extractSymbols(
	root: ReturnType<typeof parse>,
	lang: PatternLanguage,
	kind: "function" | "class",
): ExtractedSymbol[] {
	const patterns = kind === "function" ? FUNCTION_PATTERNS[lang] : CLASS_PATTERNS[lang]
	const symbols: ExtractedSymbol[] = []
	const seen = new Set<string>()

	for (const pattern of patterns) {
		try {
			const matches = root.root().findAll(pattern)
			for (const match of matches) {
				const nameNode = match.getMatch("NAME")
				if (!nameNode) continue

				const name = nameNode.text()
				const line = nameNode.range().start.line + 1 // 1-indexed
				const key = `${name}:${line}`

				if (seen.has(key)) continue
				seen.add(key)

				const text = match.text()
				const isAsync = text.includes("async ")
				const isExported =
					text.startsWith("export ") ||
					text.startsWith("pub ") ||
					(lang === "java" && text.includes("public "))

				let symbolKind: ExtractedSymbol["kind"] = kind
				if (kind === "class") {
					// Detect specific class-like kinds
					if (text.includes("struct ")) symbolKind = "struct"
					else if (text.includes("enum ")) symbolKind = "enum"
					else if (text.includes("trait ")) symbolKind = "trait"
					else if (text.includes("interface ")) symbolKind = "interface"
				}

				symbols.push({
					name,
					kind: symbolKind,
					line,
					signature: extractSignature(text, name, kind),
					isAsync,
					isExported,
				})
			}
		} catch {
			// Pattern matching failed for this pattern, continue with others
		}
	}

	return symbols
}

/**
 * Extract import paths from source code
 */
export function extractImports(
	root: ReturnType<typeof parse>,
	lang: PatternLanguage,
	content: string,
): string[] {
	const patterns = IMPORT_PATTERNS[lang]
	const imports: string[] = []
	const seen = new Set<string>()

	for (const pattern of patterns) {
		try {
			const matches = root.root().findAll(pattern)
			for (const match of matches) {
				// Try to get PATH metavariable first
				const pathNode = match.getMatch("PATH")
				if (pathNode) {
					const path = pathNode.text().replace(/['"]/g, "")
					if (!seen.has(path)) {
						seen.add(path)
						imports.push(path)
					}
					continue
				}

				// For patterns without PATH (like Python's "import NAME")
				const nameNode = match.getMatch("NAME")
				if (nameNode) {
					const path = nameNode.text()
					if (!seen.has(path)) {
						seen.add(path)
						imports.push(path)
					}
				}
			}
		} catch {
			// Pattern matching failed, continue
		}
	}

	// Fallback: regex extraction for edge cases
	if (imports.length === 0) {
		const regexImports = extractImportsWithRegex(content, lang)
		for (const imp of regexImports) {
			if (!seen.has(imp)) {
				seen.add(imp)
				imports.push(imp)
			}
		}
	}

	return imports
}

/**
 * Extract exports from source code
 */
export function extractExports(
	root: ReturnType<typeof parse>,
	lang: PatternLanguage,
	content: string,
): string[] {
	const patterns = EXPORT_PATTERNS[lang]
	const exports: string[] = []
	const seen = new Set<string>()

	for (const pattern of patterns) {
		try {
			const matches = root.root().findAll(pattern)
			for (const match of matches) {
				// Get exported names
				const nameNode = match.getMatch("NAME")
				if (nameNode) {
					const name = nameNode.text()
					if (!seen.has(name)) {
						seen.add(name)
						exports.push(name)
					}
				}

				// For re-exports with PATH
				const pathNode = match.getMatch("PATH")
				if (pathNode) {
					const path = pathNode.text().replace(/['"]/g, "")
					const reexport = `* from ${path}`
					if (!seen.has(reexport)) {
						seen.add(reexport)
						exports.push(reexport)
					}
				}
			}
		} catch {
			// Pattern matching failed, continue
		}
	}

	// For languages with implicit exports (Go, Java, Python)
	// Extract exported symbols from function/class patterns
	if (exports.length === 0 && (lang === "go" || lang === "java" || lang === "python")) {
		const implicitExports = extractImplicitExports(content, lang)
		for (const exp of implicitExports) {
			if (!seen.has(exp)) {
				seen.add(exp)
				exports.push(exp)
			}
		}
	}

	return exports
}

/**
 * Detect if a file contains tests based on path or content patterns
 */
export function detectTests(filePath: string, content: string): boolean {
	// Path-based detection
	const pathLower = filePath.toLowerCase()
	const testPathPatterns = [
		"test",
		"tests",
		"__tests__",
		"spec",
		"specs",
		"_test.",
		".test.",
		".spec.",
		"_spec.",
	]

	for (const pattern of testPathPatterns) {
		if (pathLower.includes(pattern)) {
			return true
		}
	}

	// Content-based detection
	const testContentPatterns = [
		// JavaScript/TypeScript
		/\b(describe|it|test|expect)\s*\(/,
		/\bimport\s+.*\bfrom\s+['"](@testing-library|jest|vitest|mocha|chai)['"]/,
		/\brequire\s*\(\s*['"](@testing-library|jest|vitest|mocha|chai)['"]\s*\)/,
		// Python
		/\bdef\s+test_/,
		/\bclass\s+Test/,
		/\bimport\s+(pytest|unittest)/,
		/\bfrom\s+(pytest|unittest)\s+import/,
		// Rust
		/#\[test\]/,
		/#\[cfg\(test\)\]/,
		// Go
		/\bfunc\s+Test[A-Z]/,
		/\btesting\.T\b/,
		// Java
		/@Test\b/,
		/@TestCase\b/,
		/\bimport\s+.*junit/,
	]

	for (const pattern of testContentPatterns) {
		if (pattern.test(content)) {
			return true
		}
	}

	return false
}

/**
 * Extract a function/class signature from the full declaration
 */
function extractSignature(text: string, _name: string, kind: "function" | "class"): string {
	const lines = text.split("\n")
	const firstLine = lines[0]?.trim() ?? ""

	if (kind === "function") {
		// Get up to the opening brace or first line
		const braceIndex = firstLine.indexOf("{")
		const arrowIndex = firstLine.indexOf("=>")
		const colonIndex = firstLine.indexOf(":")

		if (braceIndex > 0) {
			return firstLine.slice(0, braceIndex).trim()
		}
		if (arrowIndex > 0) {
			return firstLine.slice(0, arrowIndex).trim()
		}
		if (colonIndex > 0 && colonIndex < 100) {
			// Python-style
			return firstLine.slice(0, colonIndex).trim()
		}
		return firstLine.slice(0, 100)
	}

	// Class signature: just the declaration line
	const braceIndex = firstLine.indexOf("{")
	if (braceIndex > 0) {
		return firstLine.slice(0, braceIndex).trim()
	}
	return firstLine.slice(0, 100)
}

/**
 * Regex fallback for import extraction
 */
function extractImportsWithRegex(content: string, lang: PatternLanguage): string[] {
	const imports: string[] = []

	switch (lang) {
		case "typescript":
		case "javascript": {
			// ES imports
			const esImportRegex = /import\s+(?:(?:\{[^}]*\}|[\w*]+)\s+from\s+)?['"]([^'"]+)['"]/g
			let match: RegExpExecArray | null
			while ((match = esImportRegex.exec(content)) !== null) {
				if (match[1]) imports.push(match[1])
			}
			// CommonJS require
			const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
			while ((match = requireRegex.exec(content)) !== null) {
				if (match[1]) imports.push(match[1])
			}
			break
		}
		case "python": {
			// Python imports
			const importRegex = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g
			let match: RegExpExecArray | null
			while ((match = importRegex.exec(content)) !== null) {
				const imp = match[1] ?? match[2]
				if (imp) imports.push(imp)
			}
			break
		}
		case "rust": {
			// Rust use statements
			const useRegex = /use\s+([\w:]+)/g
			let match: RegExpExecArray | null
			while ((match = useRegex.exec(content)) !== null) {
				if (match[1]) imports.push(match[1])
			}
			break
		}
		case "go": {
			// Go imports
			const importRegex = /import\s+(?:\w+\s+)?["']([^"']+)["']/g
			let match: RegExpExecArray | null
			while ((match = importRegex.exec(content)) !== null) {
				if (match[1]) imports.push(match[1])
			}
			break
		}
		case "java": {
			// Java imports
			const importRegex = /import\s+(?:static\s+)?([\w.]+);/g
			let match: RegExpExecArray | null
			while ((match = importRegex.exec(content)) !== null) {
				if (match[1]) imports.push(match[1])
			}
			break
		}
	}

	return imports
}

/**
 * Extract implicit exports for languages without explicit export syntax
 */
function extractImplicitExports(content: string, lang: PatternLanguage): string[] {
	const exports: string[] = []

	switch (lang) {
		case "go": {
			// Go: Capitalized function/type names are public
			const funcRegex = /func\s+(?:\([^)]+\)\s+)?([A-Z][a-zA-Z0-9]*)/g
			const typeRegex = /type\s+([A-Z][a-zA-Z0-9]*)/g
			let match: RegExpExecArray | null
			while ((match = funcRegex.exec(content)) !== null) {
				if (match[1]) exports.push(match[1])
			}
			while ((match = typeRegex.exec(content)) !== null) {
				if (match[1]) exports.push(match[1])
			}
			break
		}
		case "java": {
			// Java: public classes/methods are exports
			const publicRegex = /public\s+(?:(?:static|final|abstract)\s+)*(?:class|interface|enum)\s+(\w+)/g
			let match: RegExpExecArray | null
			while ((match = publicRegex.exec(content)) !== null) {
				if (match[1]) exports.push(match[1])
			}
			break
		}
		case "python": {
			// Python: __all__ or top-level class/function names not starting with _
			const allMatch = content.match(/__all__\s*=\s*\[([^\]]+)\]/)
			if (allMatch?.[1]) {
				const items = allMatch[1].match(/['"]([^'"]+)['"]/g)
				if (items) {
					for (const item of items) {
						exports.push(item.replace(/['"]/g, ""))
					}
				}
			} else {
				// Top-level definitions not starting with _
				const defRegex = /^(?:def|class)\s+([a-zA-Z][a-zA-Z0-9_]*)/gm
				let match: RegExpExecArray | null
				while ((match = defRegex.exec(content)) !== null) {
					const name = match[1]
					if (name && !name.startsWith("_")) {
						exports.push(name)
					}
				}
			}
			break
		}
	}

	return exports
}
