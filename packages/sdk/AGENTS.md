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
if (!provider.models[modelID])
  throw new InvalidModelError(modelID, providerID, availableModelIds);
```

### Error Types with Hints

Located in `src/ai/errors.ts`:

| Error | Tag | Usage |
|-------|-----|-------|
| `InvalidProviderError` | `"InvalidProviderError"` | Provider ID not found in provider list |
| `ProviderNotConnectedError` | `"ProviderNotConnectedError"` | Provider exists but not authenticated |
| `InvalidModelError` | `"InvalidModelError"` | Model not available for the provider |
| `ServerStartError` | `"ServerStartError"` | OpenCode server failed to start |
| `SessionError` | `"SessionError"` | Session create/prompt failed |
| `TimeoutError` | `"TimeoutError"` | Operation exceeded timeout |

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
        all: Provider[];      // All available providers
        connected: string[];  // IDs of authenticated providers
        default: Record<string, string>;
      };
      error?: unknown
    }>;
  };
}
```

### Key Files

- `src/ai/opencode.ts` - Main streaming API, provider validation
- `src/ai/errors.ts` - Tagged error types with hints
- `src/ai/index.ts` - Exports

### Gotchas

1. **Base class _tag typing**: Use `readonly _tag: string` (not `as const`) in base class to allow subclass overrides
2. **Import extensions**: Use `.js` extension for imports even for TypeScript files (`import from "./errors.js"`)
3. **Pre-existing test failures**: CLI handler tests (`apps/cli`) have unrelated mock issues - don't block on these
