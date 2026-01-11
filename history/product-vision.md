# Offworld: Product Vision

> _"Your dependencies should be as understandable as your own code."_
>
> **Scaffold:** `/Users/oscargabriel/Developer/projects/offworld`

---

## The Problem

Engineers struggle to understand unfamiliar codebases:

| Problem                            | Evidence                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| **Onboarding takes months**        | 3-9 months for new engineers to fully ramp                  |
| **50%+ time reading others' code** | "AI assistants help with side projects, not with real work" |
| **Dependency blindness**           | 70-90% of modern software is OSS we never read              |
| **AI hallucination**               | LLMs trained on stale data give wrong answers about APIs    |
| **Context limits**                 | Can't paste entire codebase into an LLM prompt              |
| **Finding the right files**        | "Which 15 files out of 10,000 actually matter?"             |
| **Repeated scanning waste**        | Agent re-reads the same files every session, burning tokens |

### Real Quotes

> "@RhysSullivan: every time I put dependency source in .context/, agent output gets exponentially better"

> "@ryanvogel: need something like bun's package cache but for cloned repos with analysis"

> "@aidenybai: significant alpha in better diagramming/exploration tools"

> "The main bottleneck is not writing code, it's acquiring the necessary context to make quality changes." — Sourcebot

---

## Core Belief

**Code understanding should flow naturally: discovery, then local ownership, then AI augmentation.**

When debugging why `tanstack/router` behaves a certain way, you shouldn't need to open GitHub, navigate unfamiliar files, and hope ChatGPT knows the current API. You also shouldn't burn tokens letting your agent re-scan the same 50 files every time you ask a new question. The agent should already know the codebase layout. Ask once, get a grounded answer from actual source code.

---

## Product Tenets

1. **Learn how to use and work with open source tools fast.** Get guidance on codebase architecture for you and skill files for your agent.

2. **Save tokens and time.** Your agent shouldn't re-scan the same files every session. Our skill files give agents a map upfront so any question you have can be answered nearly instantly.

3. **Easily manage your local git clones.** Keep repos up-to-date with the latest changes analyzed and accounted for in our skill files.

4. **Use our online directory and marketplace.** Find high-quality open source tools with verified analyses and skill files. Get started immediately with one-click commands to paste into your terminal.

5. **Always reference real code, real docs, really fast.** With your local git clones and our curated agent skills.

6. **Use your preferred agent setup.** We generate skill files, not opinions on tooling. Works with Claude Code, OpenCode, Cursor—whatever you run.

---

## The Key Feature: Auto-Generated Skills

Skills have become the dominant standard for extending AI coding assistants:

| Metric                         | Value                                                |
| ------------------------------ | ---------------------------------------------------- |
| Skills on SkillsMP marketplace | **40,779+**                                          |
| Adopting platforms             | Claude Code, OpenCode, Codex CLI, ChatGPT, LangChain |
| Context efficiency             | **~100 tokens** (vs MCP's ~10k)                      |

**No one is auto-generating skills for OSS repositories.** SkillsMP has 40k+ skills, ALL manually authored. Offworld would be the **first skill generation engine**.

### What Offworld Skills Look Like

```yaml
---
name: tanstack-router-reference
description: Consult cloned TanStack Router source when user asks about routing, navigation, or type-safe links.
allowed-tools: [Read, Grep, Glob, Task]
---

# TanStack Router Source Reference

## Repository Structure
- `/packages/router-core/` - Framework-agnostic core
- `/packages/react-router/` - React bindings
- `/examples/react/` - 57 example applications

## Quick Reference Paths
- `packages/router-core/src/Router.ts` - Main router class
- `packages/react-router/src/useRouter.tsx` - Primary hook

## Search Strategies
For hook usage: `pattern: "export function use[HookName]"`
For types: `pattern: "export (type|interface) [TypeName]"`

## When to Use
- Route configuration questions
- Navigation hook implementation
- Type-safe link patterns
```

### Why Skills Matter

1. **Immediate value without CLI.** Copy skills from web directory.
2. **100x more token-efficient than MCP.** A skill is ~100 tokens. An MCP tool definition is ~10k. Over dozens of questions, that adds up fast.
3. **Agent knows where to look.** No exploratory scanning. The skill tells the agent exactly which files matter and what grep patterns to use.
4. **Universal standard.** Works across Claude Code, OpenCode, Codex, ChatGPT.
5. **Lazy loading.** Only loaded when agent needs them.

---

## User Personas

### The Contributor

- Wants to contribute to open source
- Needs to understand codebase before making PRs
- Uses CLI to clone and analyze repos locally
- Appreciates issue difficulty ratings

### The Integrator

- Building apps with many dependencies
- Needs to understand how libraries work internally
- Uses OpenCode with Offworld plugin for research
- Values accurate, up-to-date information

### The Explorer

- Curious about how things work
- Browses interesting projects for learning
- Uses web app to discover and bookmark repos
- Shares analyses with teammates

**V1 targets:** Contributors + Integrators

---

## Core Flows

### Flow 1: Just-in-Time Clone (Primary)

```
User coding, needs to understand dependency
  → Agent: offworld({ mode: "summary", repo: "tanstack/router" })
  → Plugin: "Not cloned locally. Clone tanstack/router?"
  → Agent: offworld({ mode: "clone", repo: "tanstack/router" })
  → Background clone + analyze
  → Agent notified when complete
  → Agent uses summary/architecture + native grep/read tools
```

### Flow 2: Project Init

```
User in new project with package.json
  → CLI: ow init
  → Scans deps, ranks by importance
  → Suggests top 5: "Clone? [tanstack/router, convex, ...]"
  → User confirms
  → Parallel clone + analyze
  → Agent now has grounded context for all deps
```

### Flow 3: Contribution Prep

```
User wants to contribute to OSS
  → CLI: ow pull facebook/react
  → Uses agent to understand codebase via SKILL.md
  → Makes contribution
  → CLI: ow push facebook/react (shares analysis with community)
```

### Flow 4: Discovery → Local Ownership

```
User browses offworld.sh
  → Finds interesting repo analysis
  → Clicks "Copy command"
  → Runs: bunx @offworld/cli pull tanstack/router
  → CLI clones repo + pulls analysis + installs skill
```

### Flow 5: Natural Agent Conversation

```
User: "How does TanStack Router handle route preloading?"

Agent sees (injected, invisible to user):
  [OFFWORLD]
  Cloned repos: tanstack/router (analyzed 2h ago)

Agent uses tool:
  offworld({ mode: "architecture", repo: "tanstack/router" })

Agent receives:
  { entities: [...], keyFiles: ["packages/router/src/router.ts", ...] }

Agent: (uses native grep/read on ~/ow/tanstack/router)
Agent: "Based on the TanStack Router source code, preloading works by..."
```

**Without Offworld:** Agent spends 2-3 minutes scanning folders, reading READMEs, guessing at file importance. Burns 5-10k tokens just orienting itself. Repeats this every session.

**With Offworld:** Agent loads the skill (~100 tokens), knows the 5 key files, greps directly. Answer in 20 seconds.

---

## Four Surfaces

| Surface                    | Purpose                              | Priority         |
| -------------------------- | ------------------------------------ | ---------------- |
| **CLI** (`ow`)             | Clone, analyze, manage repos locally | P1 (build first) |
| **TUI** (`ow` interactive) | Interactive terminal UI via OpenTUI  | P2 (scaffolded)  |
| **OpenCode Plugin**        | Agent integration, context injection | P1 (after CLI)   |
| **Web** (offworld.sh)      | Directory, sync, skill copy-paste    | P1 (scaffolded)  |
| **Docs**                   | Documentation via Astro Starlight    | P2 (scaffolded)  |

### The User Loop

```
[Web] Discover tanstack/router → "This looks useful"
        ↓
[CLI] ow pull tanstack/router → Now it's yours, analyzed locally
        ↓
[Plugin] "How does TanStack Router handle preloading?" → Agent searches YOUR clone
        ↓
[Web] Share your analysis with the team → They pull it too
```

---

## What's NOT in V1

- Private repos (GitHub OAuth in CLI deferred)
- Non-GitHub repos (GitLab, BitBucket)
- Language-specific analysis prompts
- MCP server (OpenCode plugin only)
- Analysis versioning/history
- Team features
- Paid tiers (all free forever; this is a side project)

---

## Success Criteria

### Launch Criteria

- CLI installs in <30 seconds
- `ow pull tanstack/router` completes in <2 minutes
- `ow generate` works via Claude Code or OpenCode (auto-detected)
- OpenCode plugin works with all modes
- Web browse/sync works reliably
- Analysis costs <$0.05 per repo (user's key)

### What Success Looks Like

- Developers use `ow pull` instead of `git clone` for OSS exploration
- Agents answer dependency questions from actual source, not training data
- Repeated questions about the same repo cost near-zero extra tokens
- Web directory becomes the go-to place for curated OSS analyses and skills
