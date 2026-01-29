import {
	OpenCodeReferenceError,
	OpenCodeSDKError,
	InvalidProviderError,
	ProviderNotConnectedError,
	InvalidModelError,
	ServerStartError,
	SessionError,
	TimeoutError,
} from "./errors.js";
import { TextAccumulator, parseStreamEvent, isEventForSession } from "./stream/index.js";

export const DEFAULT_AI_PROVIDER = "opencode";
export const DEFAULT_AI_MODEL = "claude-opus-4-5";

export interface StreamPromptOptions {
	prompt: string;
	cwd: string;
	systemPrompt?: string;
	provider?: string;

	model?: string;
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

interface AgentConfig {
	disable?: boolean;
	prompt?: string;
	description?: string;
	mode?: string;
	permission?: Record<string, string>;
	tools?: Record<string, boolean>;
}

interface OpenCodeConfig {
	plugin?: unknown[];
	mcp?: Record<string, unknown>;
	instructions?: unknown[];
	agent?: Record<string, AgentConfig>;
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
		if (
			typeof sdk.createOpencode !== "function" ||
			typeof sdk.createOpencodeClient !== "function"
		) {
			throw new OpenCodeSDKError("SDK missing required exports");
		}
		cachedCreateOpencode = sdk.createOpencode as CreateOpencodeFn;
		cachedCreateOpencodeClient = sdk.createOpencodeClient as CreateOpencodeClientFn;
		return {
			createOpencode: cachedCreateOpencode,
			createOpencodeClient: cachedCreateOpencodeClient,
		};
	} catch (error) {
		if (error instanceof OpenCodeSDKError) {
			throw error;
		}
		throw new OpenCodeSDKError();
	}
}

interface ToolRunningState {
	status: "running";
	title?: string;
	input?: unknown;
}

function formatToolMessage(tool: string | undefined, state: ToolRunningState): string | null {
	if (state.title) {
		return state.title;
	}

	if (!tool) {
		return null;
	}

	const input =
		state.input && typeof state.input === "object" && !Array.isArray(state.input)
			? (state.input as Record<string, unknown>)
			: undefined;
	if (!input) {
		return `Running ${tool}...`;
	}

	switch (tool) {
		case "read": {
			const path = input.filePath ?? input.path;
			if (typeof path === "string") {
				const filename = path.split("/").pop();
				return `Reading ${filename}...`;
			}
			return "Reading file...";
		}
		case "glob": {
			const pattern = input.pattern;
			if (typeof pattern === "string") {
				return `Globbing ${pattern}...`;
			}
			return "Searching files...";
		}
		case "grep": {
			const pattern = input.pattern;
			if (typeof pattern === "string") {
				const truncated = pattern.length > 30 ? `${pattern.slice(0, 30)}...` : pattern;
				return `Searching for "${truncated}"...`;
			}
			return "Searching content...";
		}
		case "list": {
			const path = input.path;
			if (typeof path === "string") {
				return `Listing ${path}...`;
			}
			return "Listing directory...";
		}
		default:
			return `Running ${tool}...`;
	}
}

export async function streamPrompt(options: StreamPromptOptions): Promise<StreamPromptResult> {
	const {
		prompt,
		cwd,
		systemPrompt,
		provider: optProvider,
		model: optModel,
		timeoutMs,
		onDebug,
		onStream,
	} = options;

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
			explore: { disable: true },
			analyze: {
				prompt: [
					"You are an expert at analyzing open source codebases and producing documentation.",
					"",
					"Your job is to read the codebase and produce structured output based on the user's request.",
					"Use glob to discover files, grep to search for patterns, and read to examine file contents.",
					"",
					"Guidelines:",
					"- Explore the codebase thoroughly before producing output",
					"- Focus on understanding architecture, key abstractions, and usage patterns",
					"- When asked for JSON output, respond with ONLY valid JSON - no markdown, no code blocks",
					"- When asked for prose, write clear and concise documentation",
					"- Always base your analysis on actual code you've read, never speculate",
				].join("\n"),
				mode: "primary",
				description: "Analyze open source codebases and produce summaries and reference files",
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

	const providerID = optProvider ?? DEFAULT_AI_PROVIDER;
	const modelID = optModel ?? DEFAULT_AI_MODEL;

	try {
		debug("Creating session...");
		const sessionResult = await client.session.create();
		if (sessionResult.error) {
			throw new SessionError("Failed to create session", undefined, undefined, sessionResult.error);
		}
		const sessionId = sessionResult.data.id;
		debug(`Session created: ${sessionId}`);

		debug("Validating provider and model...");
		const providerResult = await client.provider.list();
		if (providerResult.error) {
			throw new OpenCodeReferenceError("Failed to fetch provider list", providerResult.error);
		}

		const { all: allProviders, connected: connectedProviders } = providerResult.data;
		const allProviderIds = allProviders.map((p) => p.id);

		const provider = allProviders.find((p) => p.id === providerID);
		if (!provider) {
			throw new InvalidProviderError(providerID, allProviderIds);
		}

		if (!connectedProviders.includes(providerID)) {
			throw new ProviderNotConnectedError(providerID, connectedProviders);
		}

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
				agent: "analyze",
				parts: [{ type: "text", text: fullPrompt }],
				model: { providerID, modelID },
			},
		});

		const textAccumulator = new TextAccumulator();
		debug("Waiting for response...");

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const processEvents = async (): Promise<string> => {
			for await (const event of eventStream) {
				if (!isEventForSession(event, sessionId)) {
					continue;
				}

				const parsed = parseStreamEvent(event);

				switch (parsed.type) {
					case "message.part.updated": {
						if (parsed.toolPart?.state) {
							const { state, tool } = parsed.toolPart;
							if (state.status === "running") {
								const message = formatToolMessage(tool, state);
								if (message) {
									debug(message);
								}
							}
						}
						if (parsed.textPart) {
							const delta = textAccumulator.accumulatePart(parsed.textPart);
							if (!textAccumulator.hasReceivedText) {
								debug("Writing reference...");
							}
							if (delta) {
								stream(delta);
							}
						}
						break;
					}

					case "session.idle": {
						if (parsed.props.sessionID === sessionId) {
							debug("Response complete");
							return textAccumulator.getFullText();
						}
						break;
					}

					case "session.error": {
						if (parsed.props.sessionID === sessionId) {
							const errorName = parsed.error?.name ?? "Unknown session error";
							debug(`Session error: ${JSON.stringify(parsed.props.error)}`);
							throw new SessionError(errorName, sessionId, "error", parsed.props.error);
						}
						break;
					}

					case "unknown":
						break;
				}
			}
			return textAccumulator.getFullText();
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
			throw new OpenCodeReferenceError("No response received from OpenCode");
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
