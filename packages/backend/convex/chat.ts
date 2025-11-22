import {
	createThread as createAgentThread,
	listUIMessages,
	saveMessage,
	syncStreams,
	vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { codebaseAgent } from "./agent/codebaseAgent";
import { getUser, safeGetUser } from "./auth";

export const createThread = mutation({
	args: {
		repositoryId: v.id("repositories"),
		initialMessage: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await getUser(ctx);

		const threadId = await createAgentThread(ctx, components.agent, {
			userId: user._id,
		});

		const title =
			args.initialMessage.length > 50
				? `${args.initialMessage.substring(0, 50)}...`
				: args.initialMessage;

		const conversationId = await ctx.db.insert("conversations", {
			userId: user._id,
			repositoryId: args.repositoryId,
			title,
			threadId, // Agent returns string threadId
			lastMessageAt: Date.now(),
			messageCount: 1,
		});

		const { messageId } = await saveMessage(ctx, components.agent, {
			threadId,
			prompt: args.initialMessage,
		});

		await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
			threadId,
			promptMessageId: messageId,
		});

		return { conversationId, threadId };
	},
});

export const sendMessage = mutation({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await getUser(ctx);

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation || conversation.userId !== user._id) {
			throw new Error("Unauthorized");
		}

		const oneMinuteAgo = Date.now() - 60_000;
		const recentConversations = await ctx.db
			.query("conversations")
			.withIndex("by_user_time", (q) =>
				q.eq("userId", user._id).gt("lastMessageAt", oneMinuteAgo),
			)
			.collect();

		const recentMessages = recentConversations.reduce(
			(sum, c) => sum + c.messageCount,
			0,
		);
		if (recentMessages > 20) {
			throw new Error(
				"Rate limit exceeded. Please wait before sending more messages.",
			);
		}

		const { messageId } = await saveMessage(ctx, components.agent, {
			threadId: conversation.threadId,
			prompt: args.message,
		});

		await ctx.db.patch(args.conversationId, {
			lastMessageAt: Date.now(),
			messageCount: conversation.messageCount + 1,
		});

		await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
			threadId: conversation.threadId,
			promptMessageId: messageId,
		});

		return { messageId };
	},
});

export const generateResponseAsync = internalAction({
	args: {
		threadId: v.string(),
		promptMessageId: v.string(),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.runQuery(
			internal.chat.getConversationByThread,
			{
				threadId: args.threadId,
			},
		);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const ctxWithAgent = Object.assign(ctx, {
			repositoryId: conversation.repositoryId,
			userId: conversation.userId,
		});

		await codebaseAgent.generateText(
			ctxWithAgent,
			{ threadId: args.threadId },
			{
				promptMessageId: args.promptMessageId,
			},
		);
	},
});

export const listThreadMessages = query({
	args: {
		threadId: v.string(),
		paginationOpts: paginationOptsValidator,
		streamArgs: vStreamArgs,
	},
	handler: async (ctx, args) => {
		const user = await safeGetUser(ctx);
		if (!user) {
			throw new Error("Unauthorized");
		}

		const conversation = await ctx.db
			.query("conversations")
			.withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
			.first();

		if (!conversation || conversation.userId !== user._id) {
			throw new Error("Unauthorized");
		}

		const paginated = await listUIMessages(ctx, components.agent, args);
		const streams = await syncStreams(ctx, components.agent, args);

		return { ...paginated, streams };
	},
});

export const getConversationByThread = internalQuery({
	args: { threadId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("conversations")
			.withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
			.first();
	},
});

export const updateConversation = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const user = await getUser(ctx);
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation || conversation.userId !== user._id) {
			throw new Error("Unauthorized");
		}

		await ctx.db.patch(args.conversationId, {
			lastMessageAt: Date.now(),
			messageCount: conversation.messageCount + 1,
		});

		return { success: true };
	},
});

export const getConversation = query({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const user = await safeGetUser(ctx);
		if (!user) return null;

		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation || conversation.userId !== user._id) {
			return null;
		}

		return conversation;
	},
});

export const listConversationsByUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await safeGetUser(ctx);
		if (!user) return [];

		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_user_time", (q) => q.eq("userId", user._id))
			.order("desc")
			.take(50);

		return conversations;
	},
});

export const listConversationsByRepo = query({
	args: {
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const user = await safeGetUser(ctx);
		if (!user) return [];

		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		const userConversations = conversations
			.filter((conv) => conv.userId === user._id)
			.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

		return userConversations.slice(0, 20);
	},
});

export const deleteConversation = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const user = await getUser(ctx);
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Verify ownership
		if (conversation.userId !== user._id) {
			throw new Error(
				"Unauthorized: You can only delete your own conversations",
			);
		}

		await ctx.db.delete(args.conversationId);

		return { success: true };
	},
});

export const deleteConversationsByRepo = internalMutation({
	args: {
		repositoryId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
			.collect();

		for (const conversation of conversations) {
			await ctx.db.delete(conversation._id);
		}

		return conversations.length;
	},
});

export const updateConversationTitle = mutation({
	args: {
		conversationId: v.id("conversations"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await getUser(ctx);
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Verify ownership
		if (conversation.userId !== user._id) {
			throw new Error("Unauthorized: You can only edit your own conversations");
		}

		await ctx.db.patch(args.conversationId, {
			title: args.title,
		});

		return { success: true };
	},
});
