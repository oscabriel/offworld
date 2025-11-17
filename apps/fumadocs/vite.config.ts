import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ mode }) => ({
	server: {
		port: 3000,
	},
	plugins: [
		mdx(await import("./source.config")),
		tailwindcss(),
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tanstackStart({
			prerender: {
				enabled: true,
			},
		}),
		react(),
		// Only use Netlify plugin in production builds
		...(mode === "production" ? [netlify()] : []),
	],
}));
