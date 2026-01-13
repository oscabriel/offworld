# Ralph Agent Instructions

## Your Task

1. Read `scripts/ralph/PRD.json`
2. Read `scripts/ralph/progress.txt`
   (check Codebase Patterns first)
3. Check you're on the correct branch
4. Pick highest priority story
   where `passes: false`
5. Implement that ONE story
6. Run typecheck and tests
7. Update AGENTS.md files with learnings
8. Commit: `feat: [ID] - [Title]`
9. Update prd.json: `passes: true`
10. Append learnings to progress.txt

## Progress Format

APPEND to progress.txt:

## [Date] - [Story ID]

- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered

---

## Codebase Patterns

### CLI Analysis Pipeline Architecture

```
apps/cli/src/handlers/pull.ts → pullHandler()
    ├─ parseRepoInput()           # Parse "owner/repo" or local path
    ├─ cloneRepo() / updateRepo() # Git operations
    ├─ checkRemote()              # Check offworld.sh for existing analysis
    └─ runAnalysisPipeline()      # packages/sdk/src/analysis/pipeline.ts
        ├─ initLanguages()       # tree-sitter parsers
        ├─ discoverFiles()       # Find source files, skip node_modules etc.
        ├─ parseFile()           # AST parsing per file
        ├─ rankFilesWithAST()    # Heuristic file importance
        ├─ buildSkeleton()       # Deterministic structure (no AI)
        │     └─ quickPaths, searchPatterns, entities, detectedPatterns
        ├─ generateProseWithRetry() # AI prose generation
        │     ├─ streamPrompt()     # packages/sdk/src/ai/opencode.ts
        │     ├─ extractJSON()      # Parse AI response
        │     └─ validateProseQuality()
        ├─ validateConsistency()
        ├─ mergeProseIntoSkeleton()
        ├─ buildDependencyGraph()
        ├─ buildArchitectureGraph()
        └─ buildIncrementalState()
```

### Key Files to Edit (per plan.md)

| File                                    | Purpose                          | Changes Needed                                   |
| --------------------------------------- | -------------------------------- | ------------------------------------------------ |
| `packages/sdk/src/ai/opencode.ts`       | OpenCode embedded server wrapper | Add validation, configurable model, typed errors |
| `packages/sdk/src/ai/errors.ts`         | **NEW**                          | Tagged error types with hints                    |
| `packages/sdk/src/ai/stream/types.ts`   | **NEW**                          | Zod schemas for stream events                    |
| `packages/sdk/src/config.ts`            | Config loading/saving            | Add ai.provider, ai.model fields                 |
| `packages/sdk/src/analysis/pipeline.ts` | Main orchestrator                | Improve error logging                            |

### OpenCode Integration Pattern

```typescript
// opencode.ts creates embedded server per request:
const { createOpencode, createOpencodeClient } = await getOpenCodeSDK();

// Port retry loop (lines 194-211):
for (let attempt = 0; attempt < maxAttempts; attempt++) {
	port = Math.floor(Math.random() * 3000) + 3000;
	server = (await createOpencode({ port, cwd, config })).server;
	client = createOpencodeClient({ baseUrl: `http://localhost:${port}`, directory: cwd });
}

// Session lifecycle:
// 1. client.session.create()
// 2. client.event.subscribe() → AsyncIterable<OpenCodeEvent>
// 3. client.session.prompt({ agent: "explore", parts: [...], model: {...} })
// 4. Process events until session.idle
// 5. server.close()
```

### Config Schema Location

```typescript
// packages/types/src/config.ts (shared types)
// packages/sdk/src/config.ts (loading logic)

export const ConfigSchema = z.object({
	repoRoot: z.string().default("~/ow"),
	metaRoot: z.string().default("~/.ow"),
	skillDir: z.string().default("~/.opencode/skills"),
	defaultShallow: z.boolean().default(true),
	// TODO: Add ai.provider, ai.model
});
```

### Error Handling (Current State)

```typescript
// Only 2 error classes exist:
export class OpenCodeAnalysisError extends Error {
  constructor(message: string, public readonly details?: unknown) { ... }
}

export class OpenCodeSDKError extends OpenCodeAnalysisError {
  constructor() {
    super("Failed to import @opencode-ai/sdk...");
  }
}

// No hints, no provider validation, no typed errors
```

### Stream Event Types (Current State)

```typescript
// Inline casts, no schemas:
const part = props.part as { id?: string; type: string; text?: string } | undefined;

// Events handled: message.part.updated, session.idle, session.error
```

### Prose Generation Flow

```typescript
// packages/sdk/src/analysis/prose.ts

// 1. buildProsePrompt() - constructs prompt with skeleton data
// 2. streamPrompt() - sends to OpenCode, gets raw text
// 3. extractJSON() - parses JSON from response (handles code blocks)
// 4. ProseEnhancementsSchema.parse() - Zod validation
// 5. validateProseQuality() - checks for "slop" patterns
// 6. Retry once on failure with feedback prompt
```

### CLI Handler Pattern

```typescript
// apps/cli/src/handlers/*.ts

export interface PullOptions {
	repo: string;
	verbose?: boolean;
	force?: boolean;
}

export interface PullResult {
	success: boolean;
	repoPath: string;
	analysisSource: "remote" | "local" | "cached";
}

export async function pullHandler(options: PullOptions): Promise<PullResult> {
	const s = p.spinner(); // @clack/prompts spinner
	// ...spinner.start(), spinner.stop(), spinner.message()
}
```

## Stop Condition

If ALL stories pass, reply:
<promise>COMPLETE</promise>

Otherwise end normally.
