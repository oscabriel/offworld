# @offworld/sdk

Core business logic for Offworld.

Powers the CLI and web app with git clone management, AI reference generation, and agent skill distribution.

## Installation

```bash
bun add @offworld/sdk
```

## Modules

| Module | Description |
| --- | --- |
| `config.ts` | Config load/save, path utilities |
| `paths.ts` | XDG-compliant path resolution |
| `clone.ts` | Git clone/update/remove |
| `index-manager.ts` | Global + project map management |
| `generate.ts` | AI reference generation |
| `sync.ts` | Convex client for push/pull |
| `auth.ts` | WorkOS token management |
| `agents.ts` | Agent registry |
| `agents-md.ts` | AGENTS.md reference table generation |
| `repo-source.ts` | Parse repo input (URL, owner/repo, local) |
| `manifest.ts` | Dependency parsing (package.json, etc.) |
| `dep-mappings.ts` | npm package to GitHub repo resolution |
| `reference-matcher.ts` | Match deps to installed references |
| `repo-manager.ts` | Bulk repo operations (update, prune, gc) |
| `models.ts` | AI provider/model registry |
| `installation.ts` | Upgrade/uninstall utilities |

## Usage

### Config & Paths

```typescript
import { loadConfig, saveConfig, Paths } from "@offworld/sdk";

const config = loadConfig();
const skillDir = Paths.offworldDir;
const globalMap = Paths.globalMap;
```

### Clone Management

```typescript
import { cloneRepo, updateRepo, removeRepo } from "@offworld/sdk";

await cloneRepo(repoSource, { shallow: true });
await updateRepo("owner/repo");
await removeRepo("owner/repo", { referenceOnly: true });
```

### Reference Generation

```typescript
import { generateReferenceWithAI, installReference } from "@offworld/sdk";

const result = await generateReferenceWithAI(repoPath, { model: "claude-sonnet-4-20250514" });
await installReference("owner/repo", result.referenceContent, result.commitSha);
```

### Map Management

```typescript
import { readGlobalMap, writeProjectMap, upsertGlobalMapEntry } from "@offworld/sdk";

const globalMap = readGlobalMap();
await upsertGlobalMapEntry("owner/repo", { localPath, references: ["repo.md"] });
await writeProjectMap(cwd, projectMap);
```

### Sync (Push/Pull)

```typescript
import { pullReference, pushReference, checkRemote } from "@offworld/sdk";

const ref = await pullReference("owner/repo");
await pushReference("owner/repo", referenceData);
```

### Dependency Resolution

```typescript
import { parseDependencies, resolveDependencyRepo, matchDependenciesToReferences } from "@offworld/sdk";

const deps = parseDependencies("package.json");
const repo = await resolveDependencyRepo("zod");
const matches = matchDependenciesToReferences(deps);
```

## Data Paths

| Purpose | Getter |
| --- | --- |
| Config | `Paths.config` |
| Data root | `Paths.data` |
| Skill dir | `Paths.offworldDir` |
| Global map | `Paths.globalMap` |
| References | `Paths.referencesDir` |

## Commands

```bash
bun run build        # Build with tsdown
bun run dev          # Watch mode
bun run typecheck    # Type check
bun run test         # Run tests
```
