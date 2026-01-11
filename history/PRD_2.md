# Test Suite Improvement PRD

```json
{
	"items": [
		{
			"id": "T1.1",
			"category": "Phase 1: Pure Function Tests",
			"description": "Create generate.test.ts with tests for pure functions in analysis/generate.ts",
			"acceptance_criteria": [
				"File packages/sdk/src/__tests__/generate.test.ts exists",
				"Tests for sanitizeMermaidId(): empty string, special chars, unicode, numeric-only, leading/trailing underscores",
				"Tests for escapeYaml(): quotes, backslashes, newlines, combinations",
				"Tests for formatArchitectureMd(): empty entities, special chars in labels, missing optional patterns, entity relationships",
				"Tests for formatSkillMd(): empty arrays, special YAML chars, multiline descriptions, all sections populated",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/generate.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/generate.test.ts",
			"passes": true
		},
		{
			"id": "T1.2",
			"category": "Phase 1: Pure Function Tests",
			"description": "Create auth.test.ts with tests for pure/near-pure functions in auth.ts",
			"acceptance_criteria": [
				"File packages/sdk/src/__tests__/auth.test.ts exists",
				"Tests for getAuthPath(): returns correct path based on metaRoot",
				"Tests for getTokenOrNull(): returns null on error, returns token on success",
				"Tests for isLoggedIn(): true/false cases",
				"Tests for getAuthStatus(): not logged in, expired token, valid token, missing expiresAt",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/auth.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/auth.test.ts",
			"passes": true
		},
		{
			"id": "T1.3",
			"category": "Phase 1: Pure Function Tests",
			"description": "Create pipeline.test.ts with tests for expandTilde() pure function",
			"acceptance_criteria": [
				"File packages/sdk/src/__tests__/pipeline.test.ts exists",
				"Tests for expandTilde(): paths with ~/, absolute paths (no expansion), paths without tilde",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/pipeline.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/pipeline.test.ts",
			"passes": true
		},
		{
			"id": "T2.1",
			"category": "Phase 2: Improve Mock-Heavy Tests",
			"description": "Upgrade clone.test.ts to use sophisticated git mock infrastructure",
			"acceptance_criteria": [
				"Tests use createExecSyncMock and configureGitMock from ./mocks/git.js",
				"Tests verify git command failure scenarios (network errors, auth failures)",
				"Tests verify partial clone failures and cleanup behavior",
				"Tests verify index update after clone",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/clone.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/clone.test.ts",
			"passes": true
		},
		{
			"id": "T2.2",
			"category": "Phase 2: Improve Mock-Heavy Tests",
			"description": "Upgrade config.test.ts and index-manager.test.ts to use virtual file system mock",
			"acceptance_criteria": [
				"Tests use initVirtualFs, addVirtualFile, clearVirtualFs from ./mocks/fs.js",
				"Tests verify real JSON parsing with malformed files",
				"Tests verify directory creation logic",
				"Tests verify file permission scenarios",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/config.test.ts packages/sdk/src/__tests__/index-manager.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/config.test.ts packages/sdk/src/__tests__/index-manager.test.ts",
			"passes": true
		},
		{
			"id": "T2.3",
			"category": "Phase 2: Improve Mock-Heavy Tests",
			"description": "Upgrade ai-provider.test.ts to test actual detection logic",
			"acceptance_criteria": [
				"Tests verify provider priority logic (claude-code preferred when both available)",
				"Tests verify detectProvider returns correct provider and isPreferred values",
				"Tests use realistic mock responses rather than just verifying mock call patterns",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/ai-provider.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/ai-provider.test.ts",
			"passes": true
		},
		{
			"id": "T3.1",
			"category": "Phase 3: AI Integration Tests",
			"description": "Create claude-code.test.ts with mocked @anthropic-ai/claude-agent-sdk",
			"acceptance_criteria": [
				"File packages/sdk/src/__tests__/claude-code.test.ts exists",
				"Tests mock @anthropic-ai/claude-agent-sdk query function",
				"Tests cover: successful analysis with valid structured output",
				"Tests cover: error when max_turns exceeded",
				"Tests cover: error when budget exceeded",
				"Tests cover: execution error handling",
				"Tests cover: schema validation failure",
				"Tests cover: empty result handling",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/claude-code.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/claude-code.test.ts",
			"passes": true
		},
		{
			"id": "T3.2",
			"category": "Phase 3: AI Integration Tests",
			"description": "Create opencode.test.ts with mocked @opencode-ai/sdk and fetch",
			"acceptance_criteria": [
				"File packages/sdk/src/__tests__/opencode.test.ts exists",
				"Tests cover: server health check passes -> successful analysis",
				"Tests cover: server health check fails -> OpenCodeConnectionError",
				"Tests cover: session creation failure",
				"Tests cover: invalid JSON response",
				"Tests cover: session cleanup on error (finally block)",
				"Tests cover: timeout handling",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/opencode.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/opencode.test.ts",
			"passes": true
		},
		{
			"id": "T4.1",
			"category": "Phase 4: Pipeline Integration Tests",
			"description": "Add integration tests to pipeline.test.ts with mocked dependencies",
			"acceptance_criteria": [
				"Tests mock clone.js (getCommitSha), ranker.js (rankFileImportance), context.js (gatherContext), generate.js (generateSummary, extractArchitecture, generateSkill)",
				"Tests cover: full pipeline execution with all steps",
				"Tests cover: progress callback invocation",
				"Tests cover: local repo path handling (hashed)",
				"Tests cover: remote repo path handling (provider + fullName)",
				"Tests cover: error propagation from each step",
				"Tests cover: file saving verification",
				"All tests pass when running: bunx vitest run packages/sdk/src/__tests__/pipeline.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/pipeline.test.ts",
			"passes": true
		},
		{
			"id": "T4.2",
			"category": "Phase 4: Pipeline Integration Tests",
			"description": "Test installSkill() and saveAnalysis() with temp directories",
			"acceptance_criteria": [
				"Tests use mkdtempSync to create temp directories",
				"Tests use rmSync in afterEach for cleanup",
				"Tests verify actual file I/O operations",
				"Tests verify correct file contents after save",
				"All tests pass"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/pipeline.test.ts",
			"passes": true
		},
		{
			"id": "T5.1",
			"category": "Phase 5: Remove Low-Value Tests",
			"description": "Remove 'function exists' tests from importance.test.ts",
			"acceptance_criteria": [
				"No tests in importance.test.ts that only check typeof === 'function'",
				"No tests that only verify export shapes without testing behavior",
				"Approximately 10 useless tests removed",
				"Remaining tests verify actual function behavior",
				"All remaining tests pass when running: bunx vitest run packages/sdk/src/__tests__/importance.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/importance.test.ts",
			"passes": true
		},
		{
			"id": "T6.1",
			"category": "Phase 6: Integration Test Infrastructure",
			"description": "Create integration test directory structure",
			"acceptance_criteria": [
				"Directory packages/sdk/src/__tests__/integration/ exists",
				"Existing unit tests remain functional in packages/sdk/src/__tests__/",
				"Directory structure supports separation of unit and integration tests"
			],
			"verification_command": "ls -la packages/sdk/src/__tests__/integration/",
			"passes": true
		},
		{
			"id": "T6.2",
			"category": "Phase 6: Integration Test Infrastructure",
			"description": "Add integration test scripts to package.json",
			"acceptance_criteria": [
				"packages/sdk/package.json has test:unit script excluding *.integration.test.ts",
				"packages/sdk/package.json has test:integration script including only *.integration.test.ts",
				"Scripts execute correctly without errors"
			],
			"verification_command": "cd packages/sdk && bun run test:unit --help && bun run test:integration --help",
			"passes": true
		},
		{
			"id": "T6.3",
			"category": "Phase 6: Integration Test Infrastructure",
			"description": "Create sample clone.integration.test.ts",
			"acceptance_criteria": [
				"File packages/sdk/src/__tests__/integration/clone.integration.test.ts exists",
				"Test clones a real small repo (octocat/Hello-World)",
				"Test verifies .git directory exists after clone",
				"Test has 30000ms timeout for network operations",
				"Test passes when running: bunx vitest run packages/sdk/src/__tests__/integration/clone.integration.test.ts"
			],
			"verification_command": "bunx vitest run packages/sdk/src/__tests__/integration/clone.integration.test.ts",
			"passes": true
		},
		{
			"id": "TV.1",
			"category": "Verification",
			"description": "All tests pass and coverage increases",
			"acceptance_criteria": [
				"bun run test passes with no failures",
				"Test count increases by 80-100 tests from baseline",
				"Coverage for generate.ts increases from 0% to 80%+",
				"Coverage for auth.ts increases from 0% to 90%+",
				"Coverage for pipeline.ts increases from 0% to 70%+",
				"No 'function exists' tests remain in codebase"
			],
			"verification_command": "bun run test && bunx vitest run --coverage",
			"passes": true
		}
	]
}
```
