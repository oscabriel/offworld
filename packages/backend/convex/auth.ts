import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		baseURL: siteUrl,
		trustedOrigins: [siteUrl],
		database: authComponent.adapter(ctx),
		// Enable cookie caching to speed up session validation on client-side navigation
		// This avoids network requests for session validation by storing session data in a signed cookie
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60, // 5 minutes - short-lived cache that auto-refreshes
			},
		},
		socialProviders: {
			github: {
				enabled: true,
				clientId: process.env.GITHUB_CLIENT_ID!,
				clientSecret: process.env.GITHUB_CLIENT_SECRET!,
			},
		},
		plugins: [
			convex({
				authConfig,
				jwksRotateOnTokenGenerationError: true,
			}),
		],
	});
};

export const getCurrentUser = query({
	args: {},
	returns: v.any(),
	handler: async (ctx) => authComponent.getAuthUser(ctx),
});

export const getCurrentUserSafe = query({
	args: {},
	returns: v.any(),
	handler: async (ctx) => authComponent.safeGetAuthUser(ctx),
});

export async function safeGetUser(ctx: GenericCtx<DataModel>) {
	return await authComponent.safeGetAuthUser(ctx);
}

export async function getUser(ctx: GenericCtx<DataModel>) {
	const user = await authComponent.getAuthUser(ctx);
	if (!user) {
		throw new Error("Unauthorized");
	}
	return user;
}

function getAdminEmails(): string[] {
	const emails = process.env.ADMIN_EMAILS;
	if (!emails) return [];
	return emails.split(",").map((e) => e.trim().toLowerCase());
}

export async function requireAdmin(ctx: GenericCtx<DataModel>) {
	const user = await authComponent.getAuthUser(ctx);
	if (!user) throw new Error("Unauthorized");
	const adminEmails = getAdminEmails();
	if (!adminEmails.includes(user.email.toLowerCase())) {
		throw new Error("Admin access required");
	}
	return user;
}

export const isAdmin = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) return false;
		return getAdminEmails().includes(user.email.toLowerCase());
	},
});
