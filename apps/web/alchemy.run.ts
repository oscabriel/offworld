import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";

const app = await alchemy("web");

export const web = await TanStackStart("web", {
	bindings: {
		VITE_CONVEX_URL: alchemy.env.VITE_CONVEX_URL!,
		VITE_CONVEX_SITE_URL: alchemy.env.VITE_CONVEX_SITE_URL!,
		WORKOS_CLIENT_ID: alchemy.secret.env.WORKOS_CLIENT_ID!,
		WORKOS_API_KEY: alchemy.secret.env.WORKOS_API_KEY!,
		WORKOS_COOKIE_PASSWORD: alchemy.secret.env.WORKOS_COOKIE_PASSWORD!,
		WORKOS_REDIRECT_URI: alchemy.env.WORKOS_REDIRECT_URI!,
	},
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
