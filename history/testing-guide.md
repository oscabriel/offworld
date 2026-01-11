# Offworld: Testing Guide

> Comprehensive testing documentation for the Offworld project.

---

## Overview

Offworld uses **Vitest** as the test framework across all packages. Tests follow a Test-Driven Development (TDD) approach where tests are written alongside or before implementation.

### Why Vitest?

- Native ESM support (matches our Bun + TypeScript setup)
- Fast execution with smart watch mode
- Compatible with Bun runtime
- Built-in mocking, spying, and snapshot testing
- TypeScript support out of the box

---

## Test Structure

```
packages/
├── types/
│   └── src/
│       └── __tests__/
│           └── schemas.test.ts      # Zod schema validation tests
├── sdk/
│   └── src/
│       └── __tests__/
│           ├── repo-source.test.ts  # Input parsing tests
│           ├── clone.test.ts        # Git clone/pull tests
│           ├── indexer.test.ts      # File indexing tests
│           ├── importance.test.ts   # Tree-sitter ranking tests
│           └── generator.test.ts    # AI generation tests
├── cli/
│   └── src/
│       └── __tests__/
│           ├── commands.test.ts     # Command routing tests
│           └── output.test.ts       # TTY/JSON output tests
└── backend/
    └── convex/
        └── __tests__/
            └── mutations.test.ts    # Convex function tests
```

---

## Running Tests

### All Tests

```bash
# Run all tests once
bun run test

# Run with watch mode
bun run test:watch

# Run with coverage
bun run test:coverage
```

### Package-Specific Tests

```bash
# Types package
cd packages/types && bun test

# SDK package
cd packages/sdk && bun test

# CLI package
cd packages/cli && bun test

# Backend (Convex)
cd packages/backend && bun test
```

### Filtering Tests

```bash
# Run specific test file
bun test repo-source.test.ts

# Run tests matching pattern
bun test --grep "parseRepoInput"

# Run tests in specific directory
bun test packages/sdk/
```

---

## Test Configuration

Each package has a `vitest.config.ts`:

```typescript
// packages/sdk/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

Root `vitest.config.ts` for workspace-wide testing:

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    workspace: [
      'packages/types',
      'packages/sdk',
      'packages/cli',
      'packages/backend',
    ],
  },
});
```

---

## Mocking Strategy

### What to Mock

| Dependency | Mock Strategy | Reason |
|------------|---------------|--------|
| `execa` | Full mock | Git operations shouldn't hit real repos |
| `fetch` | Full mock | API calls shouldn't hit real servers |
| `fs-extra` | Partial mock | Use temp directories for real file tests |
| AI SDKs | Full mock | Don't consume API credits in tests |
| Tree-sitter | Real | Fast enough, complex to mock accurately |

### Mock Examples

#### Mocking Git Operations (execa)

```typescript
// packages/sdk/src/__tests__/clone.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneRepo } from '../clone';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';

describe('cloneRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clones a GitHub repo', async () => {
    vi.mocked(execa).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    } as any);

    await cloneRepo('owner/repo', '/tmp/test');

    expect(execa).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', 'https://github.com/owner/repo.git', '/tmp/test'],
      expect.any(Object)
    );
  });

  it('handles clone failure', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('Repository not found'));

    await expect(cloneRepo('owner/nonexistent', '/tmp/test'))
      .rejects.toThrow('Repository not found');
  });
});
```

#### Mocking API Calls (fetch)

```typescript
// packages/sdk/src/__tests__/generator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Generation', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends context to AI provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: '# Project Name\n\nA description...',
      }),
    });

    const result = await generateSkill(mockContext);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/generate'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      })
    );
  });
});
```

#### Using Temp Directories

```typescript
// packages/sdk/src/__tests__/indexer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { indexFiles } from '../indexer';

describe('indexFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'offworld-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('indexes TypeScript files', async () => {
    await mkdir(join(tempDir, 'src'));
    await writeFile(join(tempDir, 'src/index.ts'), 'export const foo = 1;');
    await writeFile(join(tempDir, 'src/utils.ts'), 'export const bar = 2;');

    const files = await indexFiles(tempDir);

    expect(files).toHaveLength(2);
    expect(files.map(f => f.path)).toContain('src/index.ts');
    expect(files.map(f => f.path)).toContain('src/utils.ts');
  });

  it('respects .gitignore', async () => {
    await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n*.log');
    await mkdir(join(tempDir, 'node_modules'));
    await writeFile(join(tempDir, 'node_modules/dep.js'), 'module.exports = {};');
    await writeFile(join(tempDir, 'debug.log'), 'log content');
    await writeFile(join(tempDir, 'main.ts'), 'console.log("hello");');

    const files = await indexFiles(tempDir);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('main.ts');
  });
});
```

---

## Test Categories

### Unit Tests

Test individual functions in isolation with mocked dependencies.

```typescript
// packages/types/src/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { AnalysisSchema, SkillSchema } from '../schemas';

describe('AnalysisSchema', () => {
  it('validates complete analysis', () => {
    const analysis = {
      repo: 'owner/repo',
      commitSha: 'abc123',
      summary: 'A project summary',
      entities: [],
      files: [],
      skill: { content: '# Skill' },
    };

    expect(() => AnalysisSchema.parse(analysis)).not.toThrow();
  });

  it('rejects invalid commit SHA', () => {
    const analysis = {
      repo: 'owner/repo',
      commitSha: '', // Invalid: empty
      summary: 'A summary',
    };

    expect(() => AnalysisSchema.parse(analysis)).toThrow();
  });
});
```

### Integration Tests

Test multiple components working together with real file system operations.

```typescript
// packages/sdk/src/__tests__/integration/full-analysis.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeRepo } from '../../analyze';

describe('Full Analysis Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'offworld-integration-'));
    // Set up a minimal repo structure
    await setupTestRepo(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('produces valid analysis from repo', async () => {
    const result = await analyzeRepo(tempDir, { skipAI: true });

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });
});
```

### Snapshot Tests

Use for complex output structures that shouldn't change unexpectedly.

```typescript
// packages/cli/src/__tests__/output.test.ts
import { describe, it, expect } from 'vitest';
import { formatAnalysisOutput } from '../output';

describe('formatAnalysisOutput', () => {
  it('formats JSON output correctly', () => {
    const analysis = createMockAnalysis();
    const output = formatAnalysisOutput(analysis, { format: 'json' });

    expect(output).toMatchSnapshot();
  });

  it('formats human-readable output correctly', () => {
    const analysis = createMockAnalysis();
    const output = formatAnalysisOutput(analysis, { format: 'human' });

    expect(output).toMatchSnapshot();
  });
});
```

---

## TDD Workflow

### Phase-to-Test Mapping

| Phase | Tests First |
|-------|-------------|
| Phase 2: Types | Schema validation, type exports |
| Phase 3: SDK | Input parsing, file indexing, ignore patterns |
| Phase 4: CLI | Command parsing, output formatting |
| Phase 5: Analysis | Context assembly, AI mocking |
| Phase 7: Backend | HTTP action responses, Convex mutations |

### TDD Cycle

1. **Red**: Write a failing test for the next feature
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

```bash
# Example TDD session
bun test --watch packages/sdk/src/__tests__/repo-source.test.ts

# 1. Write test for parseRepoInput('owner/repo')
# 2. See it fail (function doesn't exist)
# 3. Implement parseRepoInput
# 4. See test pass
# 5. Add next test case
```

---

## Coverage Requirements

### Minimum Coverage Targets

| Package | Statements | Branches | Functions |
|---------|------------|----------|-----------|
| types | 100% | 100% | 100% |
| sdk | 80% | 75% | 80% |
| cli | 70% | 70% | 70% |
| backend | 60% | 60% | 60% |

### Viewing Coverage

```bash
# Generate coverage report
bun run test:coverage

# Open HTML report
open coverage/index.html
```

---

## CI Integration

Tests run automatically on every PR via GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test
      - run: bun run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Debugging Tests

### Run Single Test in Debug Mode

```bash
# With Node inspector
node --inspect-brk ./node_modules/.bin/vitest run repo-source.test.ts

# Then attach VS Code debugger
```

### Verbose Output

```bash
# Show all console.log output
bun test --reporter=verbose

# Show only failing tests
bun test --reporter=basic
```

### Common Issues

**Issue**: Tests pass locally but fail in CI
- **Solution**: Check for time-dependent tests, hardcoded paths, or missing env vars

**Issue**: Mock not being used
- **Solution**: Ensure `vi.mock()` is called before importing the module that uses the dependency

**Issue**: Async test timeout
- **Solution**: Increase timeout with `it('test', async () => {...}, 10000)` or fix the hanging promise

---

## Test Data Fixtures

Store reusable test data in `__fixtures__/` directories:

```
packages/sdk/src/__tests__/
├── __fixtures__/
│   ├── sample-repo/           # Minimal repo for testing
│   │   ├── package.json
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── README.md
│   └── expected-analysis.json # Expected output for snapshot
└── indexer.test.ts
```

---

## Best Practices

1. **One assertion per test** when possible - makes failures clear
2. **Descriptive test names** - `it('returns null when repo not found')` not `it('test 1')`
3. **Arrange-Act-Assert** pattern - clear structure in every test
4. **Don't test implementation** - test behavior and outcomes
5. **Mock at boundaries** - mock external services, not internal functions
6. **Clean up after tests** - remove temp files, reset mocks
7. **Avoid test interdependence** - each test should run in isolation

---

## Related Documents

- [Implementation Plan](./implementation-plan.md) - Phase-specific test requirements
- [Technical Spec](./technical-spec.md) - System design context
- [PRD](../PRD.md) - Test items (T*.* prefix)

---

*Last updated: January 8, 2026*
