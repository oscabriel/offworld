import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";

import { BackgroundImage } from "@/components/layout/background-image";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";

import Header from "@/components/layout/header";
import appCss from "../index.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return await getToken();
});

export interface RouterAppContext {
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "offworld",
			},
			{
				name: "description",
				content: "Explore distant code.",
			},
			// OpenGraph meta tags
			{
				property: "og:title",
				content: "OFFWORLD",
			},
			{
				property: "og:description",
				content: "Explore distant code.",
			},
			{
				property: "og:image",
				content: "https://offworld.sh/opengraph-image.png",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:url",
				content: "https://offworld.sh",
			},
			// Twitter Card meta tags
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: "OFFWORLD",
			},
			{
				name: "twitter:description",
				content: "Explore distant code.",
			},
			{
				name: "twitter:image",
				content: "https://offworld.sh/opengraph-image.png",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			// Favicon
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
			// Preload critical images
			{
				rel: "preload",
				as: "image",
				href: "/background-image.png",
			},
			{
				rel: "preload",
				as: "image",
				href: "/logotype.svg",
			},
			{
				rel: "preload",
				as: "image",
				href: "/logotype-mobile.svg",
			},
			{
				rel: "preload",
				as: "image",
				href: "/favicon.svg",
			},
			// Google Fonts - Sorts Mill Goudy & Geist Mono
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Sorts+Mill+Goudy:ital@0;1&family=Geist+Mono:wght@300;400;500;600&display=swap",
			},
		],
	}),

	component: RootDocument,
	beforeLoad: async (ctx) => {
		const token = await getAuth();
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}
		return {
			isAuthenticated: !!token,
			token,
		};
	},
});

function RootDocument() {
	const context = useRouteContext({ from: Route.id });
	return (
		<ConvexBetterAuthProvider
			client={context.convexQueryClient.convexClient}
			authClient={authClient}
			initialToken={context.token}
		>
			<html lang="en" className="dark">
				<head>
					<HeadContent />
				</head>
				<body className="relative min-h-screen">
					<BackgroundImage />
					<div className="relative z-10">
						<Header />
						<Outlet />
					</div>
					<Toaster richColors />
					<TanStackRouterDevtools position="bottom-left" />
					<Scripts />
				</body>
			</html>
		</ConvexBetterAuthProvider>
	);
}
