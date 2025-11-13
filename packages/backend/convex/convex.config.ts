import betterAuth from "@convex-dev/better-auth/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(workflow);

export default app;
