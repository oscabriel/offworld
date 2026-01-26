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
	referenceName: v.string(),
	referenceDescription: v.string(),
	referenceContent: v.string(),
	commitSha: v.string(),
	generatedAt: v.string(),
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
	referenceName: string;
	referenceDescription: string;
	referenceContent: string;
	commitSha: string;
	generatedAt: string;
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

	// referenceName
	if (args.referenceName.length < SKILLNAME_MIN || args.referenceName.length > SKILLNAME_MAX) {
		return {
			valid: false,
			error: `referenceName must be ${SKILLNAME_MIN}-${SKILLNAME_MAX} chars`,
			field: "referenceName",
		};
	}
	if (!SKILLNAME_PATTERN.test(args.referenceName)) {
		return { valid: false, error: "Invalid referenceName format", field: "referenceName" };
	}

	// referenceDescription
	if (args.referenceDescription.length === 0 || args.referenceDescription.length > DESCRIPTION_MAX) {
		return {
			valid: false,
			error: `referenceDescription must be 1-${DESCRIPTION_MAX} chars`,
			field: "referenceDescription",
		};
	}

	// referenceContent
	if (args.referenceContent.length < CONTENT_MIN) {
		return {
			valid: false,
			error: `referenceContent too short (min ${CONTENT_MIN} chars)`,
			field: "referenceContent",
		};
	}
	if (args.referenceContent.length > CONTENT_MAX) {
		return {
			valid: false,
			error: `referenceContent too large (max ${CONTENT_MAX / 1000}KB)`,
			field: "referenceContent",
		};
	}

	// commitSha
	if (args.commitSha.length !== COMMIT_SHA_LENGTH) {
		return { valid: false, error: "commitSha must be 40 characters", field: "commitSha" };
	}
	if (!COMMIT_SHA_PATTERN.test(args.commitSha)) {
		return { valid: false, error: "Invalid commit SHA format", field: "commitSha" };
	}

	// generatedAt
	const timestamp = Date.parse(args.generatedAt);
	if (Number.isNaN(timestamp)) {
		return { valid: false, error: "Invalid generatedAt timestamp", field: "generatedAt" };
	}
	if (timestamp > Date.now() + 5 * 60_000) {
		return {
			valid: false,
			error: "generatedAt cannot be more than 5 minutes in the future",
			field: "generatedAt",
		};
	}

	return { valid: true };
}
