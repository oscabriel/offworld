# Migration Plan: JSON Schemas to Markdown Templates

**Date**: 2025-01-10  
**Status**: Approved  
**Related**: Analysis pipeline, OpenCode integration

## Problem Statement

The current analysis generation workflow forces structured JSON output through OpenCode, which doesn't support it. This causes:

- Fragile 70-line `extractJSON()` bracket-matching logic
- Frequent JSON parsing failures
- Schema validation errors when AI doesn't follow format
- No streaming feedback to users during generation

**BTCA uses the same OpenCode SDK successfully** by using simple markdown prompts instead of JSON schemas.

## Decision

Adopt the BTCA pattern:

1. Replace JSON schema prompts with markdown templates
2. Stream responses to show progress
3. Parse markdown into structured objects
4. Keep saving all files to `~/.ow/` as before

## Configuration

| Setting                  | Value                                                                           |
| ------------------------ | ------------------------------------------------------------------------------- |
| Streaming display        | Yes, show progress to user                                                      |
| Parse failure behavior   | Fail entirely (throw error)                                                     |
| Timeout per generation   | 120 seconds                                                                     |
| Skill output locations   | `~/.config/opencode/skill/{repo}/SKILL.md` + `~/.claude/skills/{repo}/SKILL.md` |
| Analysis output location | `~/.ow/analyses/{provider}--{owner}--{repo}/`                                   |

---

## Files to Modify

| File                                    | Change Type  | Description                                          |
| --------------------------------------- | ------------ | ---------------------------------------------------- |
| `packages/sdk/src/ai/opencode.ts`       | **Rewrite**  | Remove JSON schema logic, simplify to streaming text |
| `packages/sdk/src/ai/index.ts`          | **Simplify** | Export simpler `streamPrompt()` API                  |
| `packages/sdk/src/analysis/generate.ts` | **Rewrite**  | Markdown templates + parsers                         |
| `packages/sdk/src/analysis/parsers.ts`  | **New file** | Markdown parsing utilities                           |
| `packages/sdk/src/analysis/pipeline.ts` | **Minor**    | Update calls to new generate functions               |
| `packages/types/src/schemas.ts`         | **Keep**     | Schemas still used for validation & types            |

---

## Phase 1: Simplify OpenCode Integration

**File: `packages/sdk/src/ai/opencode.ts`**

### Remove

- `zodToJsonSchema` import and usage
- `extractJSON()` function (70 lines of bracket matching)
- `OpenCodeAnalysisOptions.schema` parameter
- JSON parsing and schema validation logic

### Keep

- Embedded server pattern (`createOpencode`, `createOpencodeClient`)
- Event streaming infrastructure
- Retry logic for server startup
- `docs` agent config with restricted tools

### New API

```typescript
export interface StreamPromptOptions {
	prompt: string;
	cwd: string;
	systemPrompt?: string;
	timeoutMs?: number; // Default: 120000 (2 minutes)
	onDebug?: (message: string) => void;
	onStream?: (text: string) => void;
}

export interface StreamPromptResult {
	text: string;
	sessionId: string;
	durationMs: number;
}

export async function streamPrompt(options: StreamPromptOptions): Promise<StreamPromptResult>;
```

---

## Phase 2: Markdown Templates

**File: `packages/sdk/src/analysis/generate.ts`**

Replace each function with markdown template + parser.

### `generateSummary()`

**Template prompt:**

```markdown
Analyze this repository and write a summary in this exact format:

## Purpose

[1-2 sentences describing what this project does]

## Key Features

- [feature 1]
- [feature 2]
- [feature 3]

## Technologies

- **Language**: [primary language]
- **Framework**: [main framework if any]
- **Build Tool**: [build tool]
- **Other**: [other notable tech]

## Architecture Overview

[2-3 sentences about code organization]
```

**Parser:** Return raw markdown (it's already the desired format for `summary.md`)

---

### `extractArchitecture()`

**Template prompt:**

```markdown
Analyze the codebase architecture and respond in this exact format:

## Project Type

[ONE OF: monorepo | library | cli | app | framework]

## Entities

For each major module/package:

### [entity-name]

- **Type**: [package | module | feature | util | config]
- **Path**: [relative path]
- **Description**: [what it does]
- **Responsibilities**: [comma-separated list]

## Relationships

List dependencies between entities:

- [from] -> [to]: [relationship type]

## Key Files

- `[path]`: [role/purpose]

## Patterns

- **Framework**: [detected framework or "none"]
- **Build Tool**: [detected build tool]
- **Test Framework**: [detected test framework]
- **Language**: [primary language]
```

**Parser function:**

```typescript
function parseArchitectureMarkdown(md: string): Architecture {
	const projectType = parseProjectType(md);
	const entities = parseEntitiesSection(md);
	const relationships = parseRelationshipsSection(md);
	const keyFiles = parseKeyFilesSection(md);
	const patterns = parsePatternsSection(md);
	return { projectType, entities, relationships, keyFiles, patterns };
}
```

---

### `generateSkill()`

**Template prompt:**

```markdown
Generate an AI assistant skill file for this codebase in this exact format:

## Skill Info

- **Name**: [short-kebab-case-name]
- **Description**: [one sentence]

## Allowed Tools

- [tool1]
- [tool2]

## Repository Structure

- `[path]`: [purpose]

## Key Files

- `[path]`: [description]

## Search Strategies

- [strategy 1]
- [strategy 2]

## When to Use

- [trigger condition 1]
- [trigger condition 2]
```

**Parser function:**

```typescript
function parseSkillMarkdown(md: string): Skill {
	const name = extractField(md, "Name");
	const description = extractField(md, "Description");
	const allowedTools = parseListSection(md, "## Allowed Tools");
	const repositoryStructure = parsePathPurposeSection(md, "## Repository Structure");
	const keyFiles = parsePathDescSection(md, "## Key Files");
	const searchStrategies = parseListSection(md, "## Search Strategies");
	const whenToUse = parseListSection(md, "## When to Use");
	return {
		name,
		description,
		allowedTools,
		repositoryStructure,
		keyFiles,
		searchStrategies,
		whenToUse,
	};
}
```

---

## Phase 3: Create Parser Utilities

**New file: `packages/sdk/src/analysis/parsers.ts`**

```typescript
/**
 * Markdown parsing utilities for extracting structured data from AI responses.
 * These parsers are intentionally lenient - they extract what they can and
 * provide sensible defaults for missing data.
 */

// Extract a single field value: "**Name**: value" -> "value"
export function extractField(md: string, fieldName: string): string;

// Parse a bullet list section into string array
export function parseListSection(md: string, header: string): string[];

// Parse "- `path`: description" format
export function parsePathDescSection(
	md: string,
	header: string,
): Array<{ path: string; description: string }>;

// Parse "- `path`: purpose" format
export function parsePathPurposeSection(
	md: string,
	header: string,
): Array<{ path: string; purpose: string }>;

// Parse entity blocks (### name + metadata)
export function parseEntitiesSection(md: string): Entity[];

// Parse "- from -> to: type" format
export function parseRelationshipsSection(md: string): Relationship[];

// Parse patterns section
export function parsePatternsSection(md: string): Patterns;

// Parse project type enum
export function parseProjectType(md: string): ProjectType;

// Main parsers
export function parseArchitectureMarkdown(md: string): Architecture;
export function parseSkillMarkdown(md: string): Skill;
```

---

## Phase 4: Update Pipeline

**File: `packages/sdk/src/analysis/pipeline.ts`**

Minimal changes - the function signatures stay the same:

```typescript
// Step 3: Generate summary (returns markdown string)
onProgress("summary", "Generating summary...");
const summary = await generateSummary(context, generateOptions);

// Step 4: Extract architecture (returns Architecture object)
onProgress("architecture", "Extracting architecture...");
const architecture = await extractArchitecture(context, generateOptions);

// Step 6: Generate skill (returns Skill object)
onProgress("skill", "Generating skill...");
const skill = await generateSkill(context, summary, architecture, generateOptions);
```

The save logic remains unchanged - still writes:

- `summary.md` - raw markdown from AI
- `architecture.json` - parsed Architecture object
- `architecture.md` - Mermaid diagram (generated from parsed data)
- `file-index.json` - from importance ranker (unchanged)
- `skill.json` - parsed Skill object
- `SKILL.md` - formatted skill file
- `meta.json` - metadata (unchanged)

---

## Phase 5: Update Exports

**File: `packages/sdk/src/ai/index.ts`**

```typescript
// Remove old exports
// export { runAnalysis } from "./opencode.js";

// Add new exports
export {
	streamPrompt,
	type StreamPromptOptions,
	type StreamPromptResult,
	OpenCodeAnalysisError,
	OpenCodeSDKError,
} from "./opencode.js";
```

---

## Phase 6: Cleanup

### Remove

- `zod-to-json-schema` dependency from `packages/sdk/package.json`
- `extractJSON()` function from `opencode.ts`
- `analyzeWithOpenCode()` function (replaced by `streamPrompt()`)
- `analyzeWithRetry()` function (retry logic moves into `streamPrompt()`)

### Keep

- All Zod schemas in `packages/types/src/schemas.ts` (used for type definitions)
- Error classes (`OpenCodeAnalysisError`, `OpenCodeSDKError`)
- `formatArchitectureMd()` and `formatSkillMd()` in `generate.ts`

---

## Output Verification

After implementation, `~/.ow/analyses/{repo}/` should contain:

```
~/.ow/analyses/{provider}--{owner}--{repo}/
├── summary.md          # Raw markdown from AI
├── architecture.json   # Parsed from markdown
├── architecture.md     # Mermaid diagram (generated from parsed data)
├── file-index.json     # From importance ranker (unchanged)
├── skill.json          # Parsed from markdown
├── SKILL.md            # Formatted skill file
└── meta.json           # Metadata (unchanged)
```

Skill also installed to:

```
~/.config/opencode/skill/{repo}/SKILL.md
~/.claude/skills/{repo}/SKILL.md
```

---

## Risk Mitigation

| Risk                            | Mitigation                                                 |
| ------------------------------- | ---------------------------------------------------------- |
| AI doesn't follow template      | Add examples in prompt, fail with clear error message      |
| Parser regex breaks             | Write unit tests for parsers, validate against Zod schemas |
| Streaming hangs                 | 120 second timeout per generation step                     |
| Different AI models vary output | Test with Claude Sonnet, make parsers lenient where safe   |

---

## Testing Strategy

1. **Unit tests for parsers** - Test each parser function with sample markdown
2. **Integration test** - Run full pipeline on a known repo, verify output files
3. **Manual verification** - Run `ow pull` on 2-3 real repos, check generated files

---

## Implementation Order

1. Create `parsers.ts` with all parsing utilities + tests
2. Rewrite `opencode.ts` to simple `streamPrompt()` with timeout
3. Update `generate.ts` to use markdown templates + parsers
4. Update `ai/index.ts` exports
5. Verify pipeline still works end-to-end
6. Remove old code and unused dependencies
7. Run type check and fix any issues
