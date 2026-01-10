/**
 * Unit tests for auth.ts pure/near-pure functions
 * PRD T1.2: Tests for getAuthPath, getTokenOrNull, isLoggedIn, getAuthStatus
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Mock setup - vi.mock calls are hoisted
// ============================================================================

// Virtual file system state
const virtualFs: Record<string, { content: string }> = {};
const mockMetaRoot = join(homedir(), ".ow");

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn((path: string) => {
		const normalized = path.replace(/\\/g, "/");
		return normalized in virtualFs;
	}),
	readFileSync: vi.fn((path: string) => {
		const normalized = path.replace(/\\/g, "/");
		const file = virtualFs[normalized];
		if (!file) {
			const error = new Error(
				`ENOENT: no such file or directory, open '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}
		return file.content;
	}),
	writeFileSync: vi.fn((path: string, content: string) => {
		const normalized = path.replace(/\\/g, "/");
		virtualFs[normalized] = { content };
	}),
	mkdirSync: vi.fn(),
	unlinkSync: vi.fn((path: string) => {
		const normalized = path.replace(/\\/g, "/");
		if (!(normalized in virtualFs)) {
			const error = new Error(
				`ENOENT: no such file or directory, unlink '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}
		delete virtualFs[normalized];
	}),
}));

// Mock config.ts to return predictable paths
vi.mock("../config.js", () => ({
	getMetaRoot: () => join(homedir(), ".ow"),
}));

// Import after mocking
import {
	getAuthPath,
	getToken,
	getTokenOrNull,
	isLoggedIn,
	getAuthStatus,
	loadAuthData,
	saveAuthData,
	clearAuthData,
	NotLoggedInError,
	TokenExpiredError,
	type AuthData,
} from "../auth.js";

// ============================================================================
// Setup and teardown
// ============================================================================

function clearVirtualFs(): void {
	for (const key of Object.keys(virtualFs)) {
		delete virtualFs[key];
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	clearVirtualFs();
});

afterEach(() => {
	vi.clearAllMocks();
	clearVirtualFs();
});

// ============================================================================
// Helper functions
// ============================================================================

function addAuthFile(data: AuthData): void {
	const authPath = join(mockMetaRoot, "auth.json");
	virtualFs[authPath.replace(/\\/g, "/")] = {
		content: JSON.stringify(data),
	};
}

function createFutureDate(): string {
	const future = new Date();
	future.setFullYear(future.getFullYear() + 1);
	return future.toISOString();
}

function createPastDate(): string {
	const past = new Date();
	past.setFullYear(past.getFullYear() - 1);
	return past.toISOString();
}

// ============================================================================
// getAuthPath tests
// ============================================================================

describe("getAuthPath", () => {
	it("returns correct path based on metaRoot", () => {
		const result = getAuthPath();
		expect(result).toBe(join(mockMetaRoot, "auth.json"));
	});
});

// ============================================================================
// loadAuthData tests
// ============================================================================

describe("loadAuthData", () => {
	it("returns null when auth file does not exist", () => {
		const result = loadAuthData();
		expect(result).toBeNull();
	});

	it("returns auth data when valid file exists", () => {
		const authData: AuthData = {
			token: "test-token",
			expiresAt: createFutureDate(),
			userId: "user-123",
			email: "test@example.com",
		};
		addAuthFile(authData);

		const result = loadAuthData();
		expect(result).toEqual(authData);
	});

	it("returns null when file contains invalid JSON", () => {
		const authPath = join(mockMetaRoot, "auth.json");
		virtualFs[authPath.replace(/\\/g, "/")] = {
			content: "not valid json {{{",
		};

		const result = loadAuthData();
		expect(result).toBeNull();
	});

	it("returns null when token is missing", () => {
		const authPath = join(mockMetaRoot, "auth.json");
		virtualFs[authPath.replace(/\\/g, "/")] = {
			content: JSON.stringify({ userId: "user-123" }),
		};

		const result = loadAuthData();
		expect(result).toBeNull();
	});

	it("returns null when token is not a string", () => {
		const authPath = join(mockMetaRoot, "auth.json");
		virtualFs[authPath.replace(/\\/g, "/")] = {
			content: JSON.stringify({ token: 12345 }),
		};

		const result = loadAuthData();
		expect(result).toBeNull();
	});
});

// ============================================================================
// saveAuthData tests
// ============================================================================

describe("saveAuthData", () => {
	it("saves auth data to correct path", () => {
		const authData: AuthData = {
			token: "test-token",
			expiresAt: createFutureDate(),
		};

		saveAuthData(authData);

		const authPath = join(mockMetaRoot, "auth.json");
		const saved = virtualFs[authPath.replace(/\\/g, "/")];
		expect(saved).toBeDefined();
		expect(JSON.parse(saved!.content)).toEqual(authData);
	});

	it("creates directory if it does not exist", async () => {
		const fs = await import("node:fs");
		const authData: AuthData = { token: "test-token" };

		saveAuthData(authData);

		expect(fs.mkdirSync).toHaveBeenCalledWith(mockMetaRoot, { recursive: true });
	});
});

// ============================================================================
// clearAuthData tests
// ============================================================================

describe("clearAuthData", () => {
	it("returns false when auth file does not exist", () => {
		const result = clearAuthData();
		expect(result).toBe(false);
	});

	it("returns true and deletes file when auth file exists", async () => {
		const fs = await import("node:fs");
		addAuthFile({ token: "test-token" });

		const result = clearAuthData();
		expect(result).toBe(true);
		expect(fs.unlinkSync).toHaveBeenCalled();
	});
});

// ============================================================================
// getToken tests
// ============================================================================

describe("getToken", () => {
	it("throws NotLoggedInError when not logged in", () => {
		expect(() => getToken()).toThrow(NotLoggedInError);
	});

	it("throws TokenExpiredError when token is expired", () => {
		addAuthFile({
			token: "expired-token",
			expiresAt: createPastDate(),
		});

		expect(() => getToken()).toThrow(TokenExpiredError);
	});

	it("returns token when valid and not expired", () => {
		addAuthFile({
			token: "valid-token",
			expiresAt: createFutureDate(),
		});

		const result = getToken();
		expect(result).toBe("valid-token");
	});

	it("returns token when expiresAt is missing (no expiration)", () => {
		addAuthFile({
			token: "no-expiry-token",
		});

		const result = getToken();
		expect(result).toBe("no-expiry-token");
	});
});

// ============================================================================
// getTokenOrNull tests
// ============================================================================

describe("getTokenOrNull", () => {
	it("returns null when not logged in", () => {
		const result = getTokenOrNull();
		expect(result).toBeNull();
	});

	it("returns null when token is expired", () => {
		addAuthFile({
			token: "expired-token",
			expiresAt: createPastDate(),
		});

		const result = getTokenOrNull();
		expect(result).toBeNull();
	});

	it("returns token when valid", () => {
		addAuthFile({
			token: "valid-token",
			expiresAt: createFutureDate(),
		});

		const result = getTokenOrNull();
		expect(result).toBe("valid-token");
	});

	it("returns token when expiresAt is missing", () => {
		addAuthFile({
			token: "no-expiry-token",
		});

		const result = getTokenOrNull();
		expect(result).toBe("no-expiry-token");
	});
});

// ============================================================================
// isLoggedIn tests
// ============================================================================

describe("isLoggedIn", () => {
	it("returns false when not logged in", () => {
		const result = isLoggedIn();
		expect(result).toBe(false);
	});

	it("returns false when token is expired", () => {
		addAuthFile({
			token: "expired-token",
			expiresAt: createPastDate(),
		});

		const result = isLoggedIn();
		expect(result).toBe(false);
	});

	it("returns true when valid token exists", () => {
		addAuthFile({
			token: "valid-token",
			expiresAt: createFutureDate(),
		});

		const result = isLoggedIn();
		expect(result).toBe(true);
	});

	it("returns true when token has no expiration", () => {
		addAuthFile({
			token: "no-expiry-token",
		});

		const result = isLoggedIn();
		expect(result).toBe(true);
	});
});

// ============================================================================
// getAuthStatus tests
// ============================================================================

describe("getAuthStatus", () => {
	it("returns isLoggedIn: false when not logged in", () => {
		const result = getAuthStatus();
		expect(result).toEqual({ isLoggedIn: false });
	});

	it("returns isLoggedIn: false when token is expired", () => {
		addAuthFile({
			token: "expired-token",
			expiresAt: createPastDate(),
			email: "test@example.com",
			userId: "user-123",
		});

		const result = getAuthStatus();
		expect(result).toEqual({ isLoggedIn: false });
	});

	it("returns full status when valid token exists", () => {
		const expiresAt = createFutureDate();
		addAuthFile({
			token: "valid-token",
			expiresAt,
			email: "test@example.com",
			userId: "user-123",
		});

		const result = getAuthStatus();
		expect(result).toEqual({
			isLoggedIn: true,
			email: "test@example.com",
			userId: "user-123",
			expiresAt,
		});
	});

	it("returns status without expiresAt when missing", () => {
		addAuthFile({
			token: "valid-token",
			email: "test@example.com",
		});

		const result = getAuthStatus();
		expect(result).toEqual({
			isLoggedIn: true,
			email: "test@example.com",
			userId: undefined,
			expiresAt: undefined,
		});
	});

	it("returns isLoggedIn: true without email when email is missing", () => {
		addAuthFile({
			token: "valid-token",
			userId: "user-123",
		});

		const result = getAuthStatus();
		expect(result).toEqual({
			isLoggedIn: true,
			email: undefined,
			userId: "user-123",
			expiresAt: undefined,
		});
	});
});
