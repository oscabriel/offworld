# Ralph Agent Instructions

## Your Task

1. Read `scripts/ralph/PRD.json`
2. Read `scripts/ralph/progress.txt`
   (check Codebase Patterns first)
3. Check you're on the correct branch
4. Pick highest priority story 
   where `passes: false`
5. Implement that ONE story
6. Run typecheck and tests
7. Update AGENTS.md files with learnings
8. Commit: `feat: [ID] - [Title]`
9. Update prd.json: `passes: true`
10. Append learnings to progress.txt

## Progress Format

APPEND to progress.txt:

## [Date] - [Story ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
---

## Codebase Patterns

### Route Files
```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/path")({
  component: PageComponent,
});

function PageComponent() {
  return <div>...</div>;
}
```

### Convex Queries
```tsx
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

// Non-blocking query
const { data, isLoading } = useQuery(convexQuery(api.module.function, { arg: value }));

// Suspense query (blocks until loaded)
const { data } = useSuspenseQuery(convexQuery(api.module.function, {}));
```

### Imports
- Path alias: `@/` → `src/`
- API: `@offworld/backend/convex/_generated/api`
- UI components: `@/components/ui/button`
- Icons: `lucide-react`

### UI Components
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";

// Link with params
<Link to="/repo/$owner/$repo" params={{ owner, repo }}>...</Link>
```

### Auth Pattern
```tsx
import { authClient } from "@/lib/auth-client";

// Sign out
authClient.signOut().then(() => location.reload());

// Get current user (in Convex query)
const user = await authComponent.safeGetAuthUser(ctx);
```

### Styling
- Tailwind v4 (no config file, uses CSS)
- Dark mode: class on `<html className="dark">`
- shadcn/ui components in `components/ui/`
- No border-radius in V1 design (--radius: 0rem)

## Stop Condition

If ALL stories pass, reply:
<promise>COMPLETE</promise>

Otherwise end normally.
