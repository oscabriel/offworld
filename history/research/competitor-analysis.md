# Offworld: Competitor Analysis

> Research conducted January 2026. Focused on projects in the "AI + codebase understanding" space.

---

## Executive Summary

Five projects were analyzed for similarity to Offworld:

| Project | Similarity | Threat Level | Key Insight |
|---------|------------|--------------|-------------|
| **better-context (btca)** | Very High | Medium | Validates approach; no skills generation |
| **repogrep (fernandoabolafio)** | Very High | None | Closest prior art; inactive but rich learnings |
| **opensrc (vercel-labs)** | Medium | Very Low | npm-only, no analysis, validates demand |
| **Repogrep (ami.dev)** | Medium | Low | Web-only, no local ownership |
| **AnswerOverflow** | Low | None | Different domain (Discord → Web) |

**Bottom line:** btca validates the "clone + AI search" market. repogrep (fernandoabolafio) provides the closest technical prior art with code worth stealing. opensrc validates demand for source code access for agents. Offworld's moat is **auto-generated skills** — something no competitor offers.

---

## Detailed Analysis

### 1. better-context (btca)

**URL:** https://github.com/davis7dotsh/better-context | https://btca.dev

**Stars:** 347 | **License:** MIT | **Status:** Active (v0.6.42)

#### What It Does

CLI for asking questions about libraries/frameworks by cloning repos locally and searching source directly.

```bash
# Ask a question
btca ask -r svelte -q "How does the $state rune work?"

# TUI mode
btca chat -r svelte

# Server mode
btca serve -p 8080
```

#### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Framework | Effect-TS |
| CLI | @effect/cli |
| AI | @opencode-ai/sdk (same as Offworld!) |
| TUI | Solid.js + @opentui |
| Database | Drizzle + SQLite |
| Monorepo | Turborepo |

#### Key Dependencies

```json
{
  "@opencode-ai/sdk": "^1.0.208",
  "effect": "^3.19.13",
  "@effect/cli": "^0.72.1",
  "@effect/platform-bun": "^0.85.0",
  "drizzle-orm": "^0.45.1",
  "solid-js": "^1.9.10"
}
```

#### Feature Comparison

| Feature | btca | Offworld |
|---------|------|----------|
| Clone repos locally | Yes | Yes |
| AI-powered Q&A | Yes | Yes |
| OpenCode SDK | Yes | Yes |
| TUI mode | Yes | Deferred |
| Server mode | Yes | Not planned |
| **Skill generation** | No | **Yes (Unique)** |
| **Analysis artifacts** | No | **Yes (Unique)** |
| **Web directory** | No | **Yes (Unique)** |
| **Agent plugin** | No | **Yes (Unique)** |
| **File importance ranking** | No | **Yes (Unique)** |

#### Threat Assessment

**Threat Level: Medium**

- Validates the market — proves "clone + search + AI" works
- Uses same AI backend (OpenCode SDK)
- Growing traction (347 stars, active development)
- **No skills** — Offworld's core differentiator unaddressed

#### What We Can Learn

1. **Effect-TS architecture** — Clean functional code, excellent error handling
2. **TUI as default** — `btca` with no args launches TUI (nice UX)
3. **Server mode** — Useful for IDE integrations
4. **OpenCode SDK patterns** — Their integration may inform ours

---

### 2. Repogrep (ami.dev)

**URL:** https://app.ami.dev/repogrep

**Type:** Web application | **Status:** Active

#### What It Does

AI coding agent that searches across any public GitHub repository. Web-based interface for quick code exploration.

**Features:**
- Search any public GitHub repo
- AI-powered code understanding
- No installation required
- Popular repos pre-indexed (VSCode, React, Next.js, Bun, etc.)

#### Comparison

| Feature | Repogrep | Offworld |
|---------|----------|----------|
| Web interface | Primary | Directory |
| Local clones | No | Yes |
| Persistent analysis | No | Yes |
| Skills generation | No | Yes |
| Agent integration | No | Yes |
| Offline usage | No | Yes |

#### Threat Assessment

**Threat Level: Low**

- Different audience (web users vs CLI developers)
- No local ownership model
- No agent integration
- Could be complementary (discover on Repogrep → `ow clone` for deep work)

---

### 3. repogrep (fernandoabolafio) — **Closest Prior Art**

**URL:** https://github.com/fernandoabolafio/repogrep

**Stars:** 8 | **License:** MIT | **Status:** Inactive (~2 months since last commit)

#### What It Does

A **fully local CLI** for indexing source repositories and searching them with both:
1. **Full-text search** (BM25 via SQLite FTS5)
2. **Semantic search** (vector similarity via LanceDB + local embeddings)

Everything runs locally — no cloud services, no API keys needed.

```bash
# Add and index a remote repository
repogrep add https://github.com/sindresorhus/slugify

# Keyword search (fast)
repogrep search "auth token rotation"

# Semantic search (AI-powered)
repogrep search --semantic "generate URL slugs"

# Hybrid search (combines both)
repogrep search --hybrid "API rate limiting"

# Pattern search (like ripgrep)
repogrep grep "function \w+\(" --type ts

# Read files
repogrep read Effect-TS-effect/packages/effect/src/Effect.ts
```

#### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| CLI | Commander.js |
| Full-text Search | SQLite FTS5 (BM25) |
| Vector Search | LanceDB |
| Embeddings | @xenova/transformers (MiniLM-L6-v2, local) |
| Git | simple-git |
| File Discovery | fast-glob |

#### Key Dependencies

```json
{
  "@lancedb/lancedb": "^0.4.0",
  "@xenova/transformers": "^2.10.0",
  "better-sqlite3": "^12.4.1",
  "commander": "^11.1.0",
  "simple-git": "^3.20.0",
  "fast-glob": "^3.3.2"
}
```

#### Storage Layout

```
~/.repogrep/
├── repos/                    # Cloned repositories
│   └── {repo-name}/
├── .rsearch/
│   ├── search.sqlite         # SQLite FTS5 + file metadata
│   └── vectors/              # LanceDB vector store
```

#### Feature Comparison

| Feature | repogrep | Offworld |
|---------|----------|----------|
| Clone repos locally | Yes | Yes |
| Full-text search | Yes (SQLite FTS5) | No (agent uses grep) |
| Semantic search | Yes (LanceDB) | No (decided against embeddings) |
| Hybrid search | Yes | No |
| Local embeddings | Yes (@xenova/transformers) | No |
| **Skill generation** | No | **Yes (Unique)** |
| **AI analysis** | No | **Yes (Unique)** |
| **Architecture extraction** | No | **Yes (Unique)** |
| **File importance ranking** | No | **Yes (Unique)** |
| **Web directory** | No | **Yes (Unique)** |
| Cursor rule (manual skill) | Yes | Auto-generated |

#### Threat Assessment

**Threat Level: None** (inactive project)

- Closest technical prior art to Offworld's indexing approach
- Validates local-first architecture
- No AI generation, no skills — different output entirely
- Inactive for 2 months, only 8 stars
- **Rich source of code patterns to learn from**

#### What We Can Learn

1. **Hybrid search architecture** — SQLite FTS5 + LanceDB vector search
2. **Comprehensive ignore patterns** — 100+ file types to skip
3. **Binary file detection** — Simple heuristic without dependencies
4. **File hash change detection** — Incremental indexing
5. **Cursor rule format** — Manual skill file validates the concept
6. **Gitignore parsing** — Respect repo's own ignore patterns

#### Why It Didn't Gain Traction

1. **No unique value prop** — Just search, which ripgrep/ag already do
2. **Embeddings overhead** — Local embeddings slow to generate
3. **No AI integration** — No LLM for Q&A
4. **No discovery mechanism** — No way to find interesting repos
5. **Solo maintainer** — Side project energy

---

### 4. opensrc (vercel-labs)

**URL:** https://github.com/vercel-labs/opensrc

**Stars:** 9 | **License:** Apache-2.0 | **Status:** New (17 commits)

#### What It Does

CLI that fetches **npm package source code** for AI agents. Simpler scope than Offworld—just clones source, no analysis.

```bash
# Fetch source (auto-detects version from lockfile)
opensrc zod

# Specific version
opensrc zod@3.22.0

# Multiple packages
opensrc react react-dom next

# List fetched sources
opensrc list

# Remove
opensrc remove zod
```

#### How It Works

1. Queries npm registry → finds repo URL
2. Detects installed version from lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock)
3. Clones at matching git tag
4. Stores in `opensrc/<package>/` (project-local)
5. Updates `AGENTS.md` with source locations
6. Maintains `opensrc/sources.json` index

#### Storage Layout

```
project/
├── opensrc/
│   ├── sources.json        # Index of packages
│   └── zod/
│       ├── src/
│       └── package.json
├── AGENTS.md               # Updated with source references
└── .gitignore              # opensrc/ added automatically
```

#### AGENTS.md Output

```markdown
## Source Code Reference
Source code for dependencies is available in `opensrc/` for deeper understanding.
See `opensrc/sources.json` for available packages.
```

#### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| CLI | Commander.js |
| Git | simple-git (likely) |

#### Feature Comparison

| Feature | opensrc | Offworld |
|---------|---------|----------|
| **Scope** | npm packages only | Any GitHub repo |
| **Version Detection** | From lockfile (clever) | Not yet |
| **Storage** | Project-local (`opensrc/`) | Global (`~/ow/`) |
| **Analysis** | None | Full AI analysis |
| **Skill Generation** | None | **Yes (Unique)** |
| **File Importance** | None | Tree-sitter ranking |
| **Architecture** | None | Full entity/relationship mapping |
| **Agent Integration** | AGENTS.md (static text) | OpenCode plugin (dynamic) |
| **Web Directory** | None | offworld.sh |
| **Output** | Raw source + JSON index | SKILL.md + architecture + summary |

#### Threat Assessment

**Threat Level: Very Low**

- **Different scope** — npm-only, project-local. Offworld is any GitHub repo, global management.
- **No analysis** — opensrc gives raw source. Offworld gives curated, ranked, AI-analyzed output.
- **No skills** — The moat remains untouched.
- **Vercel Labs** — Experimental lab project, may not see sustained development.
- **Validates demand** — Proves engineers want source code access for agents.

#### What We Can Learn

1. **Lockfile version detection** — Auto-detect installed version from package-lock/pnpm-lock/yarn.lock
2. **AGENTS.md convention** — Standard file for agent instructions (static but simple)
3. **Project-local storage option** — `opensrc/` in project vs global `~/ow/`
4. **sources.json index** — Simple package manifest pattern

#### Strategic Positioning

opensrc is a "dumb pipe"—just clones and indexes. Offworld's value is the **intelligence layer**: analysis, ranking, skill generation.

Could position as:
- opensrc = "quick fetch for npm packages"
- Offworld = "deep analysis for any repo"

Potentially complementary, not competitive.

---

### 5. AnswerOverflow

**URL:** https://github.com/AnswerOverflow/AnswerOverflow | https://answeroverflow.com

**Stars:** 1.4k | **License:** AGPL | **Status:** Active

#### What It Does

Makes Discord threads searchable on the web. Powers content discovery for major servers including Valorant, Cloudflare, C#, and Nuxt.

#### Connection to Offworld

The maintainer **@RhysSullivan** is quoted in Offworld's product-vision.md:

> "@RhysSullivan: every time I put dependency source in .context/, agent output gets exponentially better"

This quote validates Offworld's core thesis about source context improving AI output.

#### Tech Stack

- TypeScript monorepo
- Bun + Turborepo
- Uses OpenCode (has `.opencode/` directory)
- T3 Stack

#### Threat Assessment

**Threat Level: None**

- Different domain entirely (Discord → Web SEO)
- Not competing for same users
- Potential advocate for Offworld (already believes in source context thesis)

---

## Competitive Positioning

### Offworld's Unique Value Proposition

```
                       COMPETITIVE LANDSCAPE
+-------------------------------------------------------------+
|                                                             |
|   btca                        Offworld                      |
|   +------------------+        +-------------------------+   |
|   | Clone + Q&A      |        | Clone + Analyze + SKILLS|   |
|   |                  |        |                         |   |
|   | - Ask questions  |        | - Auto-gen SKILL.md     |   |
|   | - Chat mode      |        | - Architecture analysis |   |
|   | - Server mode    |        | - File importance       |   |
|   |                  |        | - Web directory         |   |
|   | Ephemeral        |        | Persistent              |   |
|   +------------------+        +-------------------------+   |
|                                                             |
|   Repogrep                   opensrc                        |
|   +------------------+        +------------------+           |
|   | Web search only  |        | npm fetch only   |           |
|   | No persistence   |        | No analysis      |           |
|   +------------------+        | Project-local    |           |
|        ^                      +------------------+           |
|        |                             ^                       |
|   No local ownership            Just raw source              |
|   No agent integration          No intelligence layer        |
|                                                             |
+-------------------------------------------------------------+
```

### The Skills Moat

| Metric | Value |
|--------|-------|
| Skills on SkillsMP marketplace | 40,779+ |
| Skills that are auto-generated | **0** |
| Offworld's opportunity | **First skill generation engine** |

No competitor is generating skills for OSS repositories. This is Offworld's primary differentiator.

---

## Strategic Implications

### 1. Market Validation

btca's existence and traction (347 stars, active development) validates:
- The "clone repos locally + AI search" approach works
- OpenCode SDK is the right choice
- There's demand for local codebase understanding

### 2. Differentiation is Clear

| btca | Offworld |
|------|----------|
| Ephemeral Q&A | Persistent analysis |
| User asks questions | Agent knows automatically |
| No artifacts | Skills + architecture |
| No sharing | Web directory |

### 3. Speed Matters

btca is actively developing. While skills remain unaddressed, this could change:

| Risk | Likelihood | Impact |
|------|------------|--------|
| btca adds skill generation | Low | High |
| btca gains significant traction | Medium | Medium |
| opensrc adds analysis/skills | Very Low | Medium |
| New competitor enters with skills | Low | High |

### 4. Learning Opportunities

From btca:
- Effect-TS provides excellent error handling and composability
- TUI mode is good UX (consider for V2)
- Server mode enables IDE integrations

From repogrep (fernandoabolafio):
- Hybrid search (SQLite FTS5 + LanceDB) architecture
- Comprehensive ignore patterns list (100+ patterns)
- Binary file detection heuristic
- File hash change detection for incremental updates
- Cursor rule validates skill file format

From Repogrep (ami.dev):
- Web-first discovery can drive CLI adoption
- "Copy command" pattern for onboarding

From opensrc (vercel-labs):
- Lockfile version detection for npm packages
- AGENTS.md as agent instruction convention
- Project-local storage as alternative to global
- Simple sources.json manifest pattern

---

## Recommendations

### Do Not Change Course

The competitive analysis confirms Offworld's direction is correct:
1. btca validates the market
2. Skills moat is real and unaddressed
3. Web directory adds unique value

### Double Down On

1. **Skill generation quality** — This is the moat
2. **Web directory launch** — Differentiation from btca
3. **Agent plugin** — btca has no agent integration

### Consider for V2

1. **TUI mode** — btca's default UX is good
2. **Effect-TS patterns** — Worth evaluating for error handling
3. **Server mode** — IDE integration potential

### Monitor

- btca development trajectory
- opensrc adoption and feature additions
- New entrants in skills generation
- SkillsMP adding auto-generation

---

## Appendix: Raw Data

### btca package.json (apps/cli)

```json
{
  "name": "btca",
  "version": "0.6.42",
  "dependencies": {
    "@effect/cli": "^0.72.1",
    "@effect/platform-bun": "^0.85.0",
    "@opencode-ai/sdk": "^1.0.208",
    "@opentui/solid": "^0.1.65",
    "drizzle-orm": "^0.45.1",
    "effect": "^3.19.13",
    "solid-js": "^1.9.10"
  }
}
```

### btca Entry Point Pattern

```typescript
// btca's approach using Effect-TS
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Effect } from 'effect';
import { CliService } from './services/cli.ts';

const hasNoArgs = process.argv.length <= 2;

if (hasNoArgs) {
  launchTui();  // TUI as default
} else {
  Effect.gen(function* () {
    const cli = yield* CliService;
    yield* cli.run(process.argv);
  }).pipe(
    Effect.provide(CliService.Default),
    Effect.provide(BunContext.layer),
    BunRuntime.runMain()
  );
}
```

---

## Appendix: repogrep (fernandoabolafio) Technical Details

### Embedding Model

```typescript
// embed.ts - Local embeddings via ONNX
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(input, { pooling: 'mean', normalize: true });
  return output;
}
```

### Hybrid Search Implementation

```typescript
export async function hybridSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const semanticWeight = options.semanticWeight ?? 0.6;
  const keywordWeight = options.keywordWeight ?? 0.4;

  const [keywordResults, semanticResults] = await Promise.all([
    keywordSearch(query, options),  // SQLite FTS5
    semanticSearch(query, options)  // LanceDB vectors
  ]);

  // Merge and weight results...
}
```

### Binary Detection Heuristic

```typescript
export function isBinaryBuffer(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const byte = sample[i];
    if (byte === 0) return true;  // Null byte = binary
    if (byte < 7 || (byte > 13 && byte < 32) || byte === 255) {
      suspicious += 1;
    }
  }
  return suspicious / sample.length > 0.3;  // >30% suspicious = binary
}
```

### File Hash Change Detection

```typescript
// Track file state for incremental indexing
export interface FileMetaRow {
  id?: number;
  repo: string;
  path: string;
  filename: string;
  mtime_ms: number;
  size_bytes: number;
  hash: string;  // SHA-256 of file contents
}

// Skip unchanged files
const existing = existingByPath.get(relativePath);
if (existing && existing.hash === hash && !force) {
  unchangedSkipped += 1;
  continue;
}
```

### Cursor Rule (Manual Skill File)

repogrep includes a `cursor-rule.md` that teaches Cursor how to use the CLI:

```markdown
# Cursor Rule: repogrep CLI Integration

## When to Use repogrep
Use `repogrep` when you need to:
- Search code in repositories that are NOT in the current workspace
- Find examples of patterns across multiple indexed codebases
...

## Command Selection Guide
| Need to... | Use Command | Example |
|------------|-------------|---------|
| Find code by meaning | `search --semantic` | `repogrep search "validate user input" --semantic` |
```

This validates that skill files work for teaching agents CLI usage — Offworld auto-generates these.

---

## References

- better-context: https://github.com/davis7dotsh/better-context
- btca.dev: https://btca.dev
- repogrep (fernandoabolafio): https://github.com/fernandoabolafio/repogrep
- opensrc (vercel-labs): https://github.com/vercel-labs/opensrc
- Repogrep (ami.dev): https://app.ami.dev/repogrep
- AnswerOverflow: https://github.com/AnswerOverflow/AnswerOverflow
- SkillsMP: https://skills.mp (40,779+ skills)

---

*Last updated: January 2026*
