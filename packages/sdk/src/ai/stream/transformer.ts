/**
 * Stream event transformer and parser
 * Safely parses and validates stream events using Zod schemas
 */

import {
	MessagePartUpdatedPropsSchema,
	SessionIdlePropsSchema,
	SessionErrorPropsSchema,
	TextPartSchema,
	SessionErrorSchema,
	type TextPart,
	type SessionErrorPayload,
	type MessagePartUpdatedProps,
	type SessionIdleProps,
	type SessionErrorProps,
} from "./types.js";

/**
 * Raw event from the OpenCode SDK stream
 */
export interface RawStreamEvent {
	type: string;
	properties: Record<string, unknown>;
}

/**
 * Result of parsing a stream event
 */
export type ParsedEventResult =
	| { type: "message.part.updated"; props: MessagePartUpdatedProps; textPart: TextPart | null }
	| { type: "session.idle"; props: SessionIdleProps }
	| { type: "session.error"; props: SessionErrorProps; error: SessionErrorPayload | null }
	| { type: "unknown"; rawType: string };

/**
 * Parse a raw stream event into a typed result.
 * Uses safe parsing - returns type: "unknown" for unrecognized or invalid events.
 */
export function parseStreamEvent(event: RawStreamEvent): ParsedEventResult {
	switch (event.type) {
		case "message.part.updated": {
			const propsResult = MessagePartUpdatedPropsSchema.safeParse(event.properties);
			if (!propsResult.success) {
				return { type: "unknown", rawType: event.type };
			}
			const props = propsResult.data;

			// Extract text part if present
			let textPart: TextPart | null = null;
			if (props.part?.type === "text") {
				const textPartResult = TextPartSchema.safeParse(props.part);
				if (textPartResult.success) {
					textPart = textPartResult.data;
				}
			}

			return { type: "message.part.updated", props, textPart };
		}

		case "session.idle": {
			const propsResult = SessionIdlePropsSchema.safeParse(event.properties);
			if (!propsResult.success) {
				return { type: "unknown", rawType: event.type };
			}
			return { type: "session.idle", props: propsResult.data };
		}

		case "session.error": {
			const propsResult = SessionErrorPropsSchema.safeParse(event.properties);
			if (!propsResult.success) {
				return { type: "unknown", rawType: event.type };
			}
			const props = propsResult.data;

			// Extract error details if present
			let error: SessionErrorPayload | null = null;
			if (props.error) {
				const errorResult = SessionErrorSchema.safeParse(props.error);
				if (errorResult.success) {
					error = errorResult.data;
				}
			}

			return { type: "session.error", props, error };
		}

		default:
			return { type: "unknown", rawType: event.type };
	}
}

/**
 * Check if event belongs to a specific session
 */
export function isEventForSession(event: RawStreamEvent, sessionId: string): boolean {
	const props = event.properties;
	if ("sessionID" in props && typeof props.sessionID === "string") {
		return props.sessionID === sessionId;
	}
	// Events without sessionID are assumed to be for all sessions
	return true;
}
