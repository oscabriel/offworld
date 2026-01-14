# Offworld CLI Analysis Pipeline Enhancements

## Executive Summary

The offworld CLI's analysis pipeline produces functional but inconsistent outputs. The core issue: AI generates everything (structure + prose), leading to hallucinated paths, missing patterns, and inconsistent quality.

**Solution**: Deterministic structure via AST parsing + AI for prose only.

**Current State**: Single-shot AI generation, no code parsing, path-existence-only validation.
**Target State**: AST-powered skeleton generation, AI prose enhancement, validated merge.

**Quality Impact**: 3/10 → 8/10

---

## Architecture Overview

### Current Flow (AI-Everything)

```
repoPath → heuristics → gatherContext → AI generates full SKILL.md → parse markdown → save
                                              ↑
                                    (hallucinations, inconsistent structure)
```

### New Flow (Deterministic + AI Prose)

```
repoPath
    ↓
[AST] parseFiles() → ParsedFile[] (functions, classes, imports, exports)
    ↓
[Deterministic] buildSkeleton() → SkillSkeleton
    - quickPaths: top-ranked files from heuristics + AST
    - searchPatterns: extracted symbol names as regex
    - entities: directory structure + detected patterns
    - keyFiles: files with most exports/imports
    ↓
[AI] generateProseEnhancements() → ProseEnhancements (JSON only)
    - summary, whenToUse, entityDescriptions, relationships
    ↓
[Merge] mergeProseIntoSkeleton() → Skill
    ↓
[Validate] Zod schema validation → save
```

**Key Insight**: AI cannot corrupt structure. It only adds descriptions.

---

## Competitive Analysis

### Skill Seekers

- **Approach**: Python AST + regex for 8 other languages
- **Adopted**: Multi-language parsing concept, conflict detection pattern
- **Improved**: Using ast-grep (faster, TypeScript-native, 25+ languages)

### LogicStamp Context

- **Approach**: "Deterministic for structure, AI for prose"
- **Adopted**: Skeleton-first generation, JSON schema validation

### Arbor

- **Approach**: Graph-native code intelligence
- **Adopted**: Dependency graph from imports, incremental updates

---

## Language Support

Using `@ast-grep/napi` for TypeScript-first multi-language parsing:

| Language   | Package                 | Type              | Status |
| ---------- | ----------------------- | ----------------- | ------ |
| TypeScript | Built-in                | `Lang.TypeScript` | Ready  |
| JavaScript | Built-in                | `Lang.JavaScript` | Ready  |
| TSX        | Built-in                | `Lang.Tsx`        | Ready  |
| HTML       | Built-in                | `Lang.Html`       | Ready  |
| CSS        | Built-in                | `Lang.Css`        | Ready  |
| Python     | `@ast-grep/lang-python` | External          | Ready  |
| Rust       | `@ast-grep/lang-rust`   | External          | Ready  |
| Go         | `@ast-grep/lang-go`     | External          | Ready  |
| Java       | `@ast-grep/lang-java`   | External          | Ready  |

---

## Implementation Plan

### Phase 1: AST Foundation (Week 1-2)

#### 1.1 Language Registration & Detection

**New File**: `packages/sdk/src/ast/index.ts`

```typescript
import { Lang, parse, registerDynamicLanguage } from "@ast-grep/napi";
import python from "@ast-grep/lang-python";
import rust from "@ast-grep/lang-rust";
import go from "@ast-grep/lang-go";
import java from "@ast-grep/lang-java";

let initialized = false;

export function initLanguages(): void {
	if (initialized) return;
	registerDynamicLanguage({ python, rust, go, java });
	initialized = true;
}

export const LANG_MAP: Record<string, string | Lang> = {
	// Built-in
	".ts": Lang.TypeScript,
	".tsx": Lang.Tsx,
	".js": Lang.JavaScript,
	".jsx": Lang.JavaScript,
	".mjs": Lang.JavaScript,
	".cjs": Lang.JavaScript,
	".html": Lang.Html,
	".css": Lang.Css,
	// External
	".py": "python",
	".rs": "rust",
	".go": "go",
	".java": "java",
};

export function detectLanguage(filePath: string): string | Lang | null {
	const ext = path.extname(filePath).toLowerCase();
	return LANG_MAP[ext] ?? null;
}
```

---

#### 1.2 File Parsing & Symbol Extraction

**New File**: `packages/sdk/src/ast/parser.ts`

```typescript
import { parse, SgNode, Lang } from "@ast-grep/napi";
import { detectLanguage } from "./index.js";
import { FUNCTION_PATTERNS, CLASS_PATTERNS, IMPORT_PATTERNS } from "./patterns.js";

export interface ExtractedSymbol {
	name: string;
	kind: "function" | "class" | "method" | "type" | "interface";
	line: number;
	signature?: string;
	isAsync?: boolean;
	isExported?: boolean;
}

export interface ParsedFile {
	path: string;
	language: string | Lang;
	functions: ExtractedSymbol[];
	classes: ExtractedSymbol[];
	imports: string[];
	exports: string[];
	hasTests: boolean;
}

export function parseFile(filePath: string, content: string): ParsedFile | null {
	const lang = detectLanguage(filePath);
	if (!lang) return null;

	try {
		const root = parse(lang, content).root();
		const langKey = typeof lang === "string" ? lang : lang.toString().toLowerCase();

		return {
			path: filePath,
			language: lang,
			functions: extractSymbols(root, FUNCTION_PATTERNS[langKey] ?? [], "function"),
			classes: extractSymbols(root, CLASS_PATTERNS[langKey] ?? [], "class"),
			imports: extractImports(root, IMPORT_PATTERNS[langKey] ?? []),
			exports: extractExports(root, langKey),
			hasTests: detectTests(filePath, content),
		};
	} catch (err) {
		// Syntax error or unsupported - skip file
		return null;
	}
}

function extractSymbols(
	root: SgNode,
	patterns: string[],
	kind: ExtractedSymbol["kind"],
): ExtractedSymbol[] {
	const symbols: ExtractedSymbol[] = [];

	for (const pattern of patterns) {
		for (const match of root.findAll(pattern)) {
			const nameNode = match.getMatch("NAME");
			if (!nameNode) continue;

			symbols.push({
				name: nameNode.text(),
				kind,
				line: match.range().start.line,
				isAsync: match.text().includes("async"),
				isExported: match.text().startsWith("export") || match.text().startsWith("pub"),
			});
		}
	}

	return symbols;
}

function extractImports(root: SgNode, patterns: string[]): string[] {
	const imports: string[] = [];

	for (const pattern of patterns) {
		for (const match of root.findAll(pattern)) {
			const pathNode = match.getMatch("PATH") ?? match.getMatch("MODULE");
			if (pathNode) {
				imports.push(pathNode.text().replace(/['"]/g, ""));
			}
		}
	}

	return imports;
}

function extractExports(root: SgNode, langKey: string): string[] {
	// Language-specific export extraction
	const exportPatterns: Record<string, string[]> = {
		typescript: ["export $$$DECL", "export default $$$"],
		javascript: ["export $$$DECL", "module.exports = $$$"],
		python: [], // Python doesn't have explicit exports
		rust: ["pub $$$DECL"],
		go: [], // Go exports via capitalization (detected in symbols)
		java: ["public $$$DECL"],
	};

	const patterns = exportPatterns[langKey] ?? [];
	const exports: string[] = [];

	for (const pattern of patterns) {
		for (const match of root.findAll(pattern)) {
			exports.push(match.text().slice(0, 100)); // Truncate for storage
		}
	}

	return exports;
}

function detectTests(filePath: string, content: string): boolean {
	const testPathPatterns = /\.(test|spec)\.[jt]sx?$|__tests__|tests?\//i;
	const testContentPatterns = /\b(describe|it|test|expect|assert)\s*\(/;

	return testPathPatterns.test(filePath) || testContentPatterns.test(content);
}
```

---

#### 1.3 AST Patterns Per Language

**New File**: `packages/sdk/src/ast/patterns.ts`

```typescript
export const FUNCTION_PATTERNS: Record<string, string[]> = {
	typescript: [
		"function $NAME($$$) { $$$ }",
		"async function $NAME($$$) { $$$ }",
		"const $NAME = ($$$) => $$$",
		"const $NAME = async ($$$) => $$$",
		"export function $NAME($$$) { $$$ }",
		"export async function $NAME($$$) { $$$ }",
	],
	javascript: [
		"function $NAME($$$) { $$$ }",
		"async function $NAME($$$) { $$$ }",
		"const $NAME = ($$$) => $$$",
		"const $NAME = async ($$$) => $$$",
	],
	python: ["def $NAME($$$): $$$", "async def $NAME($$$): $$$"],
	rust: [
		"fn $NAME($$$) $$$",
		"pub fn $NAME($$$) $$$",
		"async fn $NAME($$$) $$$",
		"pub async fn $NAME($$$) $$$",
	],
	go: ["func $NAME($$$) $$$", "func ($RECV) $NAME($$$) $$$"],
	java: [
		"public $TYPE $NAME($$$) { $$$ }",
		"private $TYPE $NAME($$$) { $$$ }",
		"protected $TYPE $NAME($$$) { $$$ }",
	],
};

export const CLASS_PATTERNS: Record<string, string[]> = {
	typescript: [
		"class $NAME { $$$ }",
		"class $NAME extends $BASE { $$$ }",
		"export class $NAME { $$$ }",
		"interface $NAME { $$$ }",
		"type $NAME = $$$",
	],
	javascript: ["class $NAME { $$$ }", "class $NAME extends $BASE { $$$ }"],
	python: ["class $NAME: $$$", "class $NAME($$$): $$$"],
	rust: [
		"struct $NAME { $$$ }",
		"pub struct $NAME { $$$ }",
		"enum $NAME { $$$ }",
		"trait $NAME { $$$ }",
	],
	go: ["type $NAME struct { $$$ }", "type $NAME interface { $$$ }"],
	java: ["class $NAME { $$$ }", "public class $NAME { $$$ }", "interface $NAME { $$$ }"],
};

export const IMPORT_PATTERNS: Record<string, string[]> = {
	typescript: [
		'import $$$SPEC from "$PATH"',
		'import "$PATH"',
		'import type $$$SPEC from "$PATH"',
		'require("$PATH")',
	],
	javascript: ['import $$$SPEC from "$PATH"', 'import "$PATH"', 'require("$PATH")'],
	python: ["import $MODULE", "from $MODULE import $$$"],
	rust: ["use $PATH;", "use $PATH::{$$$};"],
	go: ['import "$PATH"'],
	java: ["import $PATH;"],
};
```

---

### Phase 2: Skeleton Generation (Week 2-3)

#### 2.1 Deterministic Skeleton Builder

**New File**: `packages/sdk/src/analysis/skeleton.ts`

```typescript
import type { ParsedFile, ExtractedSymbol } from "../ast/parser.js";
import type { FileIndexEntry } from "./heuristics.js";

export interface SkillSkeleton {
	name: string;
	repoPath: string;
	quickPaths: Array<{ path: string; reason: string }>;
	searchPatterns: Array<{ pattern: string; scope: string }>;
	entities: Array<{
		name: string;
		path: string;
		keyFiles: string[];
		symbolCount: number;
	}>;
	detectedPatterns: {
		framework?: string;
		language?: string;
		hasTests: boolean;
		hasDocs: boolean;
	};
}

export function buildSkeleton(
	repoPath: string,
	repoName: string,
	topFiles: FileIndexEntry[],
	parsedFiles: Map<string, ParsedFile>,
): SkillSkeleton {
	return {
		name: repoName,
		repoPath,
		quickPaths: buildQuickPaths(topFiles, parsedFiles),
		searchPatterns: buildSearchPatterns(parsedFiles),
		entities: buildEntities(repoPath, parsedFiles),
		detectedPatterns: detectPatterns(parsedFiles),
	};
}

function buildQuickPaths(
	topFiles: FileIndexEntry[],
	parsedFiles: Map<string, ParsedFile>,
): SkillSkeleton["quickPaths"] {
	const paths: SkillSkeleton["quickPaths"] = [];

	for (const file of topFiles.slice(0, 20)) {
		const parsed = parsedFiles.get(file.path);
		let reason = file.role;

		// Enhance reason with AST info
		if (parsed) {
			const exportCount = parsed.exports.length;
			const fnCount = parsed.functions.length;
			if (exportCount > 5) reason += `, ${exportCount} exports`;
			if (fnCount > 3) reason += `, ${fnCount} functions`;
		}

		paths.push({ path: file.path, reason });
	}

	return paths;
}

function buildSearchPatterns(
	parsedFiles: Map<string, ParsedFile>,
): SkillSkeleton["searchPatterns"] {
	const symbolCounts = new Map<string, number>();
	const symbolScopes = new Map<string, string>();

	// Count symbol occurrences and track their scopes
	for (const [filePath, parsed] of parsedFiles) {
		const scope = filePath.split("/").slice(0, -1).join("/") || "root";

		for (const fn of parsed.functions) {
			symbolCounts.set(fn.name, (symbolCounts.get(fn.name) ?? 0) + 1);
			symbolScopes.set(fn.name, scope);
		}
		for (const cls of parsed.classes) {
			symbolCounts.set(cls.name, (symbolCounts.get(cls.name) ?? 0) + 1);
			symbolScopes.set(cls.name, scope);
		}
	}

	// Take most common/important symbols
	const sortedSymbols = [...symbolCounts.entries()]
		.filter(([name]) => name.length > 2 && !/^(get|set|is|has)$/.test(name))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

	return sortedSymbols.map(([name]) => ({
		pattern: name,
		scope: symbolScopes.get(name) ?? "src",
	}));
}

function buildEntities(
	repoPath: string,
	parsedFiles: Map<string, ParsedFile>,
): SkillSkeleton["entities"] {
	// Group files by top-level directory
	const dirGroups = new Map<string, ParsedFile[]>();

	for (const [filePath, parsed] of parsedFiles) {
		const parts = filePath.replace(repoPath, "").split("/").filter(Boolean);
		const topDir = parts[0] ?? "root";

		if (!dirGroups.has(topDir)) {
			dirGroups.set(topDir, []);
		}
		dirGroups.get(topDir)!.push(parsed);
	}

	// Build entities from directory groups
	return [...dirGroups.entries()]
		.filter(([dir]) => !["node_modules", ".git", "dist"].includes(dir))
		.map(([dir, files]) => {
			const allSymbols = files.flatMap((f) => [...f.functions, ...f.classes]);
			const keyFiles = files
				.sort(
					(a, b) => b.exports.length + b.functions.length - (a.exports.length + a.functions.length),
				)
				.slice(0, 5)
				.map((f) => f.path.split("/").pop()!);

			return {
				name: dir,
				path: dir,
				keyFiles,
				symbolCount: allSymbols.length,
			};
		})
		.filter((e) => e.symbolCount > 0)
		.sort((a, b) => b.symbolCount - a.symbolCount);
}

function detectPatterns(parsedFiles: Map<string, ParsedFile>): SkillSkeleton["detectedPatterns"] {
	const allImports = [...parsedFiles.values()].flatMap((f) => f.imports);
	const allFiles = [...parsedFiles.keys()];

	return {
		framework: detectFramework(allImports),
		language: detectPrimaryLanguage(parsedFiles),
		hasTests: [...parsedFiles.values()].some((f) => f.hasTests),
		hasDocs: allFiles.some((f) => /readme|docs?|documentation/i.test(f)),
	};
}

function detectFramework(imports: string[]): string | undefined {
	const frameworks: Record<string, string[]> = {
		React: ["react", "react-dom"],
		"Next.js": ["next"],
		Vue: ["vue"],
		Svelte: ["svelte"],
		Express: ["express"],
		Fastify: ["fastify"],
		NestJS: ["@nestjs/core"],
		Django: ["django"],
		FastAPI: ["fastapi"],
		Actix: ["actix-web"],
		Axum: ["axum"],
	};

	for (const [name, patterns] of Object.entries(frameworks)) {
		if (patterns.some((p) => imports.some((i) => i.includes(p)))) {
			return name;
		}
	}
	return undefined;
}

function detectPrimaryLanguage(parsedFiles: Map<string, ParsedFile>): string {
	const langCounts = new Map<string, number>();

	for (const parsed of parsedFiles.values()) {
		const lang = typeof parsed.language === "string" ? parsed.language : parsed.language.toString();
		langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
	}

	return [...langCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}
```

---

#### 2.2 Prose Enhancement via OpenCode

**New File**: `packages/sdk/src/analysis/prose.ts`

````typescript
import { z } from "zod";
import { streamPrompt } from "../ai/index.js";
import type { SkillSkeleton } from "./skeleton.js";
import type { GatheredContext } from "./context.js";
import { formatContextForPrompt } from "./context.js";

export const ProseEnhancementsSchema = z.object({
	summary: z.string().min(50),
	whenToUse: z.array(z.string()).min(3),
	entityDescriptions: z.record(z.string().min(10)),
	relationships: z.array(
		z.object({
			from: z.string(),
			to: z.string(),
			description: z.string().min(10),
		}),
	),
});

export type ProseEnhancements = z.infer<typeof ProseEnhancementsSchema>;

export interface ProseOptions {
	onDebug?: (message: string) => void;
	onStream?: (text: string) => void;
}

export async function generateProseEnhancements(
	skeleton: SkillSkeleton,
	context: GatheredContext,
	options: ProseOptions = {},
): Promise<ProseEnhancements> {
	const entityNames = skeleton.entities.map((e) => e.name);

	const prompt = `<skeleton>
${JSON.stringify(skeleton, null, 2)}
</skeleton>

<context>
${formatContextForPrompt(context)}
</context>

<task>
You are enhancing a code navigation skill with prose descriptions.
The skeleton above contains the STRUCTURE (paths, patterns, entities).
You provide ONLY the prose: descriptions, summaries, relationships.

Return a JSON object matching this EXACT schema:
{
  "summary": "2-3 sentence overview explaining what this project does and why it matters",
  "whenToUse": [
    "specific task or question this skill helps with",
    "another specific use case",
    "at least 3 use cases"
  ],
  "entityDescriptions": {
    ${entityNames.map((n) => `"${n}": "what this module/directory does and contains"`).join(",\n    ")}
  },
  "relationships": [
    { "from": "EntityA", "to": "EntityB", "description": "how A depends on or relates to B" }
  ]
}

RULES:
- Output ONLY valid JSON. No markdown fences, no commentary, no explanation.
- Entity names in descriptions must match exactly: ${entityNames.join(", ")}
- Be specific and technical, not generic. Reference actual code patterns you see.
- Relationships should reflect real dependencies (imports, inheritance, API calls).
</task>`;

	const result = await streamPrompt({
		prompt,
		cwd: context.repoPath,
		systemPrompt: "You are a technical writer. Output ONLY valid JSON.",
		onDebug: options.onDebug,
		onStream: options.onStream,
	});

	const json = extractJSON(result.text);
	return ProseEnhancementsSchema.parse(json);
}

function extractJSON(text: string): unknown {
	// Try direct parse
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {}

	// Extract from ```json blocks
	const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (jsonBlockMatch) {
		return JSON.parse(jsonBlockMatch[1].trim());
	}

	// Find JSON object boundaries
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start !== -1 && end > start) {
		return JSON.parse(trimmed.slice(start, end + 1));
	}

	throw new Error("No valid JSON found in AI response");
}
````

---

#### 2.3 Skeleton + Prose Merge

**New File**: `packages/sdk/src/analysis/merge.ts`

```typescript
import type { Skill } from "@offworld/types";
import type { SkillSkeleton } from "./skeleton.js";
import type { ProseEnhancements } from "./prose.js";

export function mergeProseIntoSkeleton(skeleton: SkillSkeleton, prose: ProseEnhancements): Skill {
	// Validate relationships reference real entities
	const entityNames = new Set(skeleton.entities.map((e) => e.name));
	const validRelationships = prose.relationships.filter(
		(rel) => entityNames.has(rel.from) && entityNames.has(rel.to),
	);

	return {
		name: skeleton.name,
		description: prose.summary,

		// Deterministic (from skeleton)
		basePaths: {
			repo: skeleton.repoPath,
			analysis: `~/.ow/analyses/${skeleton.name}`,
		},
		quickPaths: skeleton.quickPaths.map((qp) => ({
			path: `\${REPO}/${qp.path}`,
			description: qp.reason,
		})),
		searchPatterns: skeleton.searchPatterns.map((sp) => ({
			find: sp.pattern,
			pattern: sp.pattern,
			path: `\${REPO}/${sp.scope}`,
		})),

		// AI prose
		whenToUse: prose.whenToUse,

		// Merged entities
		entities: skeleton.entities.map((entity) => ({
			name: entity.name,
			type: "module" as const,
			path: entity.path,
			description: prose.entityDescriptions[entity.name] ?? "",
			keyFiles: entity.keyFiles.map((f) => ({ path: f, role: "implementation" })),
		})),

		// Validated relationships
		relationships: validRelationships.map((rel) => ({
			from: rel.from,
			to: rel.to,
			type: "depends-on",
			description: rel.description,
		})),

		// Optional sections (can be empty)
		bestPractices: [],
		commonPatterns: [],
	};
}
```

---

### Phase 3: Validation & Conflicts (Week 3-4)

#### 3.1 Self-Consistency Validation

**Clarification**: Our "conflict detection" validates AI-generated prose against the deterministic skeleton and actual repo structure. It's NOT multi-source reconciliation like Skill Seekers (which compares docs websites vs code).

**What we validate**:

- AI descriptions reference entities that exist in skeleton
- AI relationships only connect real entities
- AI doesn't claim patterns that AST didn't detect

**New File**: `packages/sdk/src/validation/consistency.ts`

```typescript
import type { Skill } from "@offworld/types";
import type { SkillSkeleton } from "../analysis/skeleton.js";
import type { ProseEnhancements } from "../analysis/prose.js";

export interface ConsistencyIssue {
	type: "orphaned_reference" | "missing_description" | "invalid_relationship";
	severity: "warning" | "error";
	message: string;
}

export interface ConsistencyReport {
	passed: boolean;
	issues: ConsistencyIssue[];
}

export function validateConsistency(
	skeleton: SkillSkeleton,
	prose: ProseEnhancements,
): ConsistencyReport {
	const issues: ConsistencyIssue[] = [];
	const entityNames = new Set(skeleton.entities.map((e) => e.name));

	// Check all entities have descriptions
	for (const entity of skeleton.entities) {
		if (!prose.entityDescriptions[entity.name]) {
			issues.push({
				type: "missing_description",
				severity: "warning",
				message: `Entity "${entity.name}" has no description`,
			});
		}
	}

	// Check descriptions don't reference non-existent entities
	for (const [name] of Object.entries(prose.entityDescriptions)) {
		if (!entityNames.has(name)) {
			issues.push({
				type: "orphaned_reference",
				severity: "error",
				message: `Description provided for non-existent entity "${name}"`,
			});
		}
	}

	// Check relationships reference real entities
	for (const rel of prose.relationships) {
		if (!entityNames.has(rel.from)) {
			issues.push({
				type: "invalid_relationship",
				severity: "error",
				message: `Relationship references non-existent entity "${rel.from}"`,
			});
		}
		if (!entityNames.has(rel.to)) {
			issues.push({
				type: "invalid_relationship",
				severity: "error",
				message: `Relationship references non-existent entity "${rel.to}"`,
			});
		}
	}

	return {
		passed: !issues.some((i) => i.severity === "error"),
		issues,
	};
}
```

---

#### 3.2 Prose Quality Validation

Since structure is deterministic, we only validate prose quality:

**New File**: `packages/sdk/src/validation/quality.ts`

```typescript
import type { ProseEnhancements } from "../analysis/prose.js";

export interface QualityReport {
	passed: boolean;
	issues: string[];
}

export function validateProseQuality(prose: ProseEnhancements): QualityReport {
	const issues: string[] = [];

	// Summary quality
	if (prose.summary.length < 50) {
		issues.push("Summary too short (< 50 chars)");
	}
	if (/^(this|the|a|an)\s+(is|project|repo)/i.test(prose.summary)) {
		issues.push("Summary starts with generic phrasing");
	}

	// whenToUse quality
	if (prose.whenToUse.length < 3) {
		issues.push("Fewer than 3 use cases provided");
	}
	const genericPhrases = ["when you need to", "if you want to", "to do"];
	for (const useCase of prose.whenToUse) {
		if (useCase.length < 20) {
			issues.push(`Use case too short: "${useCase}"`);
		}
	}

	// Entity descriptions quality
	for (const [name, desc] of Object.entries(prose.entityDescriptions)) {
		if (desc.length < 20) {
			issues.push(`Description for "${name}" too short`);
		}
		if (/^(this|contains|handles|manages)\s/i.test(desc)) {
			issues.push(`Description for "${name}" starts with generic phrasing`);
		}
	}

	return {
		passed: issues.length === 0,
		issues,
	};
}
```

---

#### 3.3 Single Retry on Failure

With deterministic structure, retry is simpler—we only regenerate prose:

```typescript
// In packages/sdk/src/analysis/generate.ts

export async function generateProseWithRetry(
	skeleton: SkillSkeleton,
	context: GatheredContext,
	options: ProseOptions = {},
): Promise<ProseEnhancements> {
	try {
		const prose = await generateProseEnhancements(skeleton, context, options);
		const quality = validateProseQuality(prose);

		if (quality.passed) {
			return prose;
		}

		// Single retry with feedback
		options.onDebug?.(`Quality issues: ${quality.issues.join(", ")}. Retrying...`);

		return generateProseEnhancements(skeleton, context, {
			...options,
			feedbackPrompt: `Previous attempt had issues: ${quality.issues.join("; ")}. Fix these.`,
		});
	} catch (err) {
		// On JSON parse failure, retry once
		options.onDebug?.(`Parse error: ${err}. Retrying...`);
		return generateProseEnhancements(skeleton, context, options);
	}
}
```

---

### Phase 4: Dependency Graph (Week 4-5)

#### 4.1 Import Graph from AST

Since we already extract imports in Phase 1, building the graph is straightforward:

**New File**: `packages/sdk/src/analysis/imports.ts`

```typescript
import type { ParsedFile } from "../ast/parser.js";

export interface ImportEdge {
	source: string;
	target: string;
	type: "import" | "require";
}

export interface DependencyGraph {
	nodes: string[];
	edges: ImportEdge[];
	hubs: Array<{ path: string; inDegree: number }>;
	leaves: Array<{ path: string; outDegree: number }>;
}

export function buildDependencyGraph(
	parsedFiles: Map<string, ParsedFile>,
	repoPath: string,
): DependencyGraph {
	const nodes = [...parsedFiles.keys()];
	const edges: ImportEdge[] = [];
	const inDegree = new Map<string, number>();
	const outDegree = new Map<string, number>();

	for (const [filePath, parsed] of parsedFiles) {
		for (const imp of parsed.imports) {
			const resolved = resolveImport(filePath, imp, nodes, repoPath);
			if (resolved) {
				edges.push({ source: filePath, target: resolved, type: "import" });
				inDegree.set(resolved, (inDegree.get(resolved) ?? 0) + 1);
				outDegree.set(filePath, (outDegree.get(filePath) ?? 0) + 1);
			}
		}
	}

	// Find hubs (most imported) and leaves (most dependencies)
	const hubs = [...inDegree.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([path, count]) => ({ path, inDegree: count }));

	const leaves = [...outDegree.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([path, count]) => ({ path, outDegree: count }));

	return { nodes, edges, hubs, leaves };
}

function resolveImport(
	fromPath: string,
	importPath: string,
	allPaths: string[],
	repoPath: string,
): string | null {
	// Skip external packages
	if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
		return null;
	}

	// Resolve relative imports
	const fromDir = fromPath.split("/").slice(0, -1).join("/");
	const resolved = new URL(importPath, `file://${fromDir}/`).pathname;

	// Try common extensions
	const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
	for (const ext of extensions) {
		const candidate = resolved + ext;
		if (allPaths.includes(candidate)) {
			return candidate;
		}
	}

	return null;
}
```

---

### Phase 5: Incremental Updates (Week 5-6)

**New File**: `packages/sdk/src/analysis/incremental.ts`

```typescript
import { createHash } from "crypto";
import type { ParsedFile } from "../ast/parser.js";

export interface FileState {
	hash: string;
	lastParsed: number;
	symbolCount: number;
}

export interface IncrementalState {
	version: string;
	commitSha: string;
	files: Record<string, FileState>;
}

export interface ChangeReport {
	added: string[];
	modified: string[];
	deleted: string[];
	unchanged: string[];
	shouldFullReanalyze: boolean;
}

export function hashFile(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function detectChanges(
	currentFiles: Map<string, string>, // path -> content
	previousState: IncrementalState | null,
): ChangeReport {
	const added: string[] = [];
	const modified: string[] = [];
	const deleted: string[] = [];
	const unchanged: string[] = [];

	if (!previousState) {
		return {
			added: [...currentFiles.keys()],
			modified: [],
			deleted: [],
			unchanged: [],
			shouldFullReanalyze: true,
		};
	}

	// Check current files
	for (const [path, content] of currentFiles) {
		const hash = hashFile(content);
		const prev = previousState.files[path];

		if (!prev) {
			added.push(path);
		} else if (prev.hash !== hash) {
			modified.push(path);
		} else {
			unchanged.push(path);
		}
	}

	// Check for deleted files
	for (const path of Object.keys(previousState.files)) {
		if (!currentFiles.has(path)) {
			deleted.push(path);
		}
	}

	// Determine if full re-analysis needed
	const keyFiles = ["package.json", "tsconfig.json", "Cargo.toml", "go.mod", "pyproject.toml"];
	const keyFileChanged = [...added, ...modified].some((p) => keyFiles.some((kf) => p.endsWith(kf)));

	const changeRatio = (added.length + modified.length + deleted.length) / (currentFiles.size || 1);

	return {
		added,
		modified,
		deleted,
		unchanged,
		shouldFullReanalyze: keyFileChanged || changeRatio > 0.3,
	};
}

export function buildIncrementalState(
	commitSha: string,
	parsedFiles: Map<string, ParsedFile>,
	fileContents: Map<string, string>,
): IncrementalState {
	const files: Record<string, FileState> = {};

	for (const [path, parsed] of parsedFiles) {
		const content = fileContents.get(path);
		if (content) {
			files[path] = {
				hash: hashFile(content),
				lastParsed: Date.now(),
				symbolCount: parsed.functions.length + parsed.classes.length,
			};
		}
	}

	return {
		version: "1.0",
		commitSha,
		files,
	};
}
```

---

## Updated Pipeline

**Modified File**: `packages/sdk/src/analysis/pipeline.ts`

```typescript
import { initLanguages } from "../ast/index.js";
import { parseFile } from "../ast/parser.js";
import { buildSkeleton } from "./skeleton.js";
import { generateProseWithRetry } from "./prose.js";
import { mergeProseIntoSkeleton } from "./merge.js";
import { validateConsistency } from "../validation/consistency.js";
import { buildDependencyGraph } from "./imports.js";
import { detectChanges, buildIncrementalState } from "./incremental.js";

export async function runAnalysisPipeline(options: PipelineOptions): Promise<AnalysisResult> {
	const { repoPath, repoName, onDebug } = options;

	// Initialize AST languages once
	initLanguages();

	// 1. Discover and parse files
	onDebug?.("Discovering files...");
	const files = await discoverFiles(repoPath);

	onDebug?.(`Parsing ${files.size} files...`);
	const parsedFiles = new Map<string, ParsedFile>();
	for (const [path, content] of files) {
		const parsed = parseFile(path, content);
		if (parsed) {
			parsedFiles.set(path, parsed);
		}
	}
	onDebug?.(`Parsed ${parsedFiles.size} files successfully`);

	// 2. Build heuristic rankings (enhanced with AST data)
	const fileIndex = rankFilesWithAST(repoPath, files, parsedFiles);

	// 3. Gather context for AI
	const context = await gatherContext(repoPath, repoName, fileIndex);

	// 4. Build deterministic skeleton
	onDebug?.("Building skeleton...");
	const skeleton = buildSkeleton(repoPath, repoName, fileIndex, parsedFiles);

	// 5. Generate prose enhancements (AI)
	onDebug?.("Generating prose...");
	const prose = await generateProseWithRetry(skeleton, context, { onDebug });

	// 6. Validate consistency
	const consistency = validateConsistency(skeleton, prose);
	if (!consistency.passed) {
		onDebug?.(`Consistency issues: ${consistency.issues.map((i) => i.message).join("; ")}`);
	}

	// 7. Merge into final skill
	const skill = mergeProseIntoSkeleton(skeleton, prose);

	// 8. Build dependency graph
	const graph = buildDependencyGraph(parsedFiles, repoPath);

	// 9. Build incremental state for next run
	const commitSha = await getCommitSha(repoPath);
	const incrementalState = buildIncrementalState(commitSha, parsedFiles, files);

	return {
		skill,
		graph,
		incrementalState,
		stats: {
			filesParsed: parsedFiles.size,
			symbolsExtracted: [...parsedFiles.values()].reduce(
				(sum, p) => sum + p.functions.length + p.classes.length,
				0,
			),
			entitiesCreated: skeleton.entities.length,
		},
	};
}
```

---

## File Changes Summary

### New Files (12)

| File                                         | Phase | Purpose                          |
| -------------------------------------------- | ----- | -------------------------------- |
| `packages/sdk/src/ast/index.ts`              | 1     | Language registration, detection |
| `packages/sdk/src/ast/parser.ts`             | 1     | File parsing, symbol extraction  |
| `packages/sdk/src/ast/patterns.ts`           | 1     | AST patterns per language        |
| `packages/sdk/src/analysis/skeleton.ts`      | 2     | Deterministic skeleton builder   |
| `packages/sdk/src/analysis/prose.ts`         | 2     | AI prose generation (JSON only)  |
| `packages/sdk/src/analysis/merge.ts`         | 2     | Skeleton + prose merge           |
| `packages/sdk/src/validation/consistency.ts` | 3     | Self-consistency validation      |
| `packages/sdk/src/validation/quality.ts`     | 3     | Prose quality checks             |
| `packages/sdk/src/analysis/imports.ts`       | 4     | Dependency graph building        |
| `packages/sdk/src/analysis/incremental.ts`   | 5     | Change detection, caching        |

### Modified Files (3)

| File                                      | Changes                     |
| ----------------------------------------- | --------------------------- |
| `packages/sdk/src/analysis/pipeline.ts`   | New AST-first flow          |
| `packages/sdk/src/analysis/heuristics.ts` | Add AST-enhanced scoring    |
| `packages/sdk/src/ai/opencode.ts`         | Add feedback prompt support |

### New Dependencies

```json
{
	"dependencies": {
		"@ast-grep/napi": "^0.37.0",
		"@ast-grep/lang-python": "^0.4.0",
		"@ast-grep/lang-rust": "^0.4.0",
		"@ast-grep/lang-go": "^0.4.0",
		"@ast-grep/lang-java": "^0.4.0"
	}
}
```

---

## Success Metrics

| Metric                  | Before   | After       | How                         |
| ----------------------- | -------- | ----------- | --------------------------- |
| Path hallucination rate | ~15%     | 0%          | Paths are deterministic     |
| Structure consistency   | Variable | 100%        | Skeleton is source of truth |
| Languages parsed        | 0        | 9           | AST extraction              |
| Symbols extracted       | 0        | 50-200/repo | Function + class count      |
| Retry rate              | N/A      | <10%        | Only prose failures         |
| Incremental cache hit   | 0%       | 80%+        | File hash matching          |

---

## Risk Mitigation

| Risk                           | Mitigation                             |
| ------------------------------ | -------------------------------------- |
| AST parsing slow               | Limit to 500 files, parallel parsing   |
| Lang package missing prebuilds | Fall back to tree-sitter-cli           |
| AI returns invalid JSON        | extractJSON() with multiple strategies |
| Prose quality low              | Single retry with feedback             |
| Incremental state corruption   | Fall back to full analysis             |

---

## References

- [ast-grep](https://ast-grep.github.io/) - Multi-language AST tool
- [@ast-grep/napi](https://www.npmjs.com/package/@ast-grep/napi) - Node.js bindings
- [Skill Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) - Multi-lang parsing patterns
- [OpenCode SDK](https://github.com/anomalyco/opencode-sdk-js) - AI integration
