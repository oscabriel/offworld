/**
 * Auth command handlers
 * Uses WorkOS Device Authorization Grant for CLI authentication
 */

import * as p from "@clack/prompts";
import { saveAuthData, clearAuthData, getAuthStatus, getAuthPath } from "@offworld/sdk";
import open from "open";
import { createSpinner } from "../utils/spinner";

// ============================================================================
// Configuration
// ============================================================================

const WORKOS_API = "https://api.workos.com";

function getWorkosClientId(): string {
	const clientId = process.env.WORKOS_CLIENT_ID;
	if (!clientId) {
		throw new Error("WORKOS_CLIENT_ID environment variable is required");
	}
	return clientId;
}

// ============================================================================
// Handler Types
// ============================================================================

export interface AuthLoginResult {
	success: boolean;
	email?: string;
	message?: string;
}

export interface AuthLogoutResult {
	success: boolean;
	message: string;
}

export interface AuthStatusResult {
	loggedIn: boolean;
	email?: string;
	userId?: string;
	expiresAt?: string;
}

// ============================================================================
// WorkOS Device Auth Types
// ============================================================================

interface DeviceAuthResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
	expires_in: number;
	interval: number;
}

interface TokenResponse {
	user: {
		id: string;
		email: string;
		firstName?: string;
		lastName?: string;
	};
	access_token: string;
	refresh_token: string;
	organizationId?: string;
}

interface AuthErrorResponse {
	error: "authorization_pending" | "slow_down" | "access_denied" | "expired_token" | string;
	error_description?: string;
}

// ============================================================================
// WorkOS API Functions
// ============================================================================

async function requestDeviceCode(): Promise<DeviceAuthResponse> {
	const response = await fetch(`${WORKOS_API}/user_management/authorize/device`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ client_id: getWorkosClientId() }),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to request device code: ${error}`);
	}

	return response.json() as Promise<DeviceAuthResponse>;
}

async function pollForTokens(
	deviceCode: string,
	interval: number,
	onStatus?: (status: string) => void,
): Promise<TokenResponse> {
	let pollInterval = interval;

	while (true) {
		const response = await fetch(`${WORKOS_API}/user_management/authenticate`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: deviceCode,
				client_id: getWorkosClientId(),
			}),
		});

		if (response.ok) {
			return response.json() as Promise<TokenResponse>;
		}

		const data = (await response.json()) as AuthErrorResponse;

		switch (data.error) {
			case "authorization_pending":
				onStatus?.("Waiting for approval...");
				await sleep(pollInterval * 1000);
				break;
			case "slow_down":
				pollInterval += 5;
				onStatus?.("Slowing down polling...");
				await sleep(pollInterval * 1000);
				break;
			case "access_denied":
				throw new Error("Authorization denied by user");
			case "expired_token":
				throw new Error("Device code expired. Please try again.");
			default:
				throw new Error(`Authentication failed: ${data.error}`);
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Login Handler
// ============================================================================

export async function authLoginHandler(): Promise<AuthLoginResult> {
	const s = createSpinner();

	const currentStatus = getAuthStatus();
	if (currentStatus.isLoggedIn) {
		p.log.info(`Already logged in as ${currentStatus.email || "unknown user"}`);
		const shouldRelogin = await p.confirm({
			message: "Do you want to log in again?",
		});
		if (!shouldRelogin || p.isCancel(shouldRelogin)) {
			return { success: true, email: currentStatus.email };
		}
	}

	s.start("Requesting device code...");

	let deviceData: DeviceAuthResponse;
	try {
		deviceData = await requestDeviceCode();
	} catch (error) {
		s.stop("Failed to get device code");
		return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
	}

	s.stop();

	p.log.info(`\nOpen this URL in your browser:\n`);
	p.log.info(`  ${deviceData.verification_uri_complete}\n`);
	p.log.info(`Or go to ${deviceData.verification_uri} and enter code: ${deviceData.user_code}\n`);

	try {
		await open(deviceData.verification_uri_complete);
	} catch {
		// User can open manually
	}

	s.start("Waiting for approval...");

	try {
		const tokenData = await pollForTokens(deviceData.device_code, deviceData.interval, (status) => {
			s.message(status);
		});

		s.stop("Login successful!");

		saveAuthData({
			token: tokenData.access_token,
			email: tokenData.user.email,
			userId: tokenData.user.id,
		});

		p.log.success(`Logged in as ${tokenData.user.email}`);

		return { success: true, email: tokenData.user.email };
	} catch (error) {
		s.stop("Login failed");
		return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
	}
}

// ============================================================================
// Logout Handler
// ============================================================================

/**
 * Handles 'ow auth logout' command
 * Clears stored session token
 */
export async function authLogoutHandler(): Promise<AuthLogoutResult> {
	const status = getAuthStatus();

	if (!status.isLoggedIn) {
		p.log.info("Not currently logged in");
		return {
			success: true,
			message: "Not logged in",
		};
	}

	const cleared = clearAuthData();

	if (cleared) {
		p.log.success("Logged out successfully");
		return {
			success: true,
			message: "Logged out successfully",
		};
	}

	p.log.warn("Could not clear auth data");
	return {
		success: false,
		message: "Could not clear auth data",
	};
}

// ============================================================================
// Status Handler
// ============================================================================

/**
 * Handles 'ow auth status' command
 * Shows current authentication status
 */
export async function authStatusHandler(): Promise<AuthStatusResult> {
	const status = getAuthStatus();

	if (status.isLoggedIn) {
		p.log.info(`Logged in as: ${status.email || "unknown"}`);
		if (status.expiresAt) {
			const expiresDate = new Date(status.expiresAt);
			p.log.info(`Session expires: ${expiresDate.toLocaleString()}`);
		}
		p.log.info(`Auth file: ${getAuthPath()}`);
	} else {
		p.log.info("Not logged in");
		p.log.info("Run 'ow auth login' to authenticate");
	}

	return {
		loggedIn: status.isLoggedIn,
		email: status.email,
		userId: status.userId,
		expiresAt: status.expiresAt,
	};
}
