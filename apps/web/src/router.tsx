import { ConvexQueryClient } from "@convex-dev/react-query";
import { env } from "@offworld/env/web";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import {
	AuthKitProvider,
	useAccessToken,
	useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

import Loader from "./components/loader";
import "./index.css";
import { routeTree } from "./routeTree.gen";

function useAuthFromWorkOS() {
	const { user, loading } = useAuth();
	const { getAccessToken, loading: tokenLoading } = useAccessToken();

	return {
		isLoading: loading || tokenLoading,
		isAuthenticated: !!user,
		fetchAccessToken: async (_args: { forceRefreshToken: boolean }) => {
			const token = await getAccessToken();
			return token ?? null;
		},
	};
}

function Wrap({
	children,
	client,
}: {
	children: ReactNode;
	client: ConvexReactClient;
}) {
	return (
		<AuthKitProvider>
			<ConvexProviderWithAuth client={client} useAuth={useAuthFromWorkOS}>
				{children}
			</ConvexProviderWithAuth>
		</AuthKitProvider>
	);
}

export function getRouter() {
	const convexUrl = env.VITE_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("VITE_CONVEX_URL is not set");
	}

	const convexQueryClient = new ConvexQueryClient(convexUrl);

	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
			},
		},
	});
	convexQueryClient.connect(queryClient);

	const router = createTanStackRouter({
		routeTree,
		defaultPreload: "intent",
		defaultPendingComponent: () => <Loader />,
		defaultNotFoundComponent: () => <div>Not Found</div>,
		context: { queryClient, convexQueryClient },
		Wrap: ({ children }) => (
			<Wrap client={convexQueryClient.convexClient}>{children}</Wrap>
		),
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
