/**
 * Load environment variables for local development overrides.
 * Production URLs are hardcoded in the SDK, but devs can override
 * them via .env to point at dev backends.
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

			if (
				(cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
				(cleanValue.startsWith("'") && cleanValue.endsWith("'"))
			) {
				cleanValue = cleanValue.slice(1, -1);
			}

			if (!process.env[cleanKey]) {
				process.env[cleanKey] = cleanValue;
			}
		}
	} catch {}
}

/**
 * Load .env from multiple possible locations:
 * 1. CLI package directory (for linked dev)
 * 2. Current working directory (for convenience)
 */
export function loadDevEnv(): void {
	if (process.env.CONVEX_URL && process.env.WORKOS_CLIENT_ID) {
		return;
	}

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const cliEnvPath = resolve(__dirname, "../.env");
	loadEnvFile(cliEnvPath);

	const cwdEnvPath = resolve(process.cwd(), ".env");
	if (cwdEnvPath !== cliEnvPath) {
		loadEnvFile(cwdEnvPath);
	}
}
