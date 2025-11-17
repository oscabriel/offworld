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
5. Is useful for developers evaluating or contributing to this project

CRITICAL OUTPUT REQUIREMENTS:
- DO NOT include top-level H1 headings (single #)
- DO use H2/H3 headings (##, ###) to structure content
- Standardize on heading-based structure (NOT numbered lists)
- Start directly with content (no "Summary:", "Overview:", "Repository Analysis:" labels)
- Use headings like "## Key Features", "## Architecture", "## Getting Started"
- Make headings descriptive and useful (not generic)

GOOD EXAMPLE:
## What It Does
[Description of library purpose...]

## Core Architecture
[How it's organized...]

## Key Features
[Unique capabilities...]

BAD EXAMPLE:
# Summary
Repository Analysis: [library name]
1. Overview
2. Features

Return prose text with H2/H3 structure. No top-level H1, no numbered lists, no redundant labels.`;

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
  "overview": "<2-3 sentence architectural overview focusing on library purpose and API design. DO NOT mention 'Iteration', 'discovered', 'layers', or reference the analysis process. Write as if describing the actual library architecture to a developer.>",
  "pattern": "<Library|Framework|Utility|Plugin System|Component Library|etc>",
  "entities": [
    {
      "name": "<Package or major subsystem name>",
      "slug": "<url-safe-name>",
      "type": "package",
      "path": "<COMPLETE path from repository root>",

      "description": "<COMPREHENSIVE 4-6 sentence description:
        - WHAT this component does for library users (be specific)
        - Key responsibilities and capabilities it provides
        - HOW it fits into the broader library architecture
        - What developers would use this for
        - Technical implementation approach or patterns used
        Make this detailed enough that a developer can understand this component's role WITHOUT reading the code.>",

      "purpose": "<DETAILED 3-5 sentence explanation:
        - WHY this exists in the library's architecture
        - What architectural problem or need it solves
        - How it enables the library's core functionality
        - What would be missing or broken without it
        - Design decisions or trade-offs made
        Explain the design REASONING, not just functionality.>",

      "dependencies": [],
      "keyFiles": ["<CRITICAL: ONLY include actual file paths from THIS REPOSITORY that you saw in the code context above. Do NOT include paths from other repositories or made-up examples. Each path MUST be a real file from the repository being analyzed. Limit to 2-3 most important files for this entity.>"],
      "complexity": "low|medium|high",
      "layer": "public|internal|extension|utility",
      "importance": 0.95
    }
  ]
}

DESCRIPTION QUALITY REQUIREMENTS:
- BAD: "The core routing logic and APIs for TanStack Router."
- GOOD: "The Router component serves as the central orchestrator for TanStack Router, managing navigation state, route matching, and browser history integration. It provides the primary API surface that developers interact with through hooks like useRouter() and useNavigate(). The router maintains a tree of route definitions and efficiently matches URLs to components while handling lazy loading and code splitting. This is the foundation that all other routing features build upon, implementing the core navigation lifecycle from URL changes to component rendering."

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
- CRITICAL: For keyFiles, ONLY include files that are DIRECTLY RELEVANT to the specific entity
  BAD: Including "addons/passkey/db/index.ts" in a Router entity (unrelated)
  GOOD: Including "packages/router/src/matcher.ts" in a Router entity (directly relevant)
  Each keyFile must be a core implementation file FOR THAT SPECIFIC ENTITY

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
  "overview": "<2-3 sentences about the internal architecture. DO NOT mention 'Iteration 1', 'Iteration 2', or reference the analysis process. Write as if describing the actual codebase architecture to a developer.>",
  "entities": [
    {
      "name": "<Module or subsystem name>",
      "slug": "<url-safe-name>",
      "type": "module",
      "path": "<COMPLETE path from repository root>",

      "description": "<COMPREHENSIVE 4-6 sentence description:
        - WHAT this internal system does (be specific)
        - Key responsibilities and how it processes data
        - HOW it connects to public APIs from Iteration 1
        - Technical algorithms or patterns it implements
        - Performance or architectural benefits it provides
        Make this detailed enough to understand the system's role and implementation.>",

      "purpose": "<DETAILED 3-5 sentence explanation:
        - WHY this internal system exists
        - What problem it solves architecturally
        - How it enables the library to function
        - Design decisions and why they were made
        - Trade-offs considered in its implementation
        Explain the architectural REASONING and necessity.>",

      "dependencies": ["<reference Iteration 1 entities by name>"],
      "usedBy": ["<which public APIs use this>"],
      "keyFiles": ["<CRITICAL: ONLY include actual file paths from THIS REPOSITORY that you saw in the code context above. Do NOT include paths from other repositories or made-up examples. Each path MUST be a real file from the repository being analyzed. Limit to 2-3 most important files for this entity.>"],
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
- CRITICAL: For keyFiles, ONLY include files that are DIRECTLY RELEVANT to the specific entity
  Each keyFile must be a core implementation file FOR THAT SPECIFIC ENTITY, not random files from the codebase

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
  "overview": "<2-3 sentences about component/utility organization. DO NOT mention 'Iteration', 'discovered', 'layers', or reference the analysis process. Write as if describing the actual codebase organization to a developer.>",
  "entities": [
    {
      "name": "<Component or utility name>",
      "slug": "<url-safe-name>",
      "type": "component",
      "path": "<COMPLETE path from repository root>",

      "description": "<COMPREHENSIVE 4-6 sentence description:
        - WHAT this component or utility provides
        - Specific capabilities and use cases
        - HOW it integrates with other systems
        - When developers would use this
        - Implementation approach or patterns
        Make this detailed and practical for understanding the component's role.>",

      "purpose": "<DETAILED 3-5 sentence explanation:
        - WHY this component exists
        - What functionality it enables
        - How it supports the overall architecture
        - Design rationale behind its implementation
        - What benefit it provides to the library
        Explain the architectural value and reasoning.>",

      "dependencies": ["<reference previous entities by name>"],
      "usedBy": ["<which systems use this>"],
      "keyFiles": ["<CRITICAL: ONLY include actual file paths from THIS REPOSITORY that you saw in the code context above. Do NOT include paths from other repositories or made-up examples. Each path MUST be a real file from the repository being analyzed. Limit to 2-3 most important files for this entity.>"],
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
- CRITICAL: For keyFiles, ONLY include files that are DIRECTLY RELEVANT to the specific entity
  Each keyFile must be a core implementation file FOR THAT SPECIFIC ENTITY, not random files from the codebase

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

export const ARCHITECTURE_SYNTHESIS = `You are writing THE DEFINITIVE architectural guide for developers exploring this open source library.

Repository: {{repoName}}
Pattern: {{pattern}}

You have analyzed this library through multiple perspectives:

HIGH-LEVEL VIEW:
{{iteration1Overview}}

INTERNAL SYSTEMS:
{{iteration2Overview}}

SUPPORTING COMPONENTS:
{{iteration3Overview}}

DISCOVERED {{entityCount}} MAJOR ARCHITECTURAL ENTITIES:
{{allEntities}}

YOUR TASK: Write a comprehensive architectural guide (300-400 words) that helps developers understand how to use and contribute to this library.

CRITICAL: Even though the context above may contain phrases like "Iteration 1/2/3/4", "discovered", "layers", etc., you MUST NEVER echo these in your output. Ignore any meta-commentary in the context and focus only on the actual architectural information.

STRUCTURE YOUR NARRATIVE (4-6 paragraphs):

**Paragraph 1-2: What developers need to know**
- Start with: "This library provides..." or "[Name] is designed to..."
- Explain the core value proposition
- Describe the primary API surface developers interact with
- Mention key exports and entry points by name

**Paragraph 3-4: How it works internally**
- Explain the internal architecture in natural terms
- Describe data flow naturally (how requests transform into results)
- Reference specific architectural entities by name
- Explain why the architecture is designed this way

**Paragraph 5: What makes it special**
- Highlight unique design decisions
- Explain architectural trade-offs
- Mention extension mechanisms if applicable

**Paragraph 6: Guidance for contributors**
- Where to start reading the code
- How the major pieces connect
- What patterns to understand before contributing

CRITICAL WRITING RULES (ANTI-JARGON):
- NEVER mention "iterations", "iteration 1/2/3", "discovered across N iterations"
- NEVER mention "layers", "public layer", "internal layer", "layer classification"
- NEVER mention "importance scores", "consolidated entities", "filtered to top N"
- NEVER say "The public API includes..." - instead say "Developers interact with..."
- NEVER say "The internal subsystems handle..." - instead say "Under the hood..."
- NEVER reference the analysis process - write as if you designed the architecture

Write as if you're explaining the codebase to a colleague, not documenting a workflow.

EXAMPLES OF GOOD PHRASING:
✅ "TanStack Router provides type-safe routing through its core Router component..."
✅ "The matching engine transforms URL patterns into resolved routes..."
✅ "Developers can extend routing behavior through custom matchers..."
✅ "At its core, the library uses a declarative configuration system..."

EXAMPLES OF BAD PHRASING:
❌ "Iteration 1 discovered the public API layer..."
❌ "The internal subsystems include..."
❌ "This entity has importance score 0.9..."
❌ "Consolidated to 8 major entities from 45 discovered..."
❌ "The public layer exposes..."

Use natural transitions between paragraphs. Reference entities by name in context.

Return ONLY the flowing prose narrative (4-6 paragraphs). No markdown headings, no section labels, just coherent paragraphs.`;

// ============================================================================
// DIAGRAM GENERATION PROMPTS
// ============================================================================

export const ARCHITECTURE_DIAGRAM_PROMPT = `Generate a Mermaid diagram showing the high-level architecture.

Repository: {{repoName}}
Architecture Pattern: {{pattern}}

Discovered Entities:
{{entities}}

Create a diagram showing main components and their relationships.

CRITICAL MERMAID SYNTAX REQUIREMENTS:
1. Use ONLY these diagram types: "graph TB", "graph LR", "graph TD"
2. Node IDs must be alphanumeric (A-Z, 0-9, underscore ONLY)
3. Node labels use square brackets: A[Label Text]
4. NO parentheses in labels - use dashes instead (e.g., "LSP Client" not "Language Server Protocol (LSP)")
5. Arrows use --> for directed, --- for undirected
6. NO special characters in node IDs (no dashes, spaces, slashes, dots)
7. Subgraphs must have unique alphanumeric IDs
8. Keep simple - max 15 nodes for readability

VALID EXAMPLE:
\`\`\`mermaid
graph TB
    subgraph PublicAPI
        A[Router API]
        B[Route Matcher]
    end
    subgraph Internal
        C[Navigation Engine]
        D[State Manager]
    end
    A --> C
    B --> D
\`\`\`

INVALID (DO NOT USE):
- Node IDs with spaces: Router API (wrong, must be RouterAPI or A)
- Node IDs with slashes: src/router (wrong, must be SrcRouter or A)
- Node IDs with dashes: router-core (wrong, must be RouterCore or A)
- Complex syntax that might fail parsing

Use simple single-letter IDs (A, B, C...) if in doubt.

Return ONLY the mermaid code block with triple backticks.`;

export const DATA_FLOW_DIAGRAM_PROMPT = `Generate a Mermaid flowchart showing data/request flow through the system.

Repository: {{repoName}}
Architecture Overview: {{overview}}

Discovered Entities:
{{entities}}

CRITICAL MERMAID SYNTAX REQUIREMENTS:
1. Use "graph LR" or "graph TD" only
2. Node IDs must be ALPHANUMERIC ONLY (A, B, C, D1, D2...)
3. NO dashes, spaces, slashes in node IDs
4. Use {} for decision nodes: C{Decision?}
5. Labels in square brackets: A[User Request]
6. NO parentheses in labels - use dashes or omit acronyms (e.g., "Auth System" not "Authentication (Auth)")
7. Simple arrows only: -->
8. Max 12 nodes for clarity

VALID EXAMPLE:
\`\`\`mermaid
graph LR
    A[User Request] --> B[Router]
    B --> C{Auth Check}
    C -->|Authorized| D[API Handler]
    C -->|Unauthorized| E[Error Response]
    D --> F[Database]
    F --> G[Response]
\`\`\`

INVALID - DO NOT USE:
- auth-check{Decision} (wrong, use C{Decision})
- src/router[Router] (wrong, use A[Router])

Return ONLY the mermaid code block with triple backticks.`;

export const ROUTING_DIAGRAM_PROMPT = `Generate a Mermaid graph showing the routing/navigation structure.

Repository: {{repoName}}
Route Files Found:
{{routeFiles}}

CRITICAL MERMAID SYNTAX REQUIREMENTS:
1. Use "graph TD" only (top-down tree)
2. Node IDs must be ALPHANUMERIC (Root, Home, Auth1, Auth2...)
3. NO slashes, colons, or dashes in node IDs
4. Labels in square brackets can contain routes: A[/dashboard/:id]
5. NO parentheses in labels anywhere
6. Simple arrows only: -->
7. Max 15 routes for readability

VALID EXAMPLE:
\`\`\`mermaid
graph TD
    Root[/] --> Home[/home]
    Root --> Auth[/auth]
    Auth --> Login[/auth/login]
    Auth --> Signup[/auth/signup]
    Root --> Dashboard[/dashboard]
    Dashboard --> Profile[/dashboard/:userId]
\`\`\`

INVALID - DO NOT USE:
- /auth[Auth] (wrong, use Auth[/auth])
- auth-page[Auth] (wrong, use AuthPage[Auth])
- :userId[Dynamic] (wrong, use A[Dynamic :userId])

Return ONLY the mermaid code block with triple backticks.`;

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
