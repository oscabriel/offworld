import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	// Only inject env vars for production builds (when they're actually set)
	// For local dev, they'll be loaded from .env at runtime
	env: process.env.CONVEX_URL
		? {
				CONVEX_URL: process.env.CONVEX_URL,
			}
		: undefined,
});
