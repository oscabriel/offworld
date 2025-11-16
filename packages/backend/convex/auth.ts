import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";

// biome-ignore lint/style/noNonNullAssertion: this is fine
const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

function createAuth(
	ctx: GenericCtx<DataModel>,
	{ optionsOnly }: { optionsOnly?: boolean } = { optionsOnly: false },
) {
	return betterAuth({
		logger: {
			disabled: optionsOnly,
		},
		baseURL: siteUrl,
		trustedOrigins: [siteUrl],
		database: authComponent.adapter(ctx),
		socialProviders: {
			github: {
				enabled: true,
				clientId: process.env.GITHUB_CLIENT_ID || "",
				clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
			},
		},
		plugins: [convex()],
	});
}

export { createAuth };

export const getCurrentUser = query({
	args: {},
	returns: v.any(),
	handler: async (ctx) => authComponent.getAuthUser(ctx),
});

/**
 * Returns the current authenticated user or null if not authenticated.
 * Safe query version that doesn't throw when user is not authenticated.
 */
export const getCurrentUserSafe = query({
	args: {},
	returns: v.any(),
	handler: async (ctx) => authComponent.safeGetAuthUser(ctx),
});

/**
 * Returns the current authenticated user or null if not authenticated.
 * Use for queries that support unauthenticated access.
 */
export async function safeGetUser(ctx: GenericCtx<DataModel>) {
	return await authComponent.safeGetAuthUser(ctx);
}

/**
 * Returns the current authenticated user or throws an error if not authenticated.
 * Use for mutations and protected queries.
 */
export async function getUser(ctx: GenericCtx<DataModel>) {
	const user = await authComponent.getAuthUser(ctx);
	if (!user) {
		throw new Error("Unauthorized");
	}
	return user;
}
