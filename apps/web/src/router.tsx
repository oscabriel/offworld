import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexReactClient } from "convex/react";

import { ErrorComponent, NotFoundComponent } from "./components/error-boundary";
import Loader from "./components/loader";
import "./index.css";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const convexUrl = import.meta.env.VITE_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("VITE_CONVEX_URL is not set");
	}

	const convexClient = new ConvexReactClient(convexUrl);
	const convexQueryClient = new ConvexQueryClient(convexClient);

	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
				staleTime: Infinity, // Convex pushes updates reactively
				gcTime: 2 * 60 * 1000, // 2 minutes
			},
		},
	});
	convexQueryClient.connect(queryClient);

	const router = createTanStackRouter({
		routeTree,
		defaultPreload: "intent",
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		defaultPendingComponent: () => (
			<div className="flex flex-1 items-center justify-center">
				<Loader />
			</div>
		),
		defaultErrorComponent: ErrorComponent,
		defaultNotFoundComponent: NotFoundComponent,
		context: { queryClient, convexQueryClient },
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
