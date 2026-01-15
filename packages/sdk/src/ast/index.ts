import { Lang, registerDynamicLanguage } from "@ast-grep/napi";

// Re-export Lang enum for external use
export { Lang };

// Language type that includes both built-in and dynamic languages
export type SupportedLang = Lang | "python" | "rust" | "go" | "java" | "c";

// Extension to language mapping
export const LANG_MAP: Record<string, Lang | string> = {
	// TypeScript/JavaScript
	".ts": Lang.TypeScript,
	".tsx": Lang.Tsx,
	".js": Lang.JavaScript,
	".jsx": Lang.Tsx, // JSX uses Tsx parser
	".mjs": Lang.JavaScript,
	".cjs": Lang.JavaScript,
	// Web
	".html": Lang.Html,
	".css": Lang.Css,
	// Dynamic languages (registered at runtime)
	".py": "python",
	".rs": "rust",
	".go": "go",
	".java": "java",
	".c": "c",
	".h": "c",
};

// Track initialization state
let initialized = false;

/**
 * Initialize dynamic language support for AST parsing.
 * Registers Python, Rust, Go, and Java via registerDynamicLanguage.
 * Safe to call multiple times (idempotent).
 */
export async function initLanguages(): Promise<void> {
	if (initialized) {
		return;
	}

	// Dynamic imports for language packages
	const [pythonLang, rustLang, goLang, javaLang, cLang] = await Promise.all([
		import("@ast-grep/lang-python"),
		import("@ast-grep/lang-rust"),
		import("@ast-grep/lang-go"),
		import("@ast-grep/lang-java"),
		import("@ast-grep/lang-c"),
	]);

	registerDynamicLanguage({
		python: {
			libraryPath: pythonLang.default.libraryPath,
			extensions: pythonLang.default.extensions,
			languageSymbol: pythonLang.default.languageSymbol,
			expandoChar: pythonLang.default.expandoChar,
		},
		rust: {
			libraryPath: rustLang.default.libraryPath,
			extensions: rustLang.default.extensions,
			languageSymbol: rustLang.default.languageSymbol,
			expandoChar: rustLang.default.expandoChar,
		},
		go: {
			libraryPath: goLang.default.libraryPath,
			extensions: goLang.default.extensions,
			languageSymbol: goLang.default.languageSymbol,
			expandoChar: goLang.default.expandoChar,
		},
		java: {
			libraryPath: javaLang.default.libraryPath,
			extensions: javaLang.default.extensions,
			languageSymbol: javaLang.default.languageSymbol,
			expandoChar: javaLang.default.expandoChar,
		},
		c: {
			libraryPath: cLang.default.libraryPath,
			extensions: cLang.default.extensions,
			languageSymbol: cLang.default.languageSymbol,
			expandoChar: cLang.default.expandoChar,
		},
	});

	initialized = true;
}

/**
 * Detect the language for a given file path based on its extension.
 * @param filePath - The path to the file
 * @returns The Lang enum value, dynamic language string, or null if unsupported
 */
export function detectLanguage(filePath: string): Lang | string | null {
	const ext = getExtension(filePath);
	if (!ext) {
		return null;
	}
	return LANG_MAP[ext] ?? null;
}

/**
 * Extract the file extension from a path (including the dot).
 */
function getExtension(filePath: string): string | null {
	const lastDot = filePath.lastIndexOf(".");
	if (lastDot === -1 || lastDot === filePath.length - 1) {
		return null;
	}
	// Handle paths like .gitignore (hidden files with no extension)
	const afterDot = filePath.slice(lastDot);
	if (afterDot.includes("/") || afterDot.includes("\\")) {
		return null;
	}
	return afterDot.toLowerCase();
}

/**
 * Check if a language is a built-in Lang enum value
 */
export function isBuiltinLang(lang: Lang | string): lang is Lang {
	return Object.values(Lang).includes(lang as Lang);
}

/**
 * Check if a file extension is supported for AST parsing
 */
export function isSupportedExtension(filePath: string): boolean {
	return detectLanguage(filePath) !== null;
}
