/**
 * Zod schemas for OpenCode stream events
 * Replaces inline `as` casts with runtime-validated types
 */

import { z } from "zod";

// ============================================================================
// Message Part Schemas
// ============================================================================

/**
 * Text message part from stream event
 */
export const TextPartSchema = z.object({
	id: z.string().optional(),
	type: z.literal("text"),
	text: z.string().optional(),
});

/**
 * Tool use message part
 */
export const ToolUsePartSchema = z.object({
	id: z.string().optional(),
	type: z.literal("tool-use"),
	toolUseId: z.string().optional(),
	name: z.string().optional(),
});

/**
 * Tool result message part
 */
export const ToolResultPartSchema = z.object({
	id: z.string().optional(),
	type: z.literal("tool-result"),
	toolUseId: z.string().optional(),
});

/**
 * Union of all message part types
 */
export const MessagePartSchema = z.discriminatedUnion("type", [
	TextPartSchema,
	ToolUsePartSchema,
	ToolResultPartSchema,
]);

// ============================================================================
// Session Error Schema
// ============================================================================

/**
 * Session error payload
 */
export const SessionErrorSchema = z.object({
	name: z.string().optional(),
	message: z.string().optional(),
	code: z.string().optional(),
});

// ============================================================================
// Event Properties Schemas
// ============================================================================

/**
 * Properties for message.part.updated event
 */
export const MessagePartUpdatedPropsSchema = z.object({
	sessionID: z.string(),
	messageID: z.string().optional(),
	part: MessagePartSchema.optional(),
});

/**
 * Properties for session.idle event
 */
export const SessionIdlePropsSchema = z.object({
	sessionID: z.string(),
});

/**
 * Properties for session.error event
 */
export const SessionErrorPropsSchema = z.object({
	sessionID: z.string(),
	error: SessionErrorSchema.optional(),
});

/**
 * Properties for session.updated event
 */
export const SessionUpdatedPropsSchema = z.object({
	sessionID: z.string(),
	status: z.string().optional(),
});

// ============================================================================
// Stream Event Schemas
// ============================================================================

/**
 * message.part.updated event
 */
export const MessagePartUpdatedEventSchema = z.object({
	type: z.literal("message.part.updated"),
	properties: MessagePartUpdatedPropsSchema,
});

/**
 * session.idle event
 */
export const SessionIdleEventSchema = z.object({
	type: z.literal("session.idle"),
	properties: SessionIdlePropsSchema,
});

/**
 * session.error event
 */
export const SessionErrorEventSchema = z.object({
	type: z.literal("session.error"),
	properties: SessionErrorPropsSchema,
});

/**
 * session.updated event
 */
export const SessionUpdatedEventSchema = z.object({
	type: z.literal("session.updated"),
	properties: SessionUpdatedPropsSchema,
});

/**
 * Generic event for unknown types (passthrough)
 */
export const GenericEventSchema = z.object({
	type: z.string(),
	properties: z.record(z.string(), z.unknown()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TextPart = z.infer<typeof TextPartSchema>;
export type ToolUsePart = z.infer<typeof ToolUsePartSchema>;
export type ToolResultPart = z.infer<typeof ToolResultPartSchema>;
export type MessagePart = z.infer<typeof MessagePartSchema>;

export type SessionErrorPayload = z.infer<typeof SessionErrorSchema>;

export type MessagePartUpdatedProps = z.infer<typeof MessagePartUpdatedPropsSchema>;
export type SessionIdleProps = z.infer<typeof SessionIdlePropsSchema>;
export type SessionErrorProps = z.infer<typeof SessionErrorPropsSchema>;
export type SessionUpdatedProps = z.infer<typeof SessionUpdatedPropsSchema>;

export type MessagePartUpdatedEvent = z.infer<typeof MessagePartUpdatedEventSchema>;
export type SessionIdleEvent = z.infer<typeof SessionIdleEventSchema>;
export type SessionErrorEvent = z.infer<typeof SessionErrorEventSchema>;
export type SessionUpdatedEvent = z.infer<typeof SessionUpdatedEventSchema>;
export type GenericEvent = z.infer<typeof GenericEventSchema>;

/**
 * All known stream event types
 */
export type StreamEvent =
	| MessagePartUpdatedEvent
	| SessionIdleEvent
	| SessionErrorEvent
	| SessionUpdatedEvent
	| GenericEvent;
