import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { createAuth } from "./auth";
import { APIError } from "better-auth/api";

const CLIENT_ID = process.env.DEVICE_AUTHORIZATION_CLIENT_ID;

function validateClientId(clientId: string) {
	if (!CLIENT_ID) throw new ConvexError("Device auth not configured");
	if (clientId !== CLIENT_ID) throw new ConvexError("Invalid client_id");
}

export const requestDeviceCode = mutation({
	args: { clientId: v.string() },
	async handler(ctx, { clientId }) {
		validateClientId(clientId);
		const auth = createAuth(ctx);

		const data = await auth.api.deviceCode({
			body: {
				client_id: clientId,
				scope: "cli",
			},
		});

		return data;
	},
});

export const getDeviceCodeStatus = query({
	args: { deviceCode: v.string(), clientId: v.string() },
	async handler(ctx, { deviceCode, clientId }) {
		validateClientId(clientId);

		const deviceCodeData = await ctx.db
			.query("deviceCode")
			.withIndex("by_deviceCode", (q) => q.eq("deviceCode", deviceCode))
			.first();

		return deviceCodeData?.status ?? "unknown";
	},
});

export const createDeviceToken = mutation({
	args: { deviceCode: v.string(), clientId: v.string() },
	async handler(ctx, { deviceCode, clientId }) {
		validateClientId(clientId);
		const auth = createAuth(ctx);

		try {
			const data = await auth.api.deviceToken({
				body: {
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
					device_code: deviceCode,
					client_id: clientId,
				},
			});

			return data;
		} catch (error) {
			if (error instanceof APIError) {
				throw new ConvexError(`${error.status}: ${error.message}`);
			}
			throw error;
		}
	},
});
