// Streaming OpenCode API - Markdown templates instead of JSON schemas

import {
	OpenCodeAnalysisError,
	OpenCodeSDKError,
	InvalidProviderError,
	ProviderNotConnectedError,
	InvalidModelError,
	ServerStartError,
	SessionError,
	TimeoutError,
} from "./errors.js";

// Re-export error types for backwards compatibility
export {
	OpenCodeAnalysisError,
	OpenCodeSDKError,
	InvalidProviderError,
	ProviderNotConnectedError,
	InvalidModelError,
	ServerStartError,
	SessionError,
	TimeoutError,
} from "./errors.js";

export interface StreamPromptOptions {
	prompt: string;
	cwd: string;
	systemPrompt?: string;
	/** Timeout in milliseconds. Set to 0 or undefined for no timeout. */
	timeoutMs?: number;
	onDebug?: (message: string) => void;
	onStream?: (text: string) => void;
}

export interface StreamPromptResult {
	text: string;
	sessionId: string;
	durationMs: number;
}

interface OpenCodeServer {
	close: () => void;
	url: string;
}

interface OpenCodeSession {
	id: string;
}

interface OpenCodeEvent {
	type: string;
	properties: Record<string, unknown>;
}

interface OpenCodeProviderModel {
	id: string;
	name: string;
}

interface OpenCodeProvider {
	id: string;
	name: string;
	models: Record<string, OpenCodeProviderModel>;
}

interface OpenCodeProviderListResponse {
	all: OpenCodeProvider[];
	connected: string[];
	default: Record<string, string>;
}

interface OpenCodeClient {
	session: {
		create: () => Promise<{ data: OpenCodeSession; error?: unknown }>;
		prompt: (options: {
			path: { id: string };
			body: {
				agent?: string;
				parts: Array<{ type: string; text: string }>;
				model?: { providerID: string; modelID: string };
			};
		}) => Promise<{ data: unknown; error?: unknown }>;
	};
	event: {
		subscribe: () => Promise<{
			stream: AsyncIterable<OpenCodeEvent>;
		}>;
	};
	provider: {
		list: () => Promise<{ data: OpenCodeProviderListResponse; error?: unknown }>;
	};
}

interface OpenCodeConfig {
	plugin?: unknown[];
	mcp?: Record<string, unknown>;
	instructions?: unknown[];
	agent?: {
		build?: { disable: boolean };
		general?: { disable: boolean };
		plan?: { disable: boolean };
		explore?: {
			disable?: boolean;
			prompt?: string;
			description?: string;
			mode?: string;
			permission?: Record<string, string>;
			tools?: Record<string, boolean>;
		};
	};
}

type CreateOpencodeResult = { server: OpenCodeServer };
type CreateOpencodeClientFn = (opts: { baseUrl: string; directory: string }) => OpenCodeClient;
type CreateOpencodeFn = (opts: {
	port: number;
	cwd?: string;
	config?: OpenCodeConfig;
}) => Promise<CreateOpencodeResult>;

let cachedCreateOpencode: CreateOpencodeFn | null = null;
let cachedCreateOpencodeClient: CreateOpencodeClientFn | null = null;

async function getOpenCodeSDK(): Promise<{
	createOpencode: CreateOpencodeFn;
	createOpencodeClient: CreateOpencodeClientFn;
}> {
	if (cachedCreateOpencode && cachedCreateOpencodeClient) {
		return {
			createOpencode: cachedCreateOpencode,
			createOpencodeClient: cachedCreateOpencodeClient,
		};
	}

	try {
		const sdk = await import("@opencode-ai/sdk");
		cachedCreateOpencode = sdk.createOpencode as CreateOpencodeFn;
		cachedCreateOpencodeClient = sdk.createOpencodeClient as CreateOpencodeClientFn;
		return {
			createOpencode: cachedCreateOpencode,
			createOpencodeClient: cachedCreateOpencodeClient,
		};
	} catch {
		throw new OpenCodeSDKError();
	}
}

/**
 * Stream a prompt to OpenCode and return raw text response.
 * No JSON parsing - just returns whatever the AI produces.
 */
export async function streamPrompt(options: StreamPromptOptions): Promise<StreamPromptResult> {
	const { prompt, cwd, systemPrompt, timeoutMs, onDebug, onStream } = options;

	const debug = onDebug ?? (() => {});
	const stream = onStream ?? (() => {});
	const startTime = Date.now();

	debug("Loading OpenCode SDK...");
	const { createOpencode, createOpencodeClient } = await getOpenCodeSDK();

	const maxAttempts = 10;
	let server: OpenCodeServer | null = null;
	let client: OpenCodeClient | null = null;
	let port = 0;

	const config: OpenCodeConfig = {
		plugin: [],
		mcp: {},
		instructions: [],
		agent: {
			build: { disable: true },
			general: { disable: true },
			plan: { disable: true },
			explore: {
				prompt: [
					"You are a codebase documentation expert.",
					"Analyze the codebase using read, grep, glob tools.",
					"Output ONLY valid JSON matching the exact schema provided.",
					"No markdown, no code blocks, no explanations - raw JSON only.",
				].join("\n"),
				mode: "primary",
				description: "Analyze code and generate structured documentation",
				tools: {
					read: true,
					grep: true,
					glob: true,
					list: true,
					write: false,
					bash: false,
					delete: false,
					edit: false,
					patch: false,
					path: false,
					todowrite: false,
					todoread: false,
					websearch: false,
					webfetch: false,
					codesearch: false,
					skill: false,
					task: false,
					mcp: false,
					question: false,
					plan_enter: false,
					plan_exit: false,
				},
				permission: {
					edit: "deny",
					bash: "deny",
					webfetch: "deny",
					external_directory: "deny",
				},
			},
		},
	};

	debug("Starting embedded OpenCode server...");

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		port = Math.floor(Math.random() * 3000) + 3000;
		try {
			const result = await createOpencode({ port, cwd, config });
			server = result.server;
			client = createOpencodeClient({
				baseUrl: `http://localhost:${port}`,
				directory: cwd,
			});
			debug(`Server started on port ${port}`);
			break;
		} catch (err) {
			if (err instanceof Error && err.message?.includes("port")) {
				continue;
			}
			throw new ServerStartError("Failed to start OpenCode server", port, err);
		}
	}

	if (!server || !client) {
		throw new ServerStartError("Failed to start OpenCode server after all attempts");
	}

	// Default model configuration
	const providerID = "anthropic";
	const modelID = "claude-sonnet-4-20250514";

	try {
		debug("Creating session...");
		const sessionResult = await client.session.create();
		if (sessionResult.error) {
			throw new SessionError("Failed to create session", undefined, undefined, sessionResult.error);
		}
		const sessionId = sessionResult.data.id;
		debug(`Session created: ${sessionId}`);

		// Validate provider and model before sending prompt
		debug("Validating provider and model...");
		const providerResult = await client.provider.list();
		if (providerResult.error) {
			throw new OpenCodeAnalysisError("Failed to fetch provider list", providerResult.error);
		}

		const { all: allProviders, connected: connectedProviders } = providerResult.data;
		const allProviderIds = allProviders.map((p) => p.id);

		// Check if provider exists
		const provider = allProviders.find((p) => p.id === providerID);
		if (!provider) {
			throw new InvalidProviderError(providerID, allProviderIds);
		}

		// Check if provider is connected
		if (!connectedProviders.includes(providerID)) {
			throw new ProviderNotConnectedError(providerID, connectedProviders);
		}

		// Check if model exists for this provider
		const availableModelIds = Object.keys(provider.models);
		if (!provider.models[modelID]) {
			throw new InvalidModelError(modelID, providerID, availableModelIds);
		}

		debug(`Provider "${providerID}" and model "${modelID}" validated`);

		debug("Subscribing to events...");
		const { stream: eventStream } = await client.event.subscribe();

		const fullPrompt = systemPrompt
			? `${systemPrompt}\n\nAnalyzing codebase at: ${cwd}\n\n${prompt}`
			: `Analyzing codebase at: ${cwd}\n\n${prompt}`;

		debug("Sending prompt...");
		const promptPromise = client.session.prompt({
			path: { id: sessionId },
			body: {
				agent: "explore",
				parts: [{ type: "text", text: fullPrompt }],
				model: { providerID, modelID },
			},
		});

		const textParts = new Map<string, string>();
		let firstTextReceived = false;
		debug("Waiting for response...");

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const processEvents = async (): Promise<string> => {
			for await (const event of eventStream) {
				const props = event.properties;

				if ("sessionID" in props && props.sessionID !== sessionId) {
					continue;
				}

				if (event.type === "message.part.updated") {
					const part = props.part as { id?: string; type: string; text?: string } | undefined;
					const partId = part?.id ?? "";
					if (part?.type === "text" && part.text && partId) {
						const prevText = textParts.get(partId) ?? "";
						textParts.set(partId, part.text);
						if (!firstTextReceived) {
							debug("Receiving response...");
							firstTextReceived = true;
						}
						if (part.text.length > prevText.length) {
							stream(part.text.slice(prevText.length));
						}
					}
				}

				if (event.type === "session.idle" && props.sessionID === sessionId) {
					debug("Response complete");
					break;
				}

				if (event.type === "session.error" && props.sessionID === sessionId) {
					const errorProps = props.error as { name?: string } | undefined;
					debug(`Session error: ${JSON.stringify(props.error)}`);
					throw new SessionError(
						errorProps?.name ?? "Unknown session error",
						sessionId,
						"error",
						props.error,
					);
				}
			}
			return Array.from(textParts.values()).join("");
		};

		let responseText: string;
		if (timeoutMs && timeoutMs > 0) {
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new TimeoutError(timeoutMs, "session response"));
				}, timeoutMs);
			});
			responseText = await Promise.race([processEvents(), timeoutPromise]);
			if (timeoutId) clearTimeout(timeoutId);
		} else {
			responseText = await processEvents();
		}

		await promptPromise;

		if (!responseText) {
			throw new OpenCodeAnalysisError("No response received from OpenCode");
		}

		debug(`Response received (${responseText.length} chars)`);

		const durationMs = Date.now() - startTime;
		debug(`Complete in ${durationMs}ms`);

		return {
			text: responseText,
			sessionId,
			durationMs,
		};
	} finally {
		debug("Closing server...");
		server.close();
	}
}
