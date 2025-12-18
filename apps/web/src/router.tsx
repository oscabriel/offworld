import { ConvexQueryClient } from "@convex-dev/react-query";
import * as Sentry from "@sentry/tanstackstart-react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
import "./index.css";

export function getRouter() {
	// biome-ignore lint/style/noNonNullAssertion: VITE_CONVEX_URL required for auth
	const CONVEX_URL = import.meta.env.VITE_CONVEX_URL!;
	if (!CONVEX_URL) {
		throw new Error("VITE_CONVEX_URL is not set");
	}

	// Note: We do NOT use expectAuth: true because this app has public routes
	// that need to work for unauthenticated users. With expectAuth: true, the
	// WebSocket is paused until setAuth() is called, which never happens for
	// unauthenticated users, causing all client-side queries to hang forever.
	// SSR auth is still handled via serverHttpClient?.setAuth(token) in __root.tsx.
	const convexQueryClient = new ConvexQueryClient(CONVEX_URL);

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
		context: {
			queryClient,
			convexClient: convexQueryClient.convexClient,
			convexQueryClient,
		},
		scrollRestoration: true,
		// Note: ConvexProvider is handled by ConvexBetterAuthProvider in __root.tsx
		// Do not add a separate Wrap with ConvexProvider here as it will conflict
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	// Initialize Sentry (client-side only) - per official docs
	if (!router.isServer) {
		const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
		// Convert to string if it's an object (Vite sometimes does this)
		const dsnString =
			typeof SENTRY_DSN === "string" ? SENTRY_DSN : String(SENTRY_DSN || "");

		if (dsnString?.startsWith("https://")) {
			Sentry.init({
				dsn: dsnString,
				sendDefaultPii: true,
				integrations: [
					Sentry.tanstackRouterBrowserTracingIntegration(router),
					Sentry.replayIntegration(),
					Sentry.feedbackIntegration({
						colorScheme: "system",
						autoInject: false, // Manual control via Sentry.getFeedback()
					}),
					Sentry.consoleLoggingIntegration({
						levels: ["log", "warn", "error"],
					}),
				],
				// Enable logs to be sent to Sentry
				enableLogs: true,
				tracesSampleRate: 1.0,
				replaysSessionSampleRate: 0.1,
				replaysOnErrorSampleRate: 1.0,
				environment: import.meta.env.MODE,
				debug: false, // Disable debug logs in all environments
				// Use tunnel to bypass ad blockers
				tunnel: "/tunnel",
			});
		}
	}

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
