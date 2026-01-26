/**
 * Simplified AI-only reference generation
 *
 * This module provides a streamlined approach to generating reference files
 * by delegating all codebase exploration to the AI agent via OpenCode.
 */

import {
	mkdirSync,
	writeFileSync,
	lstatSync,
	unlinkSync,
	rmSync,
	symlinkSync,
	existsSync,
} from "node:fs";
import { join } from "node:path";
import { streamPrompt, type StreamPromptOptions } from "./ai/opencode.js";
import { loadConfig, toSkillDirName, toMetaDirName, toReferenceFileName } from "./config.js";
import { getCommitSha } from "./clone.js";
import { agents } from "./agents.js";
import { expandTilde, Paths } from "./paths.js";
import { upsertGlobalMapEntry, readGlobalMap } from "./index-manager.js";

// ============================================================================
// Types
// ============================================================================

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

export interface InstallSkillMeta {
	/** ISO timestamp when the reference was generated */
	analyzedAt: string;
	/** Git commit SHA at time of generation */
	commitSha: string;
	/** SDK version used for generation */
	version: string;
}

// ============================================================================
// Skill Generation
// ============================================================================

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

CRITICAL: Wrap your final reference output in XML tags exactly like this:
<reference_output>
# {Library Name}
(the complete markdown content with NO frontmatter)
</reference_output>

Output ONLY the reference content inside the tags. No explanations before or after the tags.`;
}

/**
 * Extract the actual reference markdown content from AI response.
 * The response may include echoed prompt/system context before the actual reference.
 * We look for the LAST occurrence of XML tags: <reference_output>...</reference_output>
 * (Using last occurrence avoids extracting example tags from echoed prompt)
 */
function extractReferenceContent(rawResponse: string): string {
	// Try XML tag extraction first (preferred)
	// Use lastIndexOf to skip any echoed prompt examples
	const openTag = "<reference_output>";
	const closeTag = "</reference_output>";
	const closeIndex = rawResponse.lastIndexOf(closeTag);

	if (closeIndex !== -1) {
		// Find the last open tag before this close tag
		const openIndex = rawResponse.lastIndexOf(openTag, closeIndex);

		if (openIndex !== -1) {
			let content = rawResponse.slice(openIndex + openTag.length, closeIndex).trim();

			// Remove markdown code fence wrapper if present
			if (content.startsWith("```")) {
				content = content.replace(/^```(?:markdown)?\s*\n?/, "");
				content = content.replace(/\n?```\s*$/, "");
			}

			content = content.trim();
			validateReferenceContent(content);
			return content;
		}
	}

	// No valid extraction - fail loud instead of returning garbage
	throw new Error(
		"Failed to extract reference content: no <reference_output> tags found in AI response. " +
			"The AI may have failed to follow the output format instructions.",
	);
}

/**
 * Validate extracted reference content has minimum required structure.
 * Throws if content is invalid.
 */
function validateReferenceContent(content: string): void {
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

	// Generate the reference name in owner-repo format
	const referenceName = toSkillDirName(repoName);
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

	// Extract just the reference content, removing any echoed prompt/system context
	const referenceContent = extractReferenceContent(result.text);
	onDebug?.(`Extracted reference content (${referenceContent.length} chars)`);

	return {
		referenceContent,
		commitSha,
	};
}

// ============================================================================
// Skill Installation
// ============================================================================

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
	} catch {
		// Path doesn't exist, which is fine
	}

	const linkDir = join(linkPath, "..");
	mkdirSync(linkDir, { recursive: true });
	symlinkSync(target, linkPath, "dir");
}

/**
 * Install a generated reference to the filesystem (legacy per-repo install).
 *
 * Creates:
 * - ~/.local/share/offworld/skills/{name}-reference/SKILL.md
 * - ~/.local/share/offworld/meta/{name}/meta.json
 * - Symlinks to agent directories based on config.agents
 *
 * @param repoName - Qualified name (e.g., "tanstack/query" or "my-local-repo")
 * @param skillContent - The generated reference content
 * @param meta - Metadata about the generation (analyzedAt, commitSha, version)
 */
export function installSkill(repoName: string, skillContent: string, meta: InstallSkillMeta): void {
	const config = loadConfig();
	const skillDirName = toSkillDirName(repoName);
	const metaDirName = toMetaDirName(repoName);

	// Skill directory (agent-facing)
	const skillDir = join(Paths.data, "skills", skillDirName);
	mkdirSync(skillDir, { recursive: true });

	// Meta directory (internal)
	const metaDir = join(Paths.data, "meta", metaDirName);
	mkdirSync(metaDir, { recursive: true });

	// Write SKILL.md
	writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf-8");

	// Write meta.json
	const metaJson = JSON.stringify(meta, null, 2);
	writeFileSync(join(metaDir, "meta.json"), metaJson, "utf-8");

	// Create symlinks for configured agents
	const configuredAgents = config.agents ?? [];
	for (const agentName of configuredAgents) {
		const agentConfig = agents[agentName];
		if (agentConfig) {
			const agentSkillDir = expandTilde(join(agentConfig.globalSkillsDir, skillDirName));
			ensureSymlink(skillDir, agentSkillDir);
		}
	}
}

// ============================================================================
// Single-Skill Installation (US-005)
// ============================================================================

/**
 * Static template for the global SKILL.md file.
 * This is the single routing skill that all agents see.
 */
const GLOBAL_SKILL_TEMPLATE = `# Offworld Skills Router

This is the global Offworld skill that routes queries to per-repository reference files.

## How it works

When you need documentation for a dependency:
1. Run \`ow config show --json\` to get paths and map data
2. Parse the map.json to find which reference file corresponds to your query
3. Read the appropriate reference markdown from the references/ directory

## Directory Structure

\`\`\`
~/.local/share/offworld/skill/offworld/
├── SKILL.md (this file)
├── assets/
│   └── map.json (global map of all installed references)
└── references/
    ├── owner-repo.md (reference for owner/repo)
    └── ...
\`\`\`

## Querying References

Use \`ow config show --json\` to get:
- \`paths.globalMap\`: Location of map.json
- \`paths.referencesDir\`: Directory containing all reference files
- \`paths.projectMap\`: Project-specific .offworld/map.json (if in a project)

The map.json structure:
\`\`\`json
{
  "repos": {
    "owner/repo": {
      "localPath": "/absolute/path/to/clone",
      "references": ["owner-repo.md"],
      "primary": "owner-repo.md",
      "keywords": ["keyword1", "keyword2"],
      "updatedAt": "2026-01-25"
    }
  }
}
\`\`\`
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

	// Ensure offworld skill directory exists
	mkdirSync(Paths.offworldSkillDir, { recursive: true });
	mkdirSync(Paths.offworldAssetsDir, { recursive: true });
	mkdirSync(Paths.offworldReferencesDir, { recursive: true });

	// Write global SKILL.md if it doesn't exist
	const skillPath = join(Paths.offworldSkillDir, "SKILL.md");
	if (!existsSync(skillPath)) {
		writeFileSync(skillPath, GLOBAL_SKILL_TEMPLATE, "utf-8");
	}

	// Symlink the entire offworld/ directory to each agent's skill directory
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
 * @param repoName - Qualified name (e.g., "tanstack/query")
 * @param localPath - Absolute path to the cloned repository
 * @param referenceContent - The generated reference markdown content
 * @param meta - Metadata about the generation (analyzedAt, commitSha, version)
 * @param keywords - Optional array of keywords for search/routing
 */
export function installReference(
	repoName: string,
	localPath: string,
	referenceContent: string,
	meta: InstallSkillMeta,
	keywords?: string[],
): void {
	const referenceFileName = toReferenceFileName(repoName);
	const metaDirName = toMetaDirName(repoName);

	// Write reference file
	const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
	mkdirSync(Paths.offworldReferencesDir, { recursive: true });
	writeFileSync(referencePath, referenceContent, "utf-8");

	// Write meta.json
	const metaDir = join(Paths.metaDir, metaDirName);
	mkdirSync(metaDir, { recursive: true });
	const metaJson = JSON.stringify(meta, null, 2);
	writeFileSync(join(metaDir, "meta.json"), metaJson, "utf-8");

	// Update global map
	const map = readGlobalMap();
	const existingEntry = map.repos[repoName];
	const references = existingEntry?.references ?? [];

	// Add reference to list if not present
	if (!references.includes(referenceFileName)) {
		references.push(referenceFileName);
	}

	upsertGlobalMapEntry(repoName, {
		localPath,
		references,
		primary: referenceFileName,
		keywords: keywords ?? existingEntry?.keywords ?? [],
		updatedAt: new Date().toISOString().split("T")[0] ?? "",
	});
}
