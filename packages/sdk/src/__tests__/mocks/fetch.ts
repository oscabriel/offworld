/**
 * Mock for fetch API calls
 * Used to test sync.ts and AI provider detection without network requests
 */

import { vi, type Mock } from "vitest";

export interface FetchResponse {
	status: number;
	ok: boolean;
	json?: () => Promise<unknown>;
	text?: () => Promise<string>;
	headers?: Headers;
}

export interface FetchMockRoute {
	/** URL pattern (string for exact match, RegExp for pattern) */
	url: string | RegExp;
	/** HTTP method (default: GET) */
	method?: string;
	/** Response to return */
	response:
		| FetchResponse
		| ((url: string, init?: RequestInit) => FetchResponse | Promise<FetchResponse>);
}

let routes: FetchMockRoute[] = [];
let fetchMock: Mock | null = null;

/**
 * Create a mock fetch function
 */
export function createFetchMock(): Mock {
	fetchMock = vi.fn(async (input: string | Request, init?: RequestInit): Promise<Response> => {
		const url = typeof input === "string" ? input : input.url;
		const method = init?.method ?? "GET";

		// Find matching route
		for (const route of routes) {
			const urlMatches =
				typeof route.url === "string"
					? url === route.url || url.includes(route.url)
					: route.url.test(url);

			const methodMatches = !route.method || route.method.toUpperCase() === method.toUpperCase();

			if (urlMatches && methodMatches) {
				const response =
					typeof route.response === "function" ? await route.response(url, init) : route.response;

				return createMockResponse(response);
			}
		}

		// No matching route - return 404
		return createMockResponse({
			status: 404,
			ok: false,
			json: () => Promise.resolve({ error: "Not found" }),
		});
	});

	return fetchMock;
}

/**
 * Create a Response-like object from FetchResponse
 */
function createMockResponse(response: FetchResponse): Response {
	return {
		status: response.status,
		ok: response.ok,
		statusText: response.ok ? "OK" : "Error",
		headers: response.headers ?? new Headers(),
		json: response.json ?? (() => Promise.resolve({})),
		text: response.text ?? (() => Promise.resolve("")),
		blob: () => Promise.resolve(new Blob([])),
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		formData: () => Promise.resolve(new FormData()),
		clone: () => createMockResponse(response),
		body: null,
		bodyUsed: false,
		redirected: false,
		type: "basic",
		url: "",
	} as Response;
}

/**
 * Add a route to the fetch mock
 */
export function addFetchRoute(route: FetchMockRoute): void {
	routes.push(route);
}

/**
 * Clear all fetch routes
 */
export function clearFetchRoutes(): void {
	routes = [];
}

/**
 * Reset fetch mock completely
 */
export function resetFetchMock(): void {
	routes = [];
	if (fetchMock) {
		fetchMock.mockClear();
	}
}

/**
 * Install the fetch mock globally
 */
export function installFetchMock(): Mock {
	const mock = createFetchMock();
	vi.stubGlobal("fetch", mock);
	return mock;
}

// ============================================================================
// Pre-built mock responses for common scenarios
// ============================================================================

/**
 * Mock response for offworld.sh API pull endpoint
 */
export function mockOffworldPullResponse(analysis: {
	fullName: string;
	summary: string;
	architecture: object;
	skill: string;
	commitSha: string;
	analyzedAt: string;
}): FetchMockRoute {
	return {
		url: "/api/analyses/pull",
		method: "POST",
		response: {
			status: 200,
			ok: true,
			json: () => Promise.resolve(analysis),
		},
	};
}

/**
 * Mock response for offworld.sh API check endpoint
 */
export function mockOffworldCheckResponse(
	exists: boolean,
	meta?: { commitSha: string; analyzedAt: string },
): FetchMockRoute {
	return {
		url: "/api/analyses/check",
		method: "POST",
		response: {
			status: 200,
			ok: true,
			json: () => Promise.resolve(exists ? { exists: true, ...meta } : { exists: false }),
		},
	};
}

/**
 * Mock response for GitHub API stars endpoint
 */
export function mockGitHubStarsResponse(
	owner: string,
	repo: string,
	stars: number,
): FetchMockRoute {
	return {
		url: new RegExp(`api\\.github\\.com/repos/${owner}/${repo}$`),
		method: "GET",
		response: {
			status: 200,
			ok: true,
			json: () =>
				Promise.resolve({
					stargazers_count: stars,
					full_name: `${owner}/${repo}`,
				}),
		},
	};
}

/**
 * Mock response for OpenCode health check
 */
export function mockOpenCodeHealthResponse(healthy: boolean): FetchMockRoute {
	return {
		url: "localhost:4096/health",
		method: "GET",
		response: healthy
			? {
					status: 200,
					ok: true,
					json: () => Promise.resolve({ status: "ok" }),
				}
			: {
					status: 503,
					ok: false,
					json: () => Promise.resolve({ error: "unavailable" }),
				},
	};
}
