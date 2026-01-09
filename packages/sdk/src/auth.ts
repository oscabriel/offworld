/**
 * Authentication utilities for offworld CLI
 * PRD 4.8: Token storage and session management
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { getMetaRoot } from "./config.js";

// ============================================================================
// Configuration
// ============================================================================

const AUTH_FILE_NAME = "auth.json";

// ============================================================================
// Types
// ============================================================================

/** Stored authentication data */
export interface AuthData {
	token: string;
	expiresAt?: string;
	userId?: string;
	email?: string;
}

/** Authentication status */
export interface AuthStatus {
	isLoggedIn: boolean;
	email?: string;
	userId?: string;
	expiresAt?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class AuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthError";
	}
}

export class NotLoggedInError extends AuthError {
	constructor(message = "Not logged in. Please run 'ow auth login' first.") {
		super(message);
		this.name = "NotLoggedInError";
	}
}

export class TokenExpiredError extends AuthError {
	constructor(message = "Session expired. Please run 'ow auth login' again.") {
		super(message);
		this.name = "TokenExpiredError";
	}
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Returns the auth file path (~/.ow/auth.json)
 */
export function getAuthPath(): string {
	return join(getMetaRoot(), AUTH_FILE_NAME);
}

// ============================================================================
// Token Storage Functions
// ============================================================================

/**
 * Saves authentication data to ~/.ow/auth.json
 * Creates directory if it doesn't exist
 */
export function saveAuthData(data: AuthData): void {
	const authPath = getAuthPath();
	const authDir = dirname(authPath);

	// Ensure directory exists
	if (!existsSync(authDir)) {
		mkdirSync(authDir, { recursive: true });
	}

	// Write auth data
	writeFileSync(authPath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Loads authentication data from ~/.ow/auth.json
 * Returns null if file doesn't exist or is invalid
 */
export function loadAuthData(): AuthData | null {
	const authPath = getAuthPath();

	if (!existsSync(authPath)) {
		return null;
	}

	try {
		const content = readFileSync(authPath, "utf-8");
		const data = JSON.parse(content) as AuthData;

		// Basic validation
		if (!data.token || typeof data.token !== "string") {
			return null;
		}

		return data;
	} catch {
		return null;
	}
}

/**
 * Clears stored authentication data
 * @returns true if auth file was deleted, false if it didn't exist
 */
export function clearAuthData(): boolean {
	const authPath = getAuthPath();

	if (!existsSync(authPath)) {
		return false;
	}

	try {
		unlinkSync(authPath);
		return true;
	} catch {
		return false;
	}
}

// ============================================================================
// Token Retrieval Functions
// ============================================================================

/**
 * Gets the current authentication token
 * @throws NotLoggedInError if not logged in
 * @throws TokenExpiredError if token is expired
 */
export function getToken(): string {
	const data = loadAuthData();

	if (!data) {
		throw new NotLoggedInError();
	}

	// Check if token is expired
	if (data.expiresAt) {
		const expiresAt = new Date(data.expiresAt);
		if (expiresAt <= new Date()) {
			throw new TokenExpiredError();
		}
	}

	return data.token;
}

/**
 * Gets the current authentication token, or null if not logged in
 * Does not throw errors
 */
export function getTokenOrNull(): string | null {
	try {
		return getToken();
	} catch {
		return null;
	}
}

/**
 * Checks if user is logged in with valid token
 */
export function isLoggedIn(): boolean {
	return getTokenOrNull() !== null;
}

// ============================================================================
// Status Functions
// ============================================================================

/**
 * Gets the current authentication status
 */
export function getAuthStatus(): AuthStatus {
	const data = loadAuthData();

	if (!data) {
		return { isLoggedIn: false };
	}

	// Check if expired
	if (data.expiresAt) {
		const expiresAt = new Date(data.expiresAt);
		if (expiresAt <= new Date()) {
			return { isLoggedIn: false };
		}
	}

	return {
		isLoggedIn: true,
		email: data.email,
		userId: data.userId,
		expiresAt: data.expiresAt,
	};
}
