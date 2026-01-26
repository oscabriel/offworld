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
			title: "Offworld",
			social: [
				{ icon: "github", label: "GitHub", href: "https://github.com/oscabriel/offworld" },
				{ icon: "x.com", label: "Twitter", href: "https://x.com/offaboreal" },
			],
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Introduction", slug: "index" },
						{ label: "Quickstart", slug: "guides/quickstart" },
					],
				},
				{
					label: "AI Agents",
					items: [
						{ label: "Agent Integration", slug: "agents" },
						{ label: "Claude Code", slug: "agents/claude-code" },
						{ label: "Cursor", slug: "agents/cursor" },
						{ label: "Amp", slug: "agents/amp" },
						{ label: "OpenCode", slug: "agents/opencode" },
					],
				},
				{
					label: "Reference",
					items: [
						{ label: "CLI Reference", slug: "reference/cli" },
					],
				},
			],
		}),
	],
});
