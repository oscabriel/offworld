import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
	fetchSession,
	getCookieName,
} from "@convex-dev/better-auth/react-start";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { createAuth } from "@offworld/backend/convex/auth";
import * as Sentry from "@sentry/tanstackstart-react";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	ErrorComponent,
	HeadContent,
	Outlet,
	Scripts,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import type { ConvexReactClient } from "convex/react";
import { useEffect } from "react";
import { BackgroundImage } from "@/components/layout/background-image";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import appCss from "../index.css?url";

const fetchAuth = createServerFn({ method: "GET" }).handler(async () => {
	const { session } = await fetchSession(getRequest());
	const sessionCookieName = getCookieName(createAuth);
	const token = getCookie(sessionCookieName);
	return {
		userId: session?.user.id,
		token,
	};
});

export interface RouterAppContext {
	queryClient: QueryClient;
	convexClient: ConvexReactClient;
	convexQueryClient: ConvexQueryClient;
}

function DefaultErrorBoundary({ error }: { error: Error }) {
	const router = useRouter();

	// Report error to Sentry - per official docs
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<div className="container mx-auto px-4 py-16">
			<ErrorComponent error={error} />
			<Button
				variant="outline"
				onClick={() => router.invalidate()}
				className="mt-4 bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
			>
				Try Again
			</Button>
		</div>
	);
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

	errorComponent: DefaultErrorBoundary,
	component: RootDocument,
	beforeLoad: async (ctx) => {
		const { userId, token } = await fetchAuth();
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}
		return { userId, token };
	},
});

function RootDocument() {
	const context = useRouteContext({ from: Route.id });
	return (
		<ConvexBetterAuthProvider
			client={context.convexClient}
			authClient={authClient}
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
