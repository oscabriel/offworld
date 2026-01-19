# offworld

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Convex** - Reactive backend-as-a-service platform
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Starlight** - Documentation site with Astro

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
bun run dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Your app will connect to the Convex cloud backend automatically.

## Deployment (Cloudflare via Alchemy)

Each app has its own Alchemy configuration:

```bash
# Web app
cd apps/web && bun run deploy   # Deploy web to Cloudflare
cd apps/web && bun run destroy  # Tear down web deployment

# Docs
cd apps/docs && bun run deploy  # Deploy docs to Cloudflare
cd apps/docs && bun run destroy # Tear down docs deployment
```

## Project Structure

```
offworld/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
│   ├── docs/        # Documentation site (Astro Starlight)
├── packages/
│   ├── backend/     # Convex backend functions and schema
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:setup`: Setup and configure your Convex project
- `bun run check-types`: Check TypeScript types across all apps
- `bun run check`: Run Oxlint and Oxfmt
- `cd apps/web && bun run deploy`: Deploy web app to Cloudflare
- `cd apps/docs && bun run deploy`: Deploy docs to Cloudflare
- `cd apps/docs && bun run build`: Build documentation site
