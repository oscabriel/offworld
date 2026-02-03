export {
	streamPrompt,
	DEFAULT_AI_PROVIDER,
	DEFAULT_AI_MODEL,
	type StreamPromptOptions,
	type StreamPromptResult,
} from "./opencode.js";

export {
	OpenCodeReferenceError,
	OpenCodeSDKError,
	InvalidProviderError,
	ProviderNotConnectedError,
	InvalidModelError,
	ServerStartError,
	SessionError,
	TimeoutError,
} from "./errors.js";

export {
	generateReferenceWithAI,
	type GenerateReferenceOptions,
	type GenerateReferenceResult,
} from "../generate.js";
