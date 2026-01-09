/**
 * File Importance Module
 * PRD 3.7-3.9: Tree-sitter parsing and file importance ranking
 */

export {
	// Types
	type Parser,
	type Language,
	type SyntaxNode,
	type Tree,
	// Errors
	ParserError,
	ParserNotInitializedError,
	LanguageNotSupportedError,
	LanguageLoadError,
	// Language mapping
	getLanguage,
	isExtensionSupported,
	// Initialization
	initializeParser,
	isParserInitialized,
	loadLanguage,
	loadLanguageForExtension,
	// Parsing
	createParser,
	parse,
	parseByExtension,
	// Cleanup
	clearLanguageCache,
	resetParser,
} from "./parser.js";

export {
	// Types
	type ExtractedImport,
	// Import extraction
	extractImports,
	extractModuleNames,
} from "./queries.js";
