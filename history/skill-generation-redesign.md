# Skill Generation Redesign

**Date:** 2026-01-14  
**Status:** Proposed

## Problem Statement

Current skill generation pipeline produces files that are:

1. **Not user-focused** — describes internal structure, not usage patterns
2. **Missing actionable content** — no import statements, no copy-paste code
3. **Analyzing wrong content** — TanStack Router skill described the e2e test suite, not the router library
4. **Useless architecture diagrams** — file-level dependency graphs instead of conceptual architecture

### Evidence

Generated TanStack Router SKILL.md:

```yaml
description: Comprehensive Playwright-based e2e test suite validating TanStack Router/Start features...

## When to Use

- need to add e2e tests for router features
```

This is useless. A developer says "add routing to my app" — not "need to add e2e tests."

Generated Zod architecture.md shows `vitest.root.mjs` as the only dependency node. Nobody cares.

## Design Decision

**Progressive disclosure with audience separation:**

- SKILL.md = User-focused (imports, usage, common ops)
- references/ = Deeper content, split by audience (user vs contributor)

Users become contributors after familiarizing with a library. Both audiences need to be served, but at different depths.

---

## Proposed Structure

```
{library}-reference/
├── SKILL.md                      # User-focused: imports, usage, common ops
└── references/
    ├── quickstart.md             # User: installation, setup, hello world
    ├── api-patterns.md           # User: common operations with code
    ├── troubleshooting.md        # User: error → fix mappings
    ├── architecture.md           # Contributor: internal concepts, data flow
    ├── extending.md              # Contributor: plugins, adapters, hooks
    └── file-map.md           # Contributor: file locations, entry points
```

## Content Strategy

| File                   | Audience    | Triggered By                  | Content                                |
| ---------------------- | ----------- | ----------------------------- | -------------------------------------- |
| **SKILL.md**           | User        | Default activation            | Imports, "when to use", 5-7 common ops |
| **quickstart.md**      | User        | "setup", "install", "start"   | Install, configure, hello world        |
| **api-patterns.md**    | User        | "how do I X", "example of"    | 15-20 code snippets                    |
| **troubleshooting.md** | User        | "error", "not working"        | Symptom → Cause → Fix                  |
| **architecture.md**    | Contributor | "how does X work internally"  | Concepts, data flow, design decisions  |
| **extending.md**       | Contributor | "write plugin", "extend"      | Extension points, interfaces           |
| **file-map.md**        | Contributor | "where is X", "find code for" | File paths, module purposes            |

---

## SKILL.md Template

```yaml
---
name: { library }
description: { keyword-rich, user-task-oriented description }
allowed-tools: [Read, Grep, Glob]
---
```

# {Library Name}

{One-line user value prop}

## When to Use

- "{natural language trigger 1}"
- "{natural language trigger 2}"
- "{natural language trigger 3}"
- "{natural language trigger 4}"
- "{natural language trigger 5}"

## Import Patterns

```typescript
import { x } from "{package}"; // {purpose}
import { y } from "{package}/sub"; // {purpose}
```

## Quick Start

```typescript
// Minimal working example (5-10 lines)
```

## Common Operations

| Task     | Code        |
| -------- | ----------- |
| {task 1} | `{snippet}` |
| {task 2} | `{snippet}` |
| {task 3} | `{snippet}` |

## Troubleshooting

| Symptom         | Fix        |
| --------------- | ---------- |
| {error message} | {solution} |

## Go Deeper

- **[quickstart.md](references/quickstart.md)** — Full setup guide
- **[api-patterns.md](references/api-patterns.md)** — Extended examples
- **[architecture.md](references/architecture.md)** — How it works internally
- **[extending.md](references/extending.md)** — Write plugins/adapters
- **[file-map.md](references/file-map.md)** — Find code locations

---

## Reference File Templates

### quickstart.md (User)

# Quick Start

## Installation

```bash
npm install {package}
```

## Environment Setup

```env
{ENV_VAR}={value}
```

## Basic Configuration

```typescript
// Full annotated config example
```

## Hello World

```typescript
// Complete working example
```

## Next Steps

- [Common patterns](api-patterns.md)
- [Troubleshooting](troubleshooting.md)

### api-patterns.md (User)

# API Patterns

## {Category 1}

### {Operation}

```typescript
// Full code example with comments
```

## {Category 2}

### {Operation}

```typescript
// Full code example
```

### troubleshooting.md (User)

# Troubleshooting

## Common Errors

| Symptom         | Cause            | Fix          |
| --------------- | ---------------- | ------------ |
| {error message} | {why it happens} | {how to fix} |

## FAQ

### {Common question}?

{Answer with code if applicable}

### architecture.md (Contributor)

# Architecture

> Internal architecture reference for contributors.

## Core Concepts

| Concept  | Purpose                  | Location        |
| -------- | ------------------------ | --------------- |
| {Router} | {coordinates navigation} | `src/router.ts` |
| {Route}  | {defines path mapping}   | `src/route.ts`  |

## Data Flow

User Action → {step 1} → {step 2} → {step 3} → Output

## Key Abstractions

### {Abstraction Name}

{What it is, why it exists}

```typescript
interface {Name} {
  // Core interface
}
```

## Design Decisions

### Why {decision}?

{Rationale}

### extending.md (Contributor)

# Extending {Library}

## Extension Points

| Type    | Interface            | Purpose            |
| ------- | -------------------- | ------------------ |
| Plugin  | `{PluginInterface}`  | {what plugins do}  |
| Adapter | `{AdapterInterface}` | {what adapters do} |

## Writing a Plugin

```typescript
// Full annotated example
```

## Hooks / Lifecycle

| Hook  | When     | Use Case  |
| ----- | -------- | --------- |
| `onX` | {timing} | {purpose} |

### file-map.md (Contributor)

# Codebase Map

> Where to find things in the source code.

## Directory Structure

```
{package}/
├── src/
│   ├── index.ts      # Public exports
│   ├── core/         # Core logic
│   └── plugins/      # Built-in plugins
├── tests/
└── examples/
```

## Entry Points

| Entry  | Path                  | Purpose     |
| ------ | --------------------- | ----------- |
| Main   | `src/index.ts`        | Public API  |
| Client | `src/client/index.ts` | Client-side |

## Key Files by Feature

| Feature   | Files                           |
| --------- | ------------------------------- |
| {Routing} | `src/router.ts`, `src/route.ts` |

## Finding Things

| Looking for...    | Search pattern                      |
| ----------------- | ----------------------------------- |
| Route definitions | `createRoute` in `src/`             |
| Plugin interface  | `interface.*Plugin` in `src/types/` |

---

## Pipeline Changes Required

### 1. Separate Analysis Passes

```typescript
interface AnalysisResult {
	// User-facing (from README, docs, examples, public API)
	userFacing: {
		imports: ImportPattern[];
		quickStart: string;
		commonOperations: Operation[];
		troubleshooting: TroubleshootingEntry[];
	};

	// Contributor-facing (from source code analysis)
	contributorFacing: {
		architecture: ArchitectureConcept[];
		extensionPoints: ExtensionPoint[];
		codebaseMap: CodebaseMapEntry[];
		dependencyGraph: DependencyGraph;
	};
}
```

### 2. Different Extraction Sources

| Content           | Extract From                                      |
| ----------------- | ------------------------------------------------- |
| Imports           | `package.json` exports + `index.ts` files         |
| Quick start       | README.md "Getting Started" section               |
| Common operations | README examples + `examples/` folder + test files |
| Troubleshooting   | GitHub issues, README FAQ, error constants        |
| Architecture      | Source code analysis, CONTRIBUTING.md             |
| Extension points  | Plugin/adapter interfaces, hooks                  |
| Codebase map      | Directory structure + file exports                |

### 3. Two AI Prompts

**Prompt 1: User-Facing Content**

```
You are creating a quick-reference card for developers USING this library.

From the README and examples, extract:
1. Import statements (what users actually write)
2. 10-15 common operations with copy-paste code
3. Natural language phrases users say when they need this
4. Common errors and their fixes

DO NOT describe what the library does abstractly.
DO show concrete code users can copy.
```

**Prompt 2: Contributor-Facing Content**

```
You are creating a contributor guide for developers who want to understand or modify this library.

From the source code, extract:
1. Core architectural concepts and how they relate
2. Extension points (plugins, adapters, hooks) with interfaces
3. Key files and what they're responsible for
4. Design decisions and their rationale (if documented)

Focus on "where is X" and "how does Y work internally."
```

### 4. Source Prioritization

**For user-facing content, prioritize:**

1. README.md (especially examples, quick start)
2. Official docs/ folder
3. examples/ folder
4. Test files (for usage patterns)
5. package.json exports (for import paths)

**For contributor-facing content, prioritize:**

1. CONTRIBUTING.md
2. Source code in src/ or lib/
3. Type definitions
4. Internal docs or ADRs
5. Code comments

**Explicitly deprioritize:**

- e2e tests, benchmarks, CI configs for user content
- README marketing copy for contributor content

---

## Schema Changes

### New Types (packages/types/src/schemas.ts)

```typescript
export const ImportPatternSchema = z.object({
	import: z.string(), // e.g., "import { z } from 'zod'"
	purpose: z.string(), // e.g., "Main entry point"
});

export const TroubleshootingEntrySchema = z.object({
	symptom: z.string(),
	cause: z.string(),
	fix: z.string(),
});

export const ArchitectureConceptSchema = z.object({
	name: z.string(),
	purpose: z.string(),
	location: z.string(), // file path
});

export const ExtensionPointSchema = z.object({
	type: z.string(), // "plugin", "adapter", "hook"
	interface: z.string(), // interface name
	purpose: z.string(),
	example: z.string().optional(),
});

export const CodebaseMapEntrySchema = z.object({
	path: z.string(),
	purpose: z.string(),
	exports: z.array(z.string()).optional(),
});
```

### Extended Skill Schema

```typescript
export const SkillSchema = z.object({
	name: z.string(),
	description: z.string(),

	// User-facing
	importPatterns: z.array(ImportPatternSchema).optional(),
	whenToUse: z.array(z.string()).min(5),
	quickStartCode: z.string().optional(),
	commonOperations: z
		.array(
			z.object({
				task: z.string(),
				code: z.string(),
			}),
		)
		.optional(),
	troubleshooting: z.array(TroubleshootingEntrySchema).optional(),

	// Contributor-facing (stored separately but part of skill data)
	architecture: z.array(ArchitectureConceptSchema).optional(),
	extensionPoints: z.array(ExtensionPointSchema).optional(),
	codebaseMap: z.array(CodebaseMapEntrySchema).optional(),

	// Existing fields
	basePaths: z.object({ repo: z.string(), analysis: z.string() }).optional(),
	quickPaths: z.array(QuickPathSchema),
	searchPatterns: z.array(SearchPatternSchema),
	bestPractices: z.array(z.string()).optional(),
	commonPatterns: z.array(CommonPatternSchema).optional(),
});
```

---

## Token Budget

| File               | Lines | Purpose                           |
| ------------------ | ----- | --------------------------------- |
| SKILL.md           | ~150  | Always loaded on activation       |
| quickstart.md      | ~200  | Loaded for setup tasks            |
| api-patterns.md    | ~300  | Loaded for "how do I" questions   |
| troubleshooting.md | ~100  | Loaded for error resolution       |
| architecture.md    | ~300  | Loaded for internals questions    |
| extending.md       | ~200  | Loaded for plugin/extension tasks |
| file-map.md        | ~150  | Loaded for "where is" questions   |

**Total:** ~1400 lines across 7 files  
**Per-request:** ~150-450 lines (SKILL.md + 1-2 reference files)

---

## Key Insights from Research

### From Agent Skills Spec (agentskills.io)

- Skills are folders with SKILL.md + optional references/
- Frontmatter contains name, description for discovery
- Description should be keyword-rich for agent matching
- Progressive disclosure: metadata first, full content on activation

### From codebase-documenter Skill

- "When to Use" section with natural language triggers
- Explicit tool mapping (which tool for which task)
- Depth levels (minimal/standard/full)
- Success criteria (verifiable checkpoints)

### From better-auth Analysis

- Import patterns are #1 agent search query
- Decision trees route faster than prose
- Copy-paste code > abstract descriptions
- Troubleshooting tables are high ROI

---

## Implementation Priority

### Phase 1: Core Structure

1. Update schema with new types
2. Modify SKILL.md template in `formatSkillMd`
3. Add reference file generation

### Phase 2: Extraction Logic

1. Add README parsing for user-facing content
2. Add package.json export mapping
3. Separate library code from test/example code

### Phase 3: AI Prompts

1. Split into user-facing and contributor-facing prompts
2. Request concrete code, not abstract descriptions
3. Add quality validation for actionable content

### Phase 4: Reference Files

1. Generate quickstart.md from README
2. Generate api-patterns.md from examples
3. Generate architecture.md from source analysis
4. Generate file-map.md from file structure

---

## Success Criteria

A generated skill is useful when:

- [ ] Import patterns match what users actually write
- [ ] "When to Use" triggers match natural language queries
- [ ] Common operations have copy-paste code
- [ ] Troubleshooting covers top 5 errors from GitHub issues
- [ ] Architecture explains concepts, not just file dependencies
- [ ] Codebase map answers "where is X" questions

## Anti-Patterns to Avoid

- Describing test infrastructure as if it's the main library
- File-level dependency graphs without conceptual meaning
- Abstract descriptions instead of concrete code
- Generic "When to Use" triggers like "when you need this library"
- Architecture diagrams showing internal file imports
