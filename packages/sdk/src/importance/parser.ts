/**
 * Tree-sitter Parser Setup
 * PRD 3.7: Initialize Tree-sitter with language support
 */

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../constants.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Tree-sitter Parser type - using any to avoid type compatibility issues with web-tree-sitter
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Parser = any;

/**
 * Tree-sitter Language instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Language = any;

/**
 * Tree-sitter SyntaxNode
 */
export type SyntaxNode = ReturnType<Parser["parse"]>["rootNode"];

/**
 * Tree-sitter Tree (parse result)
 */
export type Tree = ReturnType<Parser["parse"]>;

// ============================================================================
// Custom Errors
// ============================================================================

export class ParserError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ParserError";
	}
}

export class ParserNotInitializedError extends ParserError {
	constructor() {
		super("Parser not initialized. Call initializeParser() first.");
		this.name = "ParserNotInitializedError";
	}
}

export class LanguageNotSupportedError extends ParserError {
	constructor(ext: string) {
		super(`Language not supported for extension: ${ext}`);
		this.name = "LanguageNotSupportedError";
	}
}

export class LanguageLoadError extends ParserError {
	constructor(language: string, cause?: Error) {
		super(`Failed to load language parser: ${language}${cause ? ` - ${cause.message}` : ""}`);
		this.name = "LanguageLoadError";
		this.cause = cause;
	}
}

// ============================================================================
// Module State
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TreeSitter: any = null;
let isInitialized = false;
const languageCache = new Map<SupportedLanguage, Language>();

// ============================================================================
// Extension to Language Mapping
// ============================================================================

/**
 * Map file extension to supported language identifier.
 *
 * @param ext - File extension including dot (e.g., ".ts", ".py")
 * @returns The language identifier or undefined if not supported
 */
export function getLanguage(ext: string): SupportedLanguage | undefined {
	const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;

	for (const [lang, extensions] of Object.entries(SUPPORTED_LANGUAGES)) {
		if ((extensions as readonly string[]).includes(normalizedExt)) {
			return lang as SupportedLanguage;
		}
	}

	return undefined;
}

/**
 * Check if a file extension is supported for parsing.
 *
 * @param ext - File extension including dot
 * @returns true if the extension is supported
 */
export function isExtensionSupported(ext: string): boolean {
	return getLanguage(ext) !== undefined;
}

// ============================================================================
// Parser Initialization
// ============================================================================

/**
 * Get the WASM file path for a language.
 * These are bundled with the tree-sitter-* packages.
 */
function getLanguageWasmPath(language: SupportedLanguage): string {
	// Map our language identifiers to tree-sitter package names
	const packageMap: Record<SupportedLanguage, string> = {
		typescript: "tree-sitter-typescript",
		javascript: "tree-sitter-javascript",
		python: "tree-sitter-python",
		go: "tree-sitter-go",
		rust: "tree-sitter-rust",
	};

	const packageName = packageMap[language];

	// For TypeScript, we need the typescript variant
	if (language === "typescript") {
		return `${packageName}/tree-sitter-typescript.wasm`;
	}

	return `${packageName}/tree-sitter-${language}.wasm`;
}

/**
 * Initialize the Tree-sitter parser.
 * Must be called before using parse functions.
 *
 * This loads the web-tree-sitter WASM module.
 * Languages are loaded lazily on first use.
 */
export async function initializeParser(): Promise<void> {
	if (isInitialized) {
		return;
	}

	const { Parser } = await import("web-tree-sitter");
	await Parser.init();
	TreeSitter = Parser;
	isInitialized = true;
}

/**
 * Check if the parser has been initialized.
 */
export function isParserInitialized(): boolean {
	return isInitialized;
}

/**
 * Load a language parser.
 * Languages are cached after first load.
 *
 * @param language - The language identifier
 * @returns The loaded Language instance
 * @throws LanguageLoadError if loading fails
 */
export async function loadLanguage(language: SupportedLanguage): Promise<Language> {
	if (!isInitialized || !TreeSitter) {
		throw new ParserNotInitializedError();
	}

	// Check cache first
	const cached = languageCache.get(language);
	if (cached) {
		return cached;
	}

	try {
		// Try to load the language WASM
		const wasmPath = getLanguageWasmPath(language);

		// In Node.js/Bun, we need to resolve the path through node_modules
		// web-tree-sitter's Language.load() can take a path or URL
		const lang = await TreeSitter.Language.load(wasmPath);
		languageCache.set(language, lang);
		return lang;
	} catch (error) {
		throw new LanguageLoadError(language, error instanceof Error ? error : undefined);
	}
}

/**
 * Load language for a file extension.
 *
 * @param ext - File extension including dot
 * @returns The loaded Language instance
 * @throws LanguageNotSupportedError if extension not supported
 * @throws LanguageLoadError if loading fails
 */
export async function loadLanguageForExtension(ext: string): Promise<Language> {
	const language = getLanguage(ext);
	if (!language) {
		throw new LanguageNotSupportedError(ext);
	}
	return loadLanguage(language);
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Create a new parser instance configured for a language.
 *
 * @param language - The language to configure
 * @returns A configured Parser instance
 */
export async function createParser(language: SupportedLanguage): Promise<Parser> {
	if (!isInitialized || !TreeSitter) {
		throw new ParserNotInitializedError();
	}

	const parser = new TreeSitter();
	const lang = await loadLanguage(language);
	parser.setLanguage(lang);
	return parser;
}

/**
 * Parse source code into a syntax tree.
 *
 * @param sourceCode - The source code to parse
 * @param language - The language of the source code
 * @returns The parsed syntax tree
 */
export async function parse(sourceCode: string, language: SupportedLanguage): Promise<Tree> {
	const parser = await createParser(language);
	return parser.parse(sourceCode);
}

/**
 * Parse source code from a file extension.
 *
 * @param sourceCode - The source code to parse
 * @param ext - The file extension
 * @returns The parsed syntax tree
 * @throws LanguageNotSupportedError if extension not supported
 */
export async function parseByExtension(sourceCode: string, ext: string): Promise<Tree> {
	const language = getLanguage(ext);
	if (!language) {
		throw new LanguageNotSupportedError(ext);
	}
	return parse(sourceCode, language);
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clear the language cache.
 * Useful for testing or freeing memory.
 */
export function clearLanguageCache(): void {
	languageCache.clear();
}

/**
 * Reset parser state.
 * Clears cache and marks as uninitialized.
 */
export function resetParser(): void {
	clearLanguageCache();
	TreeSitter = null;
	isInitialized = false;
}
