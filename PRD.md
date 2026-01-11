# Offworld CLI Analysis Workflow - Product Requirements Document

## Overview

Refactor the `ow` CLI analysis pipeline to be faster, produce slimmer skills, and support remote skill sharing. The CLI prepares context (skills + analysis docs) for users' existing AI agents.

## Requirements

```json
[
	{
		"id": "PRD-001",
		"category": "tree-sitter-removal",
		"description": "Remove tree-sitter dependency entirely and delete the /packages/sdk/src/importance/ directory",
		"steps_to_verify": [
			"Directory /packages/sdk/src/importance/ does not exist",
			"No imports from 'importance/' in any SDK files",
			"No tree-sitter or web-tree-sitter in package.json dependencies",
			"Running `ow pull` does not error on missing tree-sitter"
		],
		"passes": true
	},
	{
		"id": "PRD-002",
		"category": "tree-sitter-removal",
		"description": "Implement heuristics-based file selection to replace tree-sitter import graph analysis",
		"steps_to_verify": [
			"New file /packages/sdk/src/analysis/heuristics.ts exists",
			"Entry points (index.*, main.*, lib.rs) score highest (0.9)",
			"Config files (package.json, *.config.*) score 0.8",
			"Source directories (src/**, lib/**) score 0.6-0.7",
			"Test files score lowest (0.3)",
			"Build outputs (dist/, node_modules/) are excluded",
			"Function returns ranked FileIndexEntry[] without tree-sitter"
		],
		"passes": true
	},
	{
		"id": "PRD-003",
		"category": "ai-optimization",
		"description": "Combine summary and architecture generation into a single AI call",
		"steps_to_verify": [
			"New function generateSummaryAndArchitecture() exists in generate.ts",
			"Single prompt template SUMMARY_ARCHITECTURE_TEMPLATE exists in prompts.ts",
			"Response is parsed into separate summary (string) and architecture (Architecture) objects",
			"Pipeline makes 2 AI calls max (combined + skill) instead of 3"
		],
		"passes": true
	},
	{
		"id": "PRD-004",
		"category": "ai-optimization",
		"description": "Make architecture generation optional to allow faster summary-only analyses",
		"steps_to_verify": [
			"Pipeline accepts includeArchitecture?: boolean option",
			"When false, only summary.md is generated (no architecture.md/json)",
			"Skill generation works with or without architecture data",
			"CLI supports --skip-architecture flag"
		],
		"passes": true
	},
	{
		"id": "PRD-005",
		"category": "skill-format",
		"description": "Reduce skill output from 250-400 lines to ~100 lines",
		"steps_to_verify": [
			"Generated SKILL.md files are 80-120 lines",
			"Skill contains: Quick Paths (15-20 files), Search Patterns table, Deep Context references",
			"No verbose prose or redundant sections",
			"Prompt template in prompts.ts specifies ~100 line target"
		],
		"passes": false
	},
	{
		"id": "PRD-006",
		"category": "skill-format",
		"description": "Remove allowed-tools from skill YAML frontmatter",
		"steps_to_verify": [
			"Generated skill frontmatter contains only: name, description, commit, generated",
			"No 'allowed-tools' key in frontmatter",
			"formatSkillMd() function does not output allowed-tools",
			"Existing skills still work when installed to agent directories"
		],
		"passes": true
	},
	{
		"id": "PRD-007",
		"category": "skill-format",
		"description": "Add commit SHA to skill frontmatter for staleness tracking",
		"steps_to_verify": [
			"Skill frontmatter includes 'commit: <sha>' field",
			"SHA is extracted from cloned repo's HEAD",
			"SHA is 7+ characters (short SHA format acceptable)",
			"meta.json also includes commitSha field"
		],
		"passes": true
	},
	{
		"id": "PRD-008",
		"category": "skill-format",
		"description": "Add generated timestamp to skill frontmatter",
		"steps_to_verify": [
			"Skill frontmatter includes 'generated: YYYY-MM-DD' field",
			"Date is ISO 8601 format (date only, no time)",
			"Date reflects actual generation time, not repo date"
		],
		"passes": true
	},
	{
		"id": "PRD-009",
		"category": "skill-format",
		"description": "Skill must reference analysis directory for deep context",
		"steps_to_verify": [
			"Skill contains '## Deep Context' section",
			"Section includes path to architecture.md",
			"Section includes path to summary.md",
			"Paths use absolute ~/.ow/analyses/... format"
		],
		"passes": false
	},
	{
		"id": "PRD-010",
		"category": "validation",
		"description": "Validate all file paths exist before writing to skill",
		"steps_to_verify": [
			"New validatePathsExist() function in generate.ts or validation/paths.ts",
			"Function checks each path in skill against filesystem",
			"Non-existent paths are removed from skill output",
			"Warning is logged for removed paths",
			"Skill is still valid with reduced paths"
		],
		"passes": false
	},
	{
		"id": "PRD-011",
		"category": "validation",
		"description": "Implement staleness detection comparing commit SHAs",
		"steps_to_verify": [
			"isAnalysisStale(analysisPath, currentSha) function exists",
			"Function reads meta.json and compares commitSha",
			"Returns true if SHAs differ or meta.json missing",
			"pull.ts checks staleness before skipping regeneration"
		],
		"passes": false
	},
	{
		"id": "PRD-012",
		"category": "remote-sharing",
		"description": "Check offworld.sh API for existing analysis before local generation",
		"steps_to_verify": [
			"pull.ts checks remote API first",
			"If analysis exists remotely, download and skip local generation",
			"Remote check includes commit SHA comparison",
			"Graceful fallback to local generation if API unavailable"
		],
		"passes": false
	},
	{
		"id": "PRD-013",
		"category": "remote-sharing",
		"description": "Upload newly generated analyses to offworld.sh",
		"steps_to_verify": [
			"After local generation, upload to offworld.sh API",
			"Upload includes all artifacts (skill, summary, architecture, meta)",
			"Upload requires authentication",
			"Failed uploads don't block local workflow"
		],
		"passes": false
	},
	{
		"id": "PRD-014",
		"category": "performance",
		"description": "Default to shallow git clones (depth 1)",
		"steps_to_verify": [
			"Git clone commands include --depth 1 by default",
			"Full clone available via --full-history flag",
			"Shallow clone sufficient for analysis pipeline"
		],
		"passes": false
	},
	{
		"id": "PRD-015",
		"category": "performance",
		"description": "Implement sparse checkout for large repositories",
		"steps_to_verify": [
			"Sparse checkout enabled for repos > 100MB or > 10k files",
			"Only important directories checked out (src/, lib/, packages/, docs/)",
			"Configurable via --sparse flag or auto-detected"
		],
		"passes": false
	},
	{
		"id": "PRD-016",
		"category": "performance",
		"description": "Reduce context gathering limits for faster analysis",
		"steps_to_verify": [
			"Top files reduced from 15 to 10",
			"Max file size reduced from 100KB to 50KB",
			"Total context budget ~3000 tokens (down from 4000)",
			"Constants configurable in constants.ts"
		],
		"passes": false
	},
	{
		"id": "PRD-017",
		"category": "performance",
		"description": "Local analysis generation completes in under 15 seconds",
		"steps_to_verify": [
			"Run `ow generate` on medium repo (e.g., tanstack/router)",
			"Total time from start to skill installation < 15s",
			"Excludes git clone time (measure separately)",
			"Verbose output shows timing breakdown"
		],
		"passes": false
	},
	{
		"id": "PRD-018",
		"category": "artifacts",
		"description": "All required artifacts are generated and saved",
		"steps_to_verify": [
			"SKILL.md exists in analysis directory",
			"summary.md exists in analysis directory",
			"architecture.md exists in analysis directory",
			"architecture.json exists in analysis directory",
			"file-index.json exists in analysis directory",
			"meta.json exists with commitSha and generated fields"
		],
		"passes": false
	},
	{
		"id": "PRD-019",
		"category": "artifacts",
		"description": "Skill is installed to both OpenCode and Claude skill directories",
		"steps_to_verify": [
			"SKILL.md copied to ~/.config/opencode/skill/{name}.md",
			"SKILL.md copied to ~/.claude/skills/{name}.md",
			"Both directories created if they don't exist",
			"Existing skills are overwritten"
		],
		"passes": false
	},
	{
		"id": "PRD-020",
		"category": "cli",
		"description": "CLI provides clear progress feedback during analysis",
		"steps_to_verify": [
			"Progress messages for: cloning, gathering context, generating summary, generating skill",
			"Spinner or progress indicator during AI calls",
			"Final message shows installed skill path",
			"--verbose flag shows detailed timing and debug info"
		],
		"passes": false
	}
]
```

## File Changes Summary

### Files to Delete

- `/packages/sdk/src/importance/` (entire directory)

### Files to Modify

- `/packages/sdk/src/analysis/pipeline.ts` - Remove tree-sitter, add SHA tracking, new skill format
- `/packages/sdk/src/analysis/context.ts` - Use heuristics instead of import ranking
- `/packages/sdk/src/analysis/generate.ts` - Combine AI calls, add path validation
- `/packages/sdk/src/analysis/prompts.ts` - New combined template, ~100 line skill prompt
- `/packages/sdk/src/analysis/parsers.ts` - Update for new skill format
- `/apps/cli/src/handlers/pull.ts` - Remote-first flow, staleness checks
- `/apps/cli/src/handlers/generate.ts` - New options, upload support

### Files to Add

- `/packages/sdk/src/analysis/heuristics.ts` - File importance heuristics
- `/packages/sdk/src/remote/api.ts` - offworld.sh API client
- `/packages/sdk/src/validation/paths.ts` - Path validation utilities

## New Skill Format Example

```yaml
---
name: tanstack-router
description: Type-safe React router. Consult for routing, loaders, search params, route trees, or TanStack Router internals.
commit: a1b2c3d
generated: 2026-01-10
---

# TanStack Router Reference

Cloned to: ~/.ow/repos/github/tanstack/router
Analysis: ~/.ow/analyses/github--tanstack--router/

## Quick Paths
- `packages/react-router/src/index.tsx` - Main entry point
- `packages/react-router/src/route.tsx` - Route component
- `packages/react-router/src/router.tsx` - Router core
- `packages/react-router/src/hooks/` - All hooks
- `packages/react-router/src/types.ts` - Type definitions
- `packages/router-devtools/src/` - DevTools source
- `examples/react/basic/` - Basic usage example
- `examples/react/kitchen-sink/` - Comprehensive example
[... 15-20 total paths ...]

## Search Patterns
| Find | Pattern | Path |
|------|---------|------|
| Hooks | `export function use` | `packages/*/src/` |
| Types | `export (type\|interface)` | `packages/*/src/` |
| Components | `export const.*=` | `packages/*/src/` |
| Examples | `createRouter` | `examples/` |

## Deep Context
- Architecture: Read ~/.ow/analyses/github--tanstack--router/architecture.md
- Summary: Read ~/.ow/analyses/github--tanstack--router/summary.md
```
