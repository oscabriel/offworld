import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	env: {
		CONVEX_URL: process.env.CONVEX_URL || "",
		WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID || "",
	},
});
