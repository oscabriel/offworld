import { internalMutation } from "./_generated/server";

export const clearInvalidConversations = internalMutation({
	args: {},
	handler: async (ctx) => {
		const conversations = await ctx.db.query("conversations").collect();

		let deleted = 0;
		for (const conversation of conversations) {
			if (conversation.threadId.startsWith("thread_")) {
				await ctx.db.delete(conversation._id);
				deleted++;
			}
		}

		return { deleted };
	},
});
