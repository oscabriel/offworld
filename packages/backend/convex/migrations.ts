import { internalMutation } from "./_generated/server";

/**
 * Clear all conversations with invalid threadIds (old string format)
 * Run once after schema change
 */
export const clearInvalidConversations = internalMutation({
	args: {},
	handler: async (ctx) => {
		const conversations = await ctx.db.query("conversations").collect();

		let deleted = 0;
		for (const conversation of conversations) {
			// Delete conversations with old custom threadId format
			if (conversation.threadId.startsWith("thread_")) {
				await ctx.db.delete(conversation._id);
				deleted++;
			}
		}

		return { deleted };
	},
});
