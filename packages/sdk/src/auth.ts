/**
 * Authentication utilities for offworld CLI
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { WorkOSTokenResponseSchema } from "@offworld/types";
import { Paths } from "./paths";

const AuthDataSchema = z.object({
	token: z.string(),
	expiresAt: z.string().optional(),
	workosId: z.string().optional(),
	refreshToken: z.string().optional(),
	email: z.string().optional(),
});

export interface AuthData {
	token: string;
	expiresAt?: string;
	workosId?: string;
	refreshToken?: string;
	email?: string;
}

/** Authentication status */
export interface AuthStatus {
	isLoggedIn: boolean;
	email?: string;
	workosId?: string;
	expiresAt?: string;
}

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

function extractJwtExpiration(token: string): string | undefined {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return undefined;

		const payload = parts[1];
		if (!payload) return undefined;

		const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
		if (typeof decoded.exp !== "number") return undefined;

		return new Date(decoded.exp * 1000).toISOString();
	} catch {
		return undefined;
	}
}

export function getAuthPath(): string {
	return Paths.authFile;
}

export function saveAuthData(data: AuthData): void {
	const authPath = getAuthPath();
	const authDir = dirname(authPath);

	if (!existsSync(authDir)) {
		mkdirSync(authDir, { recursive: true });
	}

	writeFileSync(authPath, JSON.stringify(data, null, 2), "utf-8");
	chmodSync(authPath, 0o600);
}

/**
 * Loads authentication data from ~/.local/share/offworld/auth.json
 * Returns null if file doesn't exist or is invalid
 */
export function loadAuthData(): AuthData | null {
	const authPath = getAuthPath();

	if (!existsSync(authPath)) {
		return null;
	}

	try {
		const content = readFileSync(authPath, "utf-8");
		const json = JSON.parse(content);
		const parsed = AuthDataSchema.safeParse(json);

		if (!parsed.success) {
			return null;
		}

		return parsed.data;
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

export async function getToken(): Promise<string> {
	const data = loadAuthData();

	if (!data) {
		throw new NotLoggedInError();
	}

	let expiresAtStr = data.expiresAt;
	if (!expiresAtStr) {
		expiresAtStr = extractJwtExpiration(data.token);
		if (expiresAtStr) {
			data.expiresAt = expiresAtStr;
			saveAuthData(data);
		}
	}

	if (expiresAtStr) {
		const expiresAt = new Date(expiresAtStr);
		const now = new Date();
		const oneMinute = 60 * 1000;

		if (expiresAt <= now) {
			if (data.refreshToken) {
				try {
					const refreshed = await refreshAccessToken();
					return refreshed.token;
				} catch {
					throw new TokenExpiredError();
				}
			}
			throw new TokenExpiredError();
		}

		if (expiresAt.getTime() - now.getTime() < oneMinute) {
			if (data.refreshToken) {
				try {
					const refreshed = await refreshAccessToken();
					return refreshed.token;
				} catch {
					return data.token;
				}
			}
		}
	}

	return data.token;
}

/**
 * Gets the current authentication token, or null if not logged in
 * Does not throw errors
 */
export async function getTokenOrNull(): Promise<string | null> {
	try {
		return await getToken();
	} catch {
		return null;
	}
}

export async function isLoggedIn(): Promise<boolean> {
	return (await getTokenOrNull()) !== null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
	const data = loadAuthData();

	if (!data) {
		return { isLoggedIn: false };
	}

	if (data.expiresAt) {
		const expiresAt = new Date(data.expiresAt);
		if (expiresAt <= new Date()) {
			if (data.refreshToken) {
				try {
					const refreshed = await refreshAccessToken();
					return {
						isLoggedIn: true,
						email: refreshed.email,
						workosId: refreshed.workosId,
						expiresAt: refreshed.expiresAt,
					};
				} catch {
					return { isLoggedIn: false };
				}
			}
			return { isLoggedIn: false };
		}
	}

	return {
		isLoggedIn: true,
		email: data.email,
		workosId: data.workosId,
		expiresAt: data.expiresAt,
	};
}

const WORKOS_API = "https://api.workos.com";

function getWorkosClientId(): string {
	return process.env.WORKOS_CLIENT_ID || "";
}

export async function refreshAccessToken(): Promise<AuthData> {
	const data = loadAuthData();

	if (!data?.refreshToken) {
		throw new AuthError("No refresh token available. Please log in again.");
	}

	const clientId = getWorkosClientId();
	if (!clientId) {
		throw new AuthError("WORKOS_CLIENT_ID not configured");
	}

	try {
		const response = await fetch(`${WORKOS_API}/user_management/authenticate`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: data.refreshToken,
				client_id: clientId,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new AuthError(`Token refresh failed: ${error}`);
		}

		const json = await response.json();
		const tokenData = WorkOSTokenResponseSchema.parse(json);

		const newAuthData: AuthData = {
			token: tokenData.access_token,
			email: tokenData.user.email,
			workosId: tokenData.user.id,
			refreshToken: tokenData.refresh_token,
			expiresAt: tokenData.expires_at
				? new Date(tokenData.expires_at * 1000).toISOString()
				: extractJwtExpiration(tokenData.access_token),
		};

		saveAuthData(newAuthData);
		return newAuthData;
	} catch (error) {
		if (error instanceof AuthError) throw error;
		throw new AuthError(
			`Failed to refresh token: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
