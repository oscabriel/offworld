/**
 * Test fixtures index
 * Provides utilities for loading fixture files in tests
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get the absolute path to a fixture file
 */
export function getFixturePath(filename: string): string {
	return join(__dirname, filename);
}

/**
 * Load a fixture file as a string
 */
export function loadFixture(filename: string): string {
	return readFileSync(getFixturePath(filename), "utf-8");
}

/**
 * Load a fixture file as a Buffer
 */
export function loadFixtureBuffer(filename: string): Buffer {
	return readFileSync(getFixturePath(filename));
}

/**
 * Load a JSON fixture file
 */
export function loadJsonFixture<T = unknown>(filename: string): T {
	return JSON.parse(loadFixture(filename)) as T;
}

// ============================================================================
// Pre-defined fixture loaders
// ============================================================================

/**
 * Load the sample TypeScript file fixture
 */
export function loadSampleTypescript(): string {
	return loadFixture("sample-typescript.ts");
}

/**
 * Load the sample JavaScript file fixture
 */
export function loadSampleJavascript(): string {
	return loadFixture("sample-javascript.js");
}

/**
 * Load the sample Python file fixture
 */
export function loadSamplePython(): string {
	return loadFixture("sample-python.py");
}

/**
 * Load the sample gitignore fixture
 */
export function loadSampleGitignore(): string {
	return loadFixture("sample-gitignore");
}

/**
 * Load the sample package.json fixture
 */
export function loadSamplePackageJson(): Record<string, unknown> {
	return loadJsonFixture("sample-package.json");
}

/**
 * Load the sample README fixture
 */
export function loadSampleReadme(): string {
	return loadFixture("sample-readme.md");
}

/**
 * Load the sample Go file fixture
 */
export function loadSampleGo(): string {
	return loadFixture("sample-go.go");
}

// ============================================================================
// Fixture data constants
// ============================================================================

/**
 * Expected imports from sample-typescript.ts
 */
export const SAMPLE_TS_IMPORTS = [
	"react",
	"react-router-dom",
	"axios",
	"node:fs",
	"@offworld/types",
	"./utils",
	"../components/Component",
	"./styles.css",
];

/**
 * Expected imports from sample-javascript.js
 */
export const SAMPLE_JS_IMPORTS = [
	"fs/promises",
	"path",
	"express",
	"./config.js",
	"../utils/index.js",
];

/**
 * Expected imports from sample-python.py
 */
export const SAMPLE_PY_IMPORTS = [
	"os",
	"sys",
	"pathlib",
	"requests",
	"flask",
	"sqlalchemy",
	"numpy",
	"pandas",
	"typing",
	"mymodule",
];

/**
 * Expected imports from sample-go.go
 */
export const SAMPLE_GO_IMPORTS = [
	"fmt",
	"net/http",
	"os",
	"encoding/json",
	"io",
	"context",
	"github.com/sirupsen/logrus",
	"math",
	"github.com/lib/pq",
	"github.com/gin-gonic/gin",
	"github.com/spf13/cobra",
	"github.com/gorilla/mux",
];

/**
 * Sample binary content (PNG header bytes)
 */
export const SAMPLE_BINARY_BUFFER = Buffer.from([
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a, // PNG signature
	0x00,
	0x00,
	0x00,
	0x0d, // IHDR chunk length
	0x49,
	0x48,
	0x44,
	0x52, // "IHDR"
	0x00,
	0x00,
	0x00,
	0x01, // width: 1
	0x00,
	0x00,
	0x00,
	0x01, // height: 1
]);

/**
 * Sample text buffer (UTF-8)
 */
export const SAMPLE_TEXT_BUFFER = Buffer.from(
	"Hello, world!\nThis is a text file.\nWith multiple lines.",
	"utf-8",
);
