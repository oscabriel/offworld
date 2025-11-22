import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tunnel")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					// Extract the DSN from the request body or use env var
					const dsnString = process.env.VITE_SENTRY_DSN;

					if (!dsnString) {
						return new Response("Sentry DSN not configured", { status: 400 });
					}

					// Parse the DSN to get the project ID and host
					const dsnUrl = new URL(dsnString);
					const projectId = dsnUrl.pathname.substring(1); // Remove leading slash
					const sentryHost = dsnUrl.host;

					// Get the envelope from the request body
					const body = await request.text();

					// Construct the Sentry ingest URL
					const sentryUrl = `https://${sentryHost}/api/${projectId}/envelope/`;

					// Forward the request to Sentry
					const response = await fetch(sentryUrl, {
						method: "POST",
						headers: {
							"Content-Type": "application/x-sentry-envelope",
						},
						body: body,
					});

					// Return the response from Sentry
					return new Response(response.body, {
						status: response.status,
						headers: {
							"Content-Type": "application/json",
						},
					});
				} catch (error) {
					return new Response("Tunnel error", { status: 500 });
				}
			},
		},
	},
});
