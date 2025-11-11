import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";

const app = await alchemy("offworld");

export const web = await TanStackStart("web", {
	adopt: true,
	bindings: {
		VITE_CONVEX_URL: alchemy.env.VITE_CONVEX_URL,
		VITE_CONVEX_SITE_URL: alchemy.env.VITE_CONVEX_SITE_URL,
	},
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
