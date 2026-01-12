import * as crypto from "node:crypto";
import type { ParsedFile } from "../ast/parser.js";

/**
 * State of a single file for incremental tracking
 */
export interface FileState {
	hash: string;
	lastParsed: number;
	symbolCount: number;
}

/**
 * Complete incremental state for a repository
 */
export interface IncrementalState {
	version: number;
	commitSha: string;
	files: Record<string, FileState>;
}

/**
 * Report of changes detected between states
 */
export interface ChangeReport {
	added: string[];
	modified: string[];
	deleted: string[];
	unchanged: string[];
	shouldFullReanalyze: boolean;
}

/**
 * Current version of the incremental state format
 */
const STATE_VERSION = 1;

/**
 * Key files that should trigger a full re-analysis if modified
 */
const KEY_FILES = [
	"package.json",
	"package-lock.json",
	"tsconfig.json",
	"tsconfig.base.json",
	"turbo.json",
	"pyproject.toml",
	"requirements.txt",
	"setup.py",
	"Cargo.toml",
	"go.mod",
	"pom.xml",
	"build.gradle",
	".eslintrc",
	".eslintrc.js",
	".eslintrc.json",
];

/**
 * Threshold for triggering full re-analysis (30% of files changed)
 */
const FULL_REANALYZE_THRESHOLD = 0.3;

/**
 * Compute a truncated SHA256 hash of file content
 */
export function hashFile(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Detect changes between current files and a previous state
 */
export function detectChanges(
	currentFiles: Map<string, { content: string; symbolCount: number }>,
	previousState: IncrementalState | null,
): ChangeReport {
	const added: string[] = [];
	const modified: string[] = [];
	const deleted: string[] = [];
	const unchanged: string[] = [];

	// If no previous state, everything is "added"
	if (!previousState) {
		return {
			added: Array.from(currentFiles.keys()),
			modified: [],
			deleted: [],
			unchanged: [],
			shouldFullReanalyze: true,
		};
	}

	const previousPaths = new Set(Object.keys(previousState.files));

	// Check current files against previous state
	for (const [filePath, { content }] of currentFiles) {
		const hash = hashFile(content);
		const previousFile = previousState.files[filePath];

		if (!previousFile) {
			added.push(filePath);
		} else if (previousFile.hash !== hash) {
			modified.push(filePath);
		} else {
			unchanged.push(filePath);
		}

		previousPaths.delete(filePath);
	}

	// Remaining paths in previousPaths were deleted
	deleted.push(...previousPaths);

	// Determine if we should do a full re-analysis
	const shouldFullReanalyze = computeShouldFullReanalyze(
		added,
		modified,
		deleted,
		currentFiles.size,
	);

	return {
		added,
		modified,
		deleted,
		unchanged,
		shouldFullReanalyze,
	};
}

/**
 * Determine if a full re-analysis should be performed
 */
function computeShouldFullReanalyze(
	added: string[],
	modified: string[],
	deleted: string[],
	totalFiles: number,
): boolean {
	// Check if any key files were modified or added
	const changedFiles = [...added, ...modified, ...deleted];
	for (const filePath of changedFiles) {
		const fileName = filePath.split("/").pop() ?? filePath;
		if (KEY_FILES.includes(fileName)) {
			return true;
		}
	}

	// Check if change ratio exceeds threshold
	const changeCount = added.length + modified.length + deleted.length;
	if (totalFiles > 0 && changeCount / totalFiles > FULL_REANALYZE_THRESHOLD) {
		return true;
	}

	return false;
}

/**
 * Build incremental state from current parsed files
 */
export function buildIncrementalState(
	parsedFiles: Map<string, ParsedFile>,
	fileContents: Map<string, string>,
	commitSha: string,
): IncrementalState {
	const files: Record<string, FileState> = {};

	for (const [filePath, parsedFile] of parsedFiles) {
		const content = fileContents.get(filePath);
		if (!content) continue;

		files[filePath] = {
			hash: hashFile(content),
			lastParsed: Date.now(),
			symbolCount: parsedFile.functions.length + parsedFile.classes.length,
		};
	}

	return {
		version: STATE_VERSION,
		commitSha,
		files,
	};
}

/**
 * Check if a previous state is compatible with the current version
 */
export function isStateCompatible(state: IncrementalState): boolean {
	return state.version === STATE_VERSION;
}

/**
 * Get a summary of incremental state for debugging
 */
export function getStateSummary(state: IncrementalState): {
	version: number;
	commitSha: string;
	fileCount: number;
	totalSymbols: number;
} {
	const fileCount = Object.keys(state.files).length;
	const totalSymbols = Object.values(state.files).reduce((sum, file) => sum + file.symbolCount, 0);

	return {
		version: state.version,
		commitSha: state.commitSha,
		fileCount,
		totalSymbols,
	};
}
