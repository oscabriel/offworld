{
"branchName": "ralph/cli-analysis-enhancements",
"userStories": [
{
"id": "US-001",
"title": "Language Registration & Detection",
"acceptanceCriteria": [
"Create packages/sdk/src/ast/index.ts",
"initLanguages() registers python, rust, go, java via registerDynamicLanguage",
"LANG_MAP covers .ts, .tsx, .js, .jsx, .mjs, .cjs, .html, .css, .py, .rs, .go, .java",
"detectLanguage() returns correct Lang enum or string for supported extensions",
"detectLanguage() returns null for unsupported extensions",
"initLanguages() is idempotent (safe to call multiple times)",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "Phase 1.1 - Foundation for AST parsing"
},
{
"id": "US-002",
"title": "File Parsing & Symbol Extraction",
"acceptanceCriteria": [
"Create packages/sdk/src/ast/parser.ts",
"ExtractedSymbol interface with name, kind, line, signature?, isAsync?, isExported?",
"ParsedFile interface with path, language, functions, classes, imports, exports, hasTests",
"parseFile() returns ParsedFile for supported languages",
"parseFile() returns null for unsupported languages or syntax errors",
"extractSymbols() extracts function/class names with line numbers",
"extractImports() extracts import paths from all supported patterns",
"extractExports() handles language-specific export patterns",
"detectTests() identifies test files by path or content patterns",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "Phase 1.2 - Core parsing logic"
},
{
"id": "US-003",
"title": "AST Patterns Per Language",
"acceptanceCriteria": [
"Create packages/sdk/src/ast/patterns.ts",
"FUNCTION_PATTERNS covers typescript, javascript, python, rust, go, java",
"CLASS_PATTERNS covers typescript, javascript, python, rust, go, java",
"IMPORT_PATTERNS covers typescript, javascript, python, rust, go, java",
"Patterns use ast-grep syntax with $NAME, $$$, $PATH metavariables",
"TypeScript patterns include async variants and export variants",
"Python patterns include async def",
"Rust patterns include pub variants",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "Phase 1.3 - Language-specific AST patterns"
},
{
"id": "US-004",
"title": "Deterministic Skeleton Builder",
"acceptanceCriteria": [
"Create packages/sdk/src/analysis/skeleton.ts",
"SkillSkeleton interface with name, repoPath, quickPaths, searchPatterns, entities, detectedPatterns",
"buildSkeleton() produces skeleton from topFiles and parsedFiles",
"buildQuickPaths() uses top 20 files, enhances reason with export/function counts",
"buildSearchPatterns() extracts top 10 symbol names, filters out short/generic names",
"buildEntities() groups files by top-level directory, excludes node_modules/.git/dist",
"detectPatterns() identifies framework, language, hasTests, hasDocs",
"detectFramework() identifies React, Next.js, Vue, Express, FastAPI, etc.",
"No AI calls in this module (purely deterministic)",
"typecheck passes"
],
"priority": 2,
"passes": true,
"notes": "Phase 2.1 - Deterministic structure generation"
},
{
"id": "US-005",
"title": "Prose Enhancement via AI",
"acceptanceCriteria": [
"Create packages/sdk/src/analysis/prose.ts",
"ProseEnhancementsSchema validates summary (min 50 chars), whenToUse (min 3), entityDescriptions, relationships",
"generateProseEnhancements() sends skeleton + context to AI",
"Prompt specifies JSON-only output with EXACT schema",
"Prompt includes entity names for validation",
"extractJSON() handles direct JSON, ```json blocks, and object boundary extraction",
"Zod validation enforces schema on AI response",
"Options support onDebug and onStream callbacks",
"typecheck passes"
],
"priority": 2,
"passes": true,
"notes": "Phase 2.2 - AI generates prose only, not structure"
},
{
"id": "US-006",
"title": "Skeleton + Prose Merge",
"acceptanceCriteria": [
"Create packages/sdk/src/analysis/merge.ts",
"mergeProseIntoSkeleton() produces Skill type from skeleton + prose",
"Relationships filtered to only include valid entity references",
"quickPaths use ${REPO}/ prefix",
"searchPatterns include pattern and scoped path",
"entities include description from prose.entityDescriptions",
"keyFiles mapped with 'implementation' role",
"Output includes empty bestPractices and commonPatterns arrays",
"typecheck passes"
],
"priority": 2,
"passes": true,
"notes": "Phase 2.3 - Combines deterministic structure with AI prose"
},
{
"id": "US-007",
"title": "Self-Consistency Validation",
"acceptanceCriteria": [
"Create packages/sdk/src/validation/consistency.ts",
"ConsistencyIssue with type (orphaned_reference|missing_description|invalid_relationship), severity, message",
"ConsistencyReport with passed boolean and issues array",
"validateConsistency() checks all entities have descriptions",
"validateConsistency() flags descriptions for non-existent entities as errors",
"validateConsistency() flags relationships referencing non-existent entities as errors",
"passed is false if any error-severity issues exist",
"typecheck passes"
],
"priority": 3,
"passes": true,
"notes": "Phase 3.1 - Validates AI prose against deterministic skeleton"
},
{
"id": "US-008",
"title": "Prose Quality Validation",
"acceptanceCriteria": [
"Create packages/sdk/src/validation/quality.ts",
"QualityReport with passed boolean and issues array",
"validateProseQuality() checks summary length >= 50",
"validateProseQuality() flags generic summary phrasing",
"validateProseQuality() checks whenToUse has >= 3 items",
"validateProseQuality() flags short use cases (< 20 chars)",
"validateProseQuality() flags short entity descriptions (< 20 chars)",
"validateProseQuality() flags generic entity description phrasing",
"typecheck passes"
],
"priority": 3,
"passes": true,
"notes": "Phase 3.2 - Ensures AI prose meets quality standards"
},
{
"id": "US-009",
"title": "Single Retry on Prose Failure",
"acceptanceCriteria": [
"generateProseWithRetry() in packages/sdk/src/analysis/generate.ts or prose.ts",
"First attempt runs generateProseEnhancements normally",
"Quality validation runs after first attempt",
"If quality fails, single retry with feedback prompt",
"If JSON parse fails, single retry without feedback",
"onDebug called with retry reason",
"Max 2 total attempts (1 original + 1 retry)",
"typecheck passes"
],
"priority": 3,
"passes": true,
"notes": "Phase 3.3 - Limited retry logic for prose generation"
},
{
"id": "US-010",
"title": "Dependency Graph from Imports",
"acceptanceCriteria": [
"Create packages/sdk/src/analysis/imports.ts",
"ImportEdge with source, target, type (import|require)",
"DependencyGraph with nodes, edges, hubs, leaves",
"buildDependencyGraph() extracts edges from parsedFiles imports",
"resolveImport() resolves relative imports to actual file paths",
"resolveImport() tries common extensions (.ts, .tsx, .js, etc.)",
"resolveImport() returns null for external packages",
"hubs sorted by inDegree (most imported files)",
"leaves sorted by outDegree (most dependencies)",
"typecheck passes"
],
"priority": 4,
"passes": true,
"notes": "Phase 4.1 - Build import graph for relationship discovery"
},
{
"id": "US-011",
"title": "Incremental Update Detection",
"acceptanceCriteria": [
"Create packages/sdk/src/analysis/incremental.ts",
"FileState with hash, lastParsed, symbolCount",
"IncrementalState with version, commitSha, files record",
"ChangeReport with added, modified, deleted, unchanged arrays and shouldFullReanalyze flag",
"hashFile() returns truncated SHA256",
"detectChanges() compares current files against previous state",
"detectChanges() returns all added if no previous state",
"shouldFullReanalyze true if key files changed (package.json, tsconfig, etc.)",
"shouldFullReanalyze true if change ratio > 30%",
"buildIncrementalState() creates state from current parsed files",
"typecheck passes"
],
"priority": 4,
"passes": true,
"notes": "Phase 5 - Enables incremental analysis for faster reruns"
},
{
"id": "US-012",
"title": "Updated Analysis Pipeline Integration",
"acceptanceCriteria": [
"Modify packages/sdk/src/analysis/pipeline.ts",
"runAnalysisPipeline() calls initLanguages() first",
"Pipeline discovers and parses files with parseFile()",
"Pipeline calls rankFilesWithAST() (enhanced heuristics)",
"Pipeline builds skeleton with buildSkeleton()",
"Pipeline generates prose with generateProseWithRetry()",
"Pipeline validates with validateConsistency()",
"Pipeline merges with mergeProseIntoSkeleton()",
"Pipeline builds dependency graph with buildDependencyGraph()",
"Pipeline builds incremental state with buildIncrementalState()",
"Return includes skill, graph, incrementalState, stats",
"Stats include filesParsed, symbolsExtracted, entitiesCreated",
"typecheck passes"
],
"priority": 5,
"passes": true,
"notes": "Final integration - wires all phases together"
},
{
"id": "US-013",
"title": "AST-Enhanced File Heuristics",
"acceptanceCriteria": [
"Modify packages/sdk/src/analysis/heuristics.ts",
"rankFilesWithAST() accepts parsedFiles map",
"File scores boosted by export count",
"File scores boosted by function count",
"Files with hasTests flagged appropriately",
"Existing heuristic scoring preserved (entry points, config, etc.)",
"typecheck passes"
],
"priority": 2,
"passes": true,
"notes": "Enhance existing heuristics with AST data"
},
{
"id": "US-014",
"title": "Add AST-Grep Dependencies",
"acceptanceCriteria": [
"@ast-grep/napi ^0.37.0 added to packages/sdk/package.json",
"@ast-grep/lang-python ^0.4.0 added",
"@ast-grep/lang-rust ^0.4.0 added",
"@ast-grep/lang-go ^0.4.0 added",
"@ast-grep/lang-java ^0.4.0 added",
"bun install succeeds",
"No peer dependency warnings for ast-grep packages"
],
"priority": 1,
"passes": true,
"notes": "Prerequisites for AST parsing"
}
]
}
