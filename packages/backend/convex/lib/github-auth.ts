/**
 * GitHub App JWT authentication for API requests
 *
 * Generates JWTs signed with the app's private key for higher rate limits (5000 req/hr)
 * Falls back to unauthenticated requests if credentials not configured
 */

const GITHUB_API = "https://api.github.com";

interface GitHubAppConfig {
	appId: string;
	privateKey: string;
}

function getAppConfig(): GitHubAppConfig | null {
	const appId = process.env.GITHUB_APP_ID;
	const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

	if (!appId || !privateKey) {
		return null;
	}

	return { appId, privateKey };
}

/**
 * Base64url encode (RFC 4648)
 */
function base64url(input: string | Uint8Array): string {
	const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate JWT for GitHub App authentication
 * Token is valid for 10 minutes (GitHub's max)
 */
async function generateJWT(config: GitHubAppConfig): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iat: now - 60, // issued 60s ago to account for clock drift
		exp: now + 600, // expires in 10 minutes
		iss: config.appId,
	};

	const header = { alg: "RS256", typ: "JWT" };
	const encodedHeader = base64url(JSON.stringify(header));
	const encodedPayload = base64url(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;

	// Import the private key and sign
	const privateKey = await crypto.subtle.importKey(
		"pkcs8",
		pemToBinary(config.privateKey),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		privateKey,
		new TextEncoder().encode(signingInput),
	);

	const encodedSignature = base64url(new Uint8Array(signature));
	return `${signingInput}.${encodedSignature}`;
}

/**
 * Convert PEM-encoded private key to binary
 */
function pemToBinary(pem: string): ArrayBuffer {
	const lines = pem.split("\n");
	const base64 = lines
		.filter((line) => !line.startsWith("-----"))
		.join("")
		.replace(/\s/g, "");

	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

// Cache JWT to avoid regenerating on every request
let cachedJWT: { token: string; expiresAt: number } | null = null;

async function getJWT(): Promise<string | null> {
	const config = getAppConfig();
	if (!config) return null;

	const now = Date.now();
	// Refresh if expired or expiring in next 60s
	if (cachedJWT && cachedJWT.expiresAt > now + 60000) {
		return cachedJWT.token;
	}

	const token = await generateJWT(config);
	cachedJWT = {
		token,
		expiresAt: now + 9 * 60 * 1000, // 9 minutes (conservative)
	};

	return token;
}

/**
 * Get headers for GitHub API requests
 * Includes JWT auth if configured, otherwise unauthenticated
 */
export async function getGitHubHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "offworld",
	};

	const jwt = await getJWT();
	if (jwt) {
		headers.Authorization = `Bearer ${jwt}`;
	}

	return headers;
}

export { GITHUB_API };
