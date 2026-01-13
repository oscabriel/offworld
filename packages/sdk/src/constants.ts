/**
 * SDK Constants
 */

/** SDK version - must match package.json */
export const VERSION = "0.1.0";

/**
 * Default patterns to ignore when scanning repositories.
 * Includes directories, binary files, IDE configs, and build outputs.
 */
export const DEFAULT_IGNORE_PATTERNS = [
	// Version control
	".git",
	".git/**",
	".svn",
	".hg",

	// Dependencies
	"node_modules",
	"node_modules/**",
	"vendor",
	"vendor/**",
	".pnpm",
	".yarn",

	// Build outputs
	"dist",
	"dist/**",
	"build",
	"build/**",
	"out",
	"out/**",
	".next",
	".nuxt",
	".output",
	"target",
	"__pycache__",
	"*.pyc",

	// IDE and editor directories
	".vscode",
	".vscode/**",
	".idea",
	".idea/**",
	"*.swp",
	"*.swo",
	".DS_Store",

	// Binary and media extensions
	"*.jpg",
	"*.jpeg",
	"*.png",
	"*.gif",
	"*.ico",
	"*.webp",
	"*.svg",
	"*.bmp",
	"*.tiff",
	"*.mp4",
	"*.webm",
	"*.mov",
	"*.avi",
	"*.mkv",
	"*.mp3",
	"*.wav",
	"*.flac",
	"*.ogg",
	"*.pdf",
	"*.zip",
	"*.tar",
	"*.gz",
	"*.rar",
	"*.7z",
	"*.exe",
	"*.dll",
	"*.so",
	"*.dylib",
	"*.bin",
	"*.wasm",
	"*.woff",
	"*.woff2",
	"*.ttf",
	"*.eot",
	"*.otf",

	// Lock files (large, not useful for analysis)
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"bun.lockb",
	"Cargo.lock",
	"Gemfile.lock",
	"poetry.lock",
	"composer.lock",
	"go.sum",

	// Coverage and test artifacts
	"coverage",
	"coverage/**",
	".nyc_output",
	".coverage",
	"htmlcov",

	// Logs and temp files
	"*.log",
	"logs",
	"tmp",
	"temp",
	".tmp",
	".temp",
	".cache",

	// Environment files (security)
	".env",
	".env.*",
	"*.pem",
	"*.key",
] as const;

/**
 * Supported programming languages for import analysis.
 * Maps language identifier to common file extensions.
 */
export const SUPPORTED_LANGUAGES = {
	typescript: [".ts", ".tsx", ".mts", ".cts"],
	javascript: [".js", ".jsx", ".mjs", ".cjs"],
	python: [".py", ".pyw"],
	go: [".go"],
	rust: [".rs"],
} as const;

/** All supported extensions flattened */
export const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_LANGUAGES).flat();

/** Language identifier type */
export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/** Context gathering constants */
export const CONTEXT_LIMITS = {
	/** Maximum token budget for context (roughly 4 chars per token) */
	MAX_CONTEXT_TOKENS: 3000,
	/** Number of top files to include content for */
	TOP_FILES_COUNT: 10,
	/** Maximum characters per file content */
	MAX_FILE_CONTENT_CHARS: 2000,
	/** Token budget for README */
	README_TOKEN_BUDGET: 400,
	/** Token budget for package.json */
	PACKAGE_JSON_TOKEN_BUDGET: 250,
	/** Token budget for file tree */
	FILE_TREE_TOKEN_BUDGET: 350,
} as const;

/** Heuristics constants */
export const HEURISTICS_LIMITS = {
	/** Maximum files to discover */
	MAX_FILES: 500,
	/** Maximum file size in bytes (50KB) */
	MAX_FILE_SIZE: 50 * 1024,
} as const;
