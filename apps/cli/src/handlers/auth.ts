/**
 * Auth command handlers
 * PRD 4.8: 'ow auth' subcommands
 */

import * as p from "@clack/prompts";
import { saveAuthData, clearAuthData, getAuthStatus, getAuthPath } from "@offworld/sdk";
import open from "open";
import http from "node:http";
import { URL } from "node:url";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_AUTH_BASE = "https://offworld.sh";
const CALLBACK_PORT = 9876;
const CALLBACK_PATH = "/callback";

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

/**
 * Handles 'ow auth login' command
 * Opens browser to offworld.sh/login and waits for OAuth callback
 */
export async function authLoginHandler(): Promise<AuthLoginResult> {
	const s = p.spinner();

	// Check if already logged in
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

	// Create callback server to receive token
	const tokenPromise = createCallbackServer();

	// Build login URL with callback
	const callbackUrl = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
	const loginUrl = `${DEFAULT_AUTH_BASE}/login?callback=${encodeURIComponent(callbackUrl)}`;

	s.start("Opening browser for login...");

	// Open browser
	try {
		await open(loginUrl);
		s.message("Waiting for authentication...");
	} catch {
		s.stop("Failed to open browser");
		p.log.error(`Please open this URL manually:\n${loginUrl}`);
	}

	try {
		// Wait for callback with token
		const authData = await tokenPromise;

		s.stop("Login successful!");

		// Save the token
		saveAuthData(authData);

		p.log.success(`Logged in as ${authData.email || "user"}`);

		return {
			success: true,
			email: authData.email,
		};
	} catch (error) {
		s.stop("Login failed");
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return {
			success: false,
			message,
		};
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

// ============================================================================
// Callback Server
// ============================================================================

interface ReceivedAuthData {
	token: string;
	expiresAt?: string;
	userId?: string;
	email?: string;
}

/**
 * Creates a temporary HTTP server to receive the OAuth callback
 * Times out after 5 minutes
 */
function createCallbackServer(): Promise<ReceivedAuthData> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => {
				server.close();
				reject(new Error("Login timed out. Please try again."));
			},
			5 * 60 * 1000,
		); // 5 minute timeout

		const server = http.createServer((req, res) => {
			if (!req.url?.startsWith(CALLBACK_PATH)) {
				res.writeHead(404);
				res.end("Not found");
				return;
			}

			try {
				const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
				const token = url.searchParams.get("token");
				const error = url.searchParams.get("error");

				if (error) {
					// Send error response page
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(getErrorPage(error));

					clearTimeout(timeout);
					server.close();
					reject(new Error(error));
					return;
				}

				if (!token) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end(getErrorPage("No token received"));

					clearTimeout(timeout);
					server.close();
					reject(new Error("No token received from server"));
					return;
				}

				// Extract optional fields
				const expiresAt = url.searchParams.get("expiresAt") ?? undefined;
				const userId = url.searchParams.get("userId") ?? undefined;
				const email = url.searchParams.get("email") ?? undefined;

				// Send success response page
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(getSuccessPage(email));

				clearTimeout(timeout);
				server.close();

				resolve({
					token,
					expiresAt,
					userId,
					email,
				});
			} catch {
				res.writeHead(500, { "Content-Type": "text/html" });
				res.end(getErrorPage("Internal error"));

				clearTimeout(timeout);
				server.close();
				reject(new Error("Failed to process callback"));
			}
		});

		server.listen(CALLBACK_PORT, "127.0.0.1", () => {
			// Server is ready
		});

		server.on("error", (err) => {
			clearTimeout(timeout);
			if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
				reject(
					new Error(
						`Port ${CALLBACK_PORT} is already in use. Please close any conflicting applications.`,
					),
				);
			} else {
				reject(err);
			}
		});
	});
}

// ============================================================================
// HTML Pages
// ============================================================================

function getSuccessPage(email?: string): string {
	return `<!DOCTYPE html>
<html>
<head>
  <title>Offworld - Login Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
      max-width: 400px;
    }
    h1 { color: #1a202c; margin-bottom: 0.5rem; }
    p { color: #4a5568; }
    .check { font-size: 3rem; margin-bottom: 1rem; }
    .close-note { color: #718096; font-size: 0.875rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Login Successful!</h1>
    <p>${email ? `Logged in as <strong>${email}</strong>` : "You are now authenticated."}</p>
    <p class="close-note">You can close this window and return to your terminal.</p>
  </div>
</body>
</html>`;
}

function getErrorPage(error: string): string {
	return `<!DOCTYPE html>
<html>
<head>
  <title>Offworld - Login Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f56565 0%, #c53030 100%);
    }
    .card {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
      max-width: 400px;
    }
    h1 { color: #1a202c; margin-bottom: 0.5rem; }
    p { color: #4a5568; }
    .error-icon { font-size: 3rem; margin-bottom: 1rem; }
    .error-msg { color: #c53030; font-family: monospace; background: #fff5f5; padding: 0.5rem 1rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">✕</div>
    <h1>Login Failed</h1>
    <p class="error-msg">${error}</p>
    <p>Please try again or contact support if the issue persists.</p>
  </div>
</body>
</html>`;
}
