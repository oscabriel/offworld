/**
 * Prompt Templates for Skill Generation
 *
 * These prompts are designed to generate skills that match the quality of
 * manually-created reference skills in ~/.config/opencode/skill/
 *
 * Key principles:
 * 1. Full absolute paths throughout (agent can immediately Read them)
 * 2. "What is X?" context for orientation
 * 3. 30+ Quick Reference Paths organized by category
 * 4. Search Strategies with actual grep/glob patterns
 * 5. Common Patterns with step-by-step procedures
 * 6. 250-400 lines of dense, high-signal content
 */

// ============================================================================
// Skill Generation Prompt
// ============================================================================

/**
 * Generate the main SKILL.md prompt.
 *
 * This produces a rich markdown document that serves as an "onboarding guide"
 * for AI agents working with the codebase.
 */
export function createSkillPrompt(params: {
	repoPath: string;
	repoName: string;
	fullName?: string; // e.g., "tanstack/router"
	readme: string | null;
	packageConfig: string | null;
	fileTree: string;
	topFiles: Array<{ path: string; importance: number; role: string; content: string }>;
	summary: string;
	architectureJson: string;
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
	} = params;

	const displayName = fullName || repoName;

	return `You are creating a comprehensive "skill" file for an AI coding assistant. This skill helps the AI understand and work with the "${displayName}" codebase efficiently.

A skill is like an onboarding guide for a new engineer - it should contain everything an AI needs to navigate and understand this codebase WITHOUT having to grep/search for basic information.

## Context About This Repository

**Absolute Path:** ${repoPath}
**Repository Name:** ${repoName}
${fullName ? `**Full Name:** ${fullName}` : ""}

### README
${readme || "(No README found)"}

### Package Configuration
\`\`\`
${packageConfig || "(No package config found)"}
\`\`\`

### File Tree (Top Files by Importance)
${fileTree}

### Summary
${summary}

### Architecture
${architectureJson}

### Sample File Contents
${topFiles
	.map(
		(f) => `
#### ${f.path} (${f.role}, importance: ${(f.importance * 100).toFixed(0)}%)
\`\`\`
${f.content}
\`\`\`
`,
	)
	.join("\n")}

---

## Your Task

Generate a SKILL.md file using the EXACT format below. This skill will be installed to help AI agents work with this codebase.

**CRITICAL REQUIREMENTS:**
1. Use FULL ABSOLUTE PATHS everywhere (starting with ${repoPath})
2. Generate 30+ specific file paths in Quick Reference Paths
3. Include actual grep/glob patterns in Search Strategies
4. Write step-by-step procedures in Common Patterns
5. Target 250-400 lines of content
6. Make every line actionable and specific to THIS codebase

---

## Required Output Format

\`\`\`markdown
---
name: ${repoName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-reference
description: [Write a 2-3 sentence description that explains: (1) what this codebase is, (2) when to consult it, (3) what kinds of questions it answers. Include keywords that would trigger skill activation like "implementation details", "source code", "internal patterns", etc.]
allowed-tools: [Read, Grep, Glob, Task]
---

# ${displayName} Source Code Reference

When the user asks about ${repoName}, consult the cloned repository for accurate implementation details, patterns, and examples.

## What is ${repoName}?

[2-4 sentences explaining:
- What this project does (its purpose)
- What makes it unique or different from alternatives
- Key technologies or patterns it uses
- Why someone would use it]

## Repository Structure

**Base Path:** ${repoPath}

**Main Areas:**
- \`${repoPath}/[dir1]/\` - [purpose]
- \`${repoPath}/[dir2]/\` - [purpose]
- \`${repoPath}/[dir3]/\` - [purpose]
[List 5-10 top-level directories with their purposes]

## Quick Reference Paths

[Organize into logical categories. Include 30+ specific file paths with descriptions.]

### Core Implementation
- \`${repoPath}/[path/to/main.ts]\` - [what this file does]
- \`${repoPath}/[path/to/core.ts]\` - [what this file does]
[Continue with 5-10 core files]

### [Category 2 - e.g., "API/Routes", "Components", "Hooks", "Plugins"]
- \`${repoPath}/[path]\` - [description]
[Continue with 5-10 files per category]

### [Category 3]
[Continue pattern]

### Type Definitions
- \`${repoPath}/[path/to/types.ts]\` - [description]
[List key type files]

### Configuration
- \`${repoPath}/[config files]\` - [description]

### Examples/Tests
- \`${repoPath}/examples/[example1]/\` - [what it demonstrates]
- \`${repoPath}/examples/[example2]/\` - [what it demonstrates]
[List 3-5 key examples]

## Search Strategies

[Provide ACTUAL grep/glob patterns for common searches]

### Finding [Thing 1 - e.g., "Hook Implementations"]
\`\`\`
pattern: "[actual regex pattern like 'export function use']"
path: ${repoPath}/[specific/directory/]
\`\`\`

### Finding [Thing 2 - e.g., "Component Definitions"]
\`\`\`
pattern: "[actual regex pattern]"
path: ${repoPath}/[specific/directory/]
\`\`\`

### Finding [Thing 3 - e.g., "Type Definitions"]
\`\`\`
Read: ${repoPath}/[path/to/types.ts]
Or Grep: pattern: "export (type|interface)"
\`\`\`

### Finding Examples
\`\`\`
Use Glob: ${repoPath}/examples/*/
Or search: pattern: "[relevant pattern]"
\`\`\`

[Include 5-8 search strategies covering common lookup needs]

## Common Patterns

[Step-by-step procedures for common tasks. These should be ACTIONABLE.]

**[Task 1 - e.g., "Understanding a hook implementation"]:**
1. Read the hook in \`${repoPath}/packages/[pkg]/src/use[Hook].ts\`
2. Check types in \`${repoPath}/packages/[pkg]/src/types.ts\`
3. Find usage examples in \`${repoPath}/examples/\`
4. Look at tests in \`${repoPath}/packages/[pkg]/src/__tests__/\`

**[Task 2 - e.g., "Adding a new feature"]:**
1. [Step 1 with specific file path]
2. [Step 2 with specific file path]
3. [Step 3]
4. [Step 4]

**[Task 3 - e.g., "Finding how X works"]:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

[Include 4-6 common patterns/procedures]

## When to Use This Skill

[List 10-15 specific trigger conditions]

- User asks about ${repoName} implementation details
- Questions about [specific feature 1]
- Questions about [specific feature 2]
- [Continue with specific triggers relevant to this codebase]
- Internal behavior or edge cases
- Type definitions and TypeScript usage
- Advanced features not well-documented
- Debugging or troubleshooting ${repoName} issues

## Best Practices

[Workflow guidance for working with this codebase]

1. **Check examples first** - [path] contains N examples covering most patterns
2. **Read core implementations** - [path] has the source of truth
3. **Check tests** - Tests show edge cases and internal behavior
4. **Use Task tool for broad searches** - When searching across multiple files
5. **Reference file paths** - Always cite specific source locations

## Key Concepts

[If applicable, explain 3-5 key concepts unique to this codebase]

### [Concept 1]
[Brief explanation of how it works in this codebase]

### [Concept 2]
[Brief explanation]

## Architecture Overview

[Optional: ASCII diagram showing data flow or component relationships]

\`\`\`
[Component A]
    ↓
[Component B] → [Component C]
    ↓
[Component D]
\`\`\`
\`\`\`

---

**REMEMBER:**
- Every path must be a FULL ABSOLUTE PATH starting with ${repoPath}
- Include 30+ specific file paths
- Search strategies must have actual grep patterns
- Common patterns must be step-by-step with specific paths
- Target 250-400 lines of content
- Make it immediately usable without editing`;
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
