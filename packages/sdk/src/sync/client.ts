import type { ConvexHttpClient } from "convex/browser";

export class SyncUnavailableError extends Error {
	constructor(
		message = "Sync requires the 'convex' package. Install it to use @offworld/sdk/sync.",
	) {
		super(message);
		this.name = "SyncUnavailableError";
	}
}

async function loadConvexModule(): Promise<typeof import("convex/browser")> {
	try {
		return await import("convex/browser");
	} catch (error) {
		const err = error as { code?: string };
		if (err?.code === "ERR_MODULE_NOT_FOUND") {
			throw new SyncUnavailableError();
		}
		throw error;
	}
}

export async function getConvexClient(url: string, token?: string): Promise<ConvexHttpClient> {
	const { ConvexHttpClient } = await loadConvexModule();
	const client = new ConvexHttpClient(url);
	if (token) client.setAuth(token);
	return client;
}
