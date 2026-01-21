# Project-Level Init Plan

**Status:** Proposed  
**Created:** 2026-01-21  
**Problem:** `ow init` needs better project-level skill setup without adding config file clutter

## Problem Statement

Two distinct init flows needed:

1. **Global init** (`ow init`) - One-time setup: AI provider, repo root, agents
2. **Project init** (`ow project init`) - Per-project: scan manifest, install skills, update AGENTS.md

Both should:

- Work interactively for humans
- Support non-interactive flags for agent automation
- **NOT** create branded config files in projects

## Command Namespace: `ow project`

Following the pattern of `ow auth login`, `ow config get`, etc., project-level commands live under `ow project`:

| Command                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `ow project init`         | Scan manifest, install skills, update AGENTS.md |
| `ow project status`       | Show project's skills and their state           |
| `ow project sync`         | Re-scan manifest, add new deps, flag removed    |
| `ow project add <dep>`    | Manually add skill for a dep not in manifest    |
| `ow project remove <dep>` | Remove skill reference from AGENTS.md           |

**v1 scope:** `ow project init` only. Others are future enhancements.

## Research Findings

### opencode (anomalyco)

- Config precedence: remote → global → env path → project (findUp) → env content
- Project tracking: ID from git root commit hash, worktree/sandboxes tracked in XDG data storage
- Skills: loaded from `.opencode/{skill,skills}/**/SKILL.md` and `.claude/skills/**/SKILL.md`
- `/init` marks project initialized in project storage

### better-context

- Global: `~/.config/btca/btca.config.jsonc`
- Project: `./btca.config.jsonc` in cwd
- Merges global + project; project overrides by name
- **Setup prompt pattern**: scan package.json → propose resources → confirm → write config + update AGENTS.md

### External Patterns

- cosmiconfig: cascading config search (package.json → rc files → config dir)
- AI tooling: per-project dirs (`.opencode/`, `.claude/`, `.cursor/`, `.cline/`)
- Minimal footprint tools: write to existing files only (AGENTS.md)

## Current State in Offworld

| Component      | Location                                               | Status     |
| -------------- | ------------------------------------------------------ | ---------- |
| Global config  | `~/.config/offworld/config.json`                       | Keep       |
| Project config | `.offworld/project.json`                               | **Remove** |
| Skill storage  | `~/.local/share/offworld/skills/{name}/SKILL.md`       | Keep       |
| Agent symlinks | `~/.claude/skills/`, `~/.config/opencode/skill/`, etc. | Keep       |
| Init handler   | `apps/cli/src/handlers/init.ts`                        | Modify     |

## Command Structure

### `ow init` — Global Setup (one-time)

```
ow init [options]

Options:
  --model <provider/model>   AI provider and model (e.g., opencode/claude-sonnet-4-5)
  --repo-root <path>         Where to clone repos (default: ~/ow)
  --agents <list>            Comma-separated agents (opencode,claude-code,cursor,...)
  --yes, -y                  Skip confirmations
  --force                    Reconfigure even if config exists
```

**Model format:** `{provider}/{model}` — mirrors opencode CLI pattern

- `opencode/claude-sonnet-4-5`
- `anthropic/claude-sonnet-4-5-20250929`
- `openai/gpt-5.2`

**Behavior:**

- If global config exists AND in a project directory:

  ```
  Global config already exists at ~/.config/offworld/config.json

  Did you mean to run project setup? Use:
    ow project init

  To reconfigure global settings, use:
    ow init --force
  ```

- If global config exists AND NOT in a project:
  ```
  Already configured. Use --force to reconfigure.
  ```

### `ow project init` — Project Setup (per-project)

```
ow project init [options]

Options:
  --all                 Select all detected dependencies
  --deps <list>         Comma-separated deps to include (skip selection)
  --skip <list>         Comma-separated deps to exclude
  --generate            Generate skills for deps without existing ones
  --dry-run             Show what would be done without doing it
  --yes, -y             Skip confirmations
```

**Behavior:**

- Requires global config to exist (prompt to run `ow init` first if missing)
- Scans manifest, resolves repos, prompts for selection, installs skills, updates AGENTS.md

## Flows

### Global Init Flow (`ow init`)

```
ow init
    │
    ├─1─► Check if config exists
    │     ├── exists + in project → suggest `ow project init`
    │     └── exists + not in project → suggest --force
    │
    ├─2─► Prompt: repo root (default ~/ow)
    │
    ├─3─► Prompt: AI provider (opencode recommended)
    │
    ├─4─► Prompt: model selection (filtered by provider)
    │
    ├─5─► Auto-detect installed agents
    │
    ├─6─► Prompt: confirm/modify agent selection
    │
    └─7─► Write ~/.config/offworld/config.json
          (stores as ai.provider + ai.model internally)
```

**Note:** Interactive mode prompts provider then model separately for UX.
Non-interactive `--model` flag accepts combined `provider/model` format.

### Project Init Flow (`ow project init`)

```
ow project init
    │
    ├─1─► Check global config exists
    │     └── missing → error: "Run 'ow init' first"
    │
    ├─2─► Detect project root (git or cwd)
    │
    ├─3─► Scan dependency manifests
    │     ├── package.json (npm/bun/yarn)
    │     ├── pyproject.toml (python)
    │     ├── Cargo.toml (rust)
    │     ├── go.mod (go)
    │     └── requirements.txt (python fallback)
    │
    ├─4─► Resolve dependency → repo mapping
    │     ├── Tier 1: KNOWN_MAPPINGS lookup
    │     ├── Tier 2: npm registry fallback
    │     └── Tier 3: Prompt user for unknowns
    │
    ├─5─► Match to skill availability
    │     ├── installed (skill exists locally)
    │     ├── available (can pull from registry)
    │     └── generate (needs AI generation)
    │
    ├─6─► Present checklist to user
    │     [x] react (installed)
    │     [x] convex (available - will pull)
    │     [ ] some-obscure-lib (generate new)
    │     [ ] internal-lib (skip)
    │
    ├─7─► For each selected dependency:
    │     ├── If installed → no-op
    │     ├── If available → pull skill
    │     └── If generate → pull + generate skill
    │
    └─8─► Update AGENTS.md + agent-specific files
          ├── Create file if missing
          ├── Append/update "## Project Skills" section
          └── List skills with file path references
```

## Agent-Friendly Onboarding

### Quick Copy-Paste Prompt

For users to paste into their AI agent:

```
Set up offworld for this project:

1. Check if offworld CLI is installed: `ow --version`
   - If not installed: `bun install -g offworld` (or npm/pnpm)

2. Check if global config exists: `ow config get`
   - If "No config found": run `ow init --model opencode/claude-sonnet-4-5 --yes`

3. Run project setup: `ow project init --all --generate --yes`

4. Verify: Check that AGENTS.md now has a "## Project Skills" section

Report what was installed and any errors encountered.
```

### Detailed Agent Instructions

For agents that need more context (e.g., in AGENTS.md of offworld docs):

```markdown
## offworld Setup

When a user asks to "set up offworld" or "add skills for this project":

### Prerequisites Check

1. Verify CLI installed: `ow --version`
   - Install if missing: `bun install -g offworld`

2. Verify global config: `ow config get`
   - If missing, run global init (see below)

### Global Init (one-time)

If no global config exists:
\`\`\`bash
ow init --model opencode/claude-sonnet-4-5 --yes
\`\`\`

Or interactive for user control:
\`\`\`bash
ow init
\`\`\`

### Project Init (per-project)

For autonomous setup (all deps, generate missing skills):
\`\`\`bash
ow project init --all --generate --yes
\`\`\`

For selective setup (let user choose):
\`\`\`bash
ow project init
\`\`\`

For specific deps only:
\`\`\`bash
ow project init --deps react,convex,tanstack-router --generate --yes
\`\`\`

### Dry Run

To preview without changes:
\`\`\`bash
ow project init --dry-run
\`\`\`

### What Gets Created

- Skills installed to: `~/.local/share/offworld/skills/`
- Symlinks created in agent dirs: `~/.claude/skills/`, `~/.config/opencode/skill/`, etc.
- AGENTS.md updated with "## Project Skills" section
- Agent-specific files updated if they exist (CLAUDE.md, etc.)

### No Project Files Created

offworld does NOT create config files in your project. Skills are global;
project awareness is captured in AGENTS.md only.
```

### Example: Full Autonomous Setup

User pastes this prompt:

```
Set up offworld for this project. Install the CLI if needed, configure it with
OpenCode as the provider, scan my dependencies, and install skills for everything
you find. Use autonomous flags to avoid prompts.
```

Agent executes:

```bash
# 1. Check/install CLI
which ow || bun install -g offworld

# 2. Global init if needed
ow config get 2>/dev/null || ow init --model opencode/claude-sonnet-4-5 --yes

# 3. Project init
ow project init --all --generate --yes
```

Agent reports:

```
offworld setup complete:
- Installed CLI via bun
- Configured with OpenCode provider
- Found 12 dependencies in package.json
- Installed 8 skills (4 already existed, 4 generated)
- Updated AGENTS.md with skill references

Installed skills:
  - react (facebook/react)
  - convex (get-convex/convex)
  - tanstack-router (tanstack/router)
  - ... etc
```

### AGENTS.md Output Format

```markdown
## Project Skills

Skills installed for this project's dependencies:

| Dependency      | Skill           | Path                                                       |
| --------------- | --------------- | ---------------------------------------------------------- |
| react           | react           | ~/.local/share/offworld/skills/facebook-react-reference    |
| convex          | convex          | ~/.local/share/offworld/skills/get-convex-convex-reference |
| tanstack-router | tanstack-router | ~/.local/share/offworld/skills/tanstack-router-reference   |

To update skills, run: `ow pull <dependency>`
To regenerate all: `ow project init --all --generate`
```

### Reproducibility Without Config

**Option A: Accept the limitation (recommended for v1)**

- Skills are "fire and forget"
- Users who want reproducibility commit AGENTS.md
- Re-run `ow init` to restore

**Option B: Hidden comment marker**

```markdown
<!-- offworld:skills react,convex,tanstack-router -->
```

- Enables future `ow sync` to read back skill list
- Fragile if user edits/removes comment

**Option C: Global project registry**

- Store project→skill mappings in `~/.local/state/offworld/projects.json`
- Keyed by absolute path (breaks across machines)
- No project file, but machine-readable

## Implementation Tasks

### Phase 1: Command Restructure

1. Split `apps/cli/src/handlers/init.ts`
   - Keep `initHandler()` for global setup only
   - Remove `setupProjectLinks()` and `OffworldProjectConfig`
   - Add detection: if config exists + in project → suggest `ow project init`
   - Add `--force` flag to allow reconfiguration

2. Create `apps/cli/src/handlers/project.ts`
   - New `projectInitHandler(options: ProjectInitOptions)`
   - Options: `all`, `deps`, `skip`, `generate`, `dryRun`, `yes`
   - Structure for future `project status`, `project sync`, etc.

3. Update `apps/cli/src/index.ts`
   - Add `project` command group with `init` subcommand

### Phase 2: Manifest Scanning

4. Create `packages/sdk/src/manifest.ts`
   - `detectManifestType(dir: string): ManifestType`
   - `parseDependencies(dir: string): Dependency[]`
   - Support: package.json, pyproject.toml, Cargo.toml, go.mod, requirements.txt

### Phase 3: Dependency → Repo Resolution

5. Create `packages/sdk/src/dep-mappings.ts`
   - `KNOWN_MAPPINGS: Record<string, string>` - hardcoded top 50-100 deps
   - `resolveFromNpm(packageName: string): Promise<string | null>` - npm registry fallback
   - `resolveDependencyRepo(dep: string): Promise<ResolvedDep>`

### Phase 4: Skill Matching

6. Add skill index query to SDK
   - `matchDependenciesToSkills(deps: ResolvedDep[]): SkillMatch[]`
   - Return: `{ dep, repo, status: 'installed' | 'available' | 'generate' | 'unknown' }`

### Phase 5: AGENTS.md Update

7. Create `packages/sdk/src/agents-md.ts`
   - `updateAgentFiles(projectRoot: string, skills: InstalledSkill[])`
   - `appendSkillsSection(filePath: string, skills: InstalledSkill[])`
   - Handle existing sections (find + replace, or append)
   - Support AGENTS.md + agent-specific files (CLAUDE.md, etc.)

### Phase 6: Integration

8. Wire up `initProjectHandler`
   - Scan manifest → resolve repos → match skills → prompt selection
   - Batch install: `pullHandler()` for each
   - Update AGENTS.md + agent files
   - Report summary

### Phase 7: Agent Onboarding Docs

9. Create `apps/docs/src/content/docs/setup-prompt.md`
   - Quick copy-paste prompt
   - Detailed agent instructions
   - Examples for autonomous and interactive modes

### Phase 8: Cleanup

10. Remove deprecated code
    - Delete `.offworld/project.json` references
    - Remove `OffworldProjectConfig` interface
    - Update tests

## File Changes

| File                                         | Change                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `packages/sdk/src/manifest.ts`               | **New** - Dependency manifest parsing                                 |
| `packages/sdk/src/dep-mappings.ts`           | **New** - Dependency name → repo resolution                           |
| `packages/sdk/src/agents-md.ts`              | **New** - AGENTS.md manipulation                                      |
| `packages/sdk/src/index.ts`                  | Export new modules                                                    |
| `apps/cli/src/handlers/init.ts`              | **Modify** - Global only; remove project linking; add `--force`       |
| `apps/cli/src/handlers/project.ts`           | **New** - Project command handlers (`init`, future: `status`, `sync`) |
| `apps/cli/src/handlers/index.ts`             | Export new handlers                                                   |
| `apps/cli/src/index.ts`                      | **Modify** - Add `project` command group                              |
| `apps/docs/src/content/docs/setup-prompt.md` | **New** - Agent onboarding prompt                                     |

## Resolved Questions

1. **Which AGENTS.md to update?**
   - **Decision:** Both AGENTS.md (generic) AND agent-specific files if they exist (CLAUDE.md, etc.)

2. **Dependency name → repo mapping?**
   - **Decision:** Three-tier resolution (see below)

3. **Regenerate on re-run?**
   - **Decision:** Show diff, ask to confirm changes

4. **Monorepo support?**
   - **Decision:** Scan root manifest only for v1; `--recursive` flag for later

## Dependency → Repo Mapping Strategy

**Research finding:** better-context delegates this to AI (agent suggests URLs during setup). They also ship hardcoded defaults for popular libs.

**Our approach: Three-tier resolution**

### Tier 1: Hardcoded Mapping (~50-100 popular deps)

Create `packages/sdk/src/dep-mappings.ts`:

```typescript
export const KNOWN_MAPPINGS: Record<string, string> = {
	// React ecosystem
	react: "facebook/react",
	"react-dom": "facebook/react",
	next: "vercel/next.js",
	remix: "remix-run/remix",

	// Vue ecosystem
	vue: "vuejs/core",
	nuxt: "nuxt/nuxt",

	// Svelte ecosystem
	svelte: "sveltejs/svelte",
	sveltekit: "sveltejs/kit",
	"@sveltejs/kit": "sveltejs/kit",

	// State management
	"@tanstack/query": "tanstack/query",
	"@tanstack/router": "tanstack/router",
	zustand: "pmndrs/zustand",
	jotai: "pmndrs/jotai",

	// Backend
	express: "expressjs/express",
	hono: "honojs/hono",
	fastify: "fastify/fastify",
	trpc: "trpc/trpc",
	"@trpc/server": "trpc/trpc",

	// Database
	"drizzle-orm": "drizzle-team/drizzle-orm",
	prisma: "prisma/prisma",
	"@prisma/client": "prisma/prisma",

	// Validation
	zod: "colinhacks/zod",
	valibot: "fabian-hiller/valibot",

	// Styling
	tailwindcss: "tailwindlabs/tailwindcss",

	// Convex
	convex: "get-convex/convex-backend",

	// ... etc
};
```

### Tier 2: npm Registry Fallback

Query npm registry for `repository.url`:

```typescript
async function resolveFromNpm(packageName: string): Promise<string | null> {
	const res = await fetch(`https://registry.npmjs.org/${packageName}`);
	if (!res.ok) return null;
	const data = await res.json();
	const repoUrl = data.repository?.url;
	if (!repoUrl) return null;
	// Parse "git+https://github.com/owner/repo.git" → "owner/repo"
	return parseGitHubUrl(repoUrl);
}
```

### Tier 3: Prompt User

For unresolved deps:

```
? I found these dependencies but couldn't determine their GitHub repos:
  - internal-utils
  - @company/shared-lib

  Enter repo (owner/repo) or press Enter to skip:
  internal-utils: [skip]
  @company/shared-lib: [skip]
```

### Mapping Flow

```
dependency name
    │
    ├─► Check KNOWN_MAPPINGS → found? → use it
    │
    ├─► Query npm registry → has repo? → use it
    │
    └─► Prompt user → entered? → use it
                    → skipped? → exclude from skills
```

## Success Criteria

### Global Init (`ow init`)

- [ ] First run creates `~/.config/offworld/config.json`
- [ ] If config exists + in project: prompts to use `ow project init`
- [ ] If config exists + not in project: suggests `--force`
- [ ] `--force` allows reconfiguration
- [ ] All prompts skippable via flags (`--model provider/model`, `--repo-root`, `--agents`, `--yes`)

### Project Init (`ow project init`)

- [ ] Fails gracefully if no global config (tells user to run `ow init` first)
- [ ] Scans package.json (and other manifests)
- [ ] Resolves dependency names to GitHub repos (3-tier)
- [ ] Shows checklist with skill availability status
- [ ] Installs selected skills to global skill dir
- [ ] Updates AGENTS.md with "## Project Skills" section
- [ ] Updates agent-specific files if they exist (CLAUDE.md, etc.)
- [ ] No `.offworld/` directory or config file created in project
- [ ] `--all` selects all dependencies automatically
- [ ] `--deps` allows explicit list
- [ ] `--generate` enables AI generation for missing skills
- [ ] `--dry-run` previews without changes
- [ ] Re-running shows diff and asks to confirm changes

### Agent Automation

- [ ] Full autonomous setup possible with flags only
- [ ] Setup prompt documented for copy-paste use
- [ ] Exit codes are meaningful (0 success, 1 error)

## Risks

| Risk                                   | Mitigation                                            |
| -------------------------------------- | ----------------------------------------------------- |
| AGENTS.md format varies by project     | Use consistent markdown; append don't replace         |
| User edits AGENTS.md, breaks structure | Use comment markers; be resilient to missing sections |
| Dependency→repo mapping incomplete     | Start with top 100; prompt for unknowns               |
| No reproducibility for teams           | Document limitation; recommend committing AGENTS.md   |
