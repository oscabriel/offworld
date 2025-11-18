# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OFFWORLD** - AI-powered repository analysis system that explores GitHub codebases, generates architecture documentation, and provides intelligent Q&A via RAG (Retrieval Augmented Generation).

**Tagline**: "Explore distant code."

## Tech Stack

### Frontend
- **Framework**: TanStack Start (SSR React with file-based routing)
- **Routing**: TanStack Router v1 (type-safe, auto-generated route tree)
- **React Query Integration**: @convex-dev/react-query (reactive Convex subscriptions)
- **UI Components**: shadcn/ui (50+ components, Radix UI primitives)
- **Styling**: Tailwind CSS v4 (utility-first, dark mode support)
- **Forms**: TanStack Form (with shadcn Field components)
- **Icons**: Lucide React
- **Markdown**: react-markdown (chat responses, architecture docs)
- **Diagrams**: Mermaid (architecture visualizations)

### Backend
- **Platform**: Convex Cloud (serverless, edge-optimized)
- **Database**: Convex (document store, ACID transactions, real-time subscriptions)
- **Workflows**: Convex Durable Workflows (crash-safe, automatic retries)
- **RAG**: @convex-dev/rag (vector search, 768-dim embeddings, top 500 files)
- **Agent**: @convex-dev/agent (AI agent framework, 9 custom tools)
- **File Storage**: Convex file storage (GitHub file caching)

### AI & ML
- **LLM**: Gemini 2.5 Flash Lite (cost-effective, $0.018-0.025/repo)
- **Embeddings**: Google Text Embedding 004 (768 dimensions)
- **AI SDK**: Vercel AI SDK (@ai-sdk/google)
- **Use Cases**: Summaries, architecture analysis, issue difficulty, PR impact, Mermaid diagrams

### Authentication
- **Framework**: Better Auth (session-based, type-safe)
- **Providers**: GitHub OAuth (15k requests/hour via GitHub App)
- **Adapter**: @convex-dev/better-auth (Convex integration)
- **Session Storage**: Convex database

### Development
- **Monorepo**: Turborepo (task orchestration, remote caching)
- **Package Manager**: Bun v1.3+ (fast installs, native TypeScript)
- **Linter**: Biome (fast ESLint + Prettier replacement)
- **Type Checking**: TypeScript 5.x (strict mode)

### Deployment (Triple-Deploy Architecture)
- **Backend**: Convex Cloud (global edge deployment, automatic scaling)
- **Frontend**: Cloudflare Workers via Alchemy (edge SSR, <50ms cold starts)
- **Docs**: Netlify (fumadocs static site, instant previews)
- **Domain**: offworld.sh (Cloudflare DNS)

### Observability
- **Frontend**: Sentry (@sentry/tanstackstart-react)
- **Backend**: Convex Dashboard (logs, metrics, workflow visualization)
- **Deployment**: Alchemy CLI (deployment logs, env management)

## Monorepo Structure

```
apps/
  web/              - Frontend app (TanStack Start + Convex client)
  fumadocs/         - Documentation site
packages/
  backend/          - Convex backend (queries, mutations, actions, workflows)
  config/           - Shared config
```

## Development Commands

### Starting Development

```bash
# Start all apps (web + backend dev server)
bun run dev

# Start only web app
bun run dev:web

# Start only backend (Convex dev)
bun run dev:server

# Setup backend (first time or after schema changes)
bun run dev:setup
```

### Quality Checks

**IMPORTANT**: Always run these before finishing work:

```bash
# Check linting (Biome) - auto-fixes
bun run check

# Type checking across all workspaces
bun run typecheck
```

### Deployment (Triple-Deploy Architecture)

**Backend Deployment (Convex Cloud)**:
```bash
bun run deploy:backend
# → npx convex deploy --yes
# → Deploys to: Convex Cloud (global edge)
# → Functions: queries, mutations, actions, workflows, agent, RAG
# → Storage: Database + file storage + vector indexes
```

**Frontend Deployment (Cloudflare Workers via Alchemy)**:
```bash
bun run deploy:web
# → cd apps/web && bun run deploy
# → Alchemy CLI builds and deploys to Cloudflare Workers
# → Domain: offworld.sh (configured in alchemy.run.ts)
# → Features: Edge SSR, <50ms cold starts, global CDN
# → Bindings: VITE_CONVEX_URL, VITE_SENTRY_DSN (from alchemy.env)
```

**Docs Deployment (Netlify)**:
```bash
bun run deploy:docs
# → cd apps/fumadocs && bun run deploy
# → Netlify builds static site from Fumadocs
# → Config: netlify.toml (build command: turbo run build --filter fumadocs)
# → Features: Instant previews, automatic rebuilds on push
```

**All-in-One Deployment**:
```bash
bun run deploy:all
# → Deploys backend → frontend → docs sequentially
# → Ensures backend is live before frontend connects
```

**Deployment Architecture Benefits**:
- **Backend (Convex)**: Automatic scaling, zero ops, real-time subscriptions
- **Frontend (Cloudflare)**: Global edge deployment, instant routing, SSR at the edge
- **Docs (Netlify)**: Static site optimization, branch previews, easy rollbacks
- **Observability**: Sentry (frontend errors), Convex Dashboard (backend logs/metrics)

### Backend-Specific Commands

```bash
# From packages/backend/
bun run dev              # Start Convex dev server
bun run dev:setup        # Configure deployment (first time)
bun run typecheck        # Type check Convex functions
bun run check            # Lint Convex code
```

### Web-Specific Commands

```bash
# From apps/web/
bun run dev              # Start with Alchemy (Cloudflare emulation)
bun run build            # Build for production
bun run typecheck        # Type check
bun run check            # Lint
```

## Architecture Overview

### Backend Architecture (packages/backend/convex/)

**Data Model** (5 main tables):
- `repositories` - Repo metadata, indexing status, AI-generated summaries/architecture/diagrams
- `architectureEntities` - Discovered components with importance ranking, GitHub URLs, layer classification
- `issues` - GitHub issues enriched with AI analysis (difficulty, skills, files touched, GitHub URLs)
- `pullRequests` - PRs with AI summaries and metrics (files changed, impact analysis)
- `conversations` - User chat threads with persistent agent context

**Function Organization**:
- **Public queries/mutations** - Client-accessible (e.g., `api.repos.getByFullName`, `api.repos.startAnalysis`)
- **Internal queries/mutations** - Workflow-only (e.g., `repos.createRepo`, `repos.updateSummary`)
- **Actions** - External API calls (GitHub API, Gemini AI, RAG operations)

**Core Workflow**: `analyzeRepository` (11-step durable workflow)
1. Validate & fetch GitHub metadata
2. Handle re-index (clear RAG namespace, entities, issues)
3. Fetch complete file tree
4. Calculate iteration count based on repo size
5. Ingest files into RAG with vector embeddings
6. Generate AI summary (300-word overview)
7. **Progressive architecture discovery** (2-5 iterations):
   - Iteration 1: Packages/directories
   - Iteration 2: Modules/services
   - Iteration 3+: Components/utilities
   - Each iteration refines previous context
8. Consolidate entities (filter to top 5-15 by importance)
9. Generate C4 diagrams (Mermaid syntax) + narrative
10. Finalize analysis

**Key Patterns**:
- **Progressive updates** - DB updates after each step so frontend sees results immediately
- **Case-insensitive lookups** - All repo queries handle case variations
- **Path validation** - LLM-generated paths validated against GitHub file tree
- **Importance ranking** - Entry points (1.0) → core subsystems (0.7-0.9) → utilities (0.3-0.5)
- **RAG namespacing** - Each repo gets `repo:owner/name` namespace

**AI Integration**:
- `gemini.ts` - All AI generation functions (summary, architecture iterations, synthesis, Mermaid diagrams)
- `aiValidation.ts` - Zod schemas for validating LLM outputs
- `agent/codebaseAgent.ts` - Chat agent with 9 tools (search, architecture, issues, PRs, files)
- `agent/tools.ts` - Tool definitions (searchCodeContext, getArchitecture, getSummary, listFiles, explainFile, findIssues, getIssueByNumber, findPullRequests, getPullRequestByNumber)

**Auth Integration**:
- `auth.config.ts` - Better-Auth setup with GitHub OAuth + Convex adapter
- `auth.ts` - Auth helpers (`getCurrentUser()`, `getCurrentUserSafe()`, `getUser()`)
- All mutations require auth via `await getUser(ctx)`

### Frontend Architecture (apps/web/src/)

**Router Configuration** (`router.tsx`):
- TanStack Router with auto-generated route tree
- Integrates React Query + Convex via `ConvexQueryClient`
- Custom context: `QueryClient`, `ConvexReactClient`, `ConvexQueryClient`
- Root layout: `ConvexBetterAuthProvider` → Header → Outlet → Toaster

**Complete Route Tree**:
```
/ (root)
├── /                             - Home (landing, indexed repos)
├── /explore                      - Repository search/browse
├── /sign-in                      - GitHub OAuth sign-in
├── /about                        - About page
├── /test-error                   - Sentry error testing
├── /api/auth/$                   - Better Auth API handler
│
└── /_github/                     - GitHub-related routes (layout wrapper)
    ├── /$owner                   - Owner profile (user/org)
    │
    └── /$owner/$repo/            - Repository layout (two-column)
        ├── /                     - Summary (default view)
        ├── /refresh              - Force re-analysis
        │
        ├── /arch/                - Architecture routes
        │   ├── /                 - Overview + entity list
        │   └── /$slug            - Entity detail page
        │
        ├── /issues/              - Issues routes
        │   ├── /                 - Issues list (filterable)
        │   └── /$number          - Issue detail (#123)
        │
        ├── /pr/                  - Pull request routes
        │   ├── /                 - PR list (filterable)
        │   └── /$number          - PR detail (#456)
        │
        └── /chat/                - Chat routes
            ├── /                 - New conversation
            └── /$chatId          - Existing thread (shareable)
```

**Route Features**:
- **File-based routing** - TanStack Router auto-generates from `src/routes/`
- **Type-safe params** - `Route.useParams()` with full TypeScript inference
- **Layout nesting** - `route.tsx` for layouts, `index.tsx` for content
- **Prefetching** - `preload="intent"` for hover prefetch
- **SSR support** - All routes server-side rendered via TanStack Start

**Convex Integration**:
```tsx
// Queries (reactive, auto-subscribe)
const repoData = useQuery(api.repos.getByFullName, { fullName });

// Mutations (one-off updates)
const startAnalysis = useMutation(api.repos.startAnalysis);

// Actions (async operations)
const getOwnerInfo = useAction(api.repos.getOwnerInfo);
```

**Auth Flow**:
- Client: `createAuthClient()` with Convex plugin
- Server: `setupFetchClient()` for session handling
- GitHub OAuth via `authClient.signIn.social({ provider: "github" })`

**Component Structure**:
- `components/layout/` - Header, footer, background, user menu
- `components/repo/` - Repo-specific components (header, navigation, card, status badge, Mermaid diagrams)
- `components/chat/` - Chat interface (ChatInterface, MessageBubble with tool call rendering)
- `components/ui/` - Full shadcn/ui library (button, card, dialog, etc.)

**Key Patterns**:
- **File-based routing** - Parent routes define layout, child routes are content
- **Type-safe navigation** - `<Link to="..." params={{ ... }}>` with full type safety
- **Loading states** - Skeleton placeholders, conditional rendering based on query status
- **Status flows** - null → queued → processing → completed/failed
- **Chat persistence** - URL-based routing (`/chat/$chatId`) for shareable conversations
- **Tool visualization** - Agent tool calls shown as badges before AI responses
- **Streaming responses** - Real-time message updates during agent thinking

## Environment Variables

### Backend (packages/backend/)
- `CONVEX_SITE_URL` - Convex deployment URL (for Better Auth)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - OAuth app credentials
- `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID` - GitHub App API access (15k req/hr)
- `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini AI key (used by `google()` from AI SDK)

### Frontend (apps/web/)
- `VITE_CONVEX_URL` - Convex deployment URL (client connection)
- `VITE_CONVEX_SITE_URL` - Convex site URL (auth callbacks)
- `VITE_SENTRY_DSN` - Sentry project DSN (error tracking)
- `SITE_URL` - Base URL for auth redirects

### Alchemy Deployment (apps/web/alchemy.run.ts)
- Environment bindings passed to Cloudflare Workers:
  - `VITE_CONVEX_URL` - From alchemy.env
  - `VITE_CONVEX_SITE_URL` - From alchemy.env
  - `VITE_SENTRY_DSN` - From alchemy.env
- Domain configuration: `domains: ["offworld.sh"]`

### Environment Files
- `.env.dev` - Development environment (local + Convex dev deployment)
- `.env.prod` - Production environment (Convex Cloud + Cloudflare)
- `alchemy.env` - Alchemy-managed secrets (not committed)

## Key Development Guidelines

### Working with Convex

**Adding new queries/mutations**:
1. Define in `packages/backend/convex/[feature].ts`
2. Export with `query()`, `mutation()`, or `action()`
3. Add input validation with Convex validators (`v.object({ ... })`)
4. Mark internal functions with `internal` prefix or place in `_[feature].ts` files

**Schema changes**:
1. Update `packages/backend/convex/schema.ts`
2. Run `bun run dev:setup` to apply changes
3. Type regeneration is automatic

**Workflows**:
- Use `WorkflowManager.start()` to launch long-running tasks
- Use `ctx.runMutation()`, `ctx.runAction()` for step calls
- All steps are crash-safe and resumable

### Working with TanStack Router

**Adding routes**:
1. Create `apps/web/src/routes/[path]/index.tsx` or `route.tsx`
2. Route tree regenerates automatically
3. Use typed params via `Route.useParams()`

**Layouts**:
- `route.tsx` defines layout for child routes
- `index.tsx` is the page content
- Use `<Outlet />` in parent to render children

### Working with Better-Auth

**Auth checks**:
```tsx
// In components
const user = useQuery(api.auth.getCurrentUserSafe);
if (!user) return <SignInPrompt />;

// In mutations (backend)
const user = await getUser(ctx);  // throws if not authenticated
```

**Adding OAuth providers**:
1. Update `packages/backend/convex/auth.config.ts`
2. Add provider to `createAuth()` socialProviders array
3. Add env vars for client ID/secret

### Working with AI Features

**RAG operations**:
- Ingest: `ingestRepository()` action chunks and embeds files
- Search: `search()` action returns relevant context (via `rag.search()`)
- Clear: `clearNamespace()` for re-indexing
- Namespace format: `repo:owner/name`

**Modifying prompts**:
- All prompts in `packages/backend/convex/prompts.ts`
- Use JSON schema in prompts for structured outputs
- Validate with Zod schemas in `aiValidation.ts`
- Critical patterns:
  - Strip top-level H1 headings from summaries
  - Forbid workflow jargon ("iteration", "layer", "consolidated")
  - Require 4-6 sentence descriptions for entities
  - Use alphanumeric-only node IDs in Mermaid diagrams

### UI Development

**Using shadcn/ui**:
- Components in `apps/web/src/components/ui/`
- Add new components: `npx shadcn@latest add [component]`
- All styled with Tailwind utilities

**Responsive design**:
- Use `useMobile()` hook for breakpoint detection
- Mobile-first approach with Tailwind

## Common Workflows

### Adding a new repository feature

1. Define schema in `packages/backend/convex/schema.ts`
2. Add queries/mutations in `packages/backend/convex/[feature].ts`
3. Add to workflow if needed (`analyzeRepository.ts`)
4. Create UI in `apps/web/src/routes/_github/$owner_.$repo/[feature]/index.tsx`
5. Run `bun check && bun typecheck`

### Adding a new agent tool

1. Define tool in `packages/backend/convex/agent/tools.ts`
   - Use `createTool()` with zod schema
   - Import `api` for queries (NOT `(ctx as any).api`)
   - Return formatted string for LLM consumption
2. Add tool to agent in `agent/codebaseAgent.ts`
3. Test in chat interface (`/chat/`)
4. Verify tool badges appear in message bubbles

### Adding a new AI analysis step

1. Add prompt to `packages/backend/convex/prompts.ts`
2. Add validation schema to `aiValidation.ts`
3. Create action in `gemini.ts`
4. Add workflow step in `analyzeRepository.ts`
5. Update schema to store result
6. Add UI to display result

### Debugging indexing issues

1. Check Convex dashboard logs (workflow execution)
2. Check RAG namespace: query `rag` table for repo namespace
3. Verify GitHub API access (installation ID, app permissions)
4. Check AI validation errors in logs

## Testing

**Manual testing checklist**:
1. Start analysis for small repo (< 50 files)
2. Verify progressive updates (summary → entities → diagrams)
3. Test chat agent (search, architecture questions)
4. Test auth flow (sign in → protected actions → sign out)
5. Test re-index (7-day cooldown, cascading delete)

## Notes

- **Turborepo caching** - Build artifacts cached, dev tasks always run
- **Bun workspaces** - Shared dependencies in root `node_modules`
- **Biome** - Fast linter/formatter (replaces ESLint + Prettier)
- **Alchemy** - Handles Cloudflare Workers deployment, bundling, env vars
