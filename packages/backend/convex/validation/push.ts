import { v } from "convex/values";

// Validation constants
export const FULLNAME_MIN = 3;
export const FULLNAME_MAX = 200;
export const SKILLNAME_MIN = 2;
export const SKILLNAME_MAX = 80;
export const DESCRIPTION_MAX = 200;
export const CONTENT_MIN = 500;
export const CONTENT_MAX = 200_000;
export const COMMIT_SHA_LENGTH = 40;

// Regex patterns
export const FULLNAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const SKILLNAME_PATTERN = /^[a-z0-9][a-z0-9-_.]*$/;
export const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

// Convex argument validators for push action
export const pushArgs = {
	fullName: v.string(),
	skillName: v.string(),
	skillDescription: v.string(),
	skillContent: v.string(),
	commitSha: v.string(),
	analyzedAt: v.string(),
};

// Runtime validation result
export interface ValidationResult {
	valid: boolean;
	error?: string;
	field?: string;
}

/**
 * Validates push arguments at runtime
 * Returns first validation error or { valid: true }
 */
export function validatePushArgs(args: {
	fullName: string;
	skillName: string;
	skillDescription: string;
	skillContent: string;
	commitSha: string;
	analyzedAt: string;
}): ValidationResult {
	// fullName
	if (args.fullName.length < FULLNAME_MIN || args.fullName.length > FULLNAME_MAX) {
		return {
			valid: false,
			error: `fullName must be ${FULLNAME_MIN}-${FULLNAME_MAX} chars`,
			field: "fullName",
		};
	}
	if (!FULLNAME_PATTERN.test(args.fullName)) {
		return { valid: false, error: "Invalid repo format (expected owner/repo)", field: "fullName" };
	}

	// skillName
	if (args.skillName.length < SKILLNAME_MIN || args.skillName.length > SKILLNAME_MAX) {
		return {
			valid: false,
			error: `skillName must be ${SKILLNAME_MIN}-${SKILLNAME_MAX} chars`,
			field: "skillName",
		};
	}
	if (!SKILLNAME_PATTERN.test(args.skillName)) {
		return { valid: false, error: "Invalid skillName format", field: "skillName" };
	}

	// skillDescription
	if (args.skillDescription.length === 0 || args.skillDescription.length > DESCRIPTION_MAX) {
		return {
			valid: false,
			error: `skillDescription must be 1-${DESCRIPTION_MAX} chars`,
			field: "skillDescription",
		};
	}

	// skillContent
	if (args.skillContent.length < CONTENT_MIN) {
		return {
			valid: false,
			error: `skillContent too short (min ${CONTENT_MIN} chars)`,
			field: "skillContent",
		};
	}
	if (args.skillContent.length > CONTENT_MAX) {
		return {
			valid: false,
			error: `skillContent too large (max ${CONTENT_MAX / 1000}KB)`,
			field: "skillContent",
		};
	}

	// commitSha
	if (args.commitSha.length !== COMMIT_SHA_LENGTH) {
		return { valid: false, error: "commitSha must be 40 characters", field: "commitSha" };
	}
	if (!COMMIT_SHA_PATTERN.test(args.commitSha)) {
		return { valid: false, error: "Invalid commit SHA format", field: "commitSha" };
	}

	// analyzedAt
	const timestamp = Date.parse(args.analyzedAt);
	if (Number.isNaN(timestamp)) {
		return { valid: false, error: "Invalid analyzedAt timestamp", field: "analyzedAt" };
	}
	if (timestamp > Date.now() + 5 * 60_000) {
		return {
			valid: false,
			error: "analyzedAt cannot be more than 5 minutes in the future",
			field: "analyzedAt",
		};
	}

	return { valid: true };
}
