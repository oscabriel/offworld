# Offworld: Context Packet

> For agents working on this codebase. Read this before doing anything.

> **Scaffold:** `/Users/oscargabriel/Developer/projects/offworld`

---

## Goal (1 sentence)

Build a CLI tool (`ow`) that clones OSS repos, analyzes them with AI, and auto-generates SKILL.md files that teach coding agents how to navigate those codebases.

---

## Non-Goals

- **No MCP server** — OpenCode plugin only for V1
- **No private repos** — Public repos only
- **No non-GitHub push** — GitLab/Bitbucket push in V2 (local analysis works)
- **No embeddings/RAG** — Agent uses native grep/read on local clones
- **No server-side AI** — All AI runs locally via user's OpenCode instance
- **No team features** — Single-user for V1
- **No paid tiers** — Free forever (side project)

---

## Constraints / Invariants

### Technical

- **TypeScript strict mode** — No `any`, no `@ts-ignore`
- **Zod for all schemas** — Single source of truth for types
- **Bun + Turborepo** — Package manager and monorepo tool
- **trpc-cli pattern** — Router-based CLI (see `research/cli-architecture.md`)
- **Tree-sitter for file importance** — TS/JS, Rust, Go, Python only
- **Dual AI provider** — Claude Code SDK + OpenCode SDK (auto-detect)
- **Primary model** — Claude Sonnet 4 (user's configured model)
- **Better Auth for OAuth** — Web auth via Convex component, CLI reuses same flow
- **Import-based ranking** — Not path-based (content-aware)
- **~3500-4000 token budget** — For skill generation context
- **File limits** — Top 500 files by importance, skip files >100KB

### Product

- **CLI installs in <30 seconds**
- **`ow pull` completes in <2 minutes** for average repo
- **Analysis costs <$0.05** per repo (user's API key)
- **Skills usable without manual editing**
- **Remote repos stored in `~/ow/{provider}/{owner}/{repo}`** (provider-scoped)
- **Local repos analyzed in place** (no cloning)
- **Metadata stored in `~/.ow/`** (hidden, uses qualified names)
- **Push requires 5+ GitHub stars** (filters spam/test repos)
- **Local repos cannot be pushed** (skills stay local only)
- **GitLab/Bitbucket push support in V2** (analyze locally works now)

### What NOT to Do

- Don't add new dependencies without justification
- Don't create abstractions until needed
- Don't suppress TypeScript errors
- Don't implement features marked "V2" or "deferred"
- Don't use embeddings or vector search
- Don't add MCP support

---

## Authority Order

When sources disagree, what wins:

1. **Tests/CI** — If tests pass, it's correct
2. **This context packet** — Constraints override all else
3. **technical-spec.md** — Schemas and architecture
4. **implementation-plan.md** — Build order and phases
5. **Existing code patterns** — Match what's already there
6. **product-vision.md** — Product intent
7. **decisions-log.md** — Historical rationale

---

## Repo Anchors

**Scaffold exists at:** `/Users/oscargabriel/Developer/projects/offworld`

### Existing (from scaffold)

| File                                | Purpose                          |
| ----------------------------------- | -------------------------------- |
| `packages/backend/convex/schema.ts` | Convex database schema           |
| `packages/backend/convex/auth.ts`   | Better Auth + Convex integration |
| `apps/web/src/router.tsx`           | TanStack Start router setup      |
| `apps/docs/astro.config.mjs`        | Starlight docs config            |
| `apps/tui/src/index.ts`             | OpenTUI entry point              |
| `turbo.json`                        | Monorepo task config             |
| `package.json`                      | Bun workspaces with catalog      |

### To Create

| File                                   | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `packages/types/src/schemas.ts`        | All Zod schemas (single source of truth) |
| `packages/sdk/src/config.ts`           | Path utilities, config loading           |
| `packages/sdk/src/clone.ts`            | Git clone operations                     |
| `packages/sdk/src/importance/index.ts` | Tree-sitter file ranking                 |
| `packages/sdk/src/analysis.ts`         | Summary/architecture generation          |
| `packages/sdk/src/skill.ts`            | SKILL.md generation                      |
| `apps/cli/src/index.ts`                | CLI router definition                    |

---

## Prior Art / Blessed Patterns

### CLI Pattern (from better-t-stack)

```typescript
// Router-based CLI using trpc-cli + @orpc/server
export const router = os.router({
  clone: os
    .meta({ description: "Clone a repository", default: true })
    .input(z.tuple([
      z.string().describe("Repository (owner/repo)"),
      z.object({ shallow: z.boolean().optional() })
    ]))
    .handler(async ({ input }) => { ... }),
});

createCli({ router, name: "ow", version: "0.1.0" }).run();
```

### Schema Pattern

```typescript
// All types derived from Zod schemas
export const ArchitectureSchema = z.object({
	projectType: z.enum(["monorepo", "library", "cli", "app", "framework"]),
	entities: z.array(EntitySchema),
	// ...
});

export type Architecture = z.infer<typeof ArchitectureSchema>;
```

### Skill Generation Pattern

```typescript
// Structured output → Zod validate → Format as markdown
const { object } = await generateObject({
	model,
	schema: SkillSchema,
	prompt: skillGenerationPrompt,
});
const markdown = formatSkillMd(object);
```

### User's Machine Directory Structure

```
~/ow/                          # Repos (visible, provider-scoped)
  github/
    tanstack/router/
    vercel/ai/
  gitlab/
    inkscape/inkscape/

~/.ow/                         # Metadata (hidden)
  config.json
  analyses/{provider}--{owner}--{repo}/  # e.g., github--tanstack--router
    meta.json
    summary.md
    architecture.json
    architecture.md
    file-index.json
    SKILL.md
  analyses/local--{hash}/      # Local repos use path hash
    ...
```

### Monorepo Structure (Scaffold)

```
offworld/
├── apps/
│   ├── web/              # TanStack Start + Convex (SCAFFOLDED)
│   ├── docs/             # Astro Starlight (SCAFFOLDED)
│   ├── tui/              # OpenTUI (SCAFFOLDED)
│   └── cli/              # CLI commands (TO CREATE)
├── packages/
│   ├── backend/          # Convex functions (SCAFFOLDED)
│   ├── env/              # Environment vars (SCAFFOLDED)
│   ├── config/           # Shared config (SCAFFOLDED)
│   ├── infra/            # Alchemy deploy (SCAFFOLDED)
│   ├── sdk/              # Core SDK (TO CREATE)
│   ├── types/            # Zod schemas (TO CREATE)
│   └── plugin/           # OpenCode plugin (TO CREATE)
└── ...
```

---

## Oracle (Definition of Done)

### For any PR

- [ ] `bun check` passes (oxlint + oxfmt)
- [ ] `bun test` passes
- [ ] `bun build` succeeds
- [ ] No TypeScript errors
- [ ] Matches existing code patterns
- [ ] Doesn't violate constraints above

### For `ow pull`

- [ ] Accepts multiple input formats: `owner/repo`, GitHub/GitLab URLs, local paths
- [ ] For remote repos: Clones to `~/ow/{provider}/{owner}/{repo}` if not exists
- [ ] For local repos: Analyzes in place (no cloning)
- [ ] Git fetches and pulls if remote repo exists
- [ ] Checks remote for analysis (GitHub only for V1), pulls if exists
- [ ] Generates locally if no remote analysis
- [ ] Creates all analysis files in `~/.ow/analyses/{provider}--{owner}--{repo}/`
- [ ] Installs SKILL.md to both `~/.config/opencode/skill/` and `~/.claude/skills/`
- [ ] Completes in <2 minutes for average repo

### For `ow push`

- [ ] Rejects local repos with clear message
- [ ] Rejects non-GitHub repos with "coming soon" message (V1)
- [ ] Checks GitHub stars, rejects if <5 with clear message
- [ ] Uploads to offworld.sh if requirements met

### For `ow generate`

- [ ] Warns and exits if remote analysis exists (unless `--force`)
- [ ] Generates `summary.md` (AI-generated overview)
- [ ] Generates `architecture.json` (entities, relationships, keyFiles)
- [ ] Generates `architecture.md` (with Mermaid diagrams)
- [ ] Generates `file-index.json` (ranked files with optional summaries)
- [ ] Generates `SKILL.md` (auto-installed to both skill directories)
- [ ] Costs <$0.05 per repo

### For SKILL.md quality

- [ ] Has YAML frontmatter (name, description, allowed-tools)
- [ ] Has Repository Structure section
- [ ] Has Quick Reference Paths (5-10 key files)
- [ ] Has Search Strategies (grep patterns)
- [ ] Has When to Use section (trigger conditions)
- [ ] Usable without manual editing

---

## Examples

### Input Formats

`ow pull` accepts multiple formats:

```bash
ow pull tanstack/router                      # GitHub shorthand (default)
ow pull https://github.com/tanstack/router   # GitHub URL
ow pull https://gitlab.com/inkscape/inkscape # GitLab URL
ow pull git@github.com:tanstack/router.git   # SSH URL
ow pull .                                    # Current directory (local)
ow pull /path/to/local/repo                  # Absolute path (local)
```

**Note:** Shorthand `owner/repo` defaults to GitHub. Use full URLs for GitLab/Bitbucket.

### Input: `ow pull tanstack/router`

**Expected output:**

```
~/ow/github/tanstack/router/    # Full git clone (provider-scoped)
~/.ow/analyses/github--tanstack--router/
  meta.json                     # { analyzedAt, commitSha, version }
  summary.md                    # "TanStack Router is a type-safe..."
  architecture.json             # { projectType: "monorepo", entities: [...] }
  architecture.md               # Mermaid diagrams
  file-index.json               # [{ path, importance, type, summary }, ...]
  SKILL.md                      # Auto-generated skill file

~/.config/opencode/skill/tanstack-router/SKILL.md  # Auto-installed (OpenCode)
~/.claude/skills/tanstack-router/SKILL.md          # Auto-installed (Claude Code)
```

### Input: `ow pull https://gitlab.com/inkscape/inkscape`

**Expected output:**

```
~/ow/gitlab/inkscape/inkscape/  # Full git clone (provider-scoped)
~/.ow/analyses/gitlab--inkscape--inkscape/
  meta.json
  summary.md
  architecture.json
  architecture.md
  file-index.json
  SKILL.md

~/.config/opencode/skill/inkscape/SKILL.md  # Auto-installed
~/.claude/skills/inkscape/SKILL.md          # Auto-installed

# Note: GitLab repos can be analyzed locally but push is V2
```

### Input: `ow pull .` (local repo)

**Expected output:**

```
# Repo stays in place (no cloning)
~/.ow/analyses/local--a1b2c3d4e5f6/
  meta.json
  summary.md
  architecture.json
  architecture.md
  file-index.json
  SKILL.md

~/.config/opencode/skill/my-project/SKILL.md  # Auto-installed
~/.claude/skills/my-project/SKILL.md          # Auto-installed

# Note: Local repos cannot be pushed to offworld.sh
```

### Input: `ow list`

**Expected output:**

```
tanstack/router    ✓ analyzed 2h ago
vercel/ai          ✓ analyzed 1d ago  (47 commits behind)
sst/opencode       ○ not analyzed
```

### Input: `ow list --json`

**Expected output:**

```json
[
	{
		"fullName": "tanstack/router",
		"path": "~/ow/tanstack/router",
		"analyzed": true,
		"stale": false
	},
	{
		"fullName": "vercel/ai",
		"path": "~/ow/vercel/ai",
		"analyzed": true,
		"stale": true,
		"commitsBehind": 47
	},
	{ "fullName": "sst/opencode", "path": "~/ow/sst/opencode", "analyzed": false, "stale": false }
]
```

---

## Risk + Rollout

### Risks

| Risk                                 | Mitigation                                      |
| ------------------------------------ | ----------------------------------------------- |
| Tree-sitter native compilation fails | Use `web-tree-sitter` (WASM) as fallback        |
| OpenCode SDK unstable                | Implement direct Vercel AI SDK fallback         |
| Large repo timeout                   | Set file limits, implement progressive analysis |
| Analysis quality variance            | Add quality checks, allow manual override       |

### How to Fail Safely

- All operations are local-first (no server dependency for core features)
- Analysis can be re-run without side effects
- Skills can be manually edited if generation is poor
- Config is optional (sane defaults)

### Rollback

- `ow rm {repo}` cleans up clone and analysis
- `ow rm {repo} --dry-run` to preview what would be deleted
- Delete `~/.ow/` to reset all state
- Uninstall CLI: `npm uninstall -g @offworld/cli`

---

## Agent Instructions

1. **Read this entire file first** before starting work
2. **Keep diffs small** — One logical change per commit
3. **Match existing patterns** — Check repo anchors before inventing
4. **Run tests after each change** — `bun test`
5. **Don't add abstractions prematurely** — YAGNI
6. **Cite prior art** — Reference which pattern you're following
7. **Stop at phase boundaries** — Don't jump ahead in implementation plan

### Build Order (Non-Negotiable)

```
Phase 1 (COMPLETE):
  ✅ Monorepo setup (turbo, bun workspaces) - via better-t-stack
  ✅ apps/web (TanStack Start + Convex)
  ✅ apps/docs (Astro Starlight)
  ✅ apps/tui (OpenTUI)
  ✅ packages/backend (Convex + Better Auth)
  ✅ packages/env, config, infra

Phase 2 (TO DO):
  1. packages/types (Zod schemas)
  2. packages/sdk/config
  3. packages/sdk/clone
  4. packages/sdk/importance (tree-sitter)
  5. packages/sdk/analysis
  6. packages/sdk/skill
  7. apps/cli (wrap SDK)
  8. packages/sdk/sync
  9. packages/plugin (OpenCode integration)
  10. packages/backend updates (analyses schema)
```

**Do not skip steps. Each depends on the previous.**

---

## Quick Reference

| What                  | Where                          |
| --------------------- | ------------------------------ |
| Product vision        | `product-vision.md`            |
| Technical spec        | `technical-spec.md`            |
| Decision rationale    | `decisions-log.md`             |
| Implementation phases | `implementation-plan.md`       |
| CLI patterns          | `research/cli-architecture.md` |
| Market context        | `research/market-analysis.md`  |
