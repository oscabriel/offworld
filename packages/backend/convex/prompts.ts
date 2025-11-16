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

export const ARCHITECTURE_ITERATION_1 = `You are an expert software architect analyzing code structure.

Analyze the HIGH-LEVEL STRUCTURE of this codebase:

Repository: {{repoName}}
Summary: {{summary}}

Code from Entry Points and Configuration:
{{codeContext}}

Generate a JSON response with this EXACT structure:
{
  "overview": "<2-3 sentence architectural overview>",
  "pattern": "<MVC|Microservices|Monorepo|Layered|Plugin|Event-Driven|etc>",
  "entities": [
    {
      "name": "<Package or top-level directory name>",
      "slug": "<url-safe-name>",
      "type": "package",
      "path": "<relative path>",
      "description": "<what this package/directory does>",
      "purpose": "<why it exists>",
      "dependencies": [],
      "keyFiles": ["<important files in this package>"],
      "complexity": "low|medium|high"
    }
  ]
}

IMPORTANT: The "type" field MUST be one of: "package", "directory"
DO NOT use "file" as a type - individual files should be listed in keyFiles instead.

Focus on discovering:
- Packages (in monorepos) - use type "package"
- Top-level directories (src/, packages/, apps/, lib/, etc.) - use type "directory"
- Main subsystems - use type "package" or "directory"

Limit to top 15 most important entities. Return ONLY valid JSON, no markdown blocks.`;

export const ARCHITECTURE_ITERATION_2 = `Continue the architectural analysis by discovering MODULES and SERVICES:

Repository: {{repoName}}
Summary: {{summary}}

Previous Architectural Overview:
{{iteration1Overview}}

Previously Discovered Entities:
{{previousEntities}}

Code from Core Modules and Services:
{{codeContext}}

Generate a JSON response continuing the structure:
{
  "overview": "<2-3 sentences about module organization and service architecture>",
  "entities": [
    {
      "name": "<Module or service name>",
      "slug": "<url-safe-name>",
      "type": "module",
      "path": "<relative path>",
      "description": "<what this module/service does>",
      "purpose": "<its role in the system>",
      "dependencies": ["<other modules it depends on>"],
      "usedBy": ["<what uses this module>"],
      "keyFiles": ["<key files>"],
      "complexity": "low|medium|high"
    }
  ]
}

IMPORTANT: The "type" field MUST be one of: "module", "service"
DO NOT use "file" as a type - individual files should be listed in keyFiles instead.

Focus on discovering:
- Core modules (routing, authentication, data layer, etc.) - use type "module"
- Services (API services, background workers, etc.) - use type "service"
- Major subsystems within packages - use type "module"

Limit to top 20 most important entities. Do NOT repeat entities from iteration 1.
Return ONLY valid JSON, no markdown blocks.`;

export const ARCHITECTURE_ITERATION_3 = `Complete the architectural analysis by discovering COMPONENTS and UTILITIES:

Repository: {{repoName}}
Summary: {{summary}}

Complete Architectural Context:
{{previousOverview}}

Previously Discovered Entities:
{{previousEntities}}

Code from Components and Utilities:
{{codeContext}}

Generate a JSON response continuing the structure:
{
  "overview": "<2-3 sentences about component architecture and utility organization>",
  "entities": [
    {
      "name": "<Component or utility name>",
      "slug": "<url-safe-name>",
      "type": "component",
      "path": "<relative path>",
      "description": "<what this component/utility does>",
      "purpose": "<its specific use case>",
      "dependencies": ["<what it depends on>"],
      "usedBy": ["<where it's used>"],
      "keyFiles": ["<implementation files>"],
      "complexity": "low|medium|high"
    }
  ]
}

IMPORTANT: The "type" field MUST be "component"
DO NOT use "file" as a type - individual files should be listed in keyFiles instead.

Focus on discovering:
- Reusable components (UI components, React components, etc.) - use type "component"
- Core utilities and helpers - use type "component"
- Shared libraries - use type "component"

Limit to top 15 most important entities. Do NOT repeat entities from previous iterations.
Return ONLY valid JSON, no markdown blocks.`;

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
