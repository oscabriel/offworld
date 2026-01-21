import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/cli.ts", "src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	// Only inject env vars for production builds (when they're actually set)
	// For local dev, they'll be loaded from .env at runtime via env-loader
	env:
		process.env.CONVEX_URL && process.env.WORKOS_CLIENT_ID
			? {
					CONVEX_URL: process.env.CONVEX_URL,
					WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID,
				}
			: undefined,
});
