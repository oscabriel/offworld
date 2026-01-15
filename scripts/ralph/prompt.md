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

### pipeline.ts - Naming & Installation

```typescript
// Current - does NOT collapse owner==repo
function toSkillDirName(repoName: string): string {
	if (repoName.includes("/")) {
		const [owner, repo] = repoName.split("/");
		return `${owner}-${repo}-reference`;
	}
	return `${repoName}-reference`;
}

// InstallSkillOptions - currently has 3 content fields, needs 5
export interface InstallSkillOptions {
	skillContent: string;
	summaryContent: string;
	architectureContent: string;
	// MISSING: apiReferenceContent, developmentContent
	skillJson?: string;
	metaJson?: string;
	architectureJson?: string;
	fileIndexJson?: string;
}

// installSkillWithReferences writes to:
// ~/.config/offworld/skills/{owner}-{repo}-reference/SKILL.md
// ~/.config/offworld/skills/{owner}-{repo}-reference/references/*.md
// Symlinks to ~/.opencode/skills/ and ~/.claude/skills/
```

### architecture.ts - Graph Structure

```typescript
export interface ArchitectureNode {
	path: string;
	symbols: string[];
	isHub: boolean;
	layer?: "ui" | "api" | "domain" | "infra" | "util" | "config" | "test";
}

export interface ArchitectureEdge {
	source: string;
	target: string;
	type: "imports" | "extends" | "implements" | "exports" | "re-exports";
}

// Hub detection: 3+ importers
// Layer classification via LAYER_PATTERNS regex
export function buildArchitectureGraph(
	parsedFiles: Map<string, ParsedFile>,
	dependencyGraph: DependencyGraph,
): ArchitectureGraph;
```

### ast/index.ts - Language Registration

```typescript
export type SupportedLang = Lang | "python" | "rust" | "go" | "java";
// EXTEND TO: | "c" | "cpp" | "ruby" | "php"

export const LANG_MAP: Record<string, Lang | string> = {
  ".ts": Lang.TypeScript,
  ".tsx": Lang.Tsx,
  ".js": Lang.JavaScript,
  ".py": "python",
  ".rs": "rust",
  // ADD: ".c": "c", ".cpp": "cpp", ".rb": "ruby", ".php": "php"
};

// Pattern: dynamic import + registerDynamicLanguage
export async function initLanguages(): Promise<void> {
  const [pythonLang, ...] = await Promise.all([
    import("@ast-grep/lang-python"),
    // ADD: import("@ast-grep/lang-c"), etc.
  ]);
  registerDynamicLanguage({ python: {...}, /* ADD: c, cpp, ruby, php */ });
}
```

### ast/patterns.ts - AST Patterns

```typescript
export type PatternLanguage = "typescript" | "javascript" | "python" | "rust" | "go" | "java";
// EXTEND TO: | "c" | "cpp" | "ruby" | "php"

export const FUNCTION_PATTERNS: Record<PatternLanguage, string[]> = {
  typescript: ["function $NAME($$$) { $$$ }", "export function $NAME($$$): $TYPE { $$$ }"],
  python: ["def $NAME($$$): $$$"],
  // ADD: c, cpp, ruby, php patterns
};

export const CLASS_PATTERNS: Record<PatternLanguage, string[]> = { ... };
export const IMPORT_PATTERNS: Record<PatternLanguage, string[]> = { ... };
```

### prose.ts - AI Generation

```typescript
export const ProseEnhancementsSchema = z.object({
	overview: z.string().min(100),
	whenToUse: z.array(z.string()).min(3),
	entityDescriptions: z.record(z.string(), z.string()),
	// ...
});

// Pattern: prompt → stream → extractJSON → Zod validation
export async function generateProseEnhancements(
	skeleton: SkillSkeleton,
	options?: ProseGenerateOptions,
): Promise<ProseEnhancements>;
```

### Key Files

| File                                        | Purpose                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `packages/sdk/src/analysis/pipeline.ts`     | toSkillDirName, runAnalysisPipeline, installSkillWithReferences   |
| `packages/sdk/src/analysis/architecture.ts` | ArchitectureGraph, buildArchitectureGraph, generateMermaidDiagram |
| `packages/sdk/src/analysis/prose.ts`        | AI prose generation, Zod schemas                                  |
| `packages/sdk/src/ast/index.ts`             | LANG_MAP, SupportedLang, initLanguages                            |
| `packages/sdk/src/ast/patterns.ts`          | FUNCTION_PATTERNS, CLASS_PATTERNS per language                    |
| `packages/types/src/schemas.ts`             | Shared Zod schemas                                                |
| `apps/cli/src/handlers/generate.ts`         | CLI generate command                                              |
| `apps/cli/src/handlers/pull.ts`             | CLI pull command                                                  |

---

## Stop Condition

After completing ONE story:

1. Commit changes
2. Update PRD.json (`passes: true`)
3. Append to progress.txt
4. **STOP IMMEDIATELY** - do not start next story

The loop runner will start a fresh session for the next story.

If ALL stories pass, reply:
<promise>COMPLETE</promise>
