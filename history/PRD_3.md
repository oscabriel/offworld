# Test Suite Enhancement PRD

## Overview

Add critical missing test coverage to the offworld codebase: AI provider smoke tests and frontend E2E tests via Playwright.

## Requirements

```json
[
	{
		"id": "T1.0",
		"category": "AI Provider Smoke Tests",
		"description": "Create smoke test file for AI provider availability checks",
		"steps_to_verify": [
			"File exists at packages/sdk/src/__tests__/ai-provider.smoke.test.ts",
			"File imports isClaudeCodeAvailable, isOpenCodeAvailable, detectProvider from ../ai/provider.js",
			"File uses vitest (describe, it, expect)",
			"Tests are conditionally skipped based on SMOKE_TESTS env var"
		],
		"passes": true
	},
	{
		"id": "T1.1",
		"category": "AI Provider Smoke Tests",
		"description": "Test isClaudeCodeAvailable returns boolean without throwing",
		"steps_to_verify": [
			"Test case exists with name matching /isClaudeCodeAvailable.*boolean/i",
			"Test calls isClaudeCodeAvailable() without mocks",
			"Test asserts typeof result === 'boolean'",
			"Test has timeout >= 10000ms"
		],
		"passes": true
	},
	{
		"id": "T1.2",
		"category": "AI Provider Smoke Tests",
		"description": "Test isOpenCodeAvailable returns boolean without throwing",
		"steps_to_verify": [
			"Test case exists with name matching /isOpenCodeAvailable.*boolean/i",
			"Test calls isOpenCodeAvailable() without mocks",
			"Test asserts typeof result === 'boolean'",
			"Test has timeout >= 10000ms"
		],
		"passes": true
	},
	{
		"id": "T1.3",
		"category": "AI Provider Smoke Tests",
		"description": "Test detectProvider returns valid result or throws AIProviderNotFoundError",
		"steps_to_verify": [
			"Test case exists with name matching /detectProvider/i",
			"Test calls detectProvider() without mocks",
			"Test handles both success case (valid provider object) and expected error case",
			"Test has timeout >= 10000ms"
		],
		"passes": true
	},
	{
		"id": "T1.4",
		"category": "AI Provider Smoke Tests",
		"description": "Add test:smoke script to packages/sdk/package.json",
		"steps_to_verify": [
			"packages/sdk/package.json contains script 'test:smoke'",
			"Script sets SMOKE_TESTS=1 environment variable",
			"Script runs vitest with pattern filter for smoke tests"
		],
		"passes": true
	},
	{
		"id": "T2.0",
		"category": "Playwright Setup",
		"description": "Install Playwright and create configuration file",
		"steps_to_verify": [
			"@playwright/test is in apps/web/package.json devDependencies",
			"File exists at apps/web/playwright.config.ts",
			"Config exports defineConfig from @playwright/test",
			"Config sets testDir to './e2e'",
			"Config sets webServer.command to start dev server",
			"Config sets webServer.port to 3001",
			"Config sets webServer.reuseExistingServer based on CI env var",
			"Config sets use.baseURL to http://localhost:3001"
		],
		"passes": true
	},
	{
		"id": "T2.1",
		"category": "Playwright Setup",
		"description": "Create e2e test directory structure",
		"steps_to_verify": [
			"Directory exists at apps/web/e2e/",
			"At least one .spec.ts file exists in apps/web/e2e/"
		],
		"passes": true
	},
	{
		"id": "T2.2",
		"category": "Playwright Setup",
		"description": "Add Playwright scripts to apps/web/package.json",
		"steps_to_verify": [
			"Script 'test:e2e' exists and runs 'playwright test'",
			"Script 'test:e2e:ui' exists and runs 'playwright test --ui'",
			"Script 'test:e2e:headed' exists and runs 'playwright test --headed'"
		],
		"passes": true
	},
	{
		"id": "T3.0",
		"category": "Navigation E2E Tests",
		"description": "Create navigation.spec.ts for basic page load tests",
		"steps_to_verify": [
			"File exists at apps/web/e2e/navigation.spec.ts",
			"File imports test and expect from @playwright/test",
			"File contains describe block for navigation tests"
		],
		"passes": true
	},
	{
		"id": "T3.1",
		"category": "Navigation E2E Tests",
		"description": "Test home page loads without error",
		"steps_to_verify": [
			"Test navigates to '/'",
			"Test waits for page to load",
			"Test asserts main content area is visible (h1, main, or [data-testid])"
		],
		"passes": true
	},
	{
		"id": "T3.2",
		"category": "Navigation E2E Tests",
		"description": "Test browse page loads",
		"steps_to_verify": [
			"Test navigates to '/browse'",
			"Test waits for page to load",
			"Test asserts main content area is visible"
		],
		"passes": true
	},
	{
		"id": "T3.3",
		"category": "Navigation E2E Tests",
		"description": "Test repo detail page loads with valid params",
		"steps_to_verify": [
			"Test navigates to '/repo/tanstack/router' or similar known repo path",
			"Test waits for page to load",
			"Test asserts page does not show 404 or error state",
			"Test asserts main content area is visible"
		],
		"passes": true
	},
	{
		"id": "T3.4",
		"category": "Navigation E2E Tests",
		"description": "Test 404 page renders for invalid routes",
		"steps_to_verify": [
			"Test navigates to '/this-route-does-not-exist-12345'",
			"Test asserts 404 indicator is visible (text '404', 'not found', or equivalent)"
		],
		"passes": true
	},
	{
		"id": "T4.0",
		"category": "Auth E2E Tests",
		"description": "Create auth.spec.ts for authentication flow tests",
		"steps_to_verify": [
			"File exists at apps/web/e2e/auth.spec.ts",
			"File imports test and expect from @playwright/test",
			"File contains describe block for authentication tests"
		],
		"passes": true
	},
	{
		"id": "T4.1",
		"category": "Auth E2E Tests",
		"description": "Test sign-in page renders form",
		"steps_to_verify": [
			"Test navigates to '/dashboard' (auth forms shown for unauthenticated)",
			"Test asserts email input field is visible",
			"Test asserts password input field is visible",
			"Test asserts submit button is visible"
		],
		"passes": true
	},
	{
		"id": "T4.2",
		"category": "Auth E2E Tests",
		"description": "Test sign-up page renders form",
		"steps_to_verify": [
			"Test navigates to '/dashboard' and switches to sign-up",
			"Test asserts email input field is visible",
			"Test asserts password input field is visible",
			"Test asserts submit button is visible"
		],
		"passes": true
	},
	{
		"id": "T4.3",
		"category": "Auth E2E Tests",
		"description": "Test protected route redirects unauthenticated users",
		"steps_to_verify": [
			"Test navigates to a protected route (e.g., '/dashboard' or route requiring auth)",
			"Test asserts URL changes to sign-in page OR page shows auth required message"
		],
		"passes": true
	},
	{
		"id": "T5.0",
		"category": "Analysis E2E Tests",
		"description": "Create analysis.spec.ts for analysis display tests",
		"steps_to_verify": [
			"File exists at apps/web/e2e/analysis.spec.ts",
			"File imports test and expect from @playwright/test",
			"File contains describe block for analysis tests"
		],
		"passes": true
	},
	{
		"id": "T5.1",
		"category": "Analysis E2E Tests",
		"description": "Test browse page shows analysis list or empty state",
		"steps_to_verify": [
			"Test navigates to '/browse'",
			"Test waits for Convex query to resolve (network idle or specific element)",
			"Test asserts either analysis list items are visible OR empty state message is visible"
		],
		"passes": true
	},
	{
		"id": "T5.2",
		"category": "Analysis E2E Tests",
		"description": "Test repo detail page shows summary section",
		"steps_to_verify": [
			"Test navigates to repo detail page for known analyzed repo",
			"Test waits for content to load",
			"Test asserts summary content area is visible (heading, markdown content, or [data-testid='summary'])"
		],
		"passes": true
	},
	{
		"id": "T5.3",
		"category": "Analysis E2E Tests",
		"description": "Test repo detail page shows architecture section",
		"steps_to_verify": [
			"Test navigates to repo detail page for known analyzed repo",
			"Test waits for content to load",
			"Test asserts architecture content area is visible (mermaid diagram, entity list, or [data-testid='architecture'])"
		],
		"passes": true
	},
	{
		"id": "T6.0",
		"category": "CI Integration",
		"description": "Ensure smoke tests can run in CI",
		"steps_to_verify": [
			"Running 'bun run test:smoke' in packages/sdk completes without setup errors",
			"Tests either pass or skip gracefully when providers unavailable"
		],
		"passes": true
	},
	{
		"id": "T6.1",
		"category": "CI Integration",
		"description": "Ensure E2E tests can run in CI",
		"steps_to_verify": [
			"Running 'bun run test:e2e' in apps/web completes without setup errors",
			"Playwright uses Chromium only in CI for speed",
			"Tests pass against dev server"
		],
		"passes": true
	}
]
```

## Implementation Notes

### Test Isolation

- Smoke tests touch real systems but validate types only, not specific values
- E2E tests use existing Convex dev deployment (read-only operations preferred)
- No test should modify production data

### Timeouts

- Smoke tests: 10s per test (network variability)
- E2E navigation tests: default Playwright timeout (30s)
- E2E tests with Convex queries: may need explicit waits for reactivity

### Environment Variables

- `SMOKE_TESTS=1`: Enables AI provider smoke tests
- `CI=1`: Detected by Playwright for server reuse behavior

### Dependencies to Add

```
apps/web: @playwright/test (devDependency)
```

### Files to Create

```
packages/sdk/src/__tests__/ai-provider.smoke.test.ts
apps/web/playwright.config.ts
apps/web/e2e/navigation.spec.ts
apps/web/e2e/auth.spec.ts
apps/web/e2e/analysis.spec.ts
```

### Files to Modify

```
packages/sdk/package.json (add test:smoke script)
apps/web/package.json (add playwright scripts + dependency)
```
