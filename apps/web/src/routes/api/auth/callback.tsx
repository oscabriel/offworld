import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/api/auth/callback")({
	server: {
		handlers: {
			GET: handleCallbackRoute({
				onError: () =>
					new Response(JSON.stringify({ error: "Authentication failed" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
			}),
			POST: handleCallbackRoute({
				onError: () =>
					new Response(JSON.stringify({ error: "Authentication failed" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
			}),
		},
	},
});
