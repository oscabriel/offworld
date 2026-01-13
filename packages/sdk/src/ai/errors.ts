// Tagged error types with actionable hints for OpenCode integration

/**
 * Base class for OpenCode analysis errors
 */
export class OpenCodeAnalysisError extends Error {
	readonly _tag: string = "OpenCodeAnalysisError";
	constructor(
		message: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "OpenCodeAnalysisError";
	}
}

/**
 * Error when the @opencode-ai/sdk package is not installed
 */
export class OpenCodeSDKError extends OpenCodeAnalysisError {
	readonly _tag = "OpenCodeSDKError" as const;
	constructor() {
		super("Failed to import @opencode-ai/sdk. Install it with: bun add @opencode-ai/sdk");
		this.name = "OpenCodeSDKError";
	}
}

/**
 * Error when the requested provider is not found
 */
export class InvalidProviderError extends OpenCodeAnalysisError {
	readonly _tag = "InvalidProviderError" as const;
	readonly hint: string;

	constructor(
		public readonly providerID: string,
		public readonly availableProviders: string[],
	) {
		const hint =
			availableProviders.length > 0
				? `Available providers: ${availableProviders.join(", ")}`
				: "No providers available. Check your OpenCode configuration.";
		super(`Provider "${providerID}" not found. ${hint}`);
		this.name = "InvalidProviderError";
		this.hint = hint;
	}
}

/**
 * Error when the provider exists but is not connected/authenticated
 */
export class ProviderNotConnectedError extends OpenCodeAnalysisError {
	readonly _tag = "ProviderNotConnectedError" as const;
	readonly hint: string;

	constructor(
		public readonly providerID: string,
		public readonly connectedProviders: string[],
	) {
		const hint =
			connectedProviders.length > 0
				? `Connected providers: ${connectedProviders.join(", ")}. Run 'opencode auth ${providerID}' to connect.`
				: `No providers connected. Run 'opencode auth ${providerID}' to authenticate.`;
		super(`Provider "${providerID}" is not connected. ${hint}`);
		this.name = "ProviderNotConnectedError";
		this.hint = hint;
	}
}

/**
 * Error when the requested model is not found for a provider
 */
export class InvalidModelError extends OpenCodeAnalysisError {
	readonly _tag = "InvalidModelError" as const;
	readonly hint: string;

	constructor(
		public readonly modelID: string,
		public readonly providerID: string,
		public readonly availableModels: string[],
	) {
		const hint =
			availableModels.length > 0
				? `Available models for ${providerID}: ${availableModels.slice(0, 10).join(", ")}${availableModels.length > 10 ? ` (and ${availableModels.length - 10} more)` : ""}`
				: `No models available for provider "${providerID}".`;
		super(`Model "${modelID}" not found for provider "${providerID}". ${hint}`);
		this.name = "InvalidModelError";
		this.hint = hint;
	}
}

/**
 * Error when the OpenCode server fails to start
 */
export class ServerStartError extends OpenCodeAnalysisError {
	readonly _tag = "ServerStartError" as const;
	readonly hint: string;

	constructor(
		message: string,
		public readonly port?: number,
		details?: unknown,
	) {
		const hint = port
			? `Failed to start server on port ${port}. Ensure no other process is using this port.`
			: "Failed to start OpenCode server. Check your OpenCode installation and configuration.";
		super(`${message}. ${hint}`, details);
		this.name = "ServerStartError";
		this.hint = hint;
	}
}

/**
 * Error when a session operation fails
 */
export class SessionError extends OpenCodeAnalysisError {
	readonly _tag = "SessionError" as const;
	readonly hint: string;

	constructor(
		message: string,
		public readonly sessionId?: string,
		public readonly sessionState?: string,
		details?: unknown,
	) {
		const context = sessionId ? ` (session: ${sessionId})` : "";
		const stateInfo = sessionState ? ` State: ${sessionState}.` : "";
		const hint = `Session operation failed${context}.${stateInfo} Try creating a new session.`;
		super(`${message}. ${hint}`, details);
		this.name = "SessionError";
		this.hint = hint;
	}
}

/**
 * Error when a request times out
 */
export class TimeoutError extends OpenCodeAnalysisError {
	readonly _tag = "TimeoutError" as const;
	readonly hint: string;

	constructor(
		public readonly timeoutMs: number,
		public readonly operation: string = "operation",
	) {
		const hint = `The ${operation} did not complete within ${timeoutMs}ms. Consider increasing the timeout or checking if the model is responding.`;
		super(`Timeout: ${operation} did not complete within ${timeoutMs}ms. ${hint}`);
		this.name = "TimeoutError";
		this.hint = hint;
	}
}
