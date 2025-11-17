/**
 * Prompt Templates for Multi-Iteration Analysis
 *
 * Template variables use {{variableName}} syntax
 */

// ============================================================================
// SUMMARY GENERATION PROMPTS (3 iterations + synthesis)
// ============================================================================

export const SUMMARY_ITERATION_1 = `You are an expert code analyst creating clear, actionable documentation for developers.

Analyze this codebase at a HIGH LEVEL:

Repository: {{repoName}}
Description: {{description}}
Primary Language: {{language}}

Sample Code from Entry Points and Key Files:
{{codeContext}}

Provide a focused analysis (150 words max):
1. What this project DOES (2-3 sentences, user-facing perspective)
2. Problem it SOLVES
3. Who uses it (target audience)

Focus on the "why" and "what", not implementation details yet.`;

export const SUMMARY_ITERATION_2 = `Building on the overview, analyze the ARCHITECTURE:

Repository: {{repoName}}

Previous Analysis:
{{previousIteration}}

Component Structure and Key Directories:
{{codeContext}}

Provide architectural analysis (150 words max):
1. Main architectural pattern (MVC, microservices, monorepo, etc.)
2. Key directories and their roles
3. Data flow (how requests/data move through system)

Connect this to the purpose identified in the previous iteration.`;

export const SUMMARY_ITERATION_3 = `Complete the analysis with TECHNICAL DETAILS:

Repository: {{repoName}}

Overview + Architecture:
{{previousIterations}}

Implementation Patterns and Code:
{{codeContext}}

Provide technical insights (100 words max):
1. Notable design patterns used
2. Technology stack highlights
3. Extension points for contributors

Synthesize into actionable insights that connect to the previous analysis.`;

export const SUMMARY_SYNTHESIS = `Synthesize these 3 analyses into ONE comprehensive summary.

Repository: {{repoName}}

Iteration 1 (Purpose & Audience):
{{iteration1}}

Iteration 2 (Architecture):
{{iteration2}}

Iteration 3 (Technical Details):
{{iteration3}}

Create a final summary (250 words max) that:
1. Starts with the purpose (iteration 1)
2. Explains how it's built (iteration 2)
3. Highlights what makes it unique (iteration 3)
4. Flows as one coherent narrative
5. Is useful for developers evaluating or contributing to this project`;

// ============================================================================
// ARCHITECTURE GENERATION PROMPTS (3 iterations)
// ============================================================================

export const ARCHITECTURE_ITERATION_1 = `You are an expert software architect analyzing LIBRARY/FRAMEWORK code structure.

CRITICAL - THIS IS LIBRARY CODE, NOT APPLICATION CODE:
- Focus on PUBLIC API SURFACE (what developers import and use)
- Identify CORE SUBSYSTEMS (internal algorithms that power the library)
- Find EXTENSION POINTS (plugins, middleware, adapters)
- DO NOT analyze like an application (no routes/controllers/database layers)

Analyze the HIGH-LEVEL STRUCTURE of this library/framework:

Repository: {{repoName}}
Summary: {{summary}}
Type: OSS Library/Framework

Code from Entry Points and Configuration:
{{codeContext}}

Generate a JSON response with this EXACT structure:
{
  "overview": "<2-3 sentence architectural overview focusing on library purpose and API design>",
  "pattern": "<Library|Framework|Utility|Plugin System|Component Library|etc>",
  "entities": [
    {
      "name": "<Package or major subsystem name>",
      "slug": "<url-safe-name>",
      "type": "package",
      "path": "<full path from repository root>",
      "description": "<what this component does for library users>",
      "purpose": "<why it exists in the library architecture>",
      "dependencies": [],
      "keyFiles": ["<full file paths from repository root>"],
      "complexity": "low|medium|high",
      "layer": "public|internal|extension|utility",
      "importance": 0.95
    }
  ]
}

REQUIRED NEW FIELDS:
- "layer": MUST be one of:
  * "public" - Public API surface (what developers import: z.string(), useState, createRouter)
  * "internal" - Core subsystems (internal algorithms: Parser, Reconciler, Matcher)
  * "extension" - Plugin/middleware systems (how developers extend the library)
  * "utility" - Internal helpers (type utils, formatters, dev warnings)

- "importance": MUST be a number 0.0-1.0 based on:
  * 1.0: Main entry points (index.ts, main exports from package.json)
  * 0.9: Primary public APIs (what devs primarily use)
  * 0.8: Secondary public APIs (less common but important)
  * 0.7: Core internal algorithms (how it works under the hood)
  * 0.6: Extension systems (plugin interfaces)
  * 0.5: Internal utilities (helpers used across codebase)
  * 0.4: Configuration (build config, tsconfig)

EXPLICIT CONSTRAINTS:
- The "type" field MUST be one of: "package", "directory"
- DO NOT create entities for individual files (use keyFiles array instead)
- DO NOT create entities for utility files (those come in Iteration 3)
- DO NOT create entities for build configuration
- CRITICAL: All paths must be COMPLETE from repository root
  Example: Use "packages/zod/src/core.ts" NOT "src/core.ts"

FOCUS ON DISCOVERING (in order of importance):
1. Main entry points (index.ts, main export files) - importance: 1.0, layer: "public"
2. Primary public API packages/directories - importance: 0.9, layer: "public"
3. Core algorithm implementations - importance: 0.7-0.8, layer: "internal"
4. Extension/plugin systems - importance: 0.6-0.7, layer: "extension"

ANTI-DRIFT INSTRUCTIONS:
- DO NOT include general repository information unless directly architectural
- DO NOT create more than 15 entities
- DO NOT duplicate what's already in package.json "exports" field
- FOCUS EXCLUSIVELY on major architectural components

Limit to top 15 most important entities by importance score.
Return ONLY valid JSON, no markdown blocks, no code fences, no explanatory text.`;

export const ARCHITECTURE_ITERATION_2 = `Continue the library architecture analysis by discovering INTERNAL SUBSYSTEMS and MODULES.

CONTEXT FROM ITERATION 1:
Previous Architectural Overview:
{{iteration1Overview}}

Previously Discovered Entities (DO NOT REPEAT THESE):
{{previousEntities}}

Repository: {{repoName}}
Summary: {{summary}}
Type: OSS Library/Framework

Code from Core Modules and Internal Systems:
{{codeContext}}

NOW discover MODULES and INTERNAL SUBSYSTEMS that:
1. Connect to Iteration 1 entities (use "dependencies" field to reference them)
2. Are NOT already discovered (check previous entities list above)
3. Add architectural DEPTH (how things work internally), not breadth (more top-level categories)
4. Focus on INTERNAL ALGORITHMS and CORE SYSTEMS

Generate a JSON response continuing the structure:
{
  "overview": "<2-3 sentences building on Iteration 1, explain internal architecture>",
  "entities": [
    {
      "name": "<Module or subsystem name>",
      "slug": "<url-safe-name>",
      "type": "module",
      "path": "<full path from repository root>",
      "description": "<what this internal system does>",
      "purpose": "<its role in making the library work>",
      "dependencies": ["<reference Iteration 1 entities by name>"],
      "usedBy": ["<which public APIs use this>"],
      "keyFiles": ["<full file paths from repository root>"],
      "complexity": "low|medium|high",
      "layer": "internal|extension|utility",
      "importance": 0.75
    }
  ]
}

REQUIRED NEW FIELDS:
- "layer": MUST be one of:
  * "internal" - Core algorithms/engines (Parser, Reconciler, Compiler, Router Matcher)
  * "extension" - Plugin systems (middleware interfaces, adapter patterns)
  * "utility" - Internal helpers (don't use for major systems)

- "importance": MUST be a number 0.0-1.0:
  * 0.8: Critical internal systems (can't work without these)
  * 0.7: Major internal algorithms (core functionality)
  * 0.6: Extension/plugin systems
  * 0.5: Internal utilities
  * 0.4: Helper modules

EXPLICIT CONSTRAINTS:
- Maximum 20 entities
- MUST reference at least 1 Iteration 1 entity in "dependencies"
- DO NOT create duplicate entities (check previousEntities list)
- DO NOT create entities for utility files (those come in Iteration 3)
- DO NOT use layer "public" (public APIs were in Iteration 1)
- The "type" field MUST be one of: "module", "service"
- CRITICAL: All paths must be COMPLETE from repository root

FOCUS ON DISCOVERING (in order of importance):
1. Core internal algorithms - importance: 0.8, layer: "internal"
2. Processing engines/compilers - importance: 0.7-0.8, layer: "internal"
3. Plugin/extension systems - importance: 0.6-0.7, layer: "extension"
4. Service layers - importance: 0.6, layer: "internal"

ANTI-DRIFT INSTRUCTIONS:
- BUILD ON Iteration 1, do NOT repeat its entities
- CAREFULLY review the previousEntities list before creating new ones
- DO NOT drift to unrelated topics
- DO NOT create more than 20 entities
- FOCUS EXCLUSIVELY on internal systems and modules

Limit to top 20 most important entities by importance score.
Return ONLY valid JSON, no markdown blocks, no code fences, no explanatory text.`;

export const ARCHITECTURE_ITERATION_3 = `Complete the library architecture analysis by discovering COMPONENTS, UTILITIES, and HELPERS.

COMPLETE CONTEXT FROM PREVIOUS ITERATIONS:
Full Architectural Overview:
{{previousOverview}}

All Previously Discovered Entities (DO NOT REPEAT ANY OF THESE):
{{previousEntities}}

Repository: {{repoName}}
Summary: {{summary}}
Type: OSS Library/Framework

Code from Components, Utilities, and Helpers:
{{codeContext}}

NOW discover COMPONENTS and UTILITIES that:
1. Connect to previous entities (reference them in "dependencies")
2. Are NOT already discovered (carefully check the long list above)
3. Complete the architectural picture with SUPPORTING COMPONENTS
4. Focus on REUSABLE PARTS and SHARED UTILITIES

Generate a JSON response completing the structure:
{
  "overview": "<2-3 sentences about component/utility organization, building on previous iterations>",
  "entities": [
    {
      "name": "<Component or utility name>",
      "slug": "<url-safe-name>",
      "type": "component",
      "path": "<full path from repository root>",
      "description": "<what this component/utility provides>",
      "purpose": "<its specific use case in the library>",
      "dependencies": ["<reference previous entities by name>"],
      "usedBy": ["<which systems use this>"],
      "keyFiles": ["<full file paths from repository root>"],
      "complexity": "low|medium|high",
      "layer": "utility|extension|internal",
      "importance": 0.50
    }
  ]
}

REQUIRED NEW FIELDS:
- "layer": MUST be one of:
  * "utility" - Shared utilities/helpers (type utils, formatters, validators)
  * "extension" - Extension components (hooks, adapters that users can use)
  * "internal" - Internal components (only if truly core to library operation)

- "importance": MUST be a number 0.0-1.0:
  * 0.6: Important extension components (custom hooks, adapters users interact with)
  * 0.5: Shared utilities used across library
  * 0.4: Helper functions and formatters
  * 0.3: Development utilities (warnings, debug tools)

EXPLICIT CONSTRAINTS:
- Maximum 15 entities
- MUST reference at least 1 previous entity in "dependencies"
- DO NOT create duplicate entities (check the LONG previousEntities list carefully)
- DO NOT use layer "public" (those were in Iteration 1)
- DO NOT discover major subsystems (those were in Iterations 1-2)
- The "type" field MUST be "component"
- CRITICAL: All paths must be COMPLETE from repository root

FOCUS ON DISCOVERING (in order of importance):
1. Extension components users interact with - importance: 0.6, layer: "extension"
2. Shared utilities used across library - importance: 0.5, layer: "utility"
3. Helper functions and formatters - importance: 0.4, layer: "utility"
4. Development/debugging tools - importance: 0.3, layer: "utility"

ANTI-DRIFT INSTRUCTIONS:
- CAREFULLY review ALL previousEntities (from both iterations 1 & 2) before creating new ones
- BUILD ON previous iterations, do NOT repeat or contradict them
- DO NOT drift to unrelated topics
- DO NOT create more than 15 entities
- FOCUS EXCLUSIVELY on supporting components and utilities
- This is the FINAL iteration - wrap up the architecture picture cohesively

Limit to top 15 most important entities by importance score.
Return ONLY valid JSON, no markdown blocks, no code fences, no explanatory text.`;

// ============================================================================
// ARCHITECTURE SYNTHESIS PROMPT (Final step - DeepWiki pattern)
// ============================================================================

export const ARCHITECTURE_SYNTHESIS = `You are synthesizing multi-iteration architecture analysis into a cohesive narrative.

CAREFULLY REVIEW THE ENTIRE ANALYSIS:

Iteration 1 - Public APIs & Entry Points:
{{iteration1Overview}}

Iteration 2 - Internal Subsystems & Modules:
{{iteration2Overview}}

Iteration 3 - Components & Utilities:
{{iteration3Overview}}

Repository: {{repoName}}
Architecture Pattern: {{pattern}}
Total Entities Discovered: {{entityCount}}

ALL DISCOVERED ENTITIES (for reference):
{{allEntities}}

TASK: Synthesize ALL findings from the 3 iterations into ONE comprehensive architectural narrative.

Your narrative should:

1. **START with the library's purpose** (from Iteration 1)
   - What this library does for developers
   - Primary use cases and target audience

2. **EXPLAIN the architecture** (combine all 3 iterations)
   - How the library is organized (pattern, structure)
   - Public API surface (what developers import)
   - Internal subsystems (how it works under the hood)
   - Extension points (how developers can extend it)

3. **HIGHLIGHT what makes it unique** (synthesis insight)
   - Key architectural decisions
   - Notable design patterns
   - What makes this library special

4. **GUIDE contributors** (actionable insights)
   - Where to start exploring the code
   - How the major pieces connect
   - What to understand before contributing

SYNTHESIS REQUIREMENTS:
- Write 4-6 paragraphs (300-400 words total)
- Flow as one coherent narrative (not bullet points)
- Reference specific major entities by name
- Emphasize library-specific architecture (public API → internal → extensions)
- Build from overview → details → unique insights → contributor guidance
- Use clear, direct language for developers

CRITICAL INSTRUCTIONS:
- CAREFULLY review ALL three iteration overviews above
- Synthesize insights, don't just concatenate
- Focus on the architectural STORY, not just entity lists
- Reference the {{pattern}} and how it's implemented
- Make it useful for developers evaluating or contributing

This is the DEFINITIVE architectural summary - make it comprehensive and insightful.

Return ONLY the narrative text, no markdown formatting, no section headers, no code blocks.`;

// ============================================================================
// DIAGRAM GENERATION PROMPTS
// ============================================================================

export const ARCHITECTURE_DIAGRAM_PROMPT = `Generate a Mermaid C4Context diagram showing the high-level architecture.

Repository: {{repoName}}
Architecture Pattern: {{pattern}}

Discovered Entities:
{{entities}}

Create a C4Context diagram using Mermaid syntax that shows:
- Main system components as boxes
- Relationships between components
- External systems if any
- Clear hierarchy and grouping

Example format:
\`\`\`mermaid
graph TB
    subgraph "System Name"
        A[Component A]
        B[Component B]
        C[Component C]
    end

    A -->|uses| B
    B -->|depends on| C

    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#f0f0f0
\`\`\`

Keep under 20 nodes for readability.
Use subgraphs to show containment (like packages containing modules).
Return ONLY the mermaid diagram code, no explanation or markdown fences.`;

export const DATA_FLOW_DIAGRAM_PROMPT = `Generate a Mermaid flowchart showing data/request flow through the system.

Repository: {{repoName}}
Architecture Overview: {{overview}}

Discovered Entities:
{{entities}}

Create a flowchart showing:
- How requests enter the system
- How data flows between components
- Processing stages
- Data storage/retrieval

Example format:
\`\`\`mermaid
graph LR
    A[User Request] --> B[Router]
    B --> C{Auth Check}
    C -->|Authorized| D[API Handler]
    C -->|Unauthorized| E[Error Response]
    D --> F[Database]
    F --> G[Response]
\`\`\`

Keep under 15 nodes.
Use decision diamonds for conditional flows.
Return ONLY the mermaid diagram code, no explanation or markdown fences.`;

export const ROUTING_DIAGRAM_PROMPT = `Generate a Mermaid graph showing the routing/navigation structure.

Repository: {{repoName}}
Route Files Found:
{{routeFiles}}

Create a graph showing:
- Main routes and subroutes
- Route hierarchy
- Dynamic routes (with params)
- Special routes (auth, error pages, etc.)

Example format:
\`\`\`mermaid
graph TD
    Root[/] --> Home[/home]
    Root --> Auth[/auth]
    Auth --> Login[/auth/login]
    Auth --> Signup[/auth/signup]
    Root --> Dashboard[/dashboard]
    Dashboard --> Profile[/dashboard/:userId]
\`\`\`

Keep under 20 routes.
Show hierarchy clearly.
Return ONLY the mermaid diagram code, no explanation or markdown fences.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Render a prompt template with variable substitution
 */
export function renderPrompt(
	template: string,
	vars: Record<string, string>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		if (!(key in vars)) {
			console.warn(`Template variable {{${key}}} not provided`);
			return `{{${key}}}`;
		}
		return vars[key];
	});
}

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
// biome-ignore lint/suspicious/noExplicitAny: JSON parsing
export function extractJSON(text: string): any {
	// Try to find JSON in markdown code blocks first
	const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
	if (codeBlockMatch) {
		return JSON.parse(codeBlockMatch[1]);
	}

	// Try to find raw JSON
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		return JSON.parse(jsonMatch[0]);
	}

	throw new Error("No valid JSON found in response");
}
