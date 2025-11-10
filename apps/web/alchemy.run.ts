import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });

const app = await alchemy("offworld");

export const web = await TanStackStart("web", {
	bindings: {
		VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || "",
	},
	dev: {
		command: "bun run dev",
	},
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
