# SDK Package - Agent Learnings

## OpenCode Integration Patterns

### Provider/Model Validation (US-001)

**Pattern**: Always validate provider and model BEFORE sending prompts

```typescript
// Validate provider and model before sending prompt
const providerResult = await client.provider.list();
const { all: allProviders, connected: connectedProviders } = providerResult.data;

// 1. Check provider exists
const provider = allProviders.find((p) => p.id === providerID);
if (!provider) throw new InvalidProviderError(providerID, allProviderIds);

// 2. Check provider is connected
if (!connectedProviders.includes(providerID))
	throw new ProviderNotConnectedError(providerID, connectedProviders);

// 3. Check model exists for provider
if (!provider.models[modelID]) throw new InvalidModelError(modelID, providerID, availableModelIds);
```

### Error Types with Hints

Located in `src/ai/errors.ts`:

| Error                       | Tag                           | Usage                                  |
| --------------------------- | ----------------------------- | -------------------------------------- |
| `InvalidProviderError`      | `"InvalidProviderError"`      | Provider ID not found in provider list |
| `ProviderNotConnectedError` | `"ProviderNotConnectedError"` | Provider exists but not authenticated  |
| `InvalidModelError`         | `"InvalidModelError"`         | Model not available for the provider   |
| `ServerStartError`          | `"ServerStartError"`          | OpenCode server failed to start        |
| `SessionError`              | `"SessionError"`              | Session create/prompt failed           |
| `TimeoutError`              | `"TimeoutError"`              | Operation exceeded timeout             |

### OpenCode SDK Client Interface

The `@opencode-ai/sdk` client has these key endpoints:

```typescript
interface OpenCodeClient {
	session: {
		create(): Promise<{ data: { id: string }; error?: unknown }>;
		prompt(options): Promise<{ data: unknown; error?: unknown }>;
	};
	event: {
		subscribe(): Promise<{ stream: AsyncIterable<OpenCodeEvent> }>;
	};
	provider: {
		list(): Promise<{
			data: {
				all: Provider[]; // All available providers
				connected: string[]; // IDs of authenticated providers
				default: Record<string, string>;
			};
			error?: unknown;
		}>;
	};
}
```

### Key Files

- `src/ai/opencode.ts` - Main streaming API, provider validation
- `src/ai/errors.ts` - Tagged error types with hints
- `src/ai/index.ts` - Exports

### Configurable AI Model (US-002)

**Config Schema** (in `@offworld/types/schemas.ts`):

```typescript
export const AIConfigSchema = z.object({
  provider: z.string().default("opencode"),
  model: z.string().default("claude-opus-4-5"),
});

// In ConfigSchema:
ai: AIConfigSchema.default({ provider: "opencode", model: "claude-opus-4-5" }),
```

**Cascade Order**: CLI flag → Config file → Defaults

```typescript
// In pipeline.ts:
const aiProvider = options.provider ?? config.ai?.provider;
const aiModel = options.model ?? config.ai?.model;

// In opencode.ts streamPrompt:
const providerID = optProvider ?? DEFAULT_AI_PROVIDER;
const modelID = optModel ?? DEFAULT_AI_MODEL;
```

### Typed Stream Events (US-004)

**Stream Module** (`src/ai/stream/`):

- `types.ts` - Zod schemas for all stream event types
- `accumulator.ts` - TextAccumulator class for managing text deltas
- `transformer.ts` - parseStreamEvent() for typed event parsing

**Key Components**:

```typescript
// Accumulator handles text part tracking
const textAccumulator = new TextAccumulator();
const delta = textAccumulator.accumulatePart(textPart); // Returns only new text

// Transformer provides typed parsing with discriminated union
const parsed = parseStreamEvent(event);
switch (parsed.type) {
	case "message.part.updated": {
		/* parsed.textPart is TextPart | null */
	}
	case "session.idle": {
		/* parsed.props.sessionID is string */
	}
	case "session.error": {
		/* parsed.error is SessionErrorPayload | null */
	}
	case "unknown": {
		/* passthrough for unrecognized events */
	}
}
```

### Gotchas

1. **Base class \_tag typing**: Use `readonly _tag: string` (not `as const`) in base class to allow subclass overrides
2. **Import extensions**: Use `.js` extension for imports even for TypeScript files (`import from "./errors.js"`)
3. **Pre-existing test failures**: CLI handler tests (`apps/cli`) have unrelated mock issues - don't block on these
4. **Zod nested default**: When using `.default({})` on nested object schemas, must provide full default: `AIConfigSchema.default({ provider: "...", model: "..." })`
5. **Test fixture updates**: When adding new required fields to schemas, update all test fixtures that use `Config` type
6. **z.record() requires two args**: Use `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`
7. **Avoid type name conflicts**: Name stream payload types distinctly (e.g., `SessionErrorPayload` vs `SessionError` class)
8. **Silent catch debugging**: When adding debug logging to silent catches, ensure the callback is passed through all recursive calls
9. **Export naming conflicts**: When adding new formatters, check if export name exists in index.ts (e.g., `formatArchitectureMd` was in pipeline.ts - renamed to `formatArchitectureMdLegacy`)



### Simplified AI-Only Generation (US-001 - Strip Pipeline)

**New Module** (`src/generate.ts`):

```typescript
// Core function - delegates codebase exploration to AI
generateSkillWithAI(repoPath, repoName, options) -> { skillContent, commitSha }

// Installation function - writes SKILL.md and meta.json
installSkill(repoName, skillContent, meta) -> void
```

**Key Design Decisions**:

1. Single prompt approach - AI uses Read/Grep/Glob to explore codebase
2. No AST parsing, no deterministic analysis, no context gathering
3. Reuses existing `streamPrompt()` from `ai/opencode.ts`
4. Simpler output: only SKILL.md + meta.json (no references/ subdirectory)

**File Structure**:

```
~/.config/offworld/skills/{name}-reference/
└── SKILL.md

~/.config/offworld/meta/{name}/
└── meta.json  # { analyzedAt, commitSha, version }
```

**Gotchas**:

- `toSkillDirName()` and `toMetaDirName()` duplicated from pipeline.ts (intentional - will remove pipeline.ts later)
- Uses `analyze` agent from OpenCode with restricted tools (read-only)
- Prompt is self-contained (no system prompt needed beyond what's in opencode.ts config)

### Export Pattern (US-002 - Strip Pipeline)

**Public API**: Both `generateSkillWithAI` and `installSkill` are exported from `src/index.ts`:

```typescript
export {
	generateSkillWithAI,
	installSkill,
	type GenerateSkillOptions,
	type GenerateSkillResult,
	type InstallSkillMeta,
} from "./generate.js";
```

### Analysis Directory Deletion (US-003 - Strip Pipeline)

**Deleted Files**:
- `src/analysis/` directory (12 files): pipeline.ts, heuristics.ts, skeleton.ts, architecture.ts, api-surface.ts, imports.ts, merge.ts, incremental.ts, prose.ts, context.ts, parsers.ts, index.ts
- `src/validation/consistency.ts` - depended on analysis types (dead code)
- `src/validation/quality.ts` - depended on analysis types (dead code)
- Test files: analysis.test.ts, parsers.test.ts, pipeline.integration.test.ts

**Cascade Effect**: Removal required deleting validation files that imported from analysis/. These were not exported from validation/index.ts (dead code).

**Gotchas**:
- validation/index.ts only exports paths.ts and staleness.ts - consistency.ts and quality.ts were orphaned
- Tests that directly import from analysis/ must be deleted, not just have imports removed

### AST Directory Deletion (US-004 - Strip Pipeline)

**Deleted Files**:
- `src/ast/` directory (3 files): parser.ts, patterns.ts, index.ts

**Clean Deletion**: No imports from ast/ remained in codebase after US-003 deletion (analysis/ was the only consumer). Verified with grep - no cascade effects.

### Validation Directory Deletion (US-005 - Strip Pipeline)

**Deleted Files**:
- `src/validation/` directory (3 files): staleness.ts, paths.ts, index.ts
- Test file: validation.test.ts

**Remaining Validation**: None. The `validateSkillPaths`, `pathExists`, `isAnalysisStale`, `getCachedCommitSha` exports removed from index.ts.

**Gotchas**:
- consistency.ts and quality.ts were already deleted in US-003 (they depended on analysis/ types)
- Only paths.ts and staleness.ts remained in validation/index.ts exports

### AST-grep Dependencies Removal (US-006 - Strip Pipeline)

**Removed Dependencies**:
- `@ast-grep/napi` - core parsing engine
- `@ast-grep/lang-python`, `@ast-grep/lang-rust`, `@ast-grep/lang-go`, `@ast-grep/lang-java`
- `@ast-grep/lang-c`, `@ast-grep/lang-cpp`, `@ast-grep/lang-ruby`, `@ast-grep/lang-php`

**Cleanup Process**:
1. Edit package.json to remove dependencies
2. Run `bun install` to update lockfile
3. Manually remove `packages/sdk/node_modules/@ast-grep/` directory (stale symlinks remain after dep removal)
4. Re-run `bun install` to confirm clean state

**Gotchas**:
- Bun preserves symlinks to hoisted packages even after dependencies are removed from package.json
- Must manually `rm -rf` the stale @ast-grep directory before `bun install` will have "no changes"
- Root node_modules doesn't have @ast-grep (was only in packages/sdk scope)

### SDK Index Exports Verification (US-007 - Strip Pipeline)

**Public API** (`src/index.ts`) after stripping analysis code:

| Module | Key Exports |
|--------|-------------|
| `constants.ts` | VERSION, SUPPORTED_LANGUAGES, SUPPORTED_EXTENSIONS |
| `config.ts` | loadConfig, saveConfig, getSkillPath, getMetaPath |
| `repo-source.ts` | parseRepoInput, RepoSourceError |
| `util.ts` | isBinaryBuffer, loadGitignorePatterns |
| `index-manager.ts` | getIndex, updateIndex, removeFromIndex |
| `clone.ts` | cloneRepo, updateRepo, getCommitSha |
| `ai/` | streamPrompt, OpenCodeAnalysisError |
| `sync.ts` | pullAnalysis, pushAnalysis, checkRemote |
| `auth.ts` | getToken, isLoggedIn, saveAuthData |
| `generate.ts` | generateSkillWithAI, installSkill |

**Removed Exports**: All analysis/, ast/, validation/ exports deleted in US-003/004/005.

**Gotchas**:
- Some stories are verification-only (no code changes needed)
- Run `bun run build` in packages/sdk to verify bundle builds cleanly after deletions

### Test Cleanup (US-010 - Strip Pipeline)

**Deleted Test Files**:
- `src/__tests__/reference-quality.test.ts` - tested inline API surface quality functions (no longer needed)
- `src/__tests__/fixtures/` directory (10 files) - sample code files for AST parsing tests

**Files Deleted Earlier** (in US-003/005):
- `analysis.test.ts`, `parsers.test.ts`, `pipeline.integration.test.ts` - deleted in US-003
- `validation.test.ts` - deleted in US-005

**Remaining Test Files** (9 tests, 227 passing):
- `setup.test.ts`, `auth.test.ts`, `clone.test.ts`, `config.test.ts`
- `index-manager.test.ts`, `repo-source.test.ts`, `sync.test.ts`, `util.test.ts`
- `integration/clone.integration.test.ts`

**Gotchas**:
- `reference-quality.test.ts` defined its own test implementations inline (not imports) - was dead code testing removed functionality
- Fixtures were only imported by deleted parser/analysis tests - no other tests used them
- `mocks/` directory still needed by remaining tests (fs.ts, git.ts, fetch.ts)
