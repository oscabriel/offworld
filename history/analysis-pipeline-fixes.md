# Analysis Pipeline Fixes

**Date:** 2026-01-11
**Context:** Post-mortem from `ow pull --repo tanstack/query` test run

## Issues Identified

| Issue | Severity | Root Cause |
|-------|----------|------------|
| AI prompt leakage (`[search-mode]`, `[SUPERMEMORY]`) | Critical | User plugins loaded in embedded server |
| Skill name uses full local path | Critical | Arguments swapped in `buildSkeleton()` call |
| Analysis path malformed (`--Users--oscargabriel--...`) | High | Path encoding applied to full path |
| Search patterns too generic | Medium | No separation of library vs example code |
| Framework detection unnecessary | Low | CLI targets libraries, not user apps |

## Task Breakdown

### Task 1: Fix Argument Order in Pipeline (Critical)

**File:** `packages/sdk/src/analysis/pipeline.ts` (line 396)

```typescript
// Current (WRONG - arguments swapped):
const skeleton = buildSkeleton(basename(repoPath), repoPath, rankedFiles, parsedFiles);

// Fix:
const skeleton = buildSkeleton(repoPath, basename(repoPath), rankedFiles, parsedFiles);
```

---

### Task 2: Disable User Plugins/MCPs in Embedded Server

**File:** `packages/sdk/src/ai/opencode.ts`

Add these fields to prevent loading user-level config:

```typescript
const config: Config = {
  plugin: [],        // Don't load any plugins
  mcp: {},           // Don't load any MCPs
  instructions: [],  // Don't load instruction files
  
  agent: {
    // ... existing agent config ...
  },
};
```

---

### Task 3: Pass Qualified Name Through Pipeline

**Files:** `pipeline.ts`, `skeleton.ts`, `merge.ts`, `pull.ts`

1. Add `qualifiedName` to `AnalysisPipelineOptions`
2. Pass through to skeleton/merge
3. In pull handler, pass `source.fullName` for remote repos

---

### Task 4: Fix Analysis Path Encoding

**File:** `packages/sdk/src/analysis/merge.ts`

Use `qualifiedName` parameter for analysis path key instead of deriving from `skeleton.name`.

---

### Task 5: Remove Framework Detection, Keep Language Only

**File:** `packages/sdk/src/analysis/skeleton.ts`

- Remove `detectFramework()` entirely
- Keep `detectLanguage()` (TypeScript, JavaScript, Python, etc.)
- Simplify `DetectedPatterns` interface:

```typescript
export interface DetectedPatterns {
  language: string;
  hasTests: boolean;
  hasDocs: boolean;
}
```

---

### Task 6: Update Prose Prompt (Remove Framework References)

**File:** `packages/sdk/src/analysis/prose.ts`

- Remove framework from prompt context
- Keep language info only
- Remove framework-specific requirements

---

### Task 7: Improve Search Pattern Generation

**File:** `packages/sdk/src/analysis/skeleton.ts`

Separate library code from examples, prioritize library patterns.

---

### Task 8: Add Integration Tests

**File:** `packages/sdk/src/__tests__/pipeline.integration.test.ts` (new)

Test clean JSON output, proper naming, language detection.

---

## Implementation Order

| # | Task | Notes |
|---|------|-------|
| 1 | Fix argument swap | Critical bug |
| 2 | Disable plugins/MCPs | 3 lines added |
| 3 | Pass qualified name | Threading through |
| 4 | Fix path encoding | Depends on #3 |
| 5 | Remove framework detection | Simplification |
| 6 | Update prose prompt | Depends on #5 |
| 7 | Search patterns | Polish |
| 8 | Integration tests | Quality |

## Evidence from Test Run

**Verbose output showed:**
- 913 files parsed, 1750 symbols extracted
- Framework detection produced misleading "Angular" result
- First AI attempt failed due to prompt leakage
- Retry succeeded but with markdown fences around JSON
- Dependency hubs correctly showed react-query as most imported (29 imports)

**Generated files location:**
- `~/.ow/analyses/github--tanstack--query/`
- `~/.config/opencode/skill/tanstack/query/SKILL.md`
