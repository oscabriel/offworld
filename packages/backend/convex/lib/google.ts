import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Shared Google AI provider instance
 * Used across all AI operations: text generation, embeddings, and agent
 */
export const google = createGoogleGenerativeAI({
	apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
