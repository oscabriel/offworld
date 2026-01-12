// Streaming OpenCode API - Markdown templates instead of JSON schemas

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

export class OpenCodeAnalysisError extends Error {
	constructor(
		message: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "OpenCodeAnalysisError";
	}
}

export class OpenCodeSDKError extends OpenCodeAnalysisError {
	constructor() {
		super("Failed to import @opencode-ai/sdk. Install it with: bun add @opencode-ai/sdk");
		this.name = "OpenCodeSDKError";
	}
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
}

interface OpenCodeConfig {
	plugin?: unknown[];
	mcp?: Record<string, unknown>;
	instructions?: unknown[];
	agent?: {
		build?: { disable: boolean };
		explore?: { disable: boolean };
		general?: { disable: boolean };
		plan?: { disable: boolean };
		docs?: {
			prompt?: string;
			description?: string;
			permission?: Record<string, string>;
			mode?: string;
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

	// Minimal config - just disable plugins and MCP to prevent injection
	const config: OpenCodeConfig = {
		plugin: [],
		mcp: {},
		instructions: [],
	};

	debug("Starting embedded OpenCode server...");

	const isolatedConfigDir = `/tmp/ow-opencode-isolated-${Date.now()}`;
	const savedEnv = {
		XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
		XDG_DATA_HOME: process.env.XDG_DATA_HOME,
	};

	try {
		const { mkdirSync, writeFileSync, existsSync, cpSync } = await import("node:fs");
		const { join } = await import("node:path");

		mkdirSync(join(isolatedConfigDir, "opencode"), { recursive: true });
		const isolatedConfig = { $schema: "https://opencode.ai/config.json", plugin: [], mcp: {} };
		writeFileSync(
			join(isolatedConfigDir, "opencode", "opencode.json"),
			JSON.stringify(isolatedConfig),
		);

		const realDataDir =
			process.env.XDG_DATA_HOME || join(process.env.HOME || "", ".local", "share");
		const realAuthFile = join(realDataDir, "opencode", "auth.json");

		const isolatedDataDir = join(isolatedConfigDir, ".local", "share", "opencode");
		mkdirSync(isolatedDataDir, { recursive: true, mode: 0o700 });
		if (existsSync(realAuthFile)) {
			cpSync(realAuthFile, join(isolatedDataDir, "auth.json"));
		}

		process.env.XDG_CONFIG_HOME = isolatedConfigDir;
		process.env.XDG_DATA_HOME = join(isolatedConfigDir, ".local", "share");
	} catch (fsErr) {
		debug(`Warning: Could not create isolated config: ${fsErr}`);
	}

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
			throw new OpenCodeAnalysisError("Failed to start OpenCode server", err);
		}
	}

	if (!server || !client) {
		throw new OpenCodeAnalysisError("Failed to start OpenCode server after all attempts");
	}

	try {
		debug("Creating session...");
		const sessionResult = await client.session.create();
		if (sessionResult.error) {
			throw new OpenCodeAnalysisError("Failed to create session", sessionResult.error);
		}
		const sessionId = sessionResult.data.id;
		debug(`Session created: ${sessionId}`);

		debug("Subscribing to events...");
		const { stream: eventStream } = await client.event.subscribe();

		const fullPrompt = systemPrompt
			? `${systemPrompt}\n\nAnalyzing codebase at: ${cwd}\n\n${prompt}`
			: `Analyzing codebase at: ${cwd}\n\n${prompt}`;

		debug("Sending prompt...");
		const promptPromise = client.session.prompt({
			path: { id: sessionId },
			body: {
				agent: "build",
				parts: [{ type: "text", text: fullPrompt }],
				model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
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
					throw new OpenCodeAnalysisError(errorProps?.name ?? "Unknown session error", props.error);
				}
			}
			return Array.from(textParts.values()).join("");
		};

		let responseText: string;
		if (timeoutMs && timeoutMs > 0) {
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(
						new OpenCodeAnalysisError(
							`timeout: no session.idle event received within ${timeoutMs}ms`,
						),
					);
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

		// Clean up isolated config dir containing auth.json
		try {
			const { rmSync } = await import("node:fs");
			rmSync(isolatedConfigDir, { recursive: true, force: true });
		} catch {
			/* ignore cleanup errors */
		}

		if (savedEnv.XDG_CONFIG_HOME !== undefined) {
			process.env.XDG_CONFIG_HOME = savedEnv.XDG_CONFIG_HOME;
		} else {
			delete process.env.XDG_CONFIG_HOME;
		}
		if (savedEnv.XDG_DATA_HOME !== undefined) {
			process.env.XDG_DATA_HOME = savedEnv.XDG_DATA_HOME;
		} else {
			delete process.env.XDG_DATA_HOME;
		}
	}
}
