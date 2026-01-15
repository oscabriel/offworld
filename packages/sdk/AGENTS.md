# SDK Package - Agent Learnings

## OpenCode Integration Patterns

### Provider/Model Validation

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

### Configurable AI Model

**Config Schema** (in `@offworld/types/schemas.ts`):

```typescript
export const AIConfigSchema = z.object({
  provider: z.string().default("opencode"),
  model: z.string().default("claude-opus-4-5"),
});

// In ConfigSchema:
ai: AIConfigSchema.default({ provider: "opencode", model: "claude-opus-4-5" }),
```

**Cascade Order**: CLI flag -> Config file -> Defaults

```typescript
// In generate.ts:
const aiProvider = options.provider ?? config.ai?.provider;
const aiModel = options.model ?? config.ai?.model;

// In opencode.ts streamPrompt:
const providerID = optProvider ?? DEFAULT_AI_PROVIDER;
const modelID = optModel ?? DEFAULT_AI_MODEL;
```

### Typed Stream Events

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

## AI-Only Skill Generation

### generateSkillWithAI

**Location**: `src/generate.ts`

Generates a SKILL.md file by delegating codebase exploration to the AI agent.

```typescript
interface GenerateSkillOptions {
	provider?: string; // AI provider (default: from config or "opencode")
	model?: string; // AI model (default: from config or "claude-opus-4-5")
	onDebug?: (msg: string) => void; // Debug callback
	onStream?: (text: string) => void; // Stream callback for AI output
}

interface GenerateSkillResult {
	skillContent: string; // The generated SKILL.md content
	commitSha: string; // Git commit SHA of the analyzed repo
}

async function generateSkillWithAI(
	repoPath: string, // Path to the local repository
	repoName: string, // Qualified name (e.g., "owner/repo" or "repo")
	options?: GenerateSkillOptions,
): Promise<GenerateSkillResult>;
```

**How it works**:

1. Opens an OpenCode session with the `analyze` agent
2. Sends a single comprehensive prompt instructing the AI to explore the codebase
3. AI uses Read/Grep/Glob tools to understand the repository structure
4. AI generates a SKILL.md file with YAML frontmatter and markdown content
5. Returns the skill content and the current git commit SHA

### installSkill

**Location**: `src/generate.ts`

Writes a generated skill to the filesystem and creates symlinks for AI agent discovery.

```typescript
interface InstallSkillMeta {
	analyzedAt: string; // ISO timestamp
	commitSha: string; // Git commit SHA
	version: string; // SDK version
}

async function installSkill(
	repoName: string, // Qualified name (e.g., "owner/repo" or "repo")
	skillContent: string, // The SKILL.md content to write
	meta: InstallSkillMeta, // Metadata for meta.json
): Promise<void>;
```

**File structure created**:

```
~/.config/offworld/skills/{name}-reference/
└── SKILL.md

~/.config/offworld/meta/{name}/
└── meta.json  # { analyzedAt, commitSha, version }

~/.opencode/skills/{name}-reference/  -> symlink to skills dir
~/.claude/skills/{name}-reference/    -> symlink to skills dir
```

**Name collapsing**: For repos like `better-auth/better-auth`, the skill name is collapsed to `better-auth-reference` (not `better-auth-better-auth-reference`).

## Public API Summary

| Module             | Key Exports                                        |
| ------------------ | -------------------------------------------------- |
| `constants.ts`     | VERSION, SUPPORTED_LANGUAGES, SUPPORTED_EXTENSIONS |
| `config.ts`        | loadConfig, saveConfig, getSkillPath, getMetaPath  |
| `repo-source.ts`   | parseRepoInput, RepoSourceError                    |
| `util.ts`          | isBinaryBuffer, loadGitignorePatterns              |
| `index-manager.ts` | getIndex, updateIndex, removeFromIndex             |
| `clone.ts`         | cloneRepo, updateRepo, getCommitSha                |
| `ai/`              | streamPrompt, OpenCodeAnalysisError                |
| `sync.ts`          | pullAnalysis, pushAnalysis, checkRemote            |
| `auth.ts`          | getToken, isLoggedIn, saveAuthData                 |
| `generate.ts`      | generateSkillWithAI, installSkill                  |

## Gotchas

1. **Base class \_tag typing**: Use `readonly _tag: string` (not `as const`) in base class to allow subclass overrides
2. **Import extensions**: Use `.js` extension for imports even for TypeScript files (`import from "./errors.js"`)
3. **Zod nested default**: When using `.default({})` on nested object schemas, must provide full default: `AIConfigSchema.default({ provider: "...", model: "..." })`
4. **z.record() requires two args**: Use `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`
5. **Avoid type name conflicts**: Name stream payload types distinctly (e.g., `SessionErrorPayload` vs `SessionError` class)
6. **Silent catch debugging**: When adding debug logging to silent catches, ensure the callback is passed through all recursive calls
