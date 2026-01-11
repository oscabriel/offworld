# Offworld: Research Changelog

> All validated decisions with rationale. Chronological record of research conclusions.

---

## Summary: Final Decisions

| Area                | Decision                                   | Rationale                                                                   |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| **Core Value Prop** | Auto-generated skills for OSS repos        | First skill generation engine. 40k skills on SkillsMP, none auto-generated. |
| **AI Provider**     | Claude Code + OpenCode (dual, auto-detect) | Uses user's existing auth; no API keys needed                               |
| **CLI Framework**   | trpc-cli + @orpc/server                    | Router = SDK = CLI. Validated in better-t-stack.                            |
| **File Importance** | Tree-sitter (TS/JS/Rust/Go/Python)         | Import-based ranking matches Aider's approach                               |
| **Sync Model**      | Pull-first, one analysis per repo          | Simple, no conflicts                                                        |
| **Push Gate**       | 5+ GitHub stars required                   | Filters spam/test repos                                                     |
| **Local Repos**     | Full support, analyze in place             | Cannot push to web                                                          |
| **Auth**            | Better Auth + GitHub OAuth                 | Reuse web auth infrastructure                                               |
| **CLI-Convex Sync** | HTTP Actions + fetch()                     | No Convex SDK in CLI, proven in better-t-stack                              |

---

## Validation Evidence

### Market Validation

| Evidence                  | Source                       |
| ------------------------- | ---------------------------- |
| "Clone + AI search" works | btca (347 stars, active)     |
| Context is the bottleneck | Greptile raised $25M         |
| Skills > MCP consensus    | HN, Twitter, Medium articles |
| 40,779 skills exist       | SkillsMP marketplace         |
| Zero auto-generated       | First-mover opportunity      |

### Technical Validation

| Approach                   | Validated By               |
| -------------------------- | -------------------------- |
| Tree-sitter for importance | Aider, Buildt, Cognee      |
| Import-based file ranking  | CodeContext, similar tools |
| ConvexHttpClient for CLI   | Working demo built         |
| HTTP Actions pattern       | better-t-stack analytics   |

### Competitor Insights

| Competitor           | Key Learning                                                       |
| -------------------- | ------------------------------------------------------------------ |
| **btca**             | Validates market; no skills = our moat                             |
| **repogrep**         | Ignore patterns, binary detection, gitignore parsing (code stolen) |
| **opensrc**          | Lockfile version detection, AGENTS.md convention                   |
| **cursor.directory** | User submissions with login = quality gate                         |
| **SkillsMP**         | Pure aggregation, no curation                                      |
| **MCPScout**         | Vetting = differentiation                                          |

---

## Chronological Decisions

### Jan 2, 2026 - Strategic Audit

**Why OpenCode-only initially?**

- MCPs are ~10k tokens. Skills are ~100 tokens.
- Industry consensus shifting: skills > MCP
- Updated: Now dual-provider (Claude Code + OpenCode)

**Sustainability plan?**

- Side project, not startup. Free forever sustainable.
- Future: sponsorware (large OSS companies sponsor featured spots)

**Why offworld.sh vs GitHub?**

- Developers find OSS elsewhere, not on GitHub directly
- Value: curated, pre-analyzed, immediate skill copy-paste

**Skills without local clone?**

- Skills require clone. "Copy skill" button runs `bunx` command that handles clone + analysis.

### Jan 3, 2026 - Technical Details

**Skill generation approach?**

- Structured output: generateObject + Zod schema
- Context budget: ~3500-4000 tokens

**Incremental analysis unit?**

- Commit-level. Store last analyzed SHA.

**Primary entry point?**

- CLI-first. Plugin and web depend on solid CLI.

**Clone behavior?**

- Pull-first: check remote, pull if exists, else generate locally

**Architecture depth?**

- Deep: full entity extraction + relationships + Mermaid diagrams

**Per-file summaries?**

- Yes, for top ~50 files by importance

### Jan 7, 2026 - Web App Decisions

**One analysis per repo, or multiple?**

- One. Last approved push wins.

**Who can push?**

- Anyone with GitHub OAuth

**Quality gate?**

- Manual approval for first push per repo
- Auto-approve updates after

**Attribution shown?**

- Anonymous until V2 maintainer verification

**Conflict resolution?**

- Newer overwrites older
- Same commit, different analysis = blocked

**Rate limits?**

- 3 pushes per repo per day

**Staleness handling?**

- Warn ("Analysis is 47 commits behind"), don't block

### Jan 8, 2026 - CLI Finalization

**Command consolidation:**

- `ow pull` = smart clone-or-sync (aliases: `clone`, `get`)
- `ow generate` = force local AI generation
- `ow push` = share to offworld.sh
- Removed: `ow update`, `ow analyze` (merged/renamed)

**Global flags added:**

- `-v/--verbose`, `-q/--quiet`, `-V/--version`
- TTY-aware `--help` (human vs JSON)

**`generate` behavior:**

- Warns and exits if remote exists
- `--force` to proceed anyway

**Input formats:**

- owner/repo, GitHub URLs, SSH URLs, local paths all supported

**Star gate:**

- 5+ stars required to push to offworld.sh

**Local repo support:**

- Full: analyze in place, skills installed, cannot push

---

## Deferred to V2

| Feature                              | Reason                                 |
| ------------------------------------ | -------------------------------------- |
| TUI mode (`ow explore`)              | CLI-first priority                     |
| Maintainer verification badges       | Complex re-verification UX             |
| Private repos                        | Requires GitHub OAuth scopes           |
| Non-GitHub hosts (GitLab, Bitbucket) | GitHub covers 90%+ of users            |
| MCP server                           | Skills > MCP                           |
| Direct API fallback                  | Claude Code/OpenCode covers most users |
| Team features                        | Single-user for V1                     |

---

## Design Principles

1. **Local-first** - Your clones, your analysis, your machine
2. **Agent-native** - Built to be called by AI, not just humans
3. **Context-efficient** - ~100 tokens vs MCP's ~10k
4. **Dual-provider** - Works with Claude Code or OpenCode
5. **Zero config** - Uses user's existing AI auth
6. **Open source** - MIT licensed, free forever

---

## Key Patterns Adopted

| Pattern                | Source         | Where Used     |
| ---------------------- | -------------- | -------------- |
| Router-based CLI       | better-t-stack | apps/cli       |
| Zod schemas as types   | better-t-stack | packages/types |
| HTTP Actions for sync  | better-t-stack | SDK ↔ Convex   |
| Ignore patterns (100+) | repogrep       | packages/sdk   |
| Binary file detection  | repogrep       | packages/sdk   |
| Gitignore parsing      | repogrep       | packages/sdk   |
| File hash tracking     | repogrep       | packages/sdk   |

---

## Risk Analysis

| Risk                                   | Likelihood | Mitigation                      |
| -------------------------------------- | ---------- | ------------------------------- |
| Cursor/Copilot adds repo understanding | Medium     | Skills moat is real, move fast  |
| SkillsMP adds auto-generation          | Low        | First-mover advantage           |
| btca adds skills                       | Low        | Different focus (Q&A vs skills) |
| Skills format changes                  | Low        | Open standard (agentskills.io)  |

---

_Last updated: January 8, 2026_
