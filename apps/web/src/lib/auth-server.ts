import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const {
	handler,
	getToken,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = convexBetterAuthReactStart({
	// biome-ignore lint/style/noNonNullAssertion: required env var
	convexUrl: process.env.VITE_CONVEX_URL!,
	// biome-ignore lint/style/noNonNullAssertion: required env var
	convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
});
