# Markdown Template Migration PRD

## Overview

Migrate the analysis generation workflow from fragile JSON schema extraction to reliable markdown templates. The current approach forces structured JSON output through OpenCode (which doesn't support it), causing frequent parsing failures. The new approach uses markdown templates that the AI can reliably produce, then parses them into structured objects.

## Requirements

```json
[
	{
		"id": "M1.0",
		"category": "OpenCode Streaming API",
		"description": "Create streamPrompt() function that returns raw text with streaming support",
		"steps_to_verify": [
			"Function streamPrompt() exists in packages/sdk/src/ai/opencode.ts",
			"Function accepts StreamPromptOptions: { prompt, cwd, systemPrompt?, timeoutMs?, onDebug?, onStream? }",
			"Function returns Promise<StreamPromptResult>: { text, sessionId, durationMs }",
			"Function calls onStream callback with text chunks as they arrive",
			"Function does NOT use zodToJsonSchema or any JSON schema logic"
		],
		"passes": true
	},
	{
		"id": "M1.1",
		"category": "OpenCode Streaming API",
		"description": "Implement 120-second timeout for streaming responses",
		"steps_to_verify": [
			"streamPrompt() has timeoutMs parameter with default value 120000",
			"If no session.idle event received within timeout, function throws OpenCodeAnalysisError",
			"Error message includes 'timeout' and the duration waited"
		],
		"passes": true
	},
	{
		"id": "M1.2",
		"category": "OpenCode Streaming API",
		"description": "Remove JSON extraction logic from opencode.ts",
		"steps_to_verify": [
			"extractJSON() function does not exist in opencode.ts",
			"analyzeWithOpenCode() function does not exist in opencode.ts",
			"analyzeWithRetry() function does not exist in opencode.ts",
			"No import of zod-to-json-schema in opencode.ts",
			"No reference to 'schema' parameter in any function signature"
		],
		"passes": true
	},
	{
		"id": "M1.3",
		"category": "OpenCode Streaming API",
		"description": "Keep embedded server pattern and docs agent config",
		"steps_to_verify": [
			"createOpencode() is called with port retry logic (up to 10 attempts)",
			"createOpencodeClient() is used to create HTTP client",
			"Agent config disables build, explore, general, plan agents",
			"Agent config enables docs agent with read, grep, glob, list tools only",
			"Agent config denies edit, bash, webfetch permissions"
		],
		"passes": true
	},
	{
		"id": "M2.0",
		"category": "Markdown Parsers",
		"description": "Create parsers.ts with markdown parsing utilities",
		"steps_to_verify": [
			"File exists at packages/sdk/src/analysis/parsers.ts",
			"File exports extractField() function",
			"File exports parseListSection() function",
			"File exports parsePathDescSection() function",
			"File exports parsePathPurposeSection() function"
		],
		"passes": true
	},
	{
		"id": "M2.1",
		"category": "Markdown Parsers",
		"description": "Implement extractField() for parsing bold field values",
		"steps_to_verify": [
			"extractField('**Name**: my-skill', 'Name') returns 'my-skill'",
			"extractField('- **Type**: package', 'Type') returns 'package'",
			"extractField('no match here', 'Name') returns empty string or throws"
		],
		"passes": true
	},
	{
		"id": "M2.2",
		"category": "Markdown Parsers",
		"description": "Implement parseListSection() for bullet list extraction",
		"steps_to_verify": [
			"Parses '## Header\\n- item1\\n- item2' into ['item1', 'item2']",
			"Stops parsing at next ## header",
			"Handles empty sections gracefully (returns empty array)",
			"Trims whitespace from items"
		],
		"passes": true
	},
	{
		"id": "M2.3",
		"category": "Markdown Parsers",
		"description": "Implement parsePathDescSection() for path-description pairs",
		"steps_to_verify": [
			"Parses '- `src/index.ts`: Main entry point' into [{path: 'src/index.ts', description: 'Main entry point'}]",
			"Handles paths without backticks: '- src/index.ts: desc'",
			"Returns empty array for missing section"
		],
		"passes": true
	},
	{
		"id": "M2.4",
		"category": "Markdown Parsers",
		"description": "Implement parseArchitectureMarkdown() for full architecture extraction",
		"steps_to_verify": [
			"Function exists and returns Architecture type",
			"Extracts projectType from '## Project Type' section",
			"Extracts entities from '## Entities' section with ### subsections",
			"Extracts relationships from '## Relationships' section",
			"Extracts keyFiles from '## Key Files' section",
			"Extracts patterns from '## Patterns' section",
			"Throws error if critical sections are missing (projectType required)"
		],
		"passes": true
	},
	{
		"id": "M2.5",
		"category": "Markdown Parsers",
		"description": "Implement parseSkillMarkdown() for full skill extraction",
		"steps_to_verify": [
			"Function exists and returns Skill type",
			"Extracts name and description from '## Skill Info' section",
			"Extracts allowedTools from '## Allowed Tools' section",
			"Extracts repositoryStructure from '## Repository Structure' section",
			"Extracts keyFiles from '## Key Files' section",
			"Extracts searchStrategies from '## Search Strategies' section",
			"Extracts whenToUse from '## When to Use' section",
			"Throws error if name is missing or empty"
		],
		"passes": true
	},
	{
		"id": "M3.0",
		"category": "Generation Functions",
		"description": "Rewrite generateSummary() to use markdown template",
		"steps_to_verify": [
			"Function sends prompt with template sections: Purpose, Key Features, Technologies, Architecture Overview",
			"Function calls streamPrompt() instead of runAnalysis()",
			"Function returns raw markdown string (no JSON parsing)",
			"Function passes onStream callback through for progress display"
		],
		"passes": true
	},
	{
		"id": "M3.1",
		"category": "Generation Functions",
		"description": "Rewrite extractArchitecture() to use markdown template and parser",
		"steps_to_verify": [
			"Function sends prompt with template sections: Project Type, Entities, Relationships, Key Files, Patterns",
			"Function calls streamPrompt() instead of runAnalysis()",
			"Function calls parseArchitectureMarkdown() on response text",
			"Function returns Architecture object",
			"Function throws on parse failure (does not return partial data)"
		],
		"passes": true
	},
	{
		"id": "M3.2",
		"category": "Generation Functions",
		"description": "Rewrite generateSkill() to use markdown template and parser",
		"steps_to_verify": [
			"Function sends prompt with template sections: Skill Info, Allowed Tools, Repository Structure, Key Files, Search Strategies, When to Use",
			"Function calls streamPrompt() instead of runAnalysis()",
			"Function calls parseSkillMarkdown() on response text",
			"Function returns Skill object",
			"Function throws on parse failure (does not return partial data)"
		],
		"passes": true
	},
	{
		"id": "M3.3",
		"category": "Generation Functions",
		"description": "Keep formatArchitectureMd() and formatSkillMd() unchanged",
		"steps_to_verify": [
			"formatArchitectureMd() still exists and generates Mermaid diagrams",
			"formatSkillMd() still exists and generates YAML frontmatter format",
			"Both functions accept the same input types as before"
		],
		"passes": true
	},
	{
		"id": "M4.0",
		"category": "Pipeline Integration",
		"description": "Update pipeline.ts to use new generation functions",
		"steps_to_verify": [
			"runAnalysisPipeline() still calls generateSummary(), extractArchitecture(), generateSkill()",
			"Pipeline passes onStream callback through generateOptions",
			"Pipeline still saves all 7 output files to analysisPath",
			"Pipeline still calls installSkill() at the end"
		],
		"passes": true
	},
	{
		"id": "M4.1",
		"category": "Pipeline Integration",
		"description": "Verify output files are saved correctly",
		"steps_to_verify": [
			"summary.md contains raw markdown from AI",
			"architecture.json contains valid JSON matching Architecture schema",
			"architecture.md contains Mermaid diagram",
			"skill.json contains valid JSON matching Skill schema",
			"SKILL.md contains YAML frontmatter format",
			"file-index.json is unchanged (from ranker)",
			"meta.json is unchanged (metadata)"
		],
		"passes": true
	},
	{
		"id": "M4.2",
		"category": "Pipeline Integration",
		"description": "Verify skill installation to correct paths",
		"steps_to_verify": [
			"installSkill() writes to ~/.config/opencode/skill/{repo}/SKILL.md",
			"installSkill() writes to ~/.claude/skills/{repo}/SKILL.md",
			"Both files contain identical content",
			"Directories are created if they don't exist"
		],
		"passes": true
	},
	{
		"id": "M5.0",
		"category": "Export Updates",
		"description": "Update ai/index.ts exports",
		"steps_to_verify": [
			"streamPrompt is exported from packages/sdk/src/ai/index.ts",
			"StreamPromptOptions type is exported",
			"StreamPromptResult type is exported",
			"OpenCodeAnalysisError is exported",
			"OpenCodeSDKError is exported",
			"runAnalysis is NOT exported (removed)"
		],
		"passes": true
	},
	{
		"id": "M5.1",
		"category": "Export Updates",
		"description": "Update main SDK exports if needed",
		"steps_to_verify": [
			"packages/sdk/src/index.ts exports streamPrompt or appropriate public API",
			"No broken imports when running bun run check-types"
		],
		"passes": true
	},
	{
		"id": "M6.0",
		"category": "Cleanup",
		"description": "Remove zod-to-json-schema dependency",
		"steps_to_verify": [
			"zod-to-json-schema is not in packages/sdk/package.json dependencies",
			"No import of zod-to-json-schema anywhere in packages/sdk/src/"
		],
		"passes": true
	},
	{
		"id": "M6.1",
		"category": "Cleanup",
		"description": "Remove dead code from opencode.ts",
		"steps_to_verify": [
			"No unused functions in opencode.ts",
			"No unused imports in opencode.ts",
			"No unused type definitions in opencode.ts"
		],
		"passes": true
	},
	{
		"id": "M7.0",
		"category": "Parser Tests",
		"description": "Create unit tests for markdown parsers",
		"steps_to_verify": [
			"Test file exists at packages/sdk/src/__tests__/parsers.test.ts",
			"Tests cover extractField() with various inputs",
			"Tests cover parseListSection() with valid and edge cases",
			"Tests cover parseArchitectureMarkdown() with sample AI output",
			"Tests cover parseSkillMarkdown() with sample AI output",
			"All parser tests pass"
		],
		"passes": true
	},
	{
		"id": "M7.1",
		"category": "Parser Tests",
		"description": "Test parse failure behavior",
		"steps_to_verify": [
			"parseArchitectureMarkdown() throws on missing projectType",
			"parseSkillMarkdown() throws on missing name",
			"Error messages are descriptive (include what was missing)"
		],
		"passes": true
	},
	{
		"id": "M8.0",
		"category": "Type Safety",
		"description": "Ensure type check passes",
		"steps_to_verify": [
			"bun run check-types completes with no errors in packages/sdk",
			"bun run check-types completes with no errors in apps/cli",
			"No @ts-ignore or @ts-expect-error added to bypass errors"
		],
		"passes": true
	},
	{
		"id": "M8.1",
		"category": "Type Safety",
		"description": "Ensure Zod schemas are still used for type definitions",
		"steps_to_verify": [
			"ArchitectureSchema still exists in packages/types/src/schemas.ts",
			"SkillSchema still exists in packages/types/src/schemas.ts",
			"Architecture type is inferred from ArchitectureSchema",
			"Skill type is inferred from SkillSchema"
		],
		"passes": true
	},
	{
		"id": "M9.0",
		"category": "End-to-End Verification",
		"description": "CLI ow pull command works end-to-end",
		"steps_to_verify": [
			"ow pull tanstack/router completes without error",
			"Streaming output is displayed during generation",
			"All 7 files are created in ~/.ow/analyses/github--tanstack--router/",
			"SKILL.md is installed to ~/.config/opencode/skill/tanstack/router/",
			"No JSON parsing errors in output"
		],
		"passes": false
	},
	{
		"id": "M9.1",
		"category": "End-to-End Verification",
		"description": "CLI ow generate command works end-to-end",
		"steps_to_verify": [
			"ow generate on a local repo completes without error",
			"Streaming output is displayed during generation",
			"All 7 files are created in ~/.ow/analyses/local--{hash}/",
			"architecture.json is valid JSON",
			"skill.json is valid JSON"
		],
		"passes": false
	}
]
```

## Implementation Notes

### Streaming Display

The onStream callback should be passed through the entire pipeline so users see real-time progress:

- CLI handlers pass onStream to pipeline
- Pipeline passes to generate functions
- Generate functions pass to streamPrompt
- streamPrompt calls onStream with each text chunk from OpenCode events

### Parse Failure Behavior

All parsers throw on critical missing data:

- Architecture requires: projectType
- Skill requires: name
- Other fields use sensible defaults (empty arrays, empty strings)

### Timeout Configuration

- Default timeout: 120 seconds per generation step
- Total pipeline time: up to 6 minutes (3 generations x 2 min each)
- Timeout errors include helpful context about which step failed

### Dependencies

```
Remove: zod-to-json-schema from packages/sdk
Keep: zod (still used for type definitions and optional validation)
```

### Files to Create

```
packages/sdk/src/analysis/parsers.ts
packages/sdk/src/__tests__/parsers.test.ts
```

### Files to Modify

```
packages/sdk/src/ai/opencode.ts (rewrite)
packages/sdk/src/ai/index.ts (update exports)
packages/sdk/src/analysis/generate.ts (rewrite prompts, add parser calls)
packages/sdk/src/analysis/pipeline.ts (minor - pass onStream)
packages/sdk/package.json (remove zod-to-json-schema)
```

### Files to Keep Unchanged

```
packages/types/src/schemas.ts (keep all schemas)
packages/sdk/src/analysis/context.ts (unchanged)
packages/sdk/src/importance/ranker.ts (unchanged)
apps/cli/src/handlers/pull.ts (unchanged - calls pipeline)
apps/cli/src/handlers/generate.ts (unchanged - calls pipeline)
```
