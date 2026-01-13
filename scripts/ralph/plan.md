# CLI Analysis Pipeline Audit Results

## Key Finding

Better-context is NOT an analysis pipeline — it's a Q&A tool for answering questions about repos. You copied the OpenCode embedded server pattern correctly, but there are gaps in how you're using it.

---

## Critical Gaps

| Priority | Location    | Gap                          | Current State                        | Recommended Change                                                 |
| -------- | ----------- | ---------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| CRITICAL | opencode.ts | No provider/model validation | Sends prompt, fails later if invalid | Add validateProviderAndModel() BEFORE prompt                       |
| CRITICAL | opencode.ts | Hardcoded model              | claude-sonnet-4-20250514             | Make configurable from config/CLI                                  |
| HIGH     | opencode.ts | Minimal error types          | 2 error classes, no hints            | Add tagged errors with actionable hints                            |
| HIGH     | opencode.ts | Untyped stream events        | Inline as casts                      | Add Zod schemas + transformer layer                                |
| MEDIUM   | opencode.ts | Agent choice                 | Uses explore                         | Consider if explore is right for prose generation (BTCA uses docs) |

---

## Alignment Issues

### 1. Error Handling (Missing Hints)

Current (opencode.ts:19-34):

```typescript
export class OpenCodeAnalysisError extends Error {
  constructor(message: string, public readonly details?: unknown) { ... }
}
```

BTCA Pattern (agent/service.ts:16-78):

```typescript
class AgentError extends Error {
	readonly _tag = "AgentError";
	readonly hint?: string; // <-- actionable guidance
}
class InvalidProviderError extends Error {
	readonly hint: string; // "Available providers: anthropic, openai..."
}
```

Action: Create packages/sdk/src/ai/errors.ts with tagged error types.

---

### 2. Provider/Model Validation (Missing)

Current: No validation — if model is wrong, fails mid-stream.

BTCA Pattern (agent/service.ts:142-165):

```typescript
const validateProviderAndModel = async (client, providerId, modelId) => {
	const response = await client.provider.list();
	// Validates provider exists, is connected, model exists
	// Throws typed error with hint on failure
};
```

Action: Add validation before client.session.prompt().

---

### 3. Model Configuration (Hardcoded)

Current (opencode.ts:239):

```typescript
model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" }
```

BTCA Pattern: Configurable via config service.

Action: Read from ow.config.json or accept as parameter.

---

### 4. Stream Event Typing (Ad-hoc)

Current (opencode.ts:258):

```typescript
const part = props.part as { id?: string; type: string; text?: string } | undefined;
```

BTCA Pattern (stream/types.ts): Full Zod schemas for all event types.

Action: Create packages/sdk/src/ai/stream/types.ts with schemas.

---

## What's Already Correct ✅

| Aspect                  | Status | Notes                                    |
| ----------------------- | ------ | ---------------------------------------- |
| Port retry loop         | ✅     | Matches BTCA pattern                     |
| Plugin/MCP disabling    | ✅     | plugin: [], mcp: {}                      |
| Tool restrictions       | ✅     | Read-only tools                          |
| Session lifecycle       | ✅     | Create → Subscribe → Prompt → Close      |
| Server cleanup          | ✅     | finally { server.close() }               |
| Fire-and-forget pattern | ⚠️     | You await prompt, BTCA uses void (minor) |

---

## What Should Stay Different

| BTCA Feature        | Keep Different? | Reason                                                          |
| ------------------- | --------------- | --------------------------------------------------------------- |
| docs agent          | Yes             | Your explore agent is fine for analysis; BTCA uses docs for Q&A |
| SSE HTTP streaming  | Yes             | BTCA is client-server; you're in-process                        |
| Collection assembly | Yes             | BTCA manages multiple repos; you analyze single repos           |
| Resource symlinks   | Yes             | Not applicable to your pipeline                                 |

---

## Recommended Changes (Priority Order)

### 1. Add Structured Errors (HIGH)

NEW: packages/sdk/src/ai/errors.ts

- InvalidProviderError
- InvalidModelError
- ProviderNotConnectedError
- ServerStartError
- SessionError
- TimeoutError (already exists, add hint)

### 2. Add Provider Validation (CRITICAL)

MODIFY: packages/sdk/src/ai/opencode.ts

- Add validateProviderAndModel() before prompt
- Call client.provider.list() to validate

### 3. Make Model Configurable (CRITICAL)

MODIFY: packages/sdk/src/ai/opencode.ts

- Accept model config from options
- Fall back to default if not provided

MODIFY: packages/sdk/src/config.ts

- Add ai.provider and ai.model to config schema

### 4. Add Stream Types (MEDIUM)

NEW: packages/sdk/src/ai/stream/types.ts
NEW: packages/sdk/src/ai/stream/accumulator.ts
NEW: packages/sdk/src/ai/stream/transformer.ts

### 5. Improve Silent Error Handling (LOW)

MODIFY: packages/sdk/src/analysis/pipeline.ts

- Add onDebug logging to catch blocks (lines 495, 434, 227, etc.)

---

## No Changes Needed

| Area                  | Reason                  |
| --------------------- | ----------------------- |
| AST parsing pipeline  | BTCA doesn't have this  |
| Prose generation flow | Already well-structured |
| Quality validation    | Already robust          |
| Skeleton building     | Already deterministic   |
| Skill installation    | Already complete        |
