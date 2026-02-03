/**
 * Auth command handlers
 * Uses WorkOS Device Authorization Grant for CLI authentication
 */

import * as p from "@clack/prompts";
import { saveAuthData, clearAuthData, getAuthStatus, getAuthPath } from "@offworld/sdk/internal";
import {
	WorkOSDeviceAuthResponseSchema,
	WorkOSTokenResponseSchema,
	WorkOSAuthErrorResponseSchema,
	type WorkOSDeviceAuthResponse,
	type WorkOSTokenResponse,
} from "@offworld/types";
import open from "open";
import { createSpinner } from "../utils/spinner";

const WORKOS_API = "https://api.workos.com";

// Production WorkOS client ID - dev can override via WORKOS_CLIENT_ID env var
const PRODUCTION_WORKOS_CLIENT_ID = "client_01KFAD76TNGN02AP96982HG35E";

function getWorkosClientId(): string {
	return process.env.WORKOS_CLIENT_ID ?? PRODUCTION_WORKOS_CLIENT_ID;
}

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
	workosId?: string;
	expiresAt?: string;
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

async function requestDeviceCode(): Promise<WorkOSDeviceAuthResponse> {
	const response = await fetch(`${WORKOS_API}/user_management/authorize/device`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ client_id: getWorkosClientId() }),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to request device code: ${error}`);
	}

	const data = await response.json();
	return WorkOSDeviceAuthResponseSchema.parse(data);
}

async function pollForTokens(
	deviceCode: string,
	interval: number,
	onStatus?: (status: string) => void,
): Promise<WorkOSTokenResponse> {
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
			const data = await response.json();
			return WorkOSTokenResponseSchema.parse(data);
		}

		const errorData = await response.json();
		const data = WorkOSAuthErrorResponseSchema.parse(errorData);

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

export async function authLoginHandler(): Promise<AuthLoginResult> {
	const s = createSpinner();

	const currentStatus = await getAuthStatus();
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

	let deviceData: WorkOSDeviceAuthResponse;
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
	} catch {}

	s.start("Waiting for approval...");

	try {
		const tokenData = await pollForTokens(deviceData.device_code, deviceData.interval, (status) => {
			s.message(status);
		});

		s.stop("Login successful!");

		const expiresAt = tokenData.expires_at
			? new Date(tokenData.expires_at * 1000).toISOString()
			: extractJwtExpiration(tokenData.access_token);

		saveAuthData({
			token: tokenData.access_token,
			email: tokenData.user.email,
			workosId: tokenData.user.id,
			refreshToken: tokenData.refresh_token,
			expiresAt,
		});

		p.log.success(`Logged in as ${tokenData.user.email}`);

		return { success: true, email: tokenData.user.email };
	} catch (error) {
		s.stop("Login failed");
		return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
	}
}

export async function authLogoutHandler(): Promise<AuthLogoutResult> {
	const status = await getAuthStatus();

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

export async function authStatusHandler(): Promise<AuthStatusResult> {
	const status = await getAuthStatus();

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
		workosId: status.workosId,
		expiresAt: status.expiresAt,
	};
}
