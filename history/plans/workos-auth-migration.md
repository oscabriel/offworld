# WorkOS AuthKit Migration Plan

> **Status:** Planning  
> **Goal:** Replace Better Auth with WorkOS AuthKit for web (GitHub OAuth) and CLI (Device Authorization)

---

## Overview

Raze entire Better Auth implementation and replace with WorkOS AuthKit:
- **Web App:** GitHub OAuth via WorkOS AuthKit hosted UI
- **CLI:** OAuth 2.0 Device Authorization Grant (RFC 8628) via WorkOS API
- **Identity Linking:** Same WorkOS client ID for both = unified user identity

### Why WorkOS?

1. **Production-grade auth** - Battle-tested at scale
2. **Native device auth** - No custom tables or polling logic in Convex
3. **GitHub OAuth built-in** - Single provider config
4. **Convex integration** - Official template exists (`template-tanstack-start-authkit`)

### Current vs Target Architecture

**Current (Better Auth):**
```
Web ──> Better Auth ──> Convex (custom session/user tables)
CLI ──> Better Auth Device Plugin ──> Convex (custom deviceCode table)
```

**Target (WorkOS):**
```
Web ──> WorkOS AuthKit ──> WorkOS (session mgmt) ──> Convex (JWT validation only)
CLI ──> WorkOS Device API ──> WorkOS (session mgmt) ──> Convex (JWT validation only)
```

Key difference: WorkOS manages all session state. Convex only validates JWTs and stores minimal user data.

---

## Prerequisites

### WorkOS Dashboard Setup

1. Create/login to WorkOS account at https://workos.com
2. Navigate to AuthKit configuration
3. Enable **GitHub** social login provider
4. Add redirect URIs:
   - `http://localhost:3001/callback` (development)
   - `https://offworld.sh/callback` (production)
5. Note credentials:
   - `Client ID` (starts with `client_`)
   - `API Key` (starts with `sk_`)
6. Generate a secure cookie password (32+ random characters)

### Environment Variables

**Convex Dashboard** (`npx convex env set`):
```bash
npx convex env set WORKOS_CLIENT_ID client_XXXXX
npx convex env set ADMIN_EMAILS your@email.com
```

**Web App** (`.env.local`):
```bash
WORKOS_CLIENT_ID=client_XXXXX
WORKOS_API_KEY=sk_XXXXX
WORKOS_COOKIE_PASSWORD=<32+ char random string>
WORKOS_REDIRECT_URI=http://localhost:3001/callback

# Existing (keep these)
VITE_CONVEX_URL=https://xxx.convex.cloud
VITE_CONVEX_SITE_URL=https://xxx.convex.site
```

**CLI** (runtime or user config):
```bash
# Same client ID as web - enables identity linking
WORKOS_CLIENT_ID=client_XXXXX
```

---

## File Changes Summary

### Files to DELETE

| Location | File | Reason |
|----------|------|--------|
| `packages/backend/convex/` | `deviceAuth.ts` | Better Auth device flow |
| `apps/web/src/lib/` | `auth-client.ts` | Better Auth client |
| `apps/web/src/lib/` | `auth-server.ts` | Better Auth server helpers |
| `apps/web/src/routes/` | `device.$code.tsx` | Better Auth device approval UI |
| `apps/web/src/routes/api/auth/` | `$.ts` | Better Auth API routes |
| `apps/web/src/routes/` | `login.tsx` | Redundant with sign-in.tsx |

### Files to CREATE

| Location | File | Purpose |
|----------|------|---------|
| `apps/web/src/routes/` | `callback.tsx` | WorkOS OAuth callback handler |
| `apps/web/src/` | `start.ts` | TanStack Start middleware config |

### Files to MODIFY

| Location | File | Changes |
|----------|------|---------|
| `packages/backend/convex/` | `auth.ts` | Complete rewrite - remove Better Auth |
| `packages/backend/convex/` | `auth.config.ts` | WorkOS JWT validation config |
| `packages/backend/convex/` | `schema.ts` | Update users table, remove deviceCode |
| `packages/backend/convex/` | `http.ts` | Remove Better Auth routes |
| `packages/backend/convex/` | `convex.config.ts` | Remove Better Auth component |
| `packages/backend/` | `package.json` | Remove Better Auth deps |
| `apps/web/src/` | `router.tsx` | WorkOS provider integration |
| `apps/web/src/routes/` | `__root.tsx` | WorkOS SSR auth |
| `apps/web/src/routes/` | `sign-in.tsx` | WorkOS sign-in URLs |
| `apps/web/src/routes/` | `profile.tsx` | WorkOS sign-out |
| `apps/web/` | `package.json` | Add WorkOS, remove Better Auth |
| `apps/cli/src/handlers/` | `auth.ts` | WorkOS device auth API |

---

## Phase 1: Backend Changes

### 1.1 Remove Better Auth Component

**File:** `packages/backend/convex/convex.config.ts`

```typescript
// BEFORE
import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);

export default app;

// AFTER
import { defineApp } from "convex/server";

const app = defineApp();

export default app;
```

### 1.2 WorkOS JWT Validation Config

**File:** `packages/backend/convex/auth.config.ts`

```typescript
import type { AuthConfig } from "convex/server";

const clientId = process.env.WORKOS_CLIENT_ID;
if (!clientId) {
  throw new Error("WORKOS_CLIENT_ID env var required");
}

export default {
  providers: [
    {
      type: "customJwt",
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
} satisfies AuthConfig;
```

### 1.3 Auth Functions Rewrite

**File:** `packages/backend/convex/auth.ts`

```typescript
import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";

// ============================================================================
// User Queries
// ============================================================================

/**
 * Get current authenticated user from Convex identity
 * Returns user record from our users table
 */
export const getCurrentUser = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!user) return null;
    return { ...user, id: user._id };
  },
});

/**
 * Safe version that never throws
 */
export const getCurrentUserSafe = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return null;

      const user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .first();

      if (!user) return null;
      return { ...user, id: user._id };
    } catch {
      return null;
    }
  },
});

// ============================================================================
// Internal Auth Helpers
// ============================================================================

/**
 * Get authenticated user or throw
 */
export async function getUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .first();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

/**
 * Get authenticated user or null
 */
export async function safeGetUser(ctx: QueryCtx | MutationCtx) {
  try {
    return await getUser(ctx);
  } catch {
    return null;
  }
}

/**
 * Upsert user on first login
 * Call this after successful authentication
 */
export const ensureUser = mutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Check if user exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (existing) {
      // Update user info if changed
      if (
        existing.email !== identity.email ||
        existing.name !== identity.name ||
        existing.image !== identity.pictureUrl
      ) {
        await ctx.db.patch(existing._id, {
          email: identity.email ?? existing.email,
          name: identity.name ?? existing.name,
          image: identity.pictureUrl ?? existing.image,
        });
      }
      return existing;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email ?? "",
      name: identity.name ?? null,
      image: identity.pictureUrl ?? null,
      createdAt: new Date().toISOString(),
    });

    return await ctx.db.get(userId);
  },
});

// ============================================================================
// Admin Functions
// ============================================================================

function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_EMAILS;
  if (!emails) return [];
  return emails.split(",").map((e) => e.trim().toLowerCase());
}

/**
 * Require admin access or throw
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getUser(ctx);
  const adminEmails = getAdminEmails();

  if (!adminEmails.includes(user.email.toLowerCase())) {
    throw new Error("Admin access required");
  }

  return user;
}

/**
 * Check if current user is admin
 */
export const isAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await safeGetUser(ctx);
    if (!user) return false;
    return getAdminEmails().includes(user.email.toLowerCase());
  },
});
```

### 1.4 Schema Updates

**File:** `packages/backend/convex/schema.ts`

Update the users table and remove deviceCode:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ... keep existing entity/architecture schemas ...

export default defineSchema({
  // ... keep analyses and pushLogs tables unchanged ...

  // Updated users table with tokenIdentifier for Convex auth
  users: defineTable({
    tokenIdentifier: v.string(), // Convex identity token (from WorkOS JWT)
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"]),

  // DELETE: deviceCode table (WorkOS manages device codes)
});
```

### 1.5 HTTP Routes Cleanup

**File:** `packages/backend/convex/http.ts`

Remove Better Auth route registration:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUser } from "./auth";

const http = httpRouter();

// DELETE THIS LINE:
// authComponent.registerRoutes(http, createAuth);

// ============================================================================
// /api/analyses/push endpoint - Updated auth check
// ============================================================================

http.route({
  path: "/api/analyses/push",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Check authorization header
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({
            error: "Authentication required",
            message: "Please run 'ow auth login' first",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Validate token via Convex auth (WorkOS JWT)
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Get user from our users table
      const user = await ctx.runQuery(internal.auth.getUserByToken, {
        tokenIdentifier: identity.tokenIdentifier,
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const userId = user._id;

      // ... rest of push handler unchanged ...
    } catch (error) {
      console.error("Push error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

// ... keep /api/analyses/pull and /api/analyses/check unchanged ...

export default http;
```

Add internal query for HTTP handler:

**File:** `packages/backend/convex/auth.ts` (add to existing)

```typescript
import { internalQuery } from "./_generated/server";

// Internal query for HTTP handlers
export const getUserByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  returns: v.any(),
  handler: async (ctx, { tokenIdentifier }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier)
      )
      .first();
  },
});
```

### 1.6 Package.json Updates

**File:** `packages/backend/package.json`

```json
{
  "name": "@offworld/backend",
  "version": "1.0.0",
  "dependencies": {
    "convex": "catalog:",
    "dotenv": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@edge-runtime/vm": "catalog:",
    "@offworld/config": "workspace:*",
    "@types/node": "^25.0.9",
    "convex-test": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Removed:
- `@convex-dev/better-auth`
- `better-auth`

### 1.7 Delete Device Auth File

**Delete:** `packages/backend/convex/deviceAuth.ts`

---

## Phase 2: Web App Changes

### 2.1 Package.json Updates

**File:** `apps/web/package.json`

Add:
```json
"@workos/authkit-tanstack-react-start": "^0.1.0"
```

Remove:
```json
"@convex-dev/better-auth": "catalog:",
"better-auth": "catalog:"
```

### 2.2 Create start.ts (Middleware)

**File:** `apps/web/src/start.ts` (NEW)

```typescript
import { createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";

export const startInstance = createStart(() => ({
  requestMiddleware: [authkitMiddleware()],
}));
```

### 2.3 Create Callback Route

**File:** `apps/web/src/routes/callback.tsx` (NEW)

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute,
    },
  },
});
```

### 2.4 Rewrite Router

**File:** `apps/web/src/router.tsx`

```typescript
import { ConvexQueryClient } from "@convex-dev/react-query";
import { env } from "@offworld/env/web";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { useCallback, useMemo } from "react";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const convexUrl = env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not set");
  }

  const convex = new ConvexReactClient(convexUrl);
  const convexQueryClient = new ConvexQueryClient(convex);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    context: { queryClient, convexClient: convex, convexQueryClient },
    Wrap: ({ children }) => (
      <AuthKitProvider>
        <ConvexProviderWithAuth
          client={convexQueryClient.convexClient}
          useAuth={useAuthFromWorkOS}
        >
          {children}
        </ConvexProviderWithAuth>
      </AuthKitProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

/**
 * Bridge WorkOS auth state to Convex's useAuth interface
 */
function useAuthFromWorkOS() {
  const { loading, user } = useAuth();
  const { accessToken, getAccessToken } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!accessToken || forceRefreshToken) {
        return (await getAccessToken()) ?? null;
      }
      return accessToken;
    },
    [accessToken, getAccessToken],
  );

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

### 2.5 Rewrite Root Route

**File:** `apps/web/src/routes/__root.tsx`

```typescript
import { convexQuery, type ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import type { ConvexReactClient } from "convex/react";

import { BackgroundImage } from "@/components/layout/background-image";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/layout/footer";
import Header from "@/components/layout/header";
import appCss from "../index.css?url";

/**
 * Server function to get WorkOS auth state for SSR
 */
const fetchWorkosAuth = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuth();
  return {
    userId: auth.user?.id ?? null,
    token: auth.user ? auth.accessToken : null,
  };
});

export interface RouterAppContext {
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "offworld" },
      { name: "description", content: "Explore distant code." },
      { property: "og:title", content: "OFFWORLD" },
      { property: "og:description", content: "Explore distant code." },
      { property: "og:image", content: "https://offworld.sh/opengraph-image.png" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://offworld.sh" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "OFFWORLD" },
      { name: "twitter:description", content: "Explore distant code." },
      { name: "twitter:image", content: "https://offworld.sh/opengraph-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preload", as: "image", href: "/background-image.png" },
      { rel: "preload", as: "image", href: "/logotype.svg" },
      { rel: "preload", as: "image", href: "/logotype-mobile.svg" },
      { rel: "preload", as: "image", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sorts+Mill+Goudy:ital@0;1&family=Geist+Mono:wght@300;400;500;600&display=swap",
      },
    ],
  }),

  component: RootDocument,

  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchWorkosAuth();

    // Set auth token for SSR queries
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    // Prefetch user data
    await ctx.context.queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentUserSafe, {}),
    );

    return {
      isAuthenticated: !!token,
      token,
      userId,
    };
  },
});

function RootDocument() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="relative flex min-h-screen flex-col">
        <BackgroundImage />
        <div className="relative z-10 flex flex-1 flex-col">
          <Header />
          <main className="flex flex-1 flex-col">
            <Outlet />
          </main>
          <Footer />
        </div>
        <Toaster richColors />
        <TanStackRouterDevtools position="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
```

### 2.6 Rewrite Sign-In Route

**File:** `apps/web/src/routes/sign-in.tsx`

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
  component: SignInComponent,
  validateSearch: searchSchema,
  loader: async ({ search }) => {
    const { user } = await getAuth();

    // Already authenticated - redirect
    if (user) {
      throw redirect({ to: search.redirect || "/" });
    }

    // Get WorkOS sign-in URL with optional return path
    const signInUrl = await getSignInUrl({
      data: search.redirect ? { returnPathname: search.redirect } : undefined,
    });

    return { signInUrl };
  },
});

function SignInComponent() {
  const { signInUrl } = Route.useLoaderData();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center font-serif text-5xl font-normal">
          Welcome to Offworld
        </h1>

        <div className="flex justify-center">
          <a href={signInUrl}>
            <Button className="w-xs" size="lg">
              <svg
                className="mr-2 h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-background font-mono text-base">
                Sign in with GitHub
              </span>
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
```

### 2.7 Rewrite Profile Route

**File:** `apps/web/src/routes/profile.tsx`

```typescript
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  component: ProfileComponent,
  loader: async () => {
    const { user } = await getAuth();

    if (!user) {
      const signInUrl = await getSignInUrl({
        data: { returnPathname: "/profile" },
      });
      throw redirect({ href: signInUrl });
    }

    return { workosUser: user };
  },
});

function ProfileComponent() {
  const { data: user } = useSuspenseQuery(
    convexQuery(api.auth.getCurrentUserSafe, {}),
  );
  const { signOut } = useAuth();

  const handleSignOut = () => {
    signOut();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-center font-serif text-5xl font-normal">Profile</h1>

        <div className="border-border bg-card space-y-4 rounded-lg border p-6">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Name</p>
            <p className="font-serif text-lg">{user.name || "Not set"}</p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Email</p>
            <p className="font-mono text-sm">{user.email}</p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOutIcon className="size-4" />
            <span className="font-mono">Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 2.8 Delete Files

Delete these files:
- `apps/web/src/lib/auth-client.ts`
- `apps/web/src/lib/auth-server.ts`
- `apps/web/src/routes/device.$code.tsx`
- `apps/web/src/routes/api/auth/$.ts`
- `apps/web/src/routes/login.tsx`

---

## Phase 3: CLI Changes

### 3.1 Rewrite Auth Handler

**File:** `apps/cli/src/handlers/auth.ts`

```typescript
/**
 * Auth command handlers - WorkOS Device Authorization Flow (RFC 8628)
 */

import * as p from "@clack/prompts";
import {
  saveAuthData,
  clearAuthData,
  getAuthStatus,
  getAuthPath,
} from "@offworld/sdk";
import open from "open";
import { createSpinner } from "../utils/spinner";

// ============================================================================
// Configuration
// ============================================================================

// Same client ID as web app - enables identity linking
const WORKOS_CLIENT_ID =
  process.env.WORKOS_CLIENT_ID ?? "client_XXXXX"; // Replace with actual

const POLL_INTERVAL = 5000; // 5 seconds per RFC 8628
const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Types
// ============================================================================

export interface AuthLoginResult {
  success: boolean;
  email?: string;
  message?: string;
}

export interface AuthLogoutResult {
  success: boolean;
  message: string;
}

export interface AuthStatusResult {
  loggedIn: boolean;
  email?: string;
  userId?: string;
  expiresAt?: string;
}

interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

// ============================================================================
// WorkOS Device Auth API
// ============================================================================

/**
 * Step 1: Request device code from WorkOS
 */
async function requestDeviceCode(): Promise<DeviceAuthResponse> {
  const response = await fetch(
    "https://api.workos.com/user_management/authorize/device",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: WORKOS_CLIENT_ID }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to request device code: ${error}`);
  }

  return response.json();
}

/**
 * Step 3: Poll for token after user approves
 */
async function pollForToken(
  deviceCode: string,
): Promise<TokenResponse | TokenErrorResponse> {
  const response = await fetch(
    "https://api.workos.com/user_management/authenticate",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: WORKOS_CLIENT_ID,
      }),
    },
  );

  return response.json();
}

// ============================================================================
// Login Handler
// ============================================================================

export async function authLoginHandler(): Promise<AuthLoginResult> {
  const s = createSpinner();

  // Check existing auth
  const currentStatus = getAuthStatus();
  if (currentStatus.isLoggedIn) {
    p.log.info(`Already logged in as ${currentStatus.email || "unknown user"}`);
    const shouldRelogin = await p.confirm({
      message: "Do you want to log in again?",
    });
    if (!shouldRelogin || p.isCancel(shouldRelogin)) {
      return { success: true, email: currentStatus.email };
    }
  }

  // Step 1: Request device code
  s.start("Requesting device code...");

  let deviceData: DeviceAuthResponse;
  try {
    deviceData = await requestDeviceCode();
  } catch (error) {
    s.stop("Failed to get device code");
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  s.stop();

  const { device_code, user_code, verification_uri_complete, interval } =
    deviceData;

  // Step 2: Display instructions to user
  p.log.info(`\nOpen this URL in your browser:\n`);
  p.log.info(`  ${verification_uri_complete}\n`);
  p.log.info(
    `Or go to https://authkit.workos.com/device and enter: ${user_code}\n`,
  );

  // Try to open browser automatically
  try {
    await open(verification_uri_complete);
  } catch {
    // User can open manually
  }

  // Step 3: Poll for token
  s.start("Waiting for approval...");

  const pollInterval = (interval || 5) * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME) {
    await sleep(pollInterval);

    const result = await pollForToken(device_code);

    // Success - got token
    if ("access_token" in result) {
      s.stop("Login successful!");

      saveAuthData({
        token: result.access_token,
        expiresAt: result.expires_in
          ? new Date(Date.now() + result.expires_in * 1000).toISOString()
          : undefined,
      });

      p.log.success("Logged in successfully");
      return { success: true };
    }

    // Handle polling errors
    const errorResult = result as TokenErrorResponse;

    switch (errorResult.error) {
      case "authorization_pending":
        // Keep polling - user hasn't approved yet
        break;

      case "slow_down":
        // Back off - wait extra interval
        await sleep(pollInterval);
        break;

      case "access_denied":
        s.stop("Login denied");
        return { success: false, message: "Authorization denied by user" };

      case "expired_token":
        s.stop("Code expired");
        return {
          success: false,
          message: "Device code expired. Please try again.",
        };

      default:
        s.stop("Login failed");
        return {
          success: false,
          message: errorResult.error_description || errorResult.error,
        };
    }
  }

  s.stop("Timeout");
  return { success: false, message: "Authorization timed out. Please try again." };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Logout Handler
// ============================================================================

export async function authLogoutHandler(): Promise<AuthLogoutResult> {
  const status = getAuthStatus();

  if (!status.isLoggedIn) {
    p.log.info("Not currently logged in");
    return {
      success: true,
      message: "Not logged in",
    };
  }

  const cleared = clearAuthData();

  if (cleared) {
    p.log.success("Logged out successfully");
    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  p.log.warn("Could not clear auth data");
  return {
    success: false,
    message: "Could not clear auth data",
  };
}

// ============================================================================
// Status Handler
// ============================================================================

export async function authStatusHandler(): Promise<AuthStatusResult> {
  const status = getAuthStatus();

  if (status.isLoggedIn) {
    p.log.info(`Logged in as: ${status.email || "unknown"}`);
    if (status.expiresAt) {
      const expiresDate = new Date(status.expiresAt);
      p.log.info(`Session expires: ${expiresDate.toLocaleString()}`);
    }
    p.log.info(`Auth file: ${getAuthPath()}`);
  } else {
    p.log.info("Not logged in");
    p.log.info("Run 'ow auth login' to authenticate");
  }

  return {
    loggedIn: status.isLoggedIn,
    email: status.email,
    userId: status.userId,
    expiresAt: status.expiresAt,
  };
}
```

### 3.2 CLI Package.json

**File:** `apps/cli/package.json`

Remove Convex dependency (no longer needed - using WorkOS API directly):
```json
{
  "dependencies": {
    // DELETE: "convex": "...",
    // DELETE: "@offworld/backend": "workspace:*",
  }
}
```

---

## Phase 4: First Login Flow

When a user authenticates for the first time, we need to create their user record in Convex.

### Option A: Automatic via HTTP Handler

Update `/api/analyses/push` to call `ensureUser` mutation on first request.

### Option B: Client-Side Call

After successful WorkOS auth, call `ensureUser` mutation from the web app.

**Recommended:** Option B - cleaner separation.

Add to `__root.tsx` beforeLoad:

```typescript
beforeLoad: async (ctx) => {
  const { userId, token } = await fetchWorkosAuth();

  if (token) {
    ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);

    // Ensure user exists in Convex on first login
    await ctx.context.queryClient.prefetchQuery({
      queryKey: ["ensureUser"],
      queryFn: async () => {
        const client = ctx.context.convexClient;
        return await client.mutation(api.auth.ensureUser);
      },
      staleTime: Infinity, // Only run once per session
    });
  }

  // ... rest unchanged
};
```

---

## Database Migration

Since this is a clean slate:

1. **Delete all existing tables** via Convex dashboard:
   - Any Better Auth internal tables (`user`, `session`, `account`, `verification`)
   - Our `deviceCode` table
   - Existing `users` table (will be recreated with new schema)

2. **Deploy new schema:**
   ```bash
   cd packages/backend
   npx convex dev --once
   ```

3. **Verify:**
   ```bash
   npx convex dashboard
   ```
   Check that `users` table has `tokenIdentifier` index.

---

## Testing Checklist

### Web App
- [ ] Sign in via GitHub redirects to WorkOS
- [ ] Callback route handles OAuth response
- [ ] User created in Convex on first login
- [ ] Profile page shows user info
- [ ] Sign out works
- [ ] Protected routes redirect to sign-in
- [ ] SSR auth works (no flash of unauthenticated state)

### CLI
- [ ] `ow auth login` displays device code and URL
- [ ] Browser opens automatically
- [ ] Approving in browser completes CLI login
- [ ] Token saved to auth file
- [ ] `ow auth status` shows logged-in state
- [ ] `ow auth logout` clears token
- [ ] `ow push` works with new token

### Identity Linking
- [ ] Same GitHub account via web and CLI = same Convex user
- [ ] Different email = different Convex user

---

## Rollback Plan

If issues arise:
1. Revert to previous commit
2. Restore Better Auth deps in package.json
3. Restore deleted files from git

No database rollback needed (clean slate).

---

## Checklist

### Backend
- [ ] Update `convex.config.ts` - remove Better Auth component
- [ ] Update `auth.config.ts` - WorkOS JWT config
- [ ] Rewrite `auth.ts` - Convex identity-based auth
- [ ] Update `schema.ts` - add tokenIdentifier, remove deviceCode
- [ ] Update `http.ts` - remove Better Auth routes
- [ ] Delete `deviceAuth.ts`
- [ ] Update `package.json` - remove Better Auth deps
- [ ] Set `WORKOS_CLIENT_ID` env var in Convex

### Web App
- [ ] Update `package.json` - add WorkOS, remove Better Auth
- [ ] Create `start.ts` - middleware config
- [ ] Create `routes/callback.tsx` - OAuth callback
- [ ] Rewrite `router.tsx` - WorkOS provider
- [ ] Rewrite `routes/__root.tsx` - SSR auth
- [ ] Rewrite `routes/sign-in.tsx` - WorkOS URLs
- [ ] Rewrite `routes/profile.tsx` - WorkOS sign-out
- [ ] Delete `lib/auth-client.ts`
- [ ] Delete `lib/auth-server.ts`
- [ ] Delete `routes/device.$code.tsx`
- [ ] Delete `routes/api/auth/$.ts`
- [ ] Delete `routes/login.tsx`
- [ ] Set WorkOS env vars in `.env.local`

### CLI
- [ ] Rewrite `handlers/auth.ts` - WorkOS device auth API
- [ ] Update `package.json` - remove Convex deps (optional)
- [ ] Update `WORKOS_CLIENT_ID` constant

### Testing
- [ ] Web sign-in flow
- [ ] CLI device auth flow
- [ ] Identity linking (same user for web + CLI)
- [ ] Protected route redirects
- [ ] Sign-out flows
- [ ] Push with new auth token
