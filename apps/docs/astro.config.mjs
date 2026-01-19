import alchemy from "alchemy/cloudflare/astro";
import starlight from "@astrojs/starlight";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	output: "server",
	adapter: alchemy(),
	integrations: [
		starlight({
			title: "My Docs",
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/withastro/starlight" }],
			sidebar: [
				{
					label: "Guides",
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: "Example Guide", slug: "guides/example" },
					],
				},
				{
					label: "Reference",
					autogenerate: { directory: "reference" },
				},
			],
		}),
	],
});
