/**
 * Utility functions for SDK operations
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Threshold for suspicious byte ratio to classify as binary.
 * If more than 30% of bytes are "suspicious" (control chars, etc.),
 * the buffer is likely binary.
 */
const SUSPICIOUS_BYTE_THRESHOLD = 0.3;

/**
 * Checks if a buffer contains binary content.
 *
 * Detection heuristics:
 * 1. Contains null bytes (0x00) - strong binary indicator
 * 2. High ratio of suspicious bytes (control chars 0x01-0x08, 0x0E-0x1F)
 *
 * @param buffer - The buffer to check
 * @returns true if the buffer appears to be binary content
 */
export function isBinaryBuffer(buffer: Buffer): boolean {
	// Empty buffers are not binary
	if (buffer.length === 0) {
		return false;
	}

	let suspiciousBytes = 0;

	for (let i = 0; i < buffer.length; i++) {
		const byte = buffer[i]!;

		// Null byte is a strong binary indicator
		if (byte === 0x00) {
			return true;
		}

		// Count suspicious control characters (excluding common text ones)
		// 0x09 = tab, 0x0A = LF, 0x0B = VT, 0x0C = FF, 0x0D = CR are text-safe
		if ((byte >= 0x01 && byte <= 0x08) || (byte >= 0x0e && byte <= 0x1f)) {
			suspiciousBytes++;
		}
	}

	// Check if suspicious byte ratio exceeds threshold
	const ratio = suspiciousBytes / buffer.length;
	return ratio > SUSPICIOUS_BYTE_THRESHOLD;
}

/**
 * Computes SHA-256 hash of a buffer.
 *
 * @param buffer - The buffer to hash
 * @returns 64-character lowercase hex string
 */
export function hashBuffer(buffer: Buffer): string {
	return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Represents a parsed gitignore pattern with its metadata.
 */
export interface GitignorePattern {
	/** The glob pattern */
	pattern: string;
	/** Whether this is a negation pattern (starts with !) */
	negation: boolean;
}

/**
 * Loads and parses .gitignore patterns from a repository.
 *
 * Handling:
 * - Skips empty lines and comments (# lines)
 * - Handles negation patterns (!)
 * - Converts directory patterns (dir/) to glob patterns (dir/**)
 * - Handles root-relative patterns (/pattern -> pattern)
 *
 * @param repoPath - Path to the repository root
 * @returns Array of parsed gitignore patterns
 */
export function loadGitignorePatterns(repoPath: string): GitignorePattern[] {
	const gitignorePath = join(repoPath, ".gitignore");

	if (!existsSync(gitignorePath)) {
		return [];
	}

	const content = readFileSync(gitignorePath, "utf-8");
	const lines = content.split("\n");
	const patterns: GitignorePattern[] = [];

	for (const rawLine of lines) {
		// Trim whitespace
		let line = rawLine.trim();

		// Skip empty lines and comments
		if (line === "" || line.startsWith("#")) {
			continue;
		}

		// Check for negation
		let negation = false;
		if (line.startsWith("!")) {
			negation = true;
			line = line.slice(1);
		}

		// Handle root-relative patterns (leading /)
		if (line.startsWith("/")) {
			line = line.slice(1);
		}

		// Handle trailing slash (directory pattern)
		// Convert "dir/" to "dir/**" to match all contents
		if (line.endsWith("/")) {
			line = line.slice(0, -1) + "/**";
		}

		// Also add the directory itself if it was a directory pattern
		// e.g., "node_modules/" should match both "node_modules" and "node_modules/**"
		if (rawLine.trim().endsWith("/") && !negation) {
			const dirName = line.slice(0, -3); // Remove "/**"
			patterns.push({ pattern: dirName, negation: false });
		}

		patterns.push({ pattern: line, negation });
	}

	return patterns;
}

/**
 * Extracts just the pattern strings from gitignore patterns.
 * Useful for simple glob matching where negation isn't needed.
 *
 * @param repoPath - Path to the repository root
 * @returns Array of pattern strings (excludes negation patterns)
 */
export function loadGitignorePatternsSimple(repoPath: string): string[] {
	return loadGitignorePatterns(repoPath)
		.filter((p) => !p.negation)
		.map((p) => p.pattern);
}
