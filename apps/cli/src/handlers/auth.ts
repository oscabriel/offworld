/**
 * Auth command handlers
 */

import * as p from "@clack/prompts";
import { saveAuthData, clearAuthData, getAuthStatus, getAuthPath } from "@offworld/sdk";
import open from "open";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@offworld/backend/convex/_generated/api";
import { createSpinner } from "../utils/spinner";

// ============================================================================
// Configuration
// ============================================================================

const CONVEX_URL = process.env.CONVEX_URL ?? "https://quiet-zebra-310.convex.cloud";
const CLIENT_ID = process.env.DEVICE_AUTHORIZATION_CLIENT_ID ?? "offworld-cli";
const SITE_URL = process.env.SITE_URL ?? "https://offworld.sh";
const POLL_INTERVAL = 5000;
const MAX_POLL_TIME = 15 * 60 * 1000;

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

	const client = new ConvexHttpClient(CONVEX_URL);

	s.start("Requesting device code...");

	let deviceData;
	try {
		deviceData = await client.mutation(api.deviceAuth.requestDeviceCode, {
			clientId: CLIENT_ID,
		});
	} catch (error) {
		s.stop("Failed to get device code");
		return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
	}

	s.stop();

	const { device_code, user_code, verification_uri } = deviceData as {
		device_code: string;
		user_code: string;
		verification_uri: string;
	};

	const verifyUrl = verification_uri || `${SITE_URL}/device`;

	p.log.info(`\nOpen this URL in your browser:\n`);
	p.log.info(`  ${verifyUrl}/${user_code}\n`);
	p.log.info(`Or go to ${verifyUrl} and enter code: ${user_code}\n`);

	try {
		await open(`${verifyUrl}/${user_code}`);
	} catch {
		// Ignore - user can open manually
	}

	s.start("Waiting for approval...");

	const startTime = Date.now();

	while (Date.now() - startTime < MAX_POLL_TIME) {
		await sleep(POLL_INTERVAL);

		const status = await client.query(api.deviceAuth.getDeviceCodeStatus, {
			deviceCode: device_code,
			clientId: CLIENT_ID,
		});

		if (status === "approved") {
			break;
		}

		if (status === "denied") {
			s.stop("Login denied");
			return { success: false, message: "Authorization denied by user" };
		}

		if (status === "expired" || status === "unknown") {
			s.stop("Code expired");
			return { success: false, message: "Device code expired. Please try again." };
		}
	}

	s.message("Exchanging code for token...");

	try {
		const tokenData = (await client.mutation(api.deviceAuth.createDeviceToken, {
			deviceCode: device_code,
			clientId: CLIENT_ID,
		})) as { access_token: string; expires_in?: number };

		s.stop("Login successful!");

		saveAuthData({
			token: tokenData.access_token,
			expiresAt: tokenData.expires_in
				? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
				: undefined,
		});

		p.log.success("Logged in successfully");

		return { success: true };
	} catch (error) {
		s.stop("Failed to get token");
		return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
