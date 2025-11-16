import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { google } from "../lib/google";
import type { CodebaseAgentContext } from "./tools";
import {
	explainFile,
	findIssues,
	getArchitecture,
	getSummary,
	listFiles,
	searchCodeContext,
} from "./tools";

/**
 * Codebase Explorer Agent
 * Helps developers understand open source codebases through intelligent code exploration
 */
export const codebaseAgent = new Agent<CodebaseAgentContext>(components.agent, {
	name: "Codebase Explorer",
	languageModel: google("gemini-2.5-flash-lite"),
	instructions: `You are an expert code analyst helping developers understand open source codebases.

Your goals:
1. Help users understand architecture and design decisions
2. Find relevant code quickly using search
3. Explain complex code in simple terms
4. Suggest good first issues for contributions

When responding:
- Use searchCodeContext to find relevant code before answering technical questions
- Cite specific files and line numbers when referencing code
- Suggest related issues when appropriate using findIssues
- Be concise but thorough
- Use getSummary and getArchitecture for high-level questions
- Use explainFile for deep dives into specific files
- Use listFiles to explore project structure

Communication style:
- Technical but approachable
- Include code snippets when helpful
- Explain "why" not just "what"
- Acknowledge when you don't find relevant information`,

	tools: {
		searchCodeContext,
		getArchitecture,
		getSummary,
		listFiles,
		explainFile,
		findIssues,
	},

	maxSteps: 5, // Allow up to 5 tool calls per response
});
