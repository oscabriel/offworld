# Offworld: Implementation Plan

> **Status:** Scaffold complete at `/Users/oscargabriel/Developer/projects/offworld`
> **Reference:** `create-better-t-stack` scaffold + `research/stolen-patterns.md`

---

## Build Order (Non-Negotiable)

```
SDK first -> CLI wraps SDK -> Plugin wraps SDK -> Web consumes sync API
```

Each phase depends on the previous. Do not skip steps.

---

## SDK/CLI Boundary Pattern

### Data Flow

| Layer   | Returns                              | Handles                               |
| ------- | ------------------------------------ | ------------------------------------- |
| **SDK** | Structured data (`{ repos: [...] }`) | Pure logic, no terminal I/O           |
| **CLI** | Formatted terminal output            | Prompts, spinners, colors, exit codes |

### Error Handling

```typescript
// SDK: Throws typed errors
class RepoNotFoundError extends Error {
	constructor(public fullName: string) {
		super(`Repository not found: ${fullName}`);
	}
}

// CLI: Catches + formats
try {
	await cloneRepo(repo, options);
} catch (e) {
	if (e instanceof RepoNotFoundError) {
		console.error(pc.red(`Repo ${e.fullName} not found`));
		process.exit(1);
	}
	throw e;
}
```

### Config Handling

```typescript
// SDK: Receives config as param, never reads files directly
export async function analyzeRepo(
	fullName: string,
	config: AnalysisConfig, // Passed in, not loaded
): Promise<AnalysisResult>;

// CLI: Loads config, passes to SDK
const config = loadConfig();
await analyzeRepo(repo, config);
```

**Principle:** SDK is stateless + testable. CLI owns all I/O.

---

## Phase 1: Monorepo Setup (COMPLETE)

**Goal:** Establish project structure before any code.

**Status:** ✅ Scaffolded via `create-better-t-stack`

### 1.1 Directory Structure (Actual)

```
offworld/
├── apps/
│   ├── web/                    # offworld.sh (TanStack Start + Convex)
│   ├── docs/                   # Documentation (Astro Starlight)
│   └── tui/                    # Terminal UI (OpenTUI)
├── packages/
│   ├── backend/                # @offworld/backend (Convex functions)
│   │   └── convex/             # Convex schema, functions, auth
│   ├── env/                    # @offworld/env (environment handling)
│   ├── config/                 # @offworld/config (shared config)
│   └── infra/                  # @offworld/infra (Alchemy deployment)
├── package.json                # Bun workspaces with catalog
├── turbo.json                  # Turborepo config
├── .oxlintrc.json              # Linter config
├── .oxfmtrc.json               # Formatter config
├── tsconfig.json               # Root TypeScript config
└── bts.jsonc                   # Better-T-Stack config (safe to delete)
```

### 1.2 Still Need to Create

```
offworld/
├── apps/
│   └── cli/                    # @offworld/cli (publishes to npm as 'offworld')
├── packages/
│   ├── sdk/                    # @offworld/sdk (internal shared logic)
│   ├── plugin/                 # @offworld/plugin (OpenCode plugin)
│   └── types/                  # @offworld/types (shared Zod schemas)
```

### 1.3 Root package.json (Actual)

```json
{
	"name": "offworld",
	"private": true,
	"workspaces": {
		"packages": ["apps/*", "packages/*"],
		"catalog": {
			"dotenv": "^17.2.2",
			"zod": "^4.1.13",
			"typescript": "^5",
			"convex": "^1.31.2",
			"better-auth": "1.4.9",
			"@convex-dev/better-auth": "^0.10.9",
			"alchemy": "^0.82.1"
		}
	},
	"type": "module",
	"scripts": {
		"dev": "turbo dev",
		"build": "turbo build",
		"check-types": "turbo check-types",
		"dev:web": "turbo -F web dev",
		"dev:server": "turbo -F @offworld/backend dev",
		"dev:setup": "turbo -F @offworld/backend dev:setup",
		"check": "oxlint && oxfmt --write"
	},
	"dependencies": {
		"@offworld/env": "workspace:*",
		"dotenv": "catalog:",
		"zod": "catalog:"
	},
	"devDependencies": {
		"@cloudflare/workers-types": "^4.20251213.0",
		"@offworld/config": "workspace:*",
		"oxfmt": "^0.19.0",
		"oxlint": "^1.34.0",
		"turbo": "^2.6.3",
		"typescript": "catalog:"
	},
	"packageManager": "bun@1.3.5"
}
```

### 1.4 turbo.json (Actual)

```json
{
	"$schema": "https://turbo.build/schema.json",
	"ui": "tui",
	"tasks": {
		"build": {
			"dependsOn": ["^build"],
			"inputs": ["$TURBO_DEFAULT$", ".env*"],
			"outputs": ["dist/**"]
		},
		"lint": { "dependsOn": ["^lint"] },
		"check-types": { "dependsOn": ["^check-types"] },
		"dev": { "cache": false, "persistent": true },
		"dev:setup": { "cache": false, "persistent": true },
		"deploy": { "cache": false },
		"destroy": { "cache": false }
	}
}
```

### 1.5 Task Checklist (Phase 1)

- [x] Scaffold via `create-better-t-stack`
- [x] TanStack Start frontend with Convex
- [x] Better Auth component configured
- [x] Astro Starlight docs app
- [x] OpenTUI terminal app
- [x] Turborepo with oxlint/oxfmt
- [x] Cloudflare deployment via Alchemy
- [ ] Create `apps/cli/` directory
- [ ] Create `packages/sdk/` directory
- [ ] Create `packages/types/` directory
- [ ] Create `packages/plugin/` directory

---

## Phase 2: packages/types

**Goal:** Single source of truth for all Zod schemas and inferred types.

### 2.1 packages/types/package.json

```json
{
	"name": "@offworld/types",
	"version": "0.1.0",
	"description": "TypeScript types and schemas for Offworld CLI",
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/index.d.mts",
			"default": "./dist/index.mjs"
		},
		"./schemas": {
			"types": "./dist/schemas.d.mts",
			"default": "./dist/schemas.mjs"
		}
	},
	"files": ["dist"],
	"scripts": {
		"build": "tsdown",
		"dev": "tsdown --watch"
	},
	"dependencies": {
		"zod": "catalog:"
	},
	"devDependencies": {
		"@offworld/config": "workspace:*",
		"tsdown": "^0.18.2",
		"typescript": "catalog:"
	}
}
```

### 2.2 packages/types/src/schemas.ts

```typescript
import { z } from "zod";
import { homedir } from "os";
import { join } from "path";

// ============================================================
// Config Schemas
// ============================================================

export const ConfigSchema = z.object({
	repoRoot: z.string().default(join(homedir(), "ow")),
	metaRoot: z.string().default(join(homedir(), ".ow")),
	additionalRoots: z.array(z.string()).default([]),
});

// ============================================================
// Repository Schemas (Provider-Aware)
// ============================================================

// Supported git hosting providers
export const GitProviderSchema = z.enum(["github", "gitlab", "bitbucket"]);

// Flexible input that accepts multiple formats
export const RepoInputSchema = z
	.string()
	.describe("Repository: owner/repo, GitHub/GitLab URL, or local path");

// Normalized result after parsing input
export const RemoteRepoSourceSchema = z.object({
	type: z.literal("remote"),
	provider: GitProviderSchema,
	owner: z.string(),
	repo: z.string(),
	fullName: z.string(), // "owner/repo" (for display)
	qualifiedName: z.string(), // "github:owner/repo" (for storage keys)
	cloneUrl: z.string(), // "https://github.com/owner/repo.git"
});

export const LocalRepoSourceSchema = z.object({
	type: z.literal("local"),
	path: z.string(), // Absolute path
	name: z.string(), // Directory name for display
	qualifiedName: z.string(), // "local:{hash}" (for storage keys)
});

export const RepoSourceSchema = z.discriminatedUnion("type", [
	RemoteRepoSourceSchema,
	LocalRepoSourceSchema,
]);

// Legacy: kept for backward compatibility, prefer RepoInputSchema
export const RepoNameSchema = z
	.string()
	.regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
	.describe("Repository in owner/repo format");

export const CloneOptionsSchema = z.object({
	shallow: z.boolean().optional().default(false).describe("Shallow clone (depth=1)"),
	noAnalyze: z.boolean().optional().default(false).describe("Skip auto-analysis after clone"),
	branch: z.string().optional().describe("Branch to clone"),
});

export const RepoInfoSchema = z.object({
	fullName: z.string(),
	localPath: z.string(),
	analyzedAt: z.string().datetime().optional(),
	commitSha: z.string().optional(),
	hasSkill: z.boolean().default(false),
});

// ============================================================
// Analysis Schemas
// ============================================================

export const ProjectTypeSchema = z
	.enum(["monorepo", "library", "cli", "app", "framework"])
	.describe("Project type classification");

export const EntityTypeSchema = z
	.enum(["package", "module", "feature", "util", "config"])
	.describe("Entity type within project");

export const FileRoleSchema = z
	.enum(["entry", "core", "types", "config", "test", "util", "doc"])
	.describe("File role classification");

export const EntitySchema = z.object({
	name: z.string(),
	type: EntityTypeSchema,
	path: z.string(),
	description: z.string(),
	responsibilities: z.array(z.string()),
	exports: z.array(z.string()),
	dependencies: z.array(z.string()),
});

export const RelationshipSchema = z.object({
	from: z.string(),
	to: z.string(),
	type: z.enum(["imports", "extends", "implements", "uses"]),
});

export const KeyFileSchema = z.object({
	path: z.string(),
	role: FileRoleSchema,
	description: z.string(),
});

export const PatternSchema = z.object({
	framework: z.string().optional(),
	buildTool: z.string().optional(),
	testFramework: z.string().optional(),
	monorepoTool: z.string().optional(),
});

export const ArchitectureSchema = z.object({
	projectType: ProjectTypeSchema,
	entities: z.array(EntitySchema),
	relationships: z.array(RelationshipSchema),
	keyFiles: z.array(KeyFileSchema),
	patterns: PatternSchema,
});

export const FileIndexEntrySchema = z.object({
	path: z.string(),
	importance: z.number().min(0).max(1),
	type: FileRoleSchema,
	exports: z.array(z.string()).optional(),
	imports: z.array(z.string()).optional(),
	summary: z.string().optional(),
});

export const FileIndexSchema = z.array(FileIndexEntrySchema);

export const AnalysisMetaSchema = z.object({
	analyzedAt: z.string().datetime(),
	commitSha: z.string(),
	version: z.string(),
	tokenCost: z.number().optional(),
});

// ============================================================
// Skill Schemas
// ============================================================

export const SkillStructureEntrySchema = z.object({
	path: z.string(),
	purpose: z.string(),
});

export const SkillKeyFileSchema = z.object({
	path: z.string(),
	description: z.string(),
});

export const SkillSchema = z.object({
	name: z.string(),
	description: z.string(),
	allowedTools: z.array(z.string()),
	repositoryStructure: z.array(SkillStructureEntrySchema),
	keyFiles: z.array(SkillKeyFileSchema),
	searchStrategies: z.array(z.string()),
	whenToUse: z.array(z.string()),
});

// ============================================================
// Index Schema (global repo list)
// ============================================================

export const OffworldIndexSchema = z.object({
	version: z.string(),
	repos: z.array(RepoInfoSchema),
});

// ============================================================
// CLI Input Schemas
// ============================================================

export const ListOptionsSchema = z.object({
	paths: z.boolean().optional().default(false).describe("Show full paths"),
	query: z.string().optional().describe("Filter repos by name"),
});

export const AnalyzeOptionsSchema = z.object({
	force: z.boolean().optional().default(false).describe("Force re-analysis"),
});

export const ConfigSetOptionsSchema = z.object({
	key: z.enum(["root", "model", "provider"]).describe("Config key to set"),
	value: z.string().describe("Value to set"),
});

// Export constant arrays for CLI options
export const PROJECT_TYPE_VALUES = ProjectTypeSchema.options;
export const ENTITY_TYPE_VALUES = EntityTypeSchema.options;
export const FILE_ROLE_VALUES = FileRoleSchema.options;
```

### 2.3 packages/types/src/types.ts

```typescript
import type { z } from "zod";
import type {
	ConfigSchema,
	RepoNameSchema,
	CloneOptionsSchema,
	RepoInfoSchema,
	ArchitectureSchema,
	EntitySchema,
	FileIndexSchema,
	FileIndexEntrySchema,
	AnalysisMetaSchema,
	SkillSchema,
	OffworldIndexSchema,
	ListOptionsSchema,
	AnalyzeOptionsSchema,
	ConfigSetOptionsSchema,
} from "./schemas";

// Inferred types from Zod schemas
export type Config = z.infer<typeof ConfigSchema>;
export type RepoName = z.infer<typeof RepoNameSchema>;
export type CloneOptions = z.infer<typeof CloneOptionsSchema>;
export type RepoInfo = z.infer<typeof RepoInfoSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type FileIndex = z.infer<typeof FileIndexSchema>;
export type FileIndexEntry = z.infer<typeof FileIndexEntrySchema>;
export type AnalysisMeta = z.infer<typeof AnalysisMetaSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type OffworldIndex = z.infer<typeof OffworldIndexSchema>;
export type ListOptions = z.infer<typeof ListOptionsSchema>;
export type AnalyzeOptions = z.infer<typeof AnalyzeOptionsSchema>;
export type ConfigSetOptions = z.infer<typeof ConfigSetOptionsSchema>;
```

### 2.4 packages/types/src/index.ts

```typescript
// Re-export everything
export * from "./schemas";
export * from "./types";
```

### 2.5 Task Checklist

- [ ] Create `packages/types/` directory
- [ ] Create `package.json`
- [ ] Create `tsdown.config.ts`
- [ ] Create `src/schemas.ts` with all Zod schemas
- [ ] Create `src/types.ts` with inferred types
- [ ] Create `src/index.ts` re-exports
- [ ] Verify: `bun build` succeeds in packages/types

---

## Phase 3: packages/sdk

**Goal:** Internal SDK shared by CLI and plugin.

### 3.1 packages/sdk/package.json

```json
{
	"name": "@offworld/sdk",
	"version": "0.1.0",
	"private": true,
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/index.d.mts",
			"default": "./dist/index.mjs"
		}
	},
	"files": ["dist"],
	"scripts": {
		"build": "tsdown",
		"dev": "tsdown --watch"
	},
	"dependencies": {
		"@offworld/types": "workspace:*",
		"@opencode-ai/sdk": "^0.1.0",
		"execa": "^9.6.1",
		"fs-extra": "^11.3.3",
		"tinyglobby": "^0.2.15",
		"tree-sitter": "^0.22.0",
		"tree-sitter-typescript": "^0.23.0",
		"tree-sitter-python": "^0.23.0",
		"tree-sitter-go": "^0.23.0",
		"zod": "catalog:"
	},
	"devDependencies": {
		"@offworld/config": "workspace:*",
		"@types/fs-extra": "^11.0.4",
		"@types/node": "^25.0.3",
		"tsdown": "^0.18.2",
		"typescript": "catalog:"
	}
}
```

### 3.2 SDK Module Structure

```
packages/sdk/src/
├── index.ts              # Public exports
├── config.ts             # Config loading, path utilities
├── repo-source.ts        # Input parsing (owner/repo, URLs, local paths)
├── clone.ts              # Git clone operations
├── importance/
│   ├── index.ts          # rankFileImportance()
│   ├── parser.ts         # Tree-sitter setup
│   └── queries.ts        # Language-specific import queries
├── analysis.ts           # AI analysis orchestration
├── skill.ts              # SKILL.md generation
├── sync.ts               # Push/pull with offworld.sh (includes star gate)
├── ai.ts                 # OpenCode SDK client
├── util.ts               # Shared utilities
└── constants.ts          # Default ignore patterns, etc.
```

### 3.3 Core Module: repo-source.ts

```typescript
// packages/sdk/src/repo-source.ts
import path from "path";
import fs from "fs-extra";
import crypto from "node:crypto";
import type { RepoSource, GitProvider } from "@offworld/types";
import { getMetaRoot } from "./config";

// Provider configurations - easily extensible for new providers
const PROVIDERS: Record<
	GitProvider,
	{
		urlPatterns: RegExp[];
		cloneUrl: (owner: string, repo: string) => string;
	}
> = {
	github: {
		urlPatterns: [
			/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
			/^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
		],
		cloneUrl: (owner, repo) => `https://github.com/${owner}/${repo}.git`,
	},
	gitlab: {
		urlPatterns: [
			/^https?:\/\/gitlab\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
			/^git@gitlab\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
		],
		cloneUrl: (owner, repo) => `https://gitlab.com/${owner}/${repo}.git`,
	},
	bitbucket: {
		urlPatterns: [
			/^https?:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
			/^git@bitbucket\.org:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
		],
		cloneUrl: (owner, repo) => `https://bitbucket.org/${owner}/${repo}.git`,
	},
};

// Shorthand (owner/repo) defaults to GitHub
const SHORTHAND_PATTERN = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;

export async function parseRepoInput(input: string): Promise<RepoSource> {
	// 1. Try all provider URL patterns
	for (const [provider, config] of Object.entries(PROVIDERS)) {
		for (const pattern of config.urlPatterns) {
			const match = input.match(pattern);
			if (match) {
				const [, owner, repo] = match;
				return createRemoteSource(provider as GitProvider, owner, repo);
			}
		}
	}

	// 2. Try shorthand (owner/repo) - defaults to GitHub
	const shorthand = input.match(SHORTHAND_PATTERN);
	if (shorthand) {
		const [, owner, repo] = shorthand;
		return createRemoteSource("github", owner, repo);
	}

	// 3. Treat as local path
	const absolutePath = path.resolve(input);

	if (!(await fs.pathExists(absolutePath))) {
		throw new Error(`Path does not exist: ${absolutePath}`);
	}

	if (!(await fs.pathExists(path.join(absolutePath, ".git")))) {
		throw new Error(`Not a git repository: ${absolutePath}`);
	}

	const hash = crypto.createHash("sha256").update(absolutePath).digest("hex").slice(0, 12);

	return {
		type: "local",
		path: absolutePath,
		name: path.basename(absolutePath),
		qualifiedName: `local:${hash}`,
	};
}

function createRemoteSource(provider: GitProvider, owner: string, repo: string): RepoSource {
	const config = PROVIDERS[provider];
	return {
		type: "remote",
		provider,
		owner,
		repo,
		fullName: `${owner}/${repo}`,
		qualifiedName: `${provider}:${owner}/${repo}`,
		cloneUrl: config.cloneUrl(owner, repo),
	};
}

// All storage uses qualifiedName to avoid collisions across providers
export function getAnalysisPathForSource(source: RepoSource): string {
	const sanitized = source.qualifiedName.replace(/[:/]/g, "--");
	return path.join(getMetaRoot(), "analyses", sanitized);
}

export function getRepoPathForSource(source: RepoSource, repoRoot: string): string {
	if (source.type === "local") {
		return source.path;
	}
	// Provider-scoped: ~/ow/github/owner/repo
	return path.join(repoRoot, source.provider, source.owner, source.repo);
}
```

### 3.5 Core Module: config.ts

```typescript
// packages/sdk/src/config.ts
import { ConfigSchema, type Config } from "@offworld/types";
import fs from "fs-extra";
import { homedir } from "os";
import { join } from "path";

const CONFIG_FILE = "config.json";

export function getMetaRoot(): string {
	return join(homedir(), ".ow");
}

export function getRepoRoot(): string {
	const config = loadConfig();
	return config.repoRoot;
}

export function getRepoPath(fullName: string): string {
	const [owner, repo] = fullName.split("/");
	return join(getRepoRoot(), owner, repo);
}

export function getAnalysisPath(fullName: string): string {
	const sanitized = fullName.replace("/", "--");
	return join(getMetaRoot(), "analyses", sanitized);
}

export function getConfigPath(): string {
	return join(getMetaRoot(), CONFIG_FILE);
}

export function loadConfig(): Config {
	const configPath = getConfigPath();

	if (!fs.existsSync(configPath)) {
		return ConfigSchema.parse({});
	}

	const raw = fs.readJsonSync(configPath);
	return ConfigSchema.parse(raw);
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
	const current = loadConfig();
	const merged = { ...current, ...config };
	const validated = ConfigSchema.parse(merged);

	await fs.ensureDir(getMetaRoot());
	await fs.writeJson(getConfigPath(), validated, { spaces: 2 });
}
```

### 3.4 Core Module: clone.ts

```typescript
// packages/sdk/src/clone.ts
import { execa } from "execa";
import fs from "fs-extra";
import { getRepoPath, getAnalysisPath, getMetaRoot } from "./config";
import { updateIndex } from "./index-manager";
import type { CloneOptions, RepoInfo } from "@offworld/types";

export async function cloneRepo(fullName: string, options: CloneOptions = {}): Promise<string> {
	const repoPath = getRepoPath(fullName);

	if (await fs.pathExists(repoPath)) {
		throw new Error(`Repository already exists at ${repoPath}`);
	}

	await fs.ensureDir(repoPath);

	const args = ["clone"];

	if (options.shallow) {
		args.push("--depth", "1");
	}

	if (options.branch) {
		args.push("--branch", options.branch);
	}

	args.push(`https://github.com/${fullName}.git`, repoPath);

	await execa("git", args);

	// Get commit SHA
	const { stdout: commitSha } = await execa("git", ["rev-parse", "HEAD"], {
		cwd: repoPath,
	});

	// Update global index
	await updateIndex({
		fullName,
		localPath: repoPath,
		commitSha: commitSha.trim(),
		hasSkill: false,
	});

	return repoPath;
}

export async function listRepos(): Promise<RepoInfo[]> {
	const index = await getIndex();
	return index.repos;
}

export async function updateRepo(fullName: string): Promise<void> {
	const repoPath = getRepoPath(fullName);

	if (!(await fs.pathExists(repoPath))) {
		throw new Error(`Repository not found: ${fullName}`);
	}

	await execa("git", ["pull"], { cwd: repoPath });
}

export async function removeRepo(fullName: string): Promise<void> {
	const repoPath = getRepoPath(fullName);
	const analysisPath = getAnalysisPath(fullName);

	if (await fs.pathExists(repoPath)) {
		await fs.remove(repoPath);
	}

	if (await fs.pathExists(analysisPath)) {
		await fs.remove(analysisPath);
	}

	// Update index
	const index = await getIndex();
	index.repos = index.repos.filter((r) => r.fullName !== fullName);
	await saveIndex(index);
}
```

### 3.5 Core Module: constants.ts (from repogrep)

```typescript
// packages/sdk/src/constants.ts

export const DEFAULT_IGNORE_PATTERNS = [
	// Build artifacts
	"**/node_modules/**",
	"**/dist/**",
	"**/build/**",
	"**/out/**",
	"**/target/**",
	"**/.next/**",
	"**/.turbo/**",
	"**/.cache/**",
	"**/coverage/**",

	// Version control
	"**/.git/**",

	// Dependencies
	"**/vendor/**",
	"**/.venv/**",
	"**/__pycache__/**",

	// IDE
	"**/.vscode/**",
	"**/.idea/**",
	"**/.DS_Store",

	// Binary/Media (abbreviated)
	"**/*.jpg",
	"**/*.png",
	"**/*.gif",
	"**/*.svg",
	"**/*.mp4",
	"**/*.mp3",
	"**/*.wav",
	"**/*.zip",
	"**/*.tar",
	"**/*.gz",
	"**/*.exe",
	"**/*.dll",
	"**/*.so",
	"**/*.wasm",
	"**/*.db",
	"**/*.sqlite",
	"**/*.ttf",
	"**/*.woff",
	"**/*.woff2",
	"**/*.pdf",
	"**/*.docx",

	// Logs
	"**/*.log",
];

export const SUPPORTED_LANGUAGES = ["typescript", "javascript", "python", "go", "rust"] as const;

export const VERSION = "0.1.0";
```

### 3.6 Core Module: util.ts (from repogrep)

```typescript
// packages/sdk/src/util.ts
import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";

export function isBinaryBuffer(buffer: Buffer): boolean {
	if (!buffer.length) return false;

	const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
	let suspicious = 0;

	for (let i = 0; i < sample.length; i++) {
		const byte = sample[i];
		if (byte === 0) return true;
		if (byte < 7 || (byte > 13 && byte < 32) || byte === 255) {
			suspicious++;
		}
	}

	return suspicious / sample.length > 0.3;
}

export function hashBuffer(buffer: Buffer): string {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function loadGitignorePatterns(repoPath: string): Promise<string[]> {
	const gitignorePath = path.join(repoPath, ".gitignore");

	if (!(await fs.pathExists(gitignorePath))) {
		return [];
	}

	const content = await fs.readFile(gitignorePath, "utf-8");
	const patterns: string[] = [];

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		let pattern = trimmed.replace(/\\/g, "/");
		const isNegation = pattern.startsWith("!");
		if (isNegation) pattern = pattern.slice(1);

		const isRootRelative = pattern.startsWith("/");
		if (isRootRelative) pattern = pattern.slice(1);

		if (pattern.endsWith("/")) {
			pattern = `${pattern.slice(0, -1)}/**`;
		}

		if (!isRootRelative) {
			pattern = `**/${pattern}`;
		}

		if (pattern) {
			patterns.push(isNegation ? `!${pattern}` : pattern);
		}
	}

	return patterns;
}
```

### 3.7 Task Checklist

- [ ] Create `packages/sdk/` directory
- [ ] Create `package.json`
- [ ] Create `tsdown.config.ts`
- [ ] Implement `src/repo-source.ts` (input parsing: owner/repo, URLs, local paths)
- [ ] Implement `src/config.ts` (path utilities, config loading)
- [ ] Implement `src/constants.ts` (ignore patterns)
- [ ] Implement `src/util.ts` (binary detection, gitignore parsing)
- [ ] Implement `src/clone.ts` (git operations)
- [ ] Implement `src/index-manager.ts` (global index.json)
- [ ] Implement `src/importance/` (tree-sitter file ranking)
- [ ] Implement `src/ai.ts` (OpenCode SDK client)
- [ ] Implement `src/analysis.ts` (summary, architecture)
- [ ] Implement `src/skill.ts` (SKILL.md generation)
- [ ] Implement `src/sync.ts` (pull/push with offworld.sh, star gate)
- [ ] Create `src/index.ts` with public exports
- [ ] Verify: `bun build` succeeds

### 3.8 Core Module: sync.ts

Uses plain `fetch()` to call Convex HTTP Actions. No Convex SDK in CLI.

**Pattern from:** `create-better-t-stack` analytics (`apps/cli/src/utils/analytics.ts`)

```typescript
// packages/sdk/src/sync.ts
import fs from "fs-extra";
import { getAnalysisPath } from "./config";
import type { Analysis, AnalysisMeta } from "@offworld/types";

const OFFWORLD_API = process.env.OFFWORLD_API_URL ?? "https://offworld.convex.site/api";

// ============================================================
// Pull: Fetch analysis from offworld.sh (public, no auth)
// ============================================================

export async function pullAnalysis(fullName: string): Promise<{
	analysis: Analysis;
	meta: AnalysisMeta;
} | null> {
	const res = await fetch(`${OFFWORLD_API}/analyses/pull`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ fullName }),
	});

	if (!res.ok) return null;

	const remote = await res.json();
	return {
		analysis: {
			summary: remote.summary,
			architecture: remote.architecture,
			skill: remote.skill,
		},
		meta: {
			analyzedAt: remote.analyzedAt,
			commitSha: remote.commitSha,
			version: remote.version ?? "unknown",
		},
	};
}

// ============================================================
// Push: Upload analysis to offworld.sh (requires auth)
// ============================================================

export async function pushAnalysis(
	fullName: string,
	sessionToken: string,
): Promise<{ success: boolean; error?: string }> {
	const analysisPath = getAnalysisPath(fullName);

	// Load local analysis files
	const [summary, architecture, skill, meta] = await Promise.all([
		fs.readFile(`${analysisPath}/summary.md`, "utf-8"),
		fs.readJson(`${analysisPath}/architecture.json`),
		fs.readFile(`${analysisPath}/SKILL.md`, "utf-8"),
		fs.readJson(`${analysisPath}/meta.json`),
	]);

	const res = await fetch(`${OFFWORLD_API}/analyses/push`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${sessionToken}`,
		},
		body: JSON.stringify({
			fullName,
			summary,
			architecture,
			skill,
			commitSha: meta.commitSha,
			analyzedAt: meta.analyzedAt,
		}),
	});

	if (!res.ok) {
		const error = await res.text();
		return { success: false, error };
	}
	return { success: true };
}

// ============================================================
// Check: Lightweight metadata check without full pull
// ============================================================

export async function checkRemote(fullName: string): Promise<{
	exists: boolean;
	commitSha?: string;
	analyzedAt?: string;
}> {
	const res = await fetch(`${OFFWORLD_API}/analyses/check`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ fullName }),
	});

	if (!res.ok) return { exists: false };
	return res.json();
}

// ============================================================
// Staleness: Compare local vs remote
// ============================================================

export async function checkStaleness(fullName: string): Promise<{
	localCommit: string | null;
	remoteCommit: string | null;
	isStale: boolean;
}> {
	const analysisPath = getAnalysisPath(fullName);

	// Get local commit
	let localCommit: string | null = null;
	try {
		const meta = await fs.readJson(`${analysisPath}/meta.json`);
		localCommit = meta.commitSha;
	} catch {
		// No local analysis
	}

	// Get remote commit (lightweight check)
	const remote = await checkRemote(fullName);
	const remoteCommit = remote.exists ? (remote.commitSha ?? null) : null;

	return {
		localCommit,
		remoteCommit,
		isStale: localCommit !== null && remoteCommit !== null && localCommit !== remoteCommit,
	};
}

// ============================================================
// Push Gate: Check if repo can be pushed to offworld.sh
// ============================================================

export async function canPushToWeb(source: RepoSource): Promise<{
	allowed: boolean;
	reason?: string;
}> {
	// Local repos cannot be pushed
	if (source.type === "local") {
		return { allowed: false, reason: "Local repos cannot be pushed to offworld.sh" };
	}

	// V1: GitHub only for push
	if (source.provider !== "github") {
		return {
			allowed: false,
			reason: `${source.provider} repos not yet supported for push (coming soon)`,
		};
	}

	// Check stars via provider-specific API
	const stars = await fetchRepoStars(source);

	if (stars < 5) {
		return {
			allowed: false,
			reason: `Repo has ${stars} stars (minimum 5 required)`,
		};
	}

	return { allowed: true };
}

// Provider-specific star fetching (extensible)
async function fetchRepoStars(source: RemoteRepoSource): Promise<number> {
	const { provider, owner, repo } = source;

	switch (provider) {
		case "github": {
			const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
			if (!res.ok) return 0;
			return (await res.json()).stargazers_count ?? 0;
		}
		case "gitlab": {
			const encoded = encodeURIComponent(`${owner}/${repo}`);
			const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}`);
			if (!res.ok) return 0;
			return (await res.json()).star_count ?? 0;
		}
		case "bitbucket": {
			// Bitbucket doesn't have stars; return 0 for now
			return 0;
		}
	}
}
```

### 3.9 Convex HTTP Actions (packages/backend/convex/)

**Note:** The scaffold places Convex in `packages/backend/convex/`, not `apps/web/convex/`.

HTTP Actions provide REST endpoints. Internal functions contain business logic.

```typescript
// packages/backend/convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ============================================================
// Pull: Public, anyone can download analyses
// ============================================================
http.route({
	path: "/api/analyses/pull",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const { fullName } = await req.json();
		if (!fullName) {
			return new Response("Missing fullName", { status: 400 });
		}

		const analysis = await ctx.runQuery(internal.analyses.getByRepo, { fullName });
		if (!analysis) {
			return new Response("Not found", { status: 404 });
		}

		// Increment pull count (fire-and-forget)
		ctx.runMutation(internal.analyses.incrementPullCount, { fullName });

		return Response.json(analysis);
	}),
});

// ============================================================
// Push: Authenticated, rate-limited
// ============================================================
http.route({
	path: "/api/analyses/push",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const token = req.headers.get("Authorization")?.replace("Bearer ", "");
		if (!token) {
			return new Response("Unauthorized", { status: 401 });
		}

		// Verify token via Better Auth
		const session = await ctx.runQuery(internal.auth.verifySession, { token });
		if (!session) {
			return new Response("Invalid session", { status: 401 });
		}

		const body = await req.json();
		const { fullName, summary, architecture, skill, commitSha, analyzedAt } = body;

		if (!fullName || !summary || !skill || !commitSha) {
			return new Response("Missing required fields", { status: 400 });
		}

		try {
			await ctx.runMutation(internal.analyses.upsert, {
				fullName,
				summary,
				architecture,
				skill,
				commitSha,
				analyzedAt,
				userId: session.userId,
			});
			return new Response("ok");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return new Response(message, { status: 400 });
		}
	}),
});

// ============================================================
// Check: Public, lightweight metadata check
// ============================================================
http.route({
	path: "/api/analyses/check",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const { fullName } = await req.json();
		if (!fullName) {
			return new Response("Missing fullName", { status: 400 });
		}

		const meta = await ctx.runQuery(internal.analyses.getMeta, { fullName });
		if (!meta) {
			return Response.json({ exists: false });
		}

		return Response.json({
			exists: true,
			commitSha: meta.commitSha,
			analyzedAt: meta.analyzedAt,
		});
	}),
});

export default http;
```

### 3.10 Convex Schema

```typescript
// packages/backend/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	analyses: defineTable({
		fullName: v.string(), // "tanstack/router"
		summary: v.string(), // summary.md content
		architecture: v.any(), // architecture.json
		skill: v.string(), // SKILL.md content
		commitSha: v.string(), // git commit analyzed
		analyzedAt: v.string(), // ISO timestamp
		pullCount: v.number(), // download counter
		isVerified: v.boolean(), // manually reviewed
	})
		.index("by_fullName", ["fullName"])
		.index("by_pullCount", ["pullCount"]),

	pushLogs: defineTable({
		fullName: v.string(),
		date: v.string(), // "2026-01-07" for rate limiting
		userId: v.string(),
	}).index("by_repo_date", ["fullName", "date"]),
});
```

### 3.11 Internal Convex Functions

```typescript
// packages/backend/convex/analyses.ts
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// INTERNAL: Only callable from HTTP Actions (not directly from clients)
export const getByRepo = internalQuery({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.unique();
	},
});

export const getMeta = internalQuery({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.unique();

		if (!analysis) return null;
		return {
			commitSha: analysis.commitSha,
			analyzedAt: analysis.analyzedAt,
		};
	},
});

export const incrementPullCount = internalMutation({
	args: { fullName: v.string() },
	handler: async (ctx, args) => {
		const analysis = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.unique();

		if (analysis) {
			await ctx.db.patch(analysis._id, {
				pullCount: (analysis.pullCount || 0) + 1,
			});
		}
	},
});

export const upsert = internalMutation({
	args: {
		fullName: v.string(),
		summary: v.string(),
		architecture: v.any(),
		skill: v.string(),
		commitSha: v.string(),
		analyzedAt: v.string(),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		// Rate limit: 3 pushes per repo per day
		const today = new Date().toISOString().split("T")[0];
		const pushesToday = await ctx.db
			.query("pushLogs")
			.withIndex("by_repo_date", (q) => q.eq("fullName", args.fullName).eq("date", today))
			.collect();

		if (pushesToday.length >= 3) {
			throw new Error("Rate limit: max 3 pushes per repo per day");
		}

		// Conflict resolution
		const existing = await ctx.db
			.query("analyses")
			.withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
			.unique();

		if (existing) {
			const existingTime = new Date(existing.analyzedAt).getTime();
			const newTime = new Date(args.analyzedAt).getTime();

			if (newTime < existingTime) {
				throw new Error("Cannot push older analysis over newer one");
			}

			if (existing.commitSha === args.commitSha && existing.analyzedAt !== args.analyzedAt) {
				throw new Error("Cannot push different analysis for same commit");
			}

			await ctx.db.patch(existing._id, {
				summary: args.summary,
				architecture: args.architecture,
				skill: args.skill,
				commitSha: args.commitSha,
				analyzedAt: args.analyzedAt,
			});
		} else {
			await ctx.db.insert("analyses", {
				fullName: args.fullName,
				summary: args.summary,
				architecture: args.architecture,
				skill: args.skill,
				commitSha: args.commitSha,
				analyzedAt: args.analyzedAt,
				pullCount: 0,
				isVerified: false,
			});
		}

		// Log push for rate limiting
		await ctx.db.insert("pushLogs", {
			fullName: args.fullName,
			date: today,
			userId: args.userId,
		});
	},
});
```

---

## Phase 4: apps/cli

**Goal:** Working `ow` command using trpc-cli + @orpc/server pattern.

**Note:** The scaffold includes `apps/tui/` with OpenTUI for interactive terminal mode. The CLI (`apps/cli/`) is for non-interactive command execution. Both can coexist.

### 4.1 apps/cli/package.json

```json
{
	"name": "@offworld/cli",
	"version": "0.1.0",
	"description": "Clone OSS repos and auto-generate AI agent skills",
	"bin": {
		"ow": "dist/cli.mjs"
	},
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/index.d.mts",
			"import": "./dist/index.mjs"
		},
		"./cli": {
			"import": "./dist/cli.mjs"
		}
	},
	"files": ["dist"],
	"scripts": {
		"build": "tsdown --publint",
		"dev": "tsdown --watch",
		"prepublishOnly": "bun run build"
	},
	"dependencies": {
		"@offworld/sdk": "workspace:*",
		"@offworld/types": "workspace:*",
		"@clack/prompts": "^1.0.0-alpha.8",
		"@orpc/server": "^1.13.0",
		"consola": "^3.4.2",
		"execa": "^9.6.1",
		"picocolors": "^1.1.1",
		"trpc-cli": "^0.12.1",
		"zod": "catalog:"
	},
	"devDependencies": {
		"@offworld/config": "workspace:*",
		"@types/node": "^25.0.3",
		"publint": "^0.3.16",
		"tsdown": "^0.18.2",
		"typescript": "catalog:"
	}
}
```

### 4.2 apps/cli/tsdown.config.ts

```typescript
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/cli.ts"],
	format: ["esm"],
	clean: true,
	shims: true,
	outDir: "dist",
	dts: true,
	outputOptions: {
		banner: "#!/usr/bin/env node",
	},
});
```

### 4.3 apps/cli/src/index.ts (Router Definition)

```typescript
import { createRouterClient, os } from "@orpc/server";
import { createCli } from "trpc-cli";
import { z } from "zod";
import pc from "picocolors";

import {
	RepoNameSchema,
	CloneOptionsSchema,
	ListOptionsSchema,
	AnalyzeOptionsSchema,
} from "@offworld/types";

import { cloneHandler } from "./handlers/clone";
import { listHandler } from "./handlers/list";
import { analyzeHandler } from "./handlers/analyze";
import { summaryHandler } from "./handlers/summary";
import { removeHandler } from "./handlers/remove";
import { renderTitle } from "./utils/render-title";
import { VERSION } from "./utils/version";

export const router = os.router({
	clone: os
		.meta({
			description: "Clone a repository and analyze it",
			default: true,
			negateBooleans: true,
		})
		.input(z.tuple([RepoNameSchema.describe("Repository (owner/repo)"), CloneOptionsSchema]))
		.handler(async ({ input }) => {
			const [repo, options] = input;
			renderTitle();
			return cloneHandler(repo, options);
		}),

	list: os
		.meta({ description: "List cloned repositories" })
		.input(z.tuple([ListOptionsSchema.optional()]))
		.handler(async ({ input }) => listHandler(input[0])),

	analyze: os
		.meta({ description: "Analyze a repository" })
		.input(
			z.tuple([
				RepoNameSchema.optional().describe("Repository (defaults to current directory)"),
				AnalyzeOptionsSchema.optional(),
			]),
		)
		.handler(async ({ input }) => {
			const [repo, options] = input;
			return analyzeHandler(repo, options);
		}),

	summary: os
		.meta({ description: "Print repository summary" })
		.input(z.tuple([RepoNameSchema.describe("Repository")]))
		.handler(async ({ input }) => summaryHandler(input[0])),

	remove: os
		.meta({ description: "Remove a cloned repository" })
		.input(z.tuple([RepoNameSchema.describe("Repository")]))
		.handler(async ({ input }) => removeHandler(input[0])),
});

const caller = createRouterClient(router, { context: {} });

export function createOwCli() {
	return createCli({
		router,
		name: "ow",
		version: VERSION,
	});
}

// Programmatic API
export async function clone(repo: string, options?: z.infer<typeof CloneOptionsSchema>) {
	return caller.clone([repo, options ?? {}]);
}

export async function list(options?: z.infer<typeof ListOptionsSchema>) {
	return caller.list([options]);
}

export async function analyze(repo?: string, options?: z.infer<typeof AnalyzeOptionsSchema>) {
	return caller.analyze([repo, options]);
}
```

### 4.4 apps/cli/src/cli.ts (Entry Point - 3 lines)

```typescript
import { createOwCli } from "./index";

createOwCli().run();
```

### 4.5 Handler Structure

```
apps/cli/src/
├── handlers/
│   ├── pull.ts           # ow pull (+ clone/get aliases)
│   ├── push.ts           # ow push
│   ├── generate.ts       # ow generate
│   ├── list.ts           # ow list
│   ├── rm.ts             # ow rm
│   ├── auth.ts           # ow auth login/logout/status
│   └── config.ts         # ow config
├── utils/
│   ├── render-title.ts   # ASCII art title
│   ├── version.ts        # Version getter
│   ├── errors.ts         # Error handling
│   └── help.ts           # TTY-aware help (human/JSON)
├── types.ts              # Re-export from @offworld/types
├── index.ts              # Router + exports
└── cli.ts                # Entry point
```

### 4.6 Example Handler: pull.ts

```typescript
// apps/cli/src/handlers/pull.ts
import { intro, outro, spinner } from "@clack/prompts";
import pc from "picocolors";
import {
	cloneRepo,
	pullRemoteAnalysis,
	generateAnalysis,
	getRepoPath,
	checkRemoteExists,
} from "@offworld/sdk";
import type { PullOptions } from "@offworld/types";

export async function pullHandler(repo: string, options: PullOptions) {
	intro(pc.magenta(`Pulling ${repo}`));

	const s = spinner();

	// 1. Clone or update repo
	s.start("Getting repository...");
	try {
		const repoPath = await cloneRepo(repo, { shallow: options.shallow });
		s.stop(`Repository at ${pc.cyan(repoPath)}`);
	} catch (error) {
		s.stop(pc.red("Clone failed"));
		throw error;
	}

	// 2. Try remote analysis first
	s.start("Checking offworld.sh for analysis...");
	const remoteExists = await checkRemoteExists(repo);

	if (remoteExists) {
		try {
			await pullRemoteAnalysis(repo);
			s.stop("Pulled analysis from offworld.sh");
		} catch (error) {
			s.stop(pc.yellow("Remote pull failed, generating locally..."));
			await generateAnalysis(repo);
		}
	} else {
		s.stop("No remote analysis found");
		s.start("Generating analysis locally...");
		await generateAnalysis(repo);
		s.stop("Analysis complete");
	}

	outro(pc.green(`Done! Skills installed for OpenCode and Claude Code.`));

	return { success: true, path: getRepoPath(repo) };
}
```

### 4.7 Task Checklist

- [ ] Create `apps/cli/` directory
- [ ] Create `package.json`
- [ ] Create `tsdown.config.ts`
- [ ] Create `src/types.ts` (re-exports @offworld/types)
- [ ] Create `src/utils/render-title.ts`
- [ ] Create `src/utils/version.ts`
- [ ] Create `src/utils/errors.ts`
- [ ] Create `src/utils/help.ts` (TTY-aware help)
- [ ] Implement `src/handlers/pull.ts` (+ clone/get aliases)
- [ ] Implement `src/handlers/push.ts`
- [ ] Implement `src/handlers/generate.ts`
- [ ] Implement `src/handlers/list.ts`
- [ ] Implement `src/handlers/rm.ts`
- [ ] Implement `src/handlers/auth.ts`
- [ ] Implement `src/handlers/config.ts`
- [ ] Create `src/index.ts` (router definition)
- [ ] Create `src/cli.ts` (entry point)
- [ ] Verify: `bun dev:cli` works
- [ ] Test: `ow pull tanstack/router` completes successfully

---

## Phase 5: SDK Analysis & Skill Generation

**Goal:** AI-powered analysis and SKILL.md generation.

### 5.1 Importance Ranking (Tree-sitter)

```typescript
// packages/sdk/src/importance/index.ts
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Go from "tree-sitter-go";
import { glob } from "tinyglobby";
import fs from "fs-extra";
import path from "path";
import { DEFAULT_IGNORE_PATTERNS } from "../constants";
import { loadGitignorePatterns, isBinaryBuffer } from "../util";
import type { FileIndexEntry } from "@offworld/types";

const PARSERS = {
	typescript: TypeScript.typescript,
	javascript: TypeScript.typescript, // Same parser
	python: Python,
	go: Go,
};

export async function rankFileImportance(repoPath: string): Promise<FileIndexEntry[]> {
	// 1. Discover files
	const gitignorePatterns = await loadGitignorePatterns(repoPath);
	const ignore = [...DEFAULT_IGNORE_PATTERNS, ...gitignorePatterns];

	const files = await glob("**/*", {
		cwd: repoPath,
		ignore,
		onlyFiles: true,
	});

	// 2. Parse imports for supported languages
	const importMap = new Map<string, string[]>(); // file -> imports
	const reverseMap = new Map<string, number>(); // module -> import count

	for (const file of files) {
		const ext = path.extname(file);
		const lang = getLanguage(ext);
		if (!lang) continue;

		const content = await fs.readFile(path.join(repoPath, file));
		if (isBinaryBuffer(content)) continue;

		const imports = extractImports(content.toString(), lang);
		importMap.set(file, imports);

		for (const imp of imports) {
			reverseMap.set(imp, (reverseMap.get(imp) || 0) + 1);
		}
	}

	// 3. Score files by inbound import count
	const scored: FileIndexEntry[] = [];
	const maxImports = Math.max(...reverseMap.values(), 1);

	for (const file of files) {
		const moduleName = getModuleName(file);
		const importCount = reverseMap.get(moduleName) || 0;
		const importance = importCount / maxImports;

		scored.push({
			path: file,
			importance,
			type: classifyFile(file),
		});
	}

	// 4. Sort by importance (descending)
	return scored.sort((a, b) => b.importance - a.importance);
}
```

### 5.2 AI Analysis

```typescript
// packages/sdk/src/analysis.ts
import { getAIClient } from "./ai";
import { rankFileImportance } from "./importance";
import { ArchitectureSchema, type Architecture, type FileIndex } from "@offworld/types";
import fs from "fs-extra";
import { getAnalysisPath, getRepoPath } from "./config";

export async function analyzeRepo(fullName: string): Promise<void> {
	const repoPath = getRepoPath(fullName);
	const analysisPath = getAnalysisPath(fullName);

	await fs.ensureDir(analysisPath);

	// 1. Rank files
	const fileIndex = await rankFileImportance(repoPath);
	await fs.writeJson(`${analysisPath}/file-index.json`, fileIndex, { spaces: 2 });

	// 2. Gather context for AI
	const context = await gatherContext(repoPath, fileIndex);

	// 3. Generate summary
	const summary = await generateSummary(context);
	await fs.writeFile(`${analysisPath}/summary.md`, summary);

	// 4. Extract architecture
	const architecture = await extractArchitecture(context);
	await fs.writeJson(`${analysisPath}/architecture.json`, architecture, { spaces: 2 });

	// 5. Generate architecture.md with Mermaid
	const archMd = formatArchitectureMd(architecture);
	await fs.writeFile(`${analysisPath}/architecture.md`, archMd);

	// 6. Generate SKILL.md
	const skill = await generateSkill(fullName, context, architecture);
	await fs.writeFile(`${analysisPath}/SKILL.md`, skill);

	// 7. Auto-install skill
	await installSkill(fullName, skill);

	// 8. Update meta
	const meta = {
		analyzedAt: new Date().toISOString(),
		commitSha: await getCommitSha(repoPath),
		version: VERSION,
	};
	await fs.writeJson(`${analysisPath}/meta.json`, meta, { spaces: 2 });
}
```

### 5.3 SKILL.md Generation

```typescript
// packages/sdk/src/skill.ts
import { getAIClient } from "./ai";
import { SkillSchema, type Skill, type Architecture } from "@offworld/types";
import fs from "fs-extra";
import path from "path";
import { homedir } from "os";

export async function generateSkill(
	fullName: string,
	context: RepoContext,
	architecture: Architecture,
): Promise<string> {
	const client = await getAIClient();

	// Use structured output with Zod schema
	const result = await client.generateObject({
		schema: SkillSchema,
		prompt: buildSkillPrompt(fullName, context, architecture),
	});

	return formatSkillMd(fullName, result);
}

function formatSkillMd(fullName: string, skill: Skill): string {
	const [owner, repo] = fullName.split("/");

	return `---
name: ${skill.name}
description: ${skill.description}
allowed-tools: [${skill.allowedTools.join(", ")}]
---

# ${repo} Source Code Reference

## Repository Structure
**Base Path:** \`~/ow/${fullName}\`

${skill.repositoryStructure.map((s) => `- \`${s.path}\` - ${s.purpose}`).join("\n")}

## Quick Reference Paths

${skill.keyFiles.map((f) => `- \`${f.path}\` - ${f.description}`).join("\n")}

## Search Strategies

${skill.searchStrategies.map((s) => `- ${s}`).join("\n")}

## When to Use This Skill

${skill.whenToUse.map((w) => `- ${w}`).join("\n")}
`;
}

export async function installSkill(
	fullName: string,
	skillContent: string,
	projectPath?: string, // Optional: install to project-local config
): Promise<void> {
	const skillName = fullName.replace("/", "-");

	// Global: OpenCode location
	const opencodeDir = path.join(homedir(), ".config", "opencode", "skill", skillName);
	await fs.ensureDir(opencodeDir);
	await fs.writeFile(path.join(opencodeDir, "SKILL.md"), skillContent);

	// Global: Claude Code location (for compatibility)
	const claudeDir = path.join(homedir(), ".claude", "skills", skillName);
	await fs.ensureDir(claudeDir);
	await fs.writeFile(path.join(claudeDir, "SKILL.md"), skillContent);

	// Per-project: if projectPath provided, also install locally
	if (projectPath) {
		const projectSkillDir = path.join(projectPath, ".config", "opencode", "skill", skillName);
		await fs.ensureDir(projectSkillDir);
		await fs.writeFile(path.join(projectSkillDir, "SKILL.md"), skillContent);
	}
}
```

### 5.4 Task Checklist

- [ ] Implement `src/importance/parser.ts` (tree-sitter setup)
- [ ] Implement `src/importance/queries.ts` (import extraction queries)
- [ ] Implement `src/importance/index.ts` (ranking algorithm)
- [ ] Implement `src/ai/provider.ts` (dual provider detection)
- [ ] Implement `src/ai/claude-code.ts` (Claude Code SDK wrapper)
- [ ] Implement `src/ai/opencode.ts` (OpenCode SDK wrapper)
- [ ] Implement `src/analysis.ts` (orchestration)
- [ ] Implement `src/skill.ts` (SKILL.md generation)
- [ ] Test: `ow generate tanstack/router` produces all expected files
- [ ] Verify: SKILL.md is auto-installed to both skill directories

---

## Phase 6: OpenCode Plugin

**Goal:** Agent integration via OpenCode plugin hooks.

### 6.1 packages/plugin/package.json

```json
{
	"name": "@offworld/plugin",
	"version": "0.1.0",
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/index.d.mts",
			"default": "./dist/index.mjs"
		}
	},
	"files": ["dist"],
	"scripts": {
		"build": "tsdown",
		"dev": "tsdown --watch"
	},
	"dependencies": {
		"@offworld/sdk": "workspace:*",
		"@offworld/types": "workspace:*",
		"@opencode-ai/plugin": "^0.1.0",
		"zod": "catalog:"
	},
	"devDependencies": {
		"@offworld/config": "workspace:*",
		"tsdown": "^0.18.2",
		"typescript": "catalog:"
	}
}
```

### 6.2 Plugin Implementation

```typescript
// packages/plugin/src/index.ts
import { Plugin, tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { listRepos, getAnalysis, cloneRepo, analyzeRepo } from "@offworld/sdk";

export const OffworldPlugin: Plugin = async (ctx) => {
	return {
		// Register the offworld tool
		tool: {
			offworld: tool({
				description: "Query local repository clones and analyses for OSS dependencies",
				args: {
					mode: z.enum(["list", "summary", "architecture", "clone"]),
					repo: z.string().optional(),
				},
				async execute(args, context) {
					switch (args.mode) {
						case "list":
							return await listRepos();
						case "summary":
							if (!args.repo) throw new Error("repo required");
							return await getAnalysis(args.repo, "summary");
						case "architecture":
							if (!args.repo) throw new Error("repo required");
							return await getAnalysis(args.repo, "architecture");
						case "clone":
							if (!args.repo) throw new Error("repo required");
							await cloneRepo(args.repo);
							await analyzeRepo(args.repo);
							return { success: true, message: `Cloned and analyzed ${args.repo}` };
					}
				},
			}),
		},

		// Inject available repos into system context
		"experimental.chat.system.transform": async (input, output) => {
			const repos = await listRepos();
			if (repos.length > 0) {
				const repoList = repos.map((r) => r.fullName).join(", ");
				output.system.push(`[OFFWORLD] Cloned repos with analyses: ${repoList}`);
			}
		},
	};
};

export default OffworldPlugin;
```

### 6.3 Task Checklist

- [ ] Create `packages/plugin/` directory
- [ ] Create `package.json`
- [ ] Create `tsdown.config.ts`
- [ ] Implement `src/index.ts` (plugin with tool + hooks)
- [ ] Verify: Plugin registers with OpenCode
- [ ] Test: `offworld({ mode: "list" })` returns repos

---

## Phase 7: Web App (Simplified)

**Goal:** offworld.sh as directory + sync only (no RAG/chat).

### What to Keep

- Frontend design
- Auth/user data
- GitHub API for live stats

### What to Delete

- RAG pipeline
- Chat system
- Embeddings

### What to Add

- Sync API (push/pull)
- Copy skill button
- Analysis display

**Deferred:** Full web implementation details. Focus on CLI/SDK first.

---

## Success Metrics

| Metric              | Target                        |
| ------------------- | ----------------------------- |
| `ow pull` completes | <2 minutes for average repo   |
| `ow generate` cost  | <$0.05 per repo               |
| SKILL.md quality    | Usable without manual editing |
| CLI install time    | <30 seconds                   |

---

## Risk Mitigations

| Risk                                       | Mitigation                                    |
| ------------------------------------------ | --------------------------------------------- |
| Tree-sitter native compilation             | Use `web-tree-sitter` (WASM) as fallback      |
| Neither Claude Code nor OpenCode installed | Clear error message with install instructions |
| Analysis quality variance                  | Add quality checks, allow manual override     |
| Large repo timeout                         | Set file limits (500 files max for analysis)  |

---

## Deferred to V2

- MCP server
- Private repos (GitHub OAuth in CLI)
- Non-GitHub repos (GitLab, BitBucket)
- Language-specific analysis prompts
- Analysis versioning/history
- Team features
- TUI mode (`ow explore` command)
- `ow create-skill` command (skill from any CLI's JSON schema)

---

## Testing Strategy

**Goal:** Fast feedback loops during development. Tests should run in <10 seconds for unit tests.

**Reference:** See `history/testing-guide.md` for comprehensive testing documentation.

### Test Framework

- **Vitest** for all unit and integration tests
- **Bun test runner** as alternative (compatible with Vitest API)
- Tests live alongside source in `__tests__/` directories

### Test Structure by Package

```
packages/types/src/__tests__/
  schemas.test.ts           # Zod schema validation

packages/sdk/src/__tests__/
  config.test.ts            # Path utilities
  repo-source.test.ts       # Input parsing
  util.test.ts              # Binary detection, gitignore
  clone.test.ts             # Git operations (mocked)
  index-manager.test.ts     # Global index
  importance.test.ts        # File ranking
  ai-provider.test.ts       # Provider detection
  sync.test.ts              # API communication (mocked)
  analysis.test.ts          # Context gathering
  skill.test.ts             # SKILL.md formatting
  architecture.test.ts      # Mermaid generation
  fixtures/                 # Sample files for testing

apps/cli/src/__tests__/
  handlers.test.ts          # CLI command handlers

packages/backend/convex/__tests__/
  analyses.test.ts          # Convex function logic
```

### Running Tests

```bash
# All tests
bun run test

# Single package
bun run test --filter=@offworld/sdk

# Watch mode during development
bun run test:watch

# With coverage
bun run test:coverage
```

### Test-Driven Development Order

Write tests alongside implementation for each phase:

| Phase | Implementation    | Tests                                   |
| ----- | ----------------- | --------------------------------------- |
| 2     | packages/types    | T2.1: Schema validation                 |
| 3     | packages/sdk      | T3.1-T3.8: All SDK modules              |
| 4     | apps/cli          | T4.1: Handler tests                     |
| 5     | Analysis pipeline | T5.1-T5.3: Context, skill, architecture |
| 7     | Backend           | T7.1: Convex functions                  |

### Mocking Strategy

| Dependency          | Mock Approach                             |
| ------------------- | ----------------------------------------- |
| `execa` (git)       | Mock module, verify args                  |
| `fetch` (API)       | Mock global fetch, return fixtures        |
| `fs-extra`          | Mock for unit tests, real for integration |
| Claude/OpenCode SDK | Mock clients, return structured fixtures  |

### Phase-Specific Test Requirements

**After Phase 2 (types):**

- [ ] All schemas have validation tests
- [ ] `bun test` passes in packages/types

**After Phase 3 (SDK):**

- [ ] All SDK modules have unit tests
- [ ] Mocks configured for git and fetch
- [ ] `bun test` passes in packages/sdk

**After Phase 4 (CLI):**

- [ ] Handler tests cover happy paths
- [ ] Error cases tested
- [ ] `bun test` passes in apps/cli

**Before Launch:**

- [ ] All test items in PRD.md pass
- [ ] Coverage >80% for SDK
- [ ] No flaky tests

---

## Quick Reference

| What             | Where                                  |
| ---------------- | -------------------------------------- |
| Zod schemas      | `packages/types/src/schemas.ts`        |
| Path utilities   | `packages/sdk/src/config.ts`           |
| Git operations   | `packages/sdk/src/clone.ts`            |
| File ranking     | `packages/sdk/src/importance/index.ts` |
| AI analysis      | `packages/sdk/src/analysis.ts`         |
| Skill generation | `packages/sdk/src/skill.ts`            |
| CLI router       | `apps/cli/src/index.ts`                |
| CLI entry        | `apps/cli/src/cli.ts`                  |
| Plugin           | `packages/plugin/src/index.ts`         |
| Test guide       | `history/testing-guide.md`             |
| PRD items        | `PRD.md`                               |

---

_Pattern sources: `create-better-t-stack`, `research/stolen-patterns.md`_
