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
