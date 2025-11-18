import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { google } from "../lib/google";
import type { CodebaseAgentContext } from "./tools";
import {
	explainFile,
	findIssues,
	findPullRequests,
	getArchitecture,
	getIssueByNumber,
	getPullRequestByNumber,
	getSummary,
	listFiles,
	searchCodeContext,
} from "./tools";

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
- ALWAYS use searchCodeContext to find relevant code before answering technical questions
- ALWAYS use getSummary to get repository overview for general questions
- ALWAYS use getArchitecture to understand how components connect
- Cite specific files and line numbers when referencing code
- Suggest related issues when appropriate using findIssues
- Be concise but thorough
- Use explainFile for deep dives into specific files
- Use listFiles to explore project structure

Communication style:
- Technical but approachable
- Include code snippets when helpful
- Explain "why" not just "what"
- If you can't find information, say so explicitly`,

	tools: {
		searchCodeContext,
		getArchitecture,
		getSummary,
		listFiles,
		explainFile,
		findIssues,
		getIssueByNumber,
		findPullRequests,
		getPullRequestByNumber,
	},

	maxSteps: 10,
});
