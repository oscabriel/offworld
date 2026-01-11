# Test Suite Improvement Plan

## Overview

This plan addresses the test audit findings to improve test quality and coverage across the codebase. The goal is to ensure tests verify actual system behavior rather than just mock call patterns.

## Current State

- **350 tests across 17 files**
- Good tests: Schema validation, Convex backend tests
- Weak tests: SDK tests that over-mock external dependencies
- Critical gaps: No tests for analysis generation, AI integrations, auth, pipeline

---

## Phase 1: Add Pure Function Tests (Easy Wins)

**Goal:** Test functions with no external dependencies - highest ROI, no mocking needed.

### 1.1 Create `generate.test.ts`

**File:** `packages/sdk/src/__tests__/generate.test.ts`

Test these pure functions from `analysis/generate.ts`:

| Function | Test Cases |
|----------|------------|
| `sanitizeMermaidId()` | Empty string, special chars, unicode, numeric-only, leading/trailing underscores |
| `escapeYaml()` | Quotes, backslashes, newlines, combinations |
| `formatArchitectureMd()` | Empty entities, special chars in labels, missing optional patterns, entity relationships |
| `formatSkillMd()` | Empty arrays, special YAML chars, multiline descriptions, all sections populated |

### 1.2 Create `auth.test.ts`

**File:** `packages/sdk/src/__tests__/auth.test.ts`

Test these pure/near-pure functions from `auth.ts`:

| Function | Test Cases |
|----------|------------|
| `getAuthPath()` | Returns correct path based on metaRoot |
| `getTokenOrNull()` | Returns null on error, returns token on success |
| `isLoggedIn()` | True/false cases |
| `getAuthStatus()` | Not logged in, expired token, valid token, missing expiresAt |

### 1.3 Create `pipeline.test.ts` (pure parts)

**File:** `packages/sdk/src/__tests__/pipeline.test.ts`

Test `expandTilde()` from `analysis/pipeline.ts`:
- Paths with `~/`
- Absolute paths (no expansion)
- Paths without tilde

---

## Phase 2: Improve Existing Mock-Heavy Tests

**Goal:** Upgrade tests from "verify mocks called" to "verify behavior with realistic mocks".

### 2.1 Upgrade `clone.test.ts`

**Current problem:** Tests only verify `execSync` is called with expected string.

**Improvement:** Use the existing `git.ts` mock infrastructure properly:

```typescript
// Use the sophisticated git mock that already exists
import { createExecSyncMock, configureGitMock } from "./mocks/git.js";

// Configure realistic git behavior
configureGitMock({
  clone: { success: true },
  'rev-parse': { output: 'abc123def456' }
});
```

**Add tests for:**
- Git command failure scenarios (network errors, auth failures)
- Partial clone failures (cleanup behavior)
- Index update verification after clone

### 2.2 Upgrade `config.test.ts` and `index-manager.test.ts`

**Current problem:** Mocks fs at module level, tests verify mock calls.

**Improvement:** Use the existing `fs.ts` mock with virtual file system:

```typescript
import { initVirtualFs, addVirtualFile, clearVirtualFs } from "./mocks/fs.js";

beforeEach(() => {
  initVirtualFs({
    "~/.ow/config.json": JSON.stringify({ repoRoot: "/custom/path" })
  });
});
```

**Add tests for:**
- Real JSON parsing with malformed files
- Directory creation logic
- File permission scenarios

### 2.3 Upgrade `ai-provider.test.ts`

**Current problem:** Mocks both execSync and fetch, tests mock call patterns.

**Improvement:** Test actual detection logic with realistic mock responses:

```typescript
// Test the priority logic in detectProvider
it("prefers claude-code when both available", async () => {
  mockExecSync.mockReturnValue("Claude Code v1.0"); // Claude available
  mockFetch.mockResolvedValue({ ok: true }); // OpenCode available

  const result = await detectProvider();
  expect(result.provider).toBe("claude-code"); // Verify priority
  expect(result.isPreferred).toBe(false); // No preference set
});
```

---

## Phase 3: Add Missing AI Integration Tests

**Goal:** Test AI provider integrations with mocked SDKs.

### 3.1 Create `claude-code.test.ts`

**File:** `packages/sdk/src/__tests__/claude-code.test.ts`

Mock the `@anthropic-ai/claude-agent-sdk`:

```typescript
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn()
}));
```

**Test scenarios:**
- Successful analysis with valid structured output
- Error: max_turns exceeded
- Error: budget exceeded
- Error: execution error
- Schema validation failure
- Empty result handling

### 3.2 Create `opencode.test.ts`

**File:** `packages/sdk/src/__tests__/opencode.test.ts`

Mock the `@opencode-ai/sdk` and fetch:

**Test scenarios:**
- Server health check passes → successful analysis
- Server health check fails → OpenCodeConnectionError
- Session creation failure
- Invalid JSON response
- Session cleanup on error (finally block)
- Timeout handling

---

## Phase 4: Add Pipeline Integration Tests

**Goal:** Test the analysis pipeline end-to-end with mocked dependencies.

### 4.1 Create `pipeline.test.ts` (integration)

**File:** `packages/sdk/src/__tests__/pipeline.test.ts`

Mock all pipeline dependencies:

```typescript
vi.mock("../clone.js", () => ({ getCommitSha: vi.fn() }));
vi.mock("../importance/ranker.js", () => ({ rankFileImportance: vi.fn() }));
vi.mock("./context.js", () => ({ gatherContext: vi.fn() }));
vi.mock("./generate.js", () => ({
  generateSummary: vi.fn(),
  extractArchitecture: vi.fn(),
  generateSkill: vi.fn()
}));
```

**Test scenarios:**
- Full pipeline execution with all steps
- Progress callback invocation
- Local repo path handling (hashed)
- Remote repo path handling (provider + fullName)
- Error propagation from each step
- File saving verification

### 4.2 Test `installSkill()` and `saveAnalysis()`

Use temp directories for actual file I/O testing:

```typescript
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "offworld-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true });
});
```

---

## Phase 5: Remove Low-Value Tests

**Goal:** Delete tests that provide no actual value.

### 5.1 Remove "function exists" tests

Delete tests like:

```typescript
// DELETE THESE
it("rankFileImportance function exists", async () => {
  expect(typeof rankFileImportance).toBe("function");
});

it("ExtractedImport has correct shape", async () => {
  expect(typeof extractImports).toBe("function");
});
```

TypeScript already guarantees exports exist. These tests waste CI time.

**Files to clean up:**
- `importance.test.ts` - Remove ~10 "function exists" tests

---

## Phase 6: Add Integration Test Infrastructure (Optional)

**Goal:** Create real integration tests that hit actual systems.

### 6.1 Create integration test directory

```
packages/sdk/src/__tests__/
  ├── unit/           # Existing unit tests (renamed)
  └── integration/    # New integration tests
      ├── clone.integration.test.ts
      └── provider.integration.test.ts
```

### 6.2 Add integration test script

**File:** `packages/sdk/package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --exclude '**/*.integration.test.ts'",
    "test:integration": "vitest run --include '**/*.integration.test.ts'"
  }
}
```

### 6.3 Create sample integration test

```typescript
// clone.integration.test.ts
describe("cloneRepo integration", () => {
  it("clones a real small repo", async () => {
    const source = parseRepoInput("octocat/Hello-World");
    const path = await cloneRepo(source, { shallow: true });

    expect(existsSync(join(path, ".git"))).toBe(true);
  }, 30000);
});
```

---

## Implementation Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Phase 1: Pure function tests | Low | High |
| 2 | Phase 5: Remove useless tests | Low | Medium |
| 3 | Phase 2: Upgrade mock tests | Medium | High |
| 4 | Phase 3: AI integration tests | Medium | High |
| 5 | Phase 4: Pipeline tests | Medium | High |
| 6 | Phase 6: Integration infra | High | Medium |

---

## Files to Create/Modify

### New Files
- `packages/sdk/src/__tests__/generate.test.ts`
- `packages/sdk/src/__tests__/auth.test.ts`
- `packages/sdk/src/__tests__/claude-code.test.ts`
- `packages/sdk/src/__tests__/opencode.test.ts`
- `packages/sdk/src/__tests__/pipeline.test.ts`

### Files to Modify
- `packages/sdk/src/__tests__/clone.test.ts` - Upgrade mocking
- `packages/sdk/src/__tests__/config.test.ts` - Use virtual fs
- `packages/sdk/src/__tests__/index-manager.test.ts` - Use virtual fs
- `packages/sdk/src/__tests__/ai-provider.test.ts` - Test actual logic
- `packages/sdk/src/__tests__/importance.test.ts` - Remove useless tests

---

## Verification

After implementation, run:

```bash
# Run all tests
bun run test

# Check coverage (should increase)
bunx vitest run --coverage

# Verify new test files work
bunx vitest run packages/sdk/src/__tests__/generate.test.ts
bunx vitest run packages/sdk/src/__tests__/auth.test.ts
bunx vitest run packages/sdk/src/__tests__/pipeline.test.ts
```

**Expected outcomes:**
- Test count increases by ~80-100 tests
- Coverage for `generate.ts` increases from 0% to 80%+
- Coverage for `auth.ts` increases from 0% to 90%+
- Coverage for `pipeline.ts` increases from 0% to 70%+
- No "function exists" tests remain
