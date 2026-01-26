# @offworld/backend

Convex serverless backend for Offworld.

## Setup

```bash
# From monorepo root
bun run dev:server

# Or from this directory
bun run dev
```

## Schema

### Tables

| Table        | Description                          |
| ------------ | ------------------------------------ |
| `repository` | GitHub repo metadata                 |
| `reference`  | Reference content + metadata         |
| `pushLog`    | Push history for rate limiting       |
| `user`       | WorkOS user records                  |

### Repository

```typescript
{
  fullName: string        // owner/repo
  owner: string
  name: string
  description?: string
  stars: number
  language?: string
  defaultBranch: string
  githubUrl: string
  fetchedAt: string       // ISO timestamp
}
```

### Reference

```typescript
{
  repositoryId: Id<"repository">
  referenceName: string
  referenceDescription: string
  referenceContent: string    // markdown
  commitSha: string
  generatedAt: string         // ISO timestamp
  pullCount: number
  isVerified: boolean
  workosId?: string           // user who pushed
}
```

## Modules

| File             | Description                      |
| ---------------- | -------------------------------- |
| `schema.ts`      | Table definitions                |
| `references.ts`  | Reference CRUD operations        |
| `repository.ts`  | Repository queries               |
| `admin.ts`       | Admin functions                  |
| `github.ts`      | GitHub API queries               |
| `auth.ts`        | WorkOS auth helpers              |
| `http.ts`        | HTTP routes                      |
| `validation/`    | Input validators                 |

## Usage from SDK/Web

```typescript
import { api } from "@offworld/backend/api";

// Pull reference
const ref = await client.query(api.references.getByRepoName, {
  fullName: "owner/repo"
});

// Push reference
await client.mutation(api.references.push, {
  fullName: "owner/repo",
  referenceName: "repo.md",
  referenceContent: "...",
  commitSha: "abc123"
});
```

## Environment Variables

Set in Convex dashboard:

```
GITHUB_TOKEN=           # GitHub API access
WORKOS_CLIENT_ID=       # WorkOS OAuth
WORKOS_API_KEY=         # WorkOS API
```

## Commands

```bash
bun run dev          # Start Convex dev server
bun run typecheck    # Type check
bun run test         # Run tests
```
