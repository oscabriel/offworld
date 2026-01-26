import alchemy from "alchemy/cloudflare/astro";
import starlight from "@astrojs/starlight";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	site: "https://offworld.sh",
	output: "server",
	adapter: alchemy(),
	integrations: [
		starlight({
			title: "Offworld",
			customCss: [
				"@fontsource/sorts-mill-goudy/400.css",
				"@fontsource/geist-mono/400.css",
				"@fontsource/geist-mono/500.css",
				"./src/styles/custom.css",
			],
			social: [
				{ icon: "github", label: "GitHub", href: "https://github.com/oscabriel/offworld" },
				{ icon: "x.com", label: "Twitter", href: "https://x.com/offaboreal" },
			],
			editLink: {
				baseUrl: "https://github.com/oscabriel/offworld/edit/main/apps/docs/",
			},
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Introduction", slug: "index" },
						{ label: "Quickstart", slug: "guides/quickstart" },
						{ label: "AI Agent Integration", slug: "agents" },
					],
				},
				{
					label: "Concepts",
					items: [{ label: "How Offworld Works", slug: "concepts" }],
				},
				{
					label: "Reference",
					items: [{ label: "CLI Reference", slug: "reference/cli" }],
				},
			],
		}),
	],
});
