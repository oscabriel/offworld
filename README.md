# OFFWORLD

*"Explore distant code."*

AI-powered codebase analysis platform that explores GitHub repos, generates architecture docs and diagrams, and provides conversational project navigation. Built primarily on [Tanstack Start](https://tanstack.com/start) and [Convex](https://convex.dev).

## Features

### 🔍 Repository Analysis
- **On-demand indexing** - Analyze any public GitHub repository
- **AI-generated summaries** - 300-word overviews of purpose, architecture, and unique features
- **Multi-iteration architecture discovery** - Progressive entity extraction (packages → modules → services)
- **Entity consolidation** - Focus on 5-15 major architectural components ranked by importance
- **Mermaid diagrams** - Auto-generated architecture, data flow, and routing visualizations

### 💬 Conversational AI Agent
- **9 specialized tools** - Search code, explain files, find issues/PRs, get architecture
- **Persistent threads** - Shareable conversation URLs (`/chat/$chatId`)
- **Tool call visualization** - See which tools the agent uses during responses
- **Streaming responses** - Real-time message updates
- **RAG-powered search** - Vector search across top 500 files with importance weighting

### 🐛 Issue Intelligence
- **AI difficulty ratings** - 1-5 scale (Good First Issue → Advanced)
- **Skills required** - Automatically detected technologies and concepts
- **Files likely touched** - Predicted file paths with GitHub URLs
- **Filterable UI** - Dropdown filters by difficulty and state

### 📊 Architecture Insights
- **Layer classification** - Public API vs internal subsystems vs extension points
- **GitHub URL validation** - LLM-generated paths validated against actual file tree
- **Entity relationships** - Dependencies, related groups, usage patterns
- **Detailed descriptions** - 4-6 sentence explanations (not just 1-line summaries)

## Tech Stack

### Core Technologies
- **Frontend**: TanStack Start (SSR React), TanStack Router (type-safe routing), shadcn/ui, Tailwind v4
- **Backend**: Convex Cloud (serverless, edge-optimized, real-time subscriptions)
- **AI/ML**: Gemini 2.5 Flash Lite (LLM), Google Text Embedding 004 (768-dim vectors)
- **Auth**: Better Auth + GitHub OAuth
- **Observability**: Sentry (frontend errors), Convex Dashboard (backend metrics)

### Deployment Architecture (Triple-Deploy)
- **Backend**: Convex Cloud (automatic scaling, global edge deployment)
- **Frontend**: Cloudflare Workers via Alchemy (edge SSR, <50ms cold starts)
- **Docs**: Netlify (Fumadocs static site, instant previews)
- **Domain**: offworld.sh

### Development Tools
- **Monorepo**: Turborepo (task orchestration, remote caching)
- **Package Manager**: Bun v1.3+ (fast installs, native TypeScript)
- **Linting**: Biome (ESLint + Prettier replacement)
- **Type Safety**: TypeScript 5.x (strict mode)

## Quick Start

### Development
```bash
# Install dependencies
bun install

# Start development (web + backend)
bun run dev

# Or start individually
bun run dev:web      # Frontend only (TanStack Start + Alchemy)
bun run dev:server   # Backend only (Convex dev deployment)

# Setup backend (first time or after schema changes)
bun run dev:setup

# Quality checks (ALWAYS run before committing)
bun run check        # Biome linting (auto-fix)
bun run typecheck    # TypeScript validation
```

### Deployment
```bash
# Deploy all (backend → frontend → docs)
bun run deploy:all

# Or deploy individually
bun run deploy:backend  # Convex Cloud
bun run deploy:web      # Cloudflare Workers (Alchemy)
bun run deploy:docs     # Netlify (Fumadocs)
```

### Environment Setup
1. Copy `.env.example` to `.env.dev`
2. Add GitHub OAuth credentials (from GitHub Developer Settings)
3. Add GitHub App credentials (for API access)
4. Add Gemini API key (from Google AI Studio)
5. (Optional) Add Sentry DSN for error tracking
6. Run `bun run dev:setup` to configure Convex deployment

## Project Structure

```
apps/
  web/              Frontend (TanStack Start + Convex client)
  fumadocs/         Documentation site
packages/
  backend/          Convex backend (queries, mutations, actions, workflows)
  config/           Shared config
```

## Key Workflows

**Analyze a repository:**
1. Navigate to `/explore`
2. Enter GitHub URL (e.g., `tanstack/router`)
3. Wait 5-10 minutes for analysis
4. Explore summary, architecture, issues

**Chat with codebase:**
1. Navigate to analyzed repo
2. Click "Chat" tab
3. Ask questions ("What does this library do?", "Tell me about issue #4510")
4. Agent uses tools to search code, find issues, explain architecture

## Architecture Highlights

### Triple-Deploy Strategy
**Why separate deployments?**
- **Backend (Convex)**: Zero-ops serverless, automatic scaling, real-time subscriptions
- **Frontend (Cloudflare)**: Global edge SSR, instant routing, <50ms cold starts
- **Docs (Netlify)**: Static optimization, branch previews, easy rollbacks

Each service optimized for its purpose, deployed to best-in-class platform.

### Key Technical Decisions
- **Gemini over OpenAI**: 85% cost reduction ($0.025 vs $0.18/repo)
- **Convex over traditional DB**: Real-time reactivity, zero migrations, built-in file storage
- **TanStack Router**: Type-safe routing, automatic code splitting, SSR-ready
- **Biome over ESLint**: 100x faster linting, zero config
- **Bun over npm/yarn**: 10x faster installs, native TypeScript support

### Data Flow
```
GitHub API (via GitHub App)
  ↓
Convex Workflow (11 steps, durable)
  ↓
Gemini AI (summary, architecture, diagrams)
  ↓
Vector Embeddings (Google Text Embedding 004)
  ↓
Convex Database + RAG Component
  ↓
Real-time subscriptions to frontend
  ↓
TanStack Router + React Query
  ↓
shadcn/ui components
```

## Documentation

See `CLAUDE.md` for comprehensive details:
- **Complete tech stack** (frontend, backend, AI, deployment)
- **Full route tree** (16 routes, type-safe params)
- **Backend architecture** (workflows, schema, AI integration, agent tools)
- **Frontend patterns** (routing, components, auth, chat)
- **Development guidelines** (workflows, testing, debugging)
- **Deployment guide** (triple-deploy architecture)

## Performance & Costs

**Analysis Performance**:
- Small repos (<50 files): ~90 seconds, $0.018
- Medium repos (50-200 files): ~3 minutes, $0.020
- Large repos (200-500 files): ~5 minutes, $0.025

**Deployment Characteristics**:
- Convex: Global edge, <10ms p99 latency
- Cloudflare Workers: <50ms cold starts, 300+ edge locations
- Netlify: CDN-backed static assets, instant rollbacks

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes, ensure `bun run check && bun run typecheck` pass
4. Commit with conventional commits (`feat:`, `fix:`, `docs:`)
5. Push and open a pull request

## License

MIT