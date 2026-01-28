/**
 * Zod schemas for OpenCode stream events
 * Replaces inline `as` casts with runtime-validated types
 */

import { z } from "zod";

const PartBaseSchema = z.object({
	id: z.string().optional(),
	sessionID: z.string().optional(),
	messageID: z.string().optional(),
});

export const TextPartSchema = PartBaseSchema.extend({
	type: z.literal("text"),
	text: z.string().optional(),
});

export const ToolStatePendingSchema = z.object({
	status: z.literal("pending"),
});

export const ToolStateRunningSchema = z.object({
	status: z.literal("running"),
	title: z.string().optional(),
	input: z.unknown().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	time: z
		.object({
			start: z.number(),
		})
		.optional(),
});

export const ToolStateCompletedSchema = z.object({
	status: z.literal("completed"),
	title: z.string().optional(),
	input: z.record(z.string(), z.unknown()).optional(),
	output: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	time: z
		.object({
			start: z.number(),
			end: z.number(),
		})
		.optional(),
});

export const ToolStateErrorSchema = z.object({
	status: z.literal("error"),
	error: z.string().optional(),
	input: z.record(z.string(), z.unknown()).optional(),
	time: z
		.object({
			start: z.number(),
			end: z.number(),
		})
		.optional(),
});

export const ToolStateSchema = z.discriminatedUnion("status", [
	ToolStatePendingSchema,
	ToolStateRunningSchema,
	ToolStateCompletedSchema,
	ToolStateErrorSchema,
]);

export const ToolPartSchema = PartBaseSchema.extend({
	type: z.literal("tool"),
	callID: z.string().optional(),
	tool: z.string().optional(),
	state: ToolStateSchema.optional(),
});

export const StepStartPartSchema = PartBaseSchema.extend({
	type: z.literal("step-start"),
});

export const StepFinishPartSchema = PartBaseSchema.extend({
	type: z.literal("step-finish"),
	reason: z.string().optional(),
});

export const ToolUsePartSchema = PartBaseSchema.extend({
	type: z.literal("tool-use"),
	toolUseId: z.string().optional(),
	name: z.string().optional(),
});

export const ToolResultPartSchema = PartBaseSchema.extend({
	type: z.literal("tool-result"),
	toolUseId: z.string().optional(),
});

export const MessagePartSchema = z.discriminatedUnion("type", [
	TextPartSchema,
	ToolPartSchema,
	StepStartPartSchema,
	StepFinishPartSchema,
	ToolUsePartSchema,
	ToolResultPartSchema,
]);

/**
 * Session error payload
 */
export const SessionErrorSchema = z.object({
	name: z.string().optional(),
	message: z.string().optional(),
	code: z.string().optional(),
});

export const MessagePartUpdatedPropsSchema = z.object({
	part: MessagePartSchema,
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

export type TextPart = z.infer<typeof TextPartSchema>;
export type ToolPart = z.infer<typeof ToolPartSchema>;
export type ToolState = z.infer<typeof ToolStateSchema>;
export type ToolStateRunning = z.infer<typeof ToolStateRunningSchema>;
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
