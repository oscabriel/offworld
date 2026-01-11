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

Your task is to generate a SKILL.md file that helps AI agents quickly navigate and understand a codebase. Skills are reference documents that provide quick paths to important files, search patterns, activation triggers, and workflow guidance.

Be concise and technical. No prose or explanations outside the skill format.

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
1. Start immediately with the YAML frontmatter
2. Define REPO and ANALYSIS paths at the top, then use \${REPO} and \${ANALYSIS} variables
3. CRITICAL - Quick Paths section MUST contain 15-20 file paths from <top_files> and <file_tree>
4. CRITICAL - Search Patterns table MUST contain 5-8 rows with regex patterns for finding code
5. "When to Use This Skill" section: 6-10 activation triggers
6. "Best Practices" section: 5-6 numbered guidelines
7. "Common Patterns" section: 3-4 step-by-step workflows
8. Output 120-180 lines total
</rules>

<example>
---
name: express
description: Express.js web framework - fast, unopinionated, minimalist web framework for Node.js.
allowed-tools: [Read, Grep, Glob, Task]
---

# express

Minimalist web framework for Node.js providing routing, middleware, and HTTP utilities.

REPO: /Users/dev/clones/expressjs/express
ANALYSIS: /Users/dev/.ow/analyses/github--expressjs--express

## Quick Paths

- \`\${REPO}/lib/express.js\` - Main entry point, creates application
- \`\${REPO}/lib/router/index.js\` - Core router implementation
- \`\${REPO}/lib/application.js\` - Application prototype methods
- \`\${REPO}/lib/request.js\` - Request object extensions
- \`\${REPO}/lib/response.js\` - Response object extensions
- \`\${REPO}/lib/middleware/init.js\` - Default middleware initialization
- \`\${REPO}/lib/view.js\` - View rendering engine
- \`\${REPO}/lib/utils.js\` - Internal utilities

## Search Patterns

| Find | Pattern | Path |
|------|---------|------|
| Middleware exports | \`exports\\.\\w+\\s*=\` | \`\${REPO}/lib/middleware/\` |
| Route methods | \`methods\\.forEach\` | \`\${REPO}/lib/router/\` |
| Request helpers | \`defineGetter\` | \`\${REPO}/lib/request.js\` |
| Response methods | \`res\\.\\w+\\s*=\` | \`\${REPO}/lib/response.js\` |
| App settings | \`app\\.set\\(\` | \`\${REPO}/lib/application.js\` |

## When to Use This Skill

- User asks about Express routing or middleware implementation
- Questions about request/response object extensions
- Understanding Express application lifecycle
- Router internals or route matching logic
- Middleware chain execution order
- View rendering or template engine integration
- Error handling patterns in Express

## Best Practices

1. Check lib/ directory first - contains all core implementations
2. Read middleware/init.js for default middleware patterns
3. Use Grep to find method definitions across multiple files
4. Reference tests/ for edge cases and expected behavior
5. Use Task tool for complex multi-file exploration
6. Always cite file paths when referencing implementation details

## Common Patterns

**Understanding a middleware:**
1. Find middleware in \`\${REPO}/lib/middleware/\`
2. Check how it accesses req/res objects
3. Look at next() call patterns for chain continuation
4. Reference tests for expected behavior

**Adding route handling:**
1. Read \`\${REPO}/lib/router/index.js\` for router setup
2. Check \`\${REPO}/lib/router/route.js\` for route matching
3. See how params are extracted in layer.js
4. Reference application.js for app.use() patterns

**Extending request/response:**
1. Study \`\${REPO}/lib/request.js\` for req extensions
2. Check defineGetter patterns for lazy properties
3. Look at \`\${REPO}/lib/response.js\` for res methods
4. Reference how content-type is handled

## Deep Context

- Architecture: \`\${ANALYSIS}/architecture.md\`
- Summary: \`\${ANALYSIS}/summary.md\`
</example>

Now generate a skill for "${displayName}".

Use these paths in your output:
- REPO: ${repoPath}
- ANALYSIS: ${analysisPath || `~/.ow/analyses/${skillName}`}

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

## Public API
[For libraries/SDKs only - skip this section entirely for apps, CLIs, or internal tools]
[List the main exported classes/functions and their key methods]
- \`ClassName\` - purpose
  - \`.method1(params)\` - what it does
  - \`.method2(params)\` - what it does
- \`functionName(params)\` - what it does

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

## Public API
[For libraries/SDKs only - skip this section entirely for apps, CLIs, or internal tools]
[List the main exported classes/functions and their key methods]
- \`ClassName\` - purpose
  - \`.method1(params)\` - what it does
  - \`.method2(params)\` - what it does
- \`functionName(params)\` - what it does

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
