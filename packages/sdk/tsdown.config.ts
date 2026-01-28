import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	env: process.env.CONVEX_URL
		? {
				CONVEX_URL: process.env.CONVEX_URL,
			}
		: undefined,
});
