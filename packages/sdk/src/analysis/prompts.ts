/**
 * Prompt Templates for Skill Generation
 *
 * Structured following Anthropic's prompt engineering best practices:
 * 1. Task context - what you are and what you're doing
 * 2. Tone context - how to communicate
 * 3. Background data - XML-tagged repository context
 * 4. Detailed rules - specific requirements
 * 5. Examples - concrete well-formed skill example
 * 6. Immediate task - what to do now
 * 7. Output formatting - how to structure response
 * 8. Prefill simulation - start of expected output
 */

export function createSkillPrompt(params: {
	repoPath: string;
	repoName: string;
	fullName?: string;
	readme: string | null;
	packageConfig: string | null;
	fileTree: string;
	topFiles: Array<{ path: string; importance: number; role: string; content: string }>;
	summary: string;
	architectureJson: string | null;
	analysisPath?: string;
}): string {
	const {
		repoPath,
		repoName,
		fullName,
		readme,
		packageConfig,
		fileTree,
		topFiles,
		summary,
		architectureJson,
		analysisPath,
	} = params;

	const displayName = fullName || repoName;
	const skillName = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

	return `You are a technical writer creating navigation skills for AI coding assistants.

Your task is to generate a SKILL.md file that helps AI agents quickly navigate and understand a codebase. Skills are reference documents that provide quick paths to important files and search patterns for finding code.

Be concise and technical. No prose, explanations, or commentary outside the skill format.

<repository>
<path>${repoPath}</path>
<name>${repoName}</name>
${fullName ? `<fullName>${fullName}</fullName>` : ""}
</repository>

<readme>
${readme || "(none)"}
</readme>

<package_config>
${packageConfig || "(none)"}
</package_config>

<file_tree>
${fileTree}
</file_tree>

<top_files>
${topFiles.map((f) => `<file path="${f.path}" role="${f.role}"/>`).join("\n")}
</top_files>

<summary>
${summary}
</summary>

${architectureJson ? `<architecture>\n${architectureJson}\n</architecture>` : ""}

<rules>
1. Output EXACTLY ~100 lines (80-120 acceptable)
2. Use full absolute paths starting with ${repoPath}
3. Include 15-20 Quick Paths - the most important files only
4. Search Patterns must be a markdown table with 4-6 rows
5. NO commentary before or after the skill content
6. NO verbose prose, NO "Best Practices", NO "When to Use" sections
7. Start immediately with completing the YAML frontmatter
</rules>

<example>
---
name: express
description: Express.js web framework - fast, unopinionated, minimalist web framework for Node.js.
---

# express

Minimalist web framework for Node.js providing routing, middleware, and HTTP utilities.

Cloned to: /Users/dev/clones/expressjs/express
Analysis: /Users/dev/.ow/analyses/github--expressjs--express/

## Quick Paths

- \`/Users/dev/clones/expressjs/express/lib/express.js\` - Main entry point, creates application
- \`/Users/dev/clones/expressjs/express/lib/router/index.js\` - Core router implementation
- \`/Users/dev/clones/expressjs/express/lib/application.js\` - Application prototype methods
- \`/Users/dev/clones/expressjs/express/lib/request.js\` - Request object extensions
- \`/Users/dev/clones/expressjs/express/lib/response.js\` - Response object extensions
- \`/Users/dev/clones/expressjs/express/lib/middleware/init.js\` - Default middleware initialization
- \`/Users/dev/clones/expressjs/express/lib/view.js\` - View rendering engine
- \`/Users/dev/clones/expressjs/express/lib/utils.js\` - Internal utilities

## Search Patterns

| Find | Pattern | Path |
|------|---------|------|
| Middleware | \`exports\\.\\w+\\s*=\` | \`/Users/dev/clones/expressjs/express/lib/middleware/\` |
| Route methods | \`methods\\.forEach\` | \`/Users/dev/clones/expressjs/express/lib/router/\` |
| Request helpers | \`defineGetter\` | \`/Users/dev/clones/expressjs/express/lib/request.js\` |
| Response methods | \`res\\.\\w+\\s*=\` | \`/Users/dev/clones/expressjs/express/lib/response.js\` |

## Deep Context

- Architecture: Read \`/Users/dev/.ow/analyses/github--expressjs--express/architecture.md\`
- Summary: Read \`/Users/dev/.ow/analyses/github--expressjs--express/summary.md\`
</example>

Now generate a skill for "${displayName}".

Use these paths in your output:
- Cloned to: ${repoPath}
- Analysis: ${analysisPath || `~/.ow/analyses/${skillName}`}/

Output ONLY the skill markdown. Complete the YAML frontmatter that follows.

---
name: ${skillName}
description:`;
}

// ============================================================================
// Summary Prompt (Updated)
// ============================================================================

export const SUMMARY_TEMPLATE = `Based on the repository context provided, write a markdown summary using this format:

## Purpose
[1-2 sentences about what this project does and why it exists]

## What Makes It Unique
[1-2 sentences about how this differs from alternatives or what's special about it]

## Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]
- [Feature 4]
- [Feature 5]

## Technologies
- **Language**: [primary language]
- **Framework**: [if applicable]
- **Build Tool**: [build system]
- **Key Dependencies**: [important deps]

## Architecture Overview
[2-3 sentences about how the codebase is organized - monorepo structure, package organization, etc.]

## Entry Points
- [Main entry point and what it does]
- [Secondary entry point if applicable]

Keep the summary under 600 words. Focus on what's most useful for a developer trying to understand this project quickly.`;

// ============================================================================
// Architecture Prompt (Updated)
// ============================================================================

export const ARCHITECTURE_TEMPLATE = `Analyze the repository and extract structured architecture information using this EXACT format:

## Project Type
[ONE of: monorepo, library, cli, app, framework, plugin]

## Entities
[For each major module/package/directory, use this subsection format. Include 5-15 entities.]

### [Entity Name]
- **Type**: [ONE of: package, module, feature, util, config, test, docs, example]
- **Path**: [relative path from repo root]
- **Description**: [one sentence describing purpose]
- **Key Files**:
  - \`[file1.ts]\` - [what it does]
  - \`[file2.ts]\` - [what it does]
- **Exports**: [main exports if applicable]
- **Dependencies**: [internal dependencies on other entities]

## Relationships
[How entities connect to each other]
- [from] -> [to]: [relationship type: imports, extends, uses, configures]
- [from] -> [to]: [relationship type]

## Key Files
[List 15-25 most important files with their roles]
- \`[path]\`: [role - entry point, core logic, types, config, etc.]
- \`[path]\`: [role]

## Patterns
- **Framework**: [detected framework or "none"]
- **Build Tool**: [detected build tool]
- **Test Framework**: [detected test framework]
- **Language**: [primary language]
- **Package Manager**: [npm, pnpm, bun, cargo, etc.]
- **Monorepo Tool**: [turborepo, nx, lerna, or "none"]

## Directory Conventions
[Describe any naming or organization patterns]
- \`src/\` - [what goes here]
- \`packages/\` - [what goes here]
- \`examples/\` - [what goes here]

Be thorough. Include all significant directories and files visible in the codebase.`;

export const SUMMARY_ARCHITECTURE_TEMPLATE = `Analyze this repository and generate BOTH a summary AND architecture analysis in a single response.

Your response MUST follow this exact format with clearly separated sections:

=== SUMMARY ===
## Purpose
[1-2 sentences about what this project does and why it exists]

## What Makes It Unique
[1-2 sentences about how this differs from alternatives or what's special about it]

## Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]
- [Feature 4]
- [Feature 5]

## Technologies
- **Language**: [primary language]
- **Framework**: [if applicable]
- **Build Tool**: [build system]
- **Key Dependencies**: [important deps]

## Architecture Overview
[2-3 sentences about how the codebase is organized - monorepo structure, package organization, etc.]

## Entry Points
- [Main entry point and what it does]
- [Secondary entry point if applicable]

=== ARCHITECTURE ===
## Project Type
[ONE of: monorepo, library, cli, app, framework, plugin]

## Entities
[For each major module/package/directory, use this subsection format. Include 5-15 entities.]

### [Entity Name]
- **Type**: [ONE of: package, module, feature, util, config, test, docs, example]
- **Path**: [relative path from repo root]
- **Description**: [one sentence describing purpose]
- **Key Files**:
  - \`[file1.ts]\` - [what it does]
  - \`[file2.ts]\` - [what it does]
- **Exports**: [main exports if applicable]
- **Dependencies**: [internal dependencies on other entities]

## Relationships
[How entities connect to each other]
- [from] -> [to]: [relationship type: imports, extends, uses, configures]

## Key Files
[List 15-25 most important files with their roles]
- \`[path]\`: [role - entry point, core logic, types, config, etc.]

## Patterns
- **Framework**: [detected framework or "none"]
- **Build Tool**: [detected build tool]
- **Test Framework**: [detected test framework]
- **Language**: [primary language]
- **Package Manager**: [npm, pnpm, bun, cargo, etc.]
- **Monorepo Tool**: [turborepo, nx, lerna, or "none"]

## Directory Conventions
[Describe any naming or organization patterns]
- \`src/\` - [what goes here]
- \`packages/\` - [what goes here]

IMPORTANT: Use "=== SUMMARY ===" and "=== ARCHITECTURE ===" as exact section delimiters.`;
