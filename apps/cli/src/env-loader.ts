/**
 * Load environment variables for local development
 * Checks multiple common locations for .env file
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(path: string): void {
	if (!existsSync(path)) return;

	try {
		const content = readFileSync(path, "utf-8");
		const lines = content.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const match = trimmed.match(/^([^=]+)=(.*)$/);
			if (!match) continue;

			const [, key, value] = match;
			if (!key || !value) continue;

			const cleanKey = key.trim();
			let cleanValue = value.trim();

			// Remove quotes if present
			if (
				(cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
				(cleanValue.startsWith("'") && cleanValue.endsWith("'"))
			) {
				cleanValue = cleanValue.slice(1, -1);
			}

			// Only set if not already in environment
			if (!process.env[cleanKey]) {
				process.env[cleanKey] = cleanValue;
			}
		}
	} catch {
		// Silently fail
	}
}

/**
 * Load .env from multiple possible locations:
 * 1. CLI package directory (for linked dev)
 * 2. Current working directory (for convenience)
 */
export function loadDevEnv(): void {
	// Skip in production (when built with env vars)
	if (process.env.CONVEX_URL && process.env.WORKOS_CLIENT_ID) {
		return;
	}

	// Try CLI package directory first (for bun link dev)
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const cliEnvPath = resolve(__dirname, "../.env");
	loadEnvFile(cliEnvPath);

	// Fallback to CWD (for convenience)
	const cwdEnvPath = resolve(process.cwd(), ".env");
	if (cwdEnvPath !== cliEnvPath) {
		loadEnvFile(cwdEnvPath);
	}
}
