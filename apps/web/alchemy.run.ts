import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";

const app = await alchemy("offworld");

export const web = await TanStackStart("web", {
	adopt: true,
	bindings: {
		VITE_CONVEX_URL: alchemy.env.VITE_CONVEX_URL,
		VITE_CONVEX_SITE_URL: alchemy.env.VITE_CONVEX_SITE_URL,
		VITE_SENTRY_DSN: alchemy.env.VITE_SENTRY_DSN,
	},
	domains: ["offworld.sh"],
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
