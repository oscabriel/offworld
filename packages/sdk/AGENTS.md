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

### Debug Logging in Silent Catch Blocks (US-005)

**Pattern**: Pass `onDebug` callback through functions that may fail silently

```typescript
// Function accepts optional debug callback
function discoverFiles(
	repoPath: string,
	subPath = "",
	onDebug?: (message: string) => void,
): string[] {
	try {
		// ...file operations
	} catch (err) {
		onDebug?.(
			`Failed to read directory ${fullPath}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

// Caller passes through from options
const filePaths = discoverFiles(repoPath, "", onDebug);
```

**Functions with debug logging**:

- `discoverFiles()` - logs stat and read failures
- `findSkillFiles()` - logs stat and directory read failures
- `updateSkillPaths()` - accepts `UpdateSkillPathsOptions` with `onDebug`
- File parsing loop in `runAnalysisPipeline()` - logs read/parse failures

### Architecture Section Generation (US-006)

**New Architecture Types** (`src/analysis/architecture.ts`):

```typescript
interface ArchitectureSection {
  entryPoints: EntryPoint[];     // main/cli/server/worker/index/config files
  coreModules: CoreModule[];     // files with 3+ exported symbols
  hubs: DependencyHub[];         // files with 3+ importers
  layers: LayerGroup[];          // ui/api/domain/infra/util/config/test
  inheritance: InheritanceRelation[];
  directoryTree: DirectoryNode;  // tree with [HUB: N←] annotations
  findingTable: FindingEntry[];  // "Where do I find X?" lookup
  packages?: MonorepoPackage[];  // for packages/*/apps/*/libs/*
}
```

**Key Functions**:

- `buildArchitectureSection()` - builds section from parsedFiles + dependencyGraph + architectureGraph
- `formatArchitectureMd()` - generates markdown with tables, Mermaid diagrams, directory tree

**Monorepo Detection**: Looks for `packages/`, `apps/`, `libs/` prefixes and creates per-package sections.

**Layer Diagram**: Simplified flowchart showing layer counts and connections (not raw import graph).

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

### API Surface Extraction (US-007)

**New Types** (`src/analysis/api-surface.ts`):

```typescript
interface APISurface {
  packageName: string;
  imports: ImportPattern[];      // Common import patterns with purpose
  exports: PublicExport[];       // All public exports from main entry
  subpaths: SubpathExport[];     // Subpath exports (e.g., "./client", "./server")
  typeExports: PublicExport[];   // Type-only exports (interfaces, types)
}

interface ImportPattern {
  statement: string;   // e.g., "import { z } from 'zod'"
  purpose: string;     // e.g., "Main schema builder"
  exports: string[];   // Exported symbols available
}

interface PublicExport {
  name: string;
  path: string;
  signature: string;
  kind: "function" | "class" | "interface" | "type" | "const" | "enum";
  description: string;  // Inferred from name patterns
}
```

**Key Functions**:

- `extractAPISurface()` - reads package.json exports, finds entry points, extracts public symbols
- `formatAPISurfaceMd()` - generates markdown with Import Patterns, Public Exports, Subpath Exports, Type Exports tables

**Entry Point Detection Order**:
1. `package.json` exports field (resolves import/require/default/types)
2. Fallback to main/module fields
3. Fallback to common patterns: `src/index.ts`, `index.ts`, etc.

**Description Inference**: Uses name patterns (`create*`, `use*`, `get*`, `is*`) to generate descriptions automatically.

### Context-Aware Prose Generation (US-008)

**New Types** (`src/analysis/prose.ts`):

```typescript
interface ProseGenerationContext {
  apiSurface?: APISurface;      // Deterministic API surface from extractAPISurface()
  architecture?: ArchitectureSection;  // Deterministic architecture from buildArchitectureSection()
  readme?: string;              // README.md content
  examples?: string;            // Example code from examples/ directory
  contributing?: string;        // CONTRIBUTING.md content
}

interface ContextAwareProseResult {
  skill: SkillProse;           // For SKILL.md
  summary: SummaryContent;     // For summary.md
  development: DevelopmentProse; // For development.md
}
```

**Key Functions**:

- `generateProseWithContext()` - generates all three AI prose outputs with deterministic context
- `buildSkillPromptWithContext()` - includes API Surface + Architecture for SKILL.md
- `buildSummaryPromptWithContext()` - includes API Surface + README + Examples for summary.md
- `buildDevelopmentPromptWithContext()` - includes Architecture + CONTRIBUTING for development.md

**Prompt Pattern**: Each prompt includes verbatim deterministic context so AI imports match `api-reference.md` exactly.

**Gotcha**: `SummaryProse` name conflict - pipeline.ts already has `SummaryProse`. New type named `SummaryContent`.

### Dual-Track Pipeline Flow (US-009)

**Pipeline Order** (deterministic BEFORE AI):

1. Parse files, build dependency graph, architecture graph
2. Build `ArchitectureSection` (deterministic) → `formatArchitectureMd()`
3. Extract `APISurface` (deterministic) → `formatAPISurfaceMd()`
4. Load context: `loadReadme()`, `loadExamples()`, `loadContributing()`
5. Build `ProseGenerationContext` with deterministic data
6. Call `generateProseWithContext()` (AI receives deterministic context)
7. Validate, merge, return result

**New AnalysisPipelineResult Fields**:

```typescript
interface AnalysisPipelineResult {
  // ...existing fields...
  architectureSection: ArchitectureSection;
  apiSurface: APISurface;
  architectureMd: string;      // Ready-to-write markdown
  apiSurfaceMd: string;        // Ready-to-write markdown
  proseResult: ContextAwareProseResult;
}
```

**Context Loaders** (`loadReadme`, `loadExamples`, `loadContributing`):

- Accept `onDebug` callback for error logging
- Return `undefined` if file not found
- `loadExamples()` checks directories (examples/, example/, demos/) then individual files

**Legacy Prose Adapter**: For backward compatibility with `mergeProseIntoSkeleton()`, the pipeline creates a legacy prose object from `ContextAwareProseResult` fields.

### InstallSkillOptions Update (US-010)

**Updated Interface** (`src/analysis/pipeline.ts`):

```typescript
interface InstallSkillOptions {
  skillContent: string;          // Required: SKILL.md content
  summaryContent: string;        // Required: summary.md content
  architectureContent: string;   // Required: architecture.md content
  apiReferenceContent?: string;  // Optional: api-reference.md content
  developmentContent?: string;   // Optional: development.md content
  skillJson?: string;            // Optional: JSON for meta/
  metaJson?: string;             // Optional: JSON for meta/
  architectureJson?: string;     // Optional: JSON for meta/
  fileIndexJson?: string;        // Optional: JSON for meta/
}
```

**File Output Structure**:

```
~/.config/offworld/skills/{name}-reference/
├── SKILL.md
└── references/
    ├── summary.md
    ├── architecture.md
    ├── api-reference.md    # Only written if apiReferenceContent provided
    └── development.md      # Only written if developmentContent provided
```

**Gotchas**:

- `apiReferenceContent` and `developmentContent` are optional to maintain backward compatibility with existing callers
- Files only written when content is provided (conditional writes)
- Must export `formatArchitectureMdLegacy` from SDK for callers still using old 3-arg signature

### Generate Handler Update (US-011)

**formatDevelopmentMd Function** (`src/analysis/pipeline.ts`):

```typescript
interface FormatDevelopmentOptions {
  repoName: string;
}

function formatDevelopmentMd(prose: DevelopmentProse, options: FormatDevelopmentOptions): string
```

Generates markdown with sections: Getting Started, Project Structure, Build & Test, Contributing Guidelines.

**CLI Handler Changes** (`apps/cli/src/handlers/generate.ts`):

```typescript
// Extract from pipeline result
const { architectureMd, apiSurfaceMd, proseResult } = result;

// Format development content
const developmentMd = formatDevelopmentMd(proseResult.development, { repoName });

// Pass all 5 content fields
installSkillWithReferences(repoName, {
  skillContent: skillMd,
  summaryContent: summaryMd,
  architectureContent: architectureMd || legacyArchitectureMd,  // prefer new, fallback to legacy
  apiReferenceContent: apiSurfaceMd,
  developmentContent: developmentMd,
  // ...json fields
});
```

**Gotchas**:

- `DevelopmentProse` type is imported from prose.ts (not redefined in pipeline.ts)
- Use `architectureMd || legacyArchitectureMd` pattern to prefer new deterministic architecture but fall back to legacy 3-arg version
- Must rebuild SDK (`bun run build`) before CLI typecheck will see new exports

### Extended SkillSchema (US-013)

**New Schemas** (`packages/types/src/schemas.ts`):

```typescript
ImportPatternSchema: { import, purpose }
TroubleshootingEntrySchema: { symptom, cause, fix }
ArchitectureConceptSchema: { name, purpose, location }
ExtensionPointSchema: { type, interface, purpose, example? }
CodebaseMapEntrySchema: { path, purpose, exports? }
```

**Extended SkillSchema fields**:

- `importPatterns: ImportPatternSchema[]` - canonical import statements
- `whenToUse: string[]` (min 5 when present) - natural language triggers
- `quickStartCode: string` - copy-paste starter code
- `commonOperations: string[]` - frequent operations list
- `troubleshooting: TroubleshootingEntrySchema[]` - symptom/cause/fix entries
- `architecture: ArchitectureConceptSchema[]` - key concepts with locations
- `extensionPoints: ExtensionPointSchema[]` - where to extend
- `codebaseMap: CodebaseMapEntrySchema[]` - path/purpose lookup

**Gotchas**:

- `whenToUse` has `.min(5)` constraint when present - update tests that use fewer items
- All new fields are optional (`.optional()`) for backward compatibility
- Test assertions with empty arrays (`whenToUse: []`) must be updated or field omitted

### Named Re-export Extraction (US-014)

**Problem**: AST patterns like `export { $$$ } from "$PATH"` capture the multi-variable `$$$` but `match.getMatch("NAME")` only returns single matches, not lists.

**Solution** (`src/ast/parser.ts`): Parse the match text with regex to extract all named symbols:

```typescript
function extractNamedExportsFromText(text: string): string[] {
    const namedExportMatch = text.match(/export\s+(?:type\s+)?\{([^}]+)\}/);
    if (!namedExportMatch?.[1]) return [];
    
    return namedExportMatch[1].split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
            const asMatch = item.match(/(\w+)\s+as\s+(\w+)/);
            return asMatch?.[2] ?? item.match(/^(\w+)$/)?.[1];
        })
        .filter(Boolean);
}
```

**Key insight from codemap**: They don't extract exports at all. They only track imports + function definitions, then invert to find importers. For API surface, they look at function definitions IN entry files directly.

**Gotchas**:

- `export { foo as bar }` - extract `bar` (the exported name), not `foo`
- `export * from '...'` - handle separately as barrel re-exports
- Type exports (`export type { X }`) need same treatment as value exports
- AST-grep's `$$$` captures lists but `getMatch()` doesn't expose them as arrays
