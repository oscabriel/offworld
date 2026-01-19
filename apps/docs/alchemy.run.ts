import alchemy from "alchemy";
import { Astro } from "alchemy/cloudflare";

const app = await alchemy("docs");

export const docs = await Astro("docs");

console.log(`Docs   -> ${docs.url}`);

await app.finalize();
