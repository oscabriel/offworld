{
"branchName": "fix/analysis-pipeline",
"userStories": [
{
"id": "US-001",
"title": "Fix buildSkeleton argument order",
"acceptanceCriteria": [
"buildSkeleton called with (repoPath, repoName, ...) not (repoName, repoPath, ...)",
"skeleton.name contains repo name only (e.g. 'query'), not full path",
"skeleton.repoPath contains full path",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "Line 396 in pipeline.ts has arguments swapped"
},
{
"id": "US-002",
"title": "Disable user plugins/MCPs in embedded OpenCode server",
"acceptanceCriteria": [
"Config passed to createOpencodeServer includes plugin: []",
"Config passed to createOpencodeServer includes mcp: {}",
"Config passed to createOpencodeServer includes instructions: []",
"AI response does not contain [search-mode], [SUPERMEMORY], or other injected prompts",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "User-level OpenCode config was loading custom plugins into embedded server"
},
{
"id": "US-003",
"title": "Pass qualifiedName through analysis pipeline",
"acceptanceCriteria": [
"AnalysisPipelineOptions interface has qualifiedName?: string field",
"runAnalysisPipeline accepts and passes qualifiedName to buildSkeleton",
"pullHandler passes source.fullName (e.g. 'tanstack/query') for remote repos",
"pullHandler passes source.name for local repos",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "Enables proper naming throughout pipeline"
},
{
"id": "US-004",
"title": "Fix analysis path encoding",
"acceptanceCriteria": [
"mergeProseIntoSkeleton receives qualifiedName parameter",
"skill.basePaths.analysis uses qualifiedName for path key",
"Analysis path for tanstack/query is ${HOME}/.ow/analyses/tanstack--query",
"Analysis path does NOT contain --Users-- or other local path fragments",
"typecheck passes"
],
"priority": 1,
"passes": true,
"notes": "Depends on US-003"
},
{
"id": "US-005",
"title": "Remove framework detection, keep language only",
"acceptanceCriteria": [
"detectFramework function removed from skeleton.ts",
"DetectedPatterns interface only has: language, hasTests, hasDocs",
"No framework field in DetectedPatterns",
"detectLanguage function remains and works correctly",
"typecheck passes"
],
"priority": 2,
"passes": true,
"notes": "CLI targets library analysis, framework detection adds noise"
},
{
"id": "US-006",
"title": "Update prose prompt to remove framework references",
"acceptanceCriteria": [
"buildProsePrompt does not include Framework: field",
"Prompt only includes Language: field for language context",
"No framework-specific requirements in prompt",
"typecheck passes"
],
"priority": 2,
"passes": true,
"notes": "Depends on US-005"
},
{
"id": "US-007",
"title": "Improve search pattern generation for libraries",
"acceptanceCriteria": [
"buildSearchPatterns separates library code from example directories",
"Example directories identified: examples, demo, playground, samples, e2e, test",
"Library patterns prioritized over example patterns (7 library, 3 example max)",
"Generic patterns like 'Page', 'Loading', 'Example' deprioritized",
"typecheck passes"
],
"priority": 3,
"passes": true,
"notes": "Polish improvement for better pattern quality"
},
{
"id": "US-008",
"title": "Add integration tests for analysis pipeline",
"acceptanceCriteria": [
"Test file exists at packages/sdk/src/__tests__/pipeline.integration.test.ts",
"Test verifies skill.name uses qualifiedName not local path",
"Test verifies AI response contains valid JSON without prompt leakage",
"Test verifies language detection works",
"All tests pass with vitest"
],
"priority": 3,
"passes": true,
"notes": "Quality assurance for pipeline fixes"
}
]
}
