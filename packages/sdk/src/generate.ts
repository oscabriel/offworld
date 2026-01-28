/**
 * This module provides a streamlined approach to generating reference files
 * by delegating all codebase exploration to the AI agent via OpenCode.
 */

import {
	mkdirSync,
	writeFileSync,
	readFileSync,
	lstatSync,
	unlinkSync,
	rmSync,
	symlinkSync,
	existsSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { streamPrompt, type StreamPromptOptions } from "./ai/opencode.js";
import { loadConfig, toReferenceName, toMetaDirName, toReferenceFileName } from "./config.js";
import { getCommitSha } from "./clone.js";
import { agents } from "./agents.js";
import { expandTilde, Paths } from "./paths.js";
import { readGlobalMap, writeGlobalMap } from "./index-manager.js";

const PackageJsonKeywordsSchema = z.object({
	name: z.string().optional(),
	keywords: z.array(z.string()).optional(),
});

export interface GenerateReferenceOptions {
	/** AI provider ID (e.g., "anthropic", "openai"). Defaults to config value. */
	provider?: string;
	/** AI model ID. Defaults to config value. */
	model?: string;
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

export interface InstallReferenceMeta {
	/** ISO timestamp when the reference was generated */
	referenceUpdatedAt: string;
	/** Git commit SHA at time of generation */
	commitSha: string;
	/** SDK version used for generation */
	version: string;
}

function normalizeKeyword(value: string): string[] {
	const trimmed = value.trim();
	if (!trimmed) return [];
	const normalized = trimmed.toLowerCase();
	const tokens = new Set<string>();

	const addToken = (token: string): void => {
		const cleaned = token.trim().toLowerCase();
		if (cleaned.length < 2) return;
		tokens.add(cleaned);
	};

	addToken(normalized);
	addToken(normalized.replaceAll("/", "-"));
	addToken(normalized.replaceAll("/", ""));

	for (const token of normalized.split(/[\s/_-]+/)) {
		addToken(token);
	}

	if (normalized.startsWith("@")) {
		addToken(normalized.slice(1));
	}

	return Array.from(tokens);
}

function deriveKeywords(fullName: string, localPath: string, referenceContent: string): string[] {
	const keywords = new Set<string>();

	const addKeywords = (value: string): void => {
		for (const token of normalizeKeyword(value)) {
			keywords.add(token);
		}
	};

	addKeywords(fullName);

	const headingMatch = referenceContent.match(/^#\s+(.+)$/m);
	if (headingMatch?.[1]) {
		addKeywords(headingMatch[1]);
	}

	const packageJsonPath = join(localPath, "package.json");
	if (existsSync(packageJsonPath)) {
		try {
			const content = readFileSync(packageJsonPath, "utf-8");
			const json = JSON.parse(content);
			const parsed = PackageJsonKeywordsSchema.safeParse(json);

			if (parsed.success) {
				if (parsed.data.name) {
					addKeywords(parsed.data.name);
				}

				if (parsed.data.keywords) {
					for (const keyword of parsed.data.keywords) {
						addKeywords(keyword);
					}
				}
			}
		} catch {}
	}

	return Array.from(keywords);
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
function extractReferenceContent(
	rawResponse: string,
	onDebug?: (message: string) => void,
): string {
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
	const { provider, model, onDebug, onStream } = options;
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

/**
 * Ensure a symlink exists, removing any existing file/directory at the path
 */
function ensureSymlink(target: string, linkPath: string): void {
	try {
		const stat = lstatSync(linkPath);
		if (stat.isSymbolicLink()) {
			unlinkSync(linkPath);
		} else if (stat.isDirectory()) {
			rmSync(linkPath, { recursive: true });
		} else {
			unlinkSync(linkPath);
		}
	} catch {}

	const linkDir = join(linkPath, "..");
	mkdirSync(linkDir, { recursive: true });
	symlinkSync(target, linkPath, "dir");
}

/**
 * Static template for the global SKILL.md file.
 * This is the single routing skill that all agents see.
 */
const GLOBAL_SKILL_TEMPLATE = `---
name: offworld
description: Routes queries to Offworld reference files. Find and read per-repo references for dependency knowledge.
allowed-tools: Bash(ow:*) Read
---

# Offworld Reference Router

Use \`ow\` to locate and read Offworld reference files for dependencies.

## What This Does

- Finds references for libraries and repos
- Returns paths for reference files and local clones
- Helps you read the right context fast

## When to Use

- You need docs or patterns for a dependency
- You want the verified reference instead of web search
- You are about to work inside a repo clone

## Prerequisites

Check that the CLI is available:

\`\`\`bash
ow --version
\`\`\`

If \`ow\` is not available, install it:

\`\`\`bash
curl -fsSL https://offworld.sh/install | bash
\`\`\`

## Setup

Initialize Offworld once per machine:

\`\`\`bash
ow init
\`\`\`

For a specific project, build a project map:

\`\`\`bash
ow project init
\`\`\`

## Usage

**Find a reference:**
\`\`\`bash
ow map search <term>     # search by name or keyword
ow map show <repo>       # get info for specific repo
\`\`\`

**Get paths for tools:**
\`\`\`bash
ow map show <repo> --ref   # reference file path (use with Read)
ow map show <repo> --path  # clone directory path
\`\`\`

**Example workflow:**
\`\`\`bash
# 1. Find the repo
ow map search zod

# 2. Get reference path
ow map show colinhacks/zod --ref
# Output: /Users/.../.local/share/offworld/skill/offworld/references/colinhacks-zod.md

# 3. Read the reference with the path from step 2
\`\`\`

## If Reference Not Found

\`\`\`bash
ow pull <owner/repo>    # clone + generate reference
ow project init         # scan project deps, install references
\`\`\`

## Notes

- Project map (\`.offworld/map.json\`) takes precedence over global map when present
- Reference files are markdown with API docs, patterns, best practices
- Clone paths useful for exploring source code after reading reference

## Additional Resources

- Docs: https://offworld.sh/cli
`;

/**
 * Ensures the global SKILL.md exists and symlinks the offworld/ directory to all agent skill directories.
 *
 * Creates:
 * - ~/.local/share/offworld/skill/offworld/SKILL.md (static routing template)
 * - ~/.local/share/offworld/skill/offworld/assets/ (for map.json)
 * - ~/.local/share/offworld/skill/offworld/references/ (for reference files)
 * - Symlinks entire offworld/ directory to each agent's skill directory
 */
export function installGlobalSkill(): void {
	const config = loadConfig();

	mkdirSync(Paths.offworldSkillDir, { recursive: true });
	mkdirSync(Paths.offworldAssetsDir, { recursive: true });
	mkdirSync(Paths.offworldReferencesDir, { recursive: true });

	const skillPath = join(Paths.offworldSkillDir, "SKILL.md");
	if (!existsSync(skillPath)) {
		writeFileSync(skillPath, GLOBAL_SKILL_TEMPLATE, "utf-8");
	}

	const configuredAgents = config.agents ?? [];
	for (const agentName of configuredAgents) {
		const agentConfig = agents[agentName];
		if (agentConfig) {
			const agentSkillDir = expandTilde(join(agentConfig.globalSkillsDir, "offworld"));
			ensureSymlink(Paths.offworldSkillDir, agentSkillDir);
		}
	}
}

/**
 * Install a reference file for a specific repository.
 *
 * Creates:
 * - ~/.local/share/offworld/skill/offworld/references/{owner-repo}.md
 * - ~/.local/share/offworld/meta/{owner-repo}/meta.json
 * - Updates global map with reference info
 *
 * @param qualifiedName - Qualified key for map storage (e.g., "github.com:owner/repo" or "local:name")
 * @param fullName - Full repo name for file naming (e.g., "owner/repo")
 * @param localPath - Absolute path to the cloned repository
 * @param referenceContent - The generated reference markdown content
 * @param meta - Metadata about the generation (referenceUpdatedAt, commitSha, version)
 * @param keywords - Optional array of keywords for search/routing
 */
export function installReference(
	qualifiedName: string,
	fullName: string,
	localPath: string,
	referenceContent: string,
	meta: InstallReferenceMeta,
	keywords?: string[],
): void {
	installGlobalSkill();

	const referenceFileName = toReferenceFileName(fullName);
	const metaDirName = toMetaDirName(fullName);

	const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
	mkdirSync(Paths.offworldReferencesDir, { recursive: true });
	writeFileSync(referencePath, referenceContent, "utf-8");

	const metaDir = join(Paths.metaDir, metaDirName);
	mkdirSync(metaDir, { recursive: true });
	const metaJson = JSON.stringify(meta, null, 2);
	writeFileSync(join(metaDir, "meta.json"), metaJson, "utf-8");

	const map = readGlobalMap();
	const existingEntry = map.repos[qualifiedName];
	const legacyProviderMap: Record<string, string> = {
		"github.com": "github",
		"gitlab.com": "gitlab",
		"bitbucket.org": "bitbucket",
	};
	const [host] = qualifiedName.split(":");
	const legacyProvider = host ? legacyProviderMap[host] : undefined;
	const legacyQualifiedName = legacyProvider ? `${legacyProvider}:${fullName}` : undefined;
	const legacyEntry = legacyQualifiedName ? map.repos[legacyQualifiedName] : undefined;

	const references = [...(existingEntry?.references ?? []), ...(legacyEntry?.references ?? [])];
	if (!references.includes(referenceFileName)) {
		references.push(referenceFileName);
	}

	const derivedKeywords = keywords ?? deriveKeywords(fullName, localPath, referenceContent);
	const keywordsSet = new Set<string>([
		...(existingEntry?.keywords ?? []),
		...(legacyEntry?.keywords ?? []),
		...derivedKeywords,
	]);

	map.repos[qualifiedName] = {
		localPath,
		references,
		primary: referenceFileName,
		keywords: Array.from(keywordsSet),
		updatedAt: new Date().toISOString(),
	};

	if (legacyQualifiedName && legacyQualifiedName in map.repos) {
		delete map.repos[legacyQualifiedName];
	}

	writeGlobalMap(map);
}
