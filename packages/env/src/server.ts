import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		WORKOS_CLIENT_ID: z.string(),
		WORKOS_API_KEY: z.string(),
		WORKOS_COOKIE_PASSWORD: z.string().min(32),
		WORKOS_REDIRECT_URI: z.string().url(),
		CORS_ORIGIN: z.string().url(),
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
