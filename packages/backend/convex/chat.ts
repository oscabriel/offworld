import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { codebaseAgent } from "./agent/codebaseAgent";

/**
 * Create a new conversation thread
 */
export const createThread = mutation({
	args: {
		userId: v.string(),
		repositoryId: v.id("repositories"),
		initialMessage: v.string(),
	},
	handler: async (ctx, args) => {
		// Generate a unique thread ID (will be set after first agent interaction)
		const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Generate initial title from first message (truncate to 50 chars)
		const title =
			args.initialMessage.length > 50
				? `${args.initialMessage.substring(0, 50)}...`
				: args.initialMessage;

		const conversationId = await ctx.db.insert("conversations", {
			userId: args.userId,
			repositoryId: args.repositoryId,
			title,
			threadId,
			lastMessageAt: Date.now(),
			messageCount: 1,
		});

		return { conversationId, threadId };
	},
});

/**
 * Send a message and get agent response
 */
export const sendMessage = action({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		// Get conversation details
		const conversation = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.chat.getConversation,
			{ conversationId: args.conversationId },
		);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Create context with repositoryId and userId for agent
		const ctxWithAgent = Object.assign(ctx, {
			repositoryId: conversation.repositoryId,
			userId: args.userId,
		});

		// Generate response using agent
		const response = await codebaseAgent.generateText(
			ctxWithAgent,
			conversation.threadId,
			{
				prompt: args.message,
			},
		);

		// Update conversation metadata
		await ctx.runMutation(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.chat.updateConversation,
			{
				conversationId: args.conversationId,
			},
		);

		return {
			message: response.text,
			threadId: conversation.threadId,
		};
	},
});

/**
 * Stream a message response from the agent
 */
export const streamMessage = action({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		// Get conversation details
		const conversation = await ctx.runQuery(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.chat.getConversation,
			{ conversationId: args.conversationId },
		);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Create context with repositoryId and userId for agent
		const ctxWithAgent = Object.assign(ctx, {
			repositoryId: conversation.repositoryId,
			userId: args.userId,
		});

		// Stream response using agent
		const stream = await codebaseAgent.streamText(
			ctxWithAgent,
			conversation.threadId,
			{
				prompt: args.message,
			},
		);

		// Update conversation metadata
		await ctx.runMutation(
			// biome-ignore lint/suspicious/noExplicitAny: Convex generated internal API types
			(ctx as any).api.chat.updateConversation,
			{
				conversationId: args.conversationId,
			},
		);

		return stream;
	},
});

/**
 * Update conversation metadata (last message time, message count)
 */
export const updateConversation = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		await ctx.db.patch(args.conversationId, {
			lastMessageAt: Date.now(),
			messageCount: conversation.messageCount + 1,
		});

		return { success: true };
	},
});

/**
 * Get a single conversation by ID
 */
export const getConversation = query({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);
		return conversation;
	},
});

/**
 * List all conversations for a user
 */
export const listConversationsByUser = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_user_time", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(50);

		return conversations;
	},
});

/**
 * List conversations for a specific repository
 */
export const listConversationsByRepo = query({
	args: {
		repositoryId: v.id("repositories"),
		userId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		let conversations = await ctx.db
			.query("conversations")
			.withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		// Filter by user if specified
		if (args.userId) {
			conversations = conversations.filter(
				(conv) => conv.userId === args.userId,
			);
		}

		// Sort by last message time (most recent first)
		conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

		return conversations.slice(0, 20);
	},
});

/**
 * Delete a conversation
 */
export const deleteConversation = mutation({
	args: {
		conversationId: v.id("conversations"),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Verify ownership
		if (conversation.userId !== args.userId) {
			throw new Error(
				"Unauthorized: You can only delete your own conversations",
			);
		}

		await ctx.db.delete(args.conversationId);

		return { success: true };
	},
});

/**
 * Update conversation title
 */
export const updateConversationTitle = mutation({
	args: {
		conversationId: v.id("conversations"),
		title: v.string(),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Verify ownership
		if (conversation.userId !== args.userId) {
			throw new Error("Unauthorized: You can only edit your own conversations");
		}

		await ctx.db.patch(args.conversationId, {
			title: args.title,
		});

		return { success: true };
	},
});
