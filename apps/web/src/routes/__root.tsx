import "@/types/router";
import { convexQuery, type ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "@offworld/backend/convex/_generated/api";
import { useQueryClient } from "@tanstack/react-query";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import {
	AuthKitProvider,
	useAccessToken,
	useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { ConvexProviderWithAuth, useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BackgroundImage } from "@/components/layout/background-image";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Toaster } from "@/components/ui/sonner";

import { Footer } from "@/components/layout/footer";
import Header from "@/components/layout/header";
import appCss from "../index.css?url";

const fetchWorkosAuth = createServerFn({ method: "GET" }).handler(async () => {
	const auth = await getAuth();
	if (!auth.user) {
		return { initialAuth: null, workosId: null, token: null } as const;
	}
	return {
		initialAuth: auth,
		workosId: auth.user.id,
		token: auth.accessToken,
	} as const;
});

export interface RouterAppContext {
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}

const ROUTES_WITHOUT_FOOTER = ["/sign-in"];

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
				content: "One command. Every dependency. Every agent.",
			},
			// OpenGraph meta tags
			{
				property: "og:title",
				content: "OFFWORLD",
			},
			{
				property: "og:description",
				content: "One command. Every dependency. Every agent.",
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
				content: "One command. Every dependency. Every agent.",
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

	component: RootComponent,
	beforeLoad: async (ctx) => {
		const { initialAuth, workosId, token } = await fetchWorkosAuth();
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		await ctx.context.queryClient.ensureQueryData(convexQuery(api.auth.getCurrentUserSafe, {}));

		const showFooter = !ROUTES_WITHOUT_FOOTER.includes(ctx.location.pathname);

		return {
			initialAuth,
			isAuthenticated: !!token,
			workosId,
			token,
			showFooter,
		};
	},
});

function useAuthFromWorkOS() {
	const { user, loading } = useAuth();
	const { accessToken, getAccessToken } = useAccessToken();

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			if (!accessToken || forceRefreshToken) {
				return (await getAccessToken()) ?? null;
			}

			return accessToken;
		},
		[accessToken, getAccessToken],
	);

	return useMemo(
		() => ({
			isLoading: loading,
			isAuthenticated: !!user,
			fetchAccessToken,
		}),
		[loading, user, fetchAccessToken],
	);
}

function RootComponent() {
	const context = useRouteContext({ from: Route.id });

	return (
		<AuthKitProvider initialAuth={context.initialAuth ?? undefined}>
			<ConvexProviderWithAuth
				client={context.convexQueryClient.convexClient}
				useAuth={useAuthFromWorkOS}
			>
				<RootDocument token={context.token} showFooter={context.showFooter} />
			</ConvexProviderWithAuth>
		</AuthKitProvider>
	);
}

function ConnectionMonitor() {
	const convex = useConvex();
	const queryClient = useQueryClient();
	const [wasConnected, setWasConnected] = useState(true);
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		const checkConnection = () => {
			const state = convex.connectionState();
			const connected = state.isWebSocketConnected;

			if (!initialized && connected) {
				setInitialized(true);
				setWasConnected(true);
				return;
			}

			if (!connected && wasConnected) {
				console.warn("[Convex] WebSocket disconnected");
				setWasConnected(false);
			} else if (connected && !wasConnected) {
				console.info("[Convex] WebSocket reconnected, refreshing queries...");
				setWasConnected(true);
				void queryClient.invalidateQueries();
			}
		};

		const interval = setInterval(checkConnection, 1000);
		return () => clearInterval(interval);
	}, [convex, wasConnected, queryClient, initialized]);

	return null;
}

function RootDocument({ token, showFooter }: { token: string | null; showFooter: boolean }) {
	const ensureUser = useMutation(api.auth.ensureUser);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!token) return;
		void ensureUser({}).then(() => {
			void queryClient.invalidateQueries({
				queryKey: convexQuery(api.auth.getCurrentUserSafe, {}).queryKey,
			});
		});
	}, [token, ensureUser, queryClient]);

	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body className="relative flex min-h-screen flex-col">
				<ConnectionMonitor />
				<BackgroundImage />
				<div className="relative z-10 flex flex-1 flex-col">
					<Header />
					<Breadcrumbs />
					<main className="flex flex-1 flex-col pt-13">
						<Outlet />
					</main>
					{showFooter && <Footer />}
				</div>
				<Toaster richColors />
				<TanStackRouterDevtools position="bottom-left" />
				<Scripts />
			</body>
		</html>
	);
}
