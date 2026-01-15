Plan: Strip Analysis Pipeline to AI-Only SKILL.md Generation
Summary
Remove all deterministic analysis (AST parsing, dependency graphs, architecture extraction, API surface detection, heuristics, skeleton building, etc.) and replace with a single AI prompt that asks the agent to generate a SKILL.md file by analyzing the repository directly. The agent will use its own Read/Grep/Glob tools to explore the codebase.

---

What Gets DELETED

1. Entire analysis/ module (except minimal parts for context)

- ❌ heuristics.ts - File ranking logic
- ❌ skeleton.ts - Deterministic structure building
- ❌ architecture.ts - Architecture graph, layers, hubs
- ❌ api-surface.ts - API extraction
- ❌ imports.ts - Dependency graph building
- ❌ merge.ts - Skeleton/prose merging
- ❌ incremental.ts - Incremental state tracking
- ❌ parsers.ts - Markdown parsing (not needed)
- ✅ KEEP: prose.ts - Simplified to just send one AI prompt

2. Entire ast/ module

- ❌ parser.ts - AST parsing logic
- ❌ patterns.ts - AST-grep patterns
- ❌ index.ts - Language initialization
- No more @ast-grep dependencies
- No more language-specific parsing

3. Entire validation/ module

- ❌ consistency.ts
- ❌ quality.ts
- ❌ paths.ts
- ❌ staleness.ts

4. Analysis-related exports from pipeline.ts

- ❌ runAnalysisPipeline() - The entire deterministic pipeline
- ❌ loadReadme(), loadExamples(), loadContributing() - Context loaders
- ❌ formatSkillMd(), formatSummaryMd(), formatArchitectureMd(), etc. - All formatters except SKILL.md
- ❌ updateSkillPaths() - Path variable updating
- ❌ All the skeleton/architecture/api-surface helpers

5. Reference file generation

- ❌ summary.md - No longer generated
- ❌ architecture.md - No longer generated
- ❌ api-reference.md - No longer generated
- ❌ development.md - No longer generated
- ❌ references/ directory - No longer created

6. Meta JSON files (except minimal metadata)

- ❌ skill.json - Full skill structure
- ❌ architecture.json - Architecture data
- ❌ file-index.json - File index
- ✅ KEEP: meta.json - Minimal metadata (analyzedAt, commitSha, version)

7. Helper modules that become unnecessary

- Most of context.ts (if it's only used for deterministic analysis)
- Test fixtures related to analysis

---

What Gets KEPT

1. Core infrastructure

- ✅ ai/ module - OpenCode client, streaming, errors
- ✅ clone.ts - Git cloning logic
- ✅ config.ts - Configuration loading
- ✅ repo-source.ts - parseRepoInput(), RepoSource types
- ✅ sync.ts - Remote push/pull (if still relevant)
- ✅ index-manager.ts - Local index tracking
- ✅ util.ts - Generic utilities
- ✅ constants.ts - Shared constants

2. Simplified pipeline

- New generate.ts (replaces pipeline.ts) with:
  - generateSkillWithAI(repoPath, repoName, options)
  - installSkill(repoName, skillContent, metaContent)
  - formatSkillMd(skillText, options) - Basic YAML frontmatter + content

3. CLI handlers

- ✅ apps/cli/src/handlers/generate.ts - Simplified to:
  1. Clone/resolve repo path
  2. Call generateSkillWithAI()
  3. Install skill
  4. Update index
- ✅ Other handlers: init, list, pull, push, rm, auth, config

4. Types (simplified)

- ✅ Skill type (from @offworld/types) - Simplified schema
- ✅ Config, IndexEntry types
- ❌ Remove: Architecture, ParsedFile, DependencyGraph, etc.

---

New Simplified Flow
User runs: ow generate tanstack/query
↓

1. parseRepoInput("tanstack/query")
   ↓
2. cloneRepo() if remote (or use local path)
   ↓
3. generateSkillWithAI(repoPath, "tanstack/query", { provider, model })
   ├── Start OpenCode session
   ├── Send single prompt:
   │ """
   │ You are analyzing the repository at {repoPath}.
   │  
   │ Generate a comprehensive SKILL.md file for AI agents.
   │ Use Read, Grep, and Glob tools to explore the codebase.
   │  
   │ The SKILL.md should include:
   │ - name: Repository name
   │ - description: What this codebase does (1-2 sentences)
   │ - whenToUse: List of 5+ natural language triggers
   │ - bestPractices: List of 3+ best practices
   │ - commonPatterns: List of common usage patterns with steps
   │  
   │ Output ONLY the SKILL.md content with YAML frontmatter.
   │ """
   └── Stream response to file
   ↓
4. formatSkillMd(aiOutput, { commitSha, generated })
   └── Ensure proper frontmatter format
   ↓
5. installSkill(repoName, skillContent, metaContent)
   ├── Write ~/.config/offworld/skills/{name}-reference/SKILL.md
   ├── Write ~/.config/offworld/meta/{name}/meta.json
   ├── Symlink to ~/.opencode/skills/{name}-reference/
   └── Symlink to ~/.claude/skills/{name}-reference/
   ↓
6. updateIndex({ qualifiedName, analyzedAt, commitSha, hasSkill: true })

---

File Structure After Changes
packages/sdk/src/
├── ai/ ✅ Keep (OpenCode client)
│ ├── stream/
│ ├── claude-code.ts
│ ├── errors.ts
│ ├── index.ts
│ └── opencode.ts
├── analysis/ ❌ DELETE ENTIRE DIRECTORY
├── ast/ ❌ DELETE ENTIRE DIRECTORY
├── validation/ ❌ DELETE ENTIRE DIRECTORY
├── clone.ts ✅ Keep
├── config.ts ✅ Keep
├── constants.ts ✅ Keep
├── index-manager.ts ✅ Keep
├── index.ts ✅ Keep (update exports)
├── repo-source.ts ✅ Keep
├── sync.ts ✅ Keep (if still relevant)
├── util.ts ✅ Keep
└── generate.ts ✅ NEW - Simplified generation
apps/cli/src/handlers/
├── generate.ts ✅ Simplified
├── auth.ts ✅ Keep
├── config.ts ✅ Keep
├── init.ts ✅ Keep
├── list.ts ✅ Keep
├── pull.ts ✅ Keep
├── push.ts ✅ Keep
└── rm.ts ✅ Keep

---

New generate.ts (SDK)
import { streamPrompt } from "./ai/index.js";
import { existsSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { join, homedir } from "node:path";
import { loadConfig } from "./config.js";
import { getCommitSha } from "./clone.js";
export interface GenerateSkillOptions {
provider?: string;
model?: string;
onDebug?: (msg: string) => void;
onStream?: (text: string) => void;
}
export async function generateSkillWithAI(
repoPath: string,
repoName: string,
options: GenerateSkillOptions = {}
): Promise<{ skillContent: string; commitSha: string }> {
const { provider, model, onDebug, onStream } = options;
const config = loadConfig();

const prompt = `You are analyzing the repository at ${repoPath}.
Generate a comprehensive SKILL.md file that helps AI agents understand and work with this codebase.
Use Read, Grep, and Glob tools to explore the repository structure, understand the codebase, and extract patterns.
The SKILL.md should include YAML frontmatter with:

- name: Repository name
- description: One-line description (max 100 chars)
  Then include these sections:

## When to Use

- List 5+ natural language triggers (e.g., "when building a form", "when managing state")

## Best Practices

- List 3+ numbered best practices

## Common Patterns

- List 2+ patterns with descriptive names and numbered steps
  Output ONLY the SKILL.md content. Do not include explanations or markdown fences.`;
  const result = await streamPrompt({
  prompt,
  cwd: repoPath,
  provider: provider ?? config.ai?.provider,
  model: model ?? config.ai?.model,
  onDebug,
  onStream,
  });
  const commitSha = getCommitSha(repoPath);
  return {
  skillContent: result.text,
  commitSha,
  };
  }
  export function installSkill(
  repoName: string,
  skillContent: string,
  meta: { analyzedAt: string; commitSha: string; version: string }
  ): void {
  const config = loadConfig();
  const skillDirName = toSkillDirName(repoName);
  const metaDirName = toMetaDirName(repoName);
  const skillDir = expandTilde(join(config.metaRoot, "skills", skillDirName));
  const metaDir = expandTilde(join(config.metaRoot, "meta", metaDirName));
  mkdirSync(skillDir, { recursive: true });
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf-8");
  writeFileSync(join(metaDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  const openCodeSkillDir = expandTilde(join(config.skillDir, skillDirName));
  const claudeSkillDir = join(homedir(), ".claude", "skills", skillDirName);
  ensureSymlink(skillDir, openCodeSkillDir);
  ensureSymlink(skillDir, claudeSkillDir);
  }
  // Helper functions: toSkillDirName, toMetaDirName, expandTilde, ensureSymlink
  // (Keep from current pipeline.ts)

---

New generate.ts (CLI Handler)
export async function generateHandler(options: GenerateOptions): Promise<GenerateResult> {
const { repo, force = false, provider, model } = options;
const config = loadConfig();
const s = createSpinner();
try {
s.start("Parsing repository input...");
const source = parseRepoInput(repo);
s.stop("Repository parsed");
let repoPath: string;
// Remote check + cloning logic (keep as-is)
if (source.type === "remote") {
// ... existing clone logic ...
} else {
repoPath = source.path;
}
s.start("Generating skill with AI...");
const qualifiedName = source.type === "remote" ? source.fullName : source.name;

    const { skillContent, commitSha } = await generateSkillWithAI(repoPath, qualifiedName, {
      provider,
      model,
      onDebug: (msg) => s.message(msg),
      onStream: (text) => { /* optionally log */ },
    });

    s.stop("Skill generated");
    const analyzedAt = new Date().toISOString();
    const meta = { analyzedAt, commitSha, version: "0.1.0" };

    installSkill(qualifiedName, skillContent, meta);

    updateIndex({
      qualifiedName,
      analyzedAt,
      commitSha,
      hasSkill: true,
    });
    p.log.success(`Skill saved to: ${getSkillPath(qualifiedName)}`);

    return { success: true, analysisPath: getSkillPath(qualifiedName) };

} catch (error) {
s.stop("Failed");
return { success: false, message: error.message };
}
}

---

Updated @offworld/types Schema
// Simplified Skill schema - remove all deterministic fields
export const SkillSchema = z.object({
name: z.string(),
description: z.string(),
whenToUse: z.array(z.string()).optional(),
bestPractices: z.array(z.string()).optional(),
commonPatterns: z.array(z.object({
name: z.string(),
steps: z.array(z.string()),
})).optional(),
// Remove: basePaths, quickPaths, searchPatterns, etc.
});

---

Package.json Changes
Remove dependencies:
{
dependencies: {
@ast-grep/napi: REMOVE,
@ast-grep/lang-python: REMOVE,
@ast-grep/lang-rust: REMOVE,
@ast-grep/lang-go: REMOVE,
@ast-grep/lang-java: REMOVE,
@ast-grep/lang-c: REMOVE,
@ast-grep/lang-cpp: REMOVE,
@ast-grep/lang-ruby: REMOVE,
@ast-grep/lang-php: REMOVE
}
}

---

Migration Steps

1. Create new packages/sdk/src/generate.ts with simplified logic
2. Delete directories: analysis/, ast/, validation/
3. Update packages/sdk/src/index.ts to remove deleted exports
4. Simplify apps/cli/src/handlers/generate.ts
5. Update @offworld/types to remove unused schemas
6. Remove AST-grep dependencies from package.json
7. Update tests to remove analysis-related tests
8. Update AGENTS.md to remove analysis learnings

---

Benefits
✅ Drastically simpler codebase - Remove ~5000+ lines of analysis code  
✅ Faster to maintain - No AST pattern maintenance across languages  
✅ Agent does the work - Leverage AI's ability to explore codebases  
✅ Single source of truth - One SKILL.md file, not 5 different files  
✅ Faster execution - No parsing overhead, agent reads only what it needs  
✅ More flexible - Agent can adapt exploration based on repo structure

---

Risks & Mitigations
⚠️ Risk: AI might be inconsistent in SKILL.md format  
✅ Mitigation: Clear prompt with schema definition, validate YAML frontmatter
⚠️ Risk: AI might miss important patterns  
✅ Mitigation: Prompt instructs agent to use Grep/Read extensively
⚠️ Risk: Slower than deterministic parsing  
✅ Mitigation: Only one AI call vs multiple + parsing, likely faster overall
