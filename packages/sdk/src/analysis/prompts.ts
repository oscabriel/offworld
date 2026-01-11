/**
 * Prompt Templates for Skill Generation
 *
 * Key principles:
 * 1. Full absolute paths throughout (agent can immediately Read them)
 * 2. Quick Paths (15-20 files) - most important files
 * 3. Search Patterns table - grep patterns for common searches
 * 4. Deep Context references to analysis files
 * 5. Target ~100 lines - dense, no prose
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

	return `Generate a SLIM skill (~100 lines) for "${displayName}".

## Repository Context

Path: ${repoPath}
Name: ${repoName}
${fullName ? `Full: ${fullName}` : ""}

README:
${readme || "(none)"}

Package:
${packageConfig || "(none)"}

File Tree:
${fileTree}

Summary:
${summary}
${architectureJson ? `\nArchitecture:\n${architectureJson}` : ""}

Top Files:
${topFiles.map((f) => `- ${f.path} (${f.role})`).join("\n")}

---

## Output Format (EXACTLY ~100 lines)

\`\`\`markdown
---
name: ${skillName}
description: [1 sentence: what it is + when to use this skill]
---

# ${displayName}

[1-2 sentences: what this is and its purpose]

Cloned to: ${repoPath}
${analysisPath ? `Analysis: ${analysisPath}/` : ""}

## Quick Paths

[15-20 most important files with full absolute paths]
- \`${repoPath}/path/to/file.ts\` - description
- \`${repoPath}/path/to/other.ts\` - description

## Search Patterns

| Find | Pattern | Path |
|------|---------|------|
| Hooks | \`export function use\` | \`${repoPath}/src/\` |
| Types | \`export (type|interface)\` | \`${repoPath}/src/\` |
| Components | \`export const.*=\` | \`${repoPath}/src/\` |
[4-6 rows with actual grep patterns]

## Deep Context

- Architecture: Read \`${analysisPath || "~/.ow/analyses/<repo>"}/architecture.md\`
- Summary: Read \`${analysisPath || "~/.ow/analyses/<repo>"}/summary.md\`
\`\`\`

---

RULES:
1. EXACTLY ~100 lines (80-120 acceptable)
2. Full absolute paths starting with ${repoPath}
3. 15-20 Quick Paths - most important files only
4. Search Patterns as markdown table (4-6 rows)
5. NO verbose prose, NO "Best Practices", NO "When to Use" sections
6. Dense, actionable, grep-ready`;
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
