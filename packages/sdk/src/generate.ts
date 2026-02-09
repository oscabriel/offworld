/**
 * This module provides a streamlined approach to generating reference files
 * by delegating all codebase exploration to the AI agent via OpenCode.
 */

import { streamPrompt, type OpenCodeContext, type StreamPromptOptions } from "./ai/opencode.js";
import { loadConfig, toReferenceName } from "./config.js";
import { getCommitSha } from "./clone.js";

export interface GenerateReferenceOptions {
	/** AI provider ID (e.g., "anthropic", "openai"). Defaults to config value. */
	provider?: string;
	/** AI model ID. Defaults to config value. */
	model?: string;
	/** Shared OpenCode server context for multi-repo generation */
	openCodeContext?: OpenCodeContext;
	/** Debug callback for detailed logging */
	onDebug?: (message: string) => void;
	/** Stream callback for real-time AI output */
	onStream?: (text: string) => void;
}

export interface GenerateReferenceResult {
	/** The generated reference markdown content */
	referenceContent: string;
	/** The commit SHA at the time of generation */
	commitSha: string;
}

function createReferenceGenerationPrompt(referenceName: string): string {
	return `You are an expert at analyzing open source libraries and producing reference documentation for AI coding agents.

## PRIMARY GOAL

Generate a reference markdown file that helps developers USE this library effectively. This is NOT a contribution guide - it's a usage reference for developers consuming this library in their own projects.

## CRITICAL RULES

1. **USER PERSPECTIVE ONLY**: Write for developers who will npm/pip/cargo install this library and use it in THEIR code.
   - DO NOT include: how to contribute, internal test commands, repo-specific policies
   - DO NOT include: "never mock in tests" or similar internal dev guidelines
   - DO NOT include: commands like "npx hereby", "just ready", "bun test" that run the library's own tests
   - DO include: how to install, import, configure, and use the public API

2. **NO FRONTMATTER**: Output pure markdown with NO YAML frontmatter. Start directly with the library name heading.

3. **QUICK REFERENCES**: Include a "Quick References" section with paths to key entry points in the repo:
   - Paths must be relative from repo root (e.g., \`src/index.ts\`, \`docs/api.md\`)
   - Include: main entry point, type definitions, README, key docs
   - DO NOT include absolute paths or user-specific paths
   - Keep to 3-5 most important files that help users understand the library

4. **PUBLIC API FOCUS**: Document what users import and call, not internal implementation details.
   - Entry points: what to import from the package
   - Configuration: how to set up/initialize
   - Core methods/functions: the main API surface
   - Types: key TypeScript interfaces users need

5. **MONOREPO AWARENESS**: Many libraries are monorepos with multiple packages:
   - Check for \`packages/\`, \`apps/\`, \`crates/\`, or \`libs/\` directories
   - Check root package.json for \`workspaces\` field
   - If monorepo: document the package structure and key packages users would install
   - Use full paths from repo root (e.g., \`packages/core/src/index.ts\`)
   - Identify which packages are publishable vs internal

## EXPLORATION STEPS

Use Read, Grep, Glob tools to explore:
1. Root package.json / Cargo.toml - check for workspaces/monorepo config
2. Check for \`packages/\`, \`apps/\`, \`crates/\` directories
3. README.md - official usage documentation
4. For monorepos: explore each publishable package's entry point
5. docs/ or website/ - find documentation
6. examples/ - real usage patterns
7. TypeScript definitions (.d.ts) - public API surface

## OUTPUT FORMAT

IMPORTANT: Reference name is "${referenceName}" (for internal tracking only - do NOT include in output).

\`\`\`markdown
# {Library Name}

{2-3 sentence overview of what this library does and its key value proposition}

## Quick References

| File | Purpose |
|------|---------|
| \`packages/{pkg}/src/index.ts\` | Main entry point (monorepo example) |
| \`src/index.ts\` | Main entry point (single-package example) |
| \`README.md\` | Documentation |

(For monorepos, include paths to key publishable packages)

## Packages (for monorepos only)

| Package | npm name | Description |
|---------|----------|-------------|
| \`packages/core\` | \`@scope/core\` | Core functionality |
| \`packages/react\` | \`@scope/react\` | React bindings |

(OMIT this section for single-package repos)

## When to Use

- {Practical scenario where a developer would reach for this library}
- {Another real-world use case}
- {Problem this library solves}

## Installation

\`\`\`bash
# Single package
npm install {package-name}

# Monorepo (show key packages)
npm install @scope/core @scope/react
\`\`\`

## Best Practices

1. {Actionable best practice for USERS of this library}
2. {Common mistake to avoid when using this library}
3. {Performance or correctness tip}

## Common Patterns

**{Pattern Name}:**
\`\`\`{language}
{Minimal working code example}
\`\`\`

**{Another Pattern}:**
\`\`\`{language}
{Another code example}
\`\`\`

## API Quick Reference

| Export | Type | Description |
|--------|------|-------------|
| \`{main export}\` | {type} | {what it does} |
| \`{another export}\` | {type} | {what it does} |

{Add more sections as appropriate for the library: Configuration, Types, CLI Commands (if user-facing), etc.}
\`\`\`

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] NO YAML frontmatter - start directly with # heading
- [ ] Every code example is something a USER would write, not a contributor
- [ ] No internal test commands or contribution workflows
- [ ] Quick References paths are relative from repo root (no absolute/user paths)
- [ ] Best practices are for using the library, not developing it
- [ ] If monorepo: Packages section lists publishable packages with npm names
- [ ] If monorepo: paths include package directory (e.g., \`packages/core/src/index.ts\`)

Now explore the codebase and generate the reference content.

## OUTPUT INSTRUCTIONS

After exploring, output your complete reference wrapped in XML tags like this:

\`\`\`
<reference_output>
(your complete markdown reference here)
</reference_output>
\`\`\`

REQUIREMENTS:
- Start with a level-1 heading with the actual library name (e.g., "# TanStack Query")
- Include sections: Quick References (table), When to Use (bullets), Installation, Best Practices, Common Patterns (with code), API Quick Reference (table)
- Minimum 2000 characters of actual content - short or placeholder content will be rejected
- Fill in real information from your exploration - do not use placeholder text like "{Library Name}"
- No YAML frontmatter - start directly with the markdown heading
- Output ONLY the reference inside the tags, no other text

Begin exploring now.`;
}

/**
 * Extract the actual reference markdown content from AI response.
 * The response may include echoed prompt/system context before the actual reference.
 * Handles multiple edge cases:
 * - Model echoes the prompt template (skip template content)
 * - Model forgets to close the tag (extract to end of response)
 * - Multiple tag pairs (find the one with real content)
 */
function extractReferenceContent(rawResponse: string, onDebug?: (message: string) => void): string {
	const openTag = "<reference_output>";
	const closeTag = "</reference_output>";

	onDebug?.(`[extract] Raw response length: ${rawResponse.length} chars`);

	// Find all occurrences of open and close tags
	const openIndices: number[] = [];
	const closeIndices: number[] = [];
	let pos = 0;
	while ((pos = rawResponse.indexOf(openTag, pos)) !== -1) {
		openIndices.push(pos);
		pos += openTag.length;
	}
	pos = 0;
	while ((pos = rawResponse.indexOf(closeTag, pos)) !== -1) {
		closeIndices.push(pos);
		pos += closeTag.length;
	}

	onDebug?.(
		`[extract] Found ${openIndices.length} open tag(s), ${closeIndices.length} close tag(s)`,
	);

	// Helper to clean content (strip markdown fences)
	const cleanContent = (raw: string): string => {
		let content = raw.trim();
		if (content.startsWith("```")) {
			content = content.replace(/^```(?:markdown)?\s*\n?/, "");
			content = content.replace(/\n?```\s*$/, "");
		}
		return content.trim();
	};

	// Helper to check if content is template placeholder
	const isTemplateContent = (content: string): boolean => {
		return (
			content.includes("{Library Name}") ||
			content.includes("(your complete markdown reference here)")
		);
	};

	// Strategy 1: Find properly paired tags, starting from the LAST open tag
	// (Last is more likely to be actual output, not echoed prompt)
	for (let i = openIndices.length - 1; i >= 0; i--) {
		const openIdx = openIndices[i];
		if (openIdx === undefined) continue;

		// Find the first close tag after this open tag
		const closeIdx = closeIndices.find((c) => c > openIdx);
		if (closeIdx !== undefined) {
			const rawContent = rawResponse.slice(openIdx + openTag.length, closeIdx);
			const content = cleanContent(rawContent);

			onDebug?.(`[extract] Pair ${i}: open=${openIdx}, close=${closeIdx}, len=${content.length}`);
			onDebug?.(
				`[extract] Preview: "${content.slice(0, 200)}${content.length > 200 ? "..." : ""}"`,
			);

			if (isTemplateContent(content)) {
				onDebug?.(`[extract] Skipping pair ${i} - template placeholder content`);
				continue;
			}

			if (content.length >= 500) {
				onDebug?.(`[extract] Using pair ${i} - valid content`);
				validateReferenceContent(content);
				return content;
			}
			onDebug?.(`[extract] Pair ${i} too short (${content.length} chars)`);
		}
	}

	// Strategy 2: Handle unclosed tag - model output <reference_output> but never closed it
	// Find the last open tag that has no close tag after it
	const lastOpenIdx = openIndices[openIndices.length - 1];
	if (lastOpenIdx !== undefined) {
		const hasCloseAfter = closeIndices.some((c) => c > lastOpenIdx);
		if (!hasCloseAfter) {
			onDebug?.(`[extract] Last open tag at ${lastOpenIdx} is unclosed - extracting to end`);
			const rawContent = rawResponse.slice(lastOpenIdx + openTag.length);
			const content = cleanContent(rawContent);

			onDebug?.(`[extract] Unclosed content: ${content.length} chars`);
			onDebug?.(
				`[extract] Preview: "${content.slice(0, 200)}${content.length > 200 ? "..." : ""}"`,
			);

			if (!isTemplateContent(content) && content.length >= 500) {
				onDebug?.(`[extract] Using unclosed content - valid`);
				validateReferenceContent(content);
				return content;
			}
		}
	}

	onDebug?.(`[extract] No valid content found`);
	onDebug?.(`[extract] Response tail: "${rawResponse.slice(-300)}"`);

	throw new Error(
		"Failed to extract reference content: no valid <reference_output> tags found. " +
			"The AI may have failed to follow the output format or produced placeholder content.",
	);
}

/**
 * Validate extracted reference content has minimum required structure.
 * Throws if content is invalid.
 */
function validateReferenceContent(content: string): void {
	// Check for template placeholders that indicate the model just echoed the format
	const templatePlaceholders = [
		"{Library Name}",
		"{Full overview paragraph}",
		"{Table with 3-5 key files}",
		"{3+ bullet points}",
		"{Install commands}",
		"{3+ numbered items}",
		"{2+ code examples",
		"{Table of key exports}",
		"{Additional sections",
	];

	const foundPlaceholders = templatePlaceholders.filter((p) => content.includes(p));
	if (foundPlaceholders.length > 0) {
		throw new Error(
			`Invalid reference content: contains template placeholders (${foundPlaceholders.slice(0, 3).join(", ")}). ` +
				"The AI echoed the format instead of generating actual content.",
		);
	}

	if (content.length < 500) {
		throw new Error(
			`Invalid reference content: too short (${content.length} chars, minimum 500). ` +
				"The AI may have produced placeholder or incomplete content.",
		);
	}

	if (!content.startsWith("#")) {
		throw new Error(
			"Invalid reference content: must start with markdown heading. " +
				"Content must begin with '# Library Name' (no YAML frontmatter).",
		);
	}
}

/**
 * Generate a reference markdown file for a repository using AI.
 *
 * Opens an OpenCode session and instructs the AI agent to explore the codebase
 * using Read, Grep, and Glob tools, then produce a comprehensive reference.
 *
 * @param repoPath - Path to the repository to analyze
 * @param repoName - Qualified name of the repo (e.g., "tanstack/query" or "my-local-repo")
 * @param options - Generation options (provider, model, callbacks)
 * @returns The generated reference content and commit SHA
 */
export async function generateReferenceWithAI(
	repoPath: string,
	repoName: string,
	options: GenerateReferenceOptions = {},
): Promise<GenerateReferenceResult> {
	const { provider, model, onDebug, onStream, openCodeContext } = options;
	const config = loadConfig();

	const [configProvider, configModel] = config.defaultModel?.split("/") ?? [];
	const aiProvider = provider ?? configProvider;
	const aiModel = model ?? configModel;

	onDebug?.(`Starting AI reference generation for ${repoName}`);
	onDebug?.(`Repo path: ${repoPath}`);
	onDebug?.(`Provider: ${aiProvider ?? "default"}, Model: ${aiModel ?? "default"}`);

	const commitSha = getCommitSha(repoPath);
	onDebug?.(`Commit SHA: ${commitSha}`);

	const referenceName = toReferenceName(repoName);
	onDebug?.(`Reference name: ${referenceName}`);

	const promptOptions: StreamPromptOptions = {
		prompt: createReferenceGenerationPrompt(referenceName),
		cwd: repoPath,
		provider: aiProvider,
		model: aiModel,
		openCodeContext,
		onDebug,
		onStream,
	};

	const result = await streamPrompt(promptOptions);

	onDebug?.(`Generation complete (${result.durationMs}ms, ${result.text.length} chars)`);

	const referenceContent = extractReferenceContent(result.text, onDebug);
	onDebug?.(`Extracted reference content (${referenceContent.length} chars)`);

	return {
		referenceContent,
		commitSha,
	};
}
