# TanStack Start Research

## Overview

**TanStack Start** is a **full-stack React/Solid/Vue framework** built on top of TanStack Router. It lives in the `tanstack/router` monorepo and provides server-side rendering, streaming, and server functions.

| Property             | Value                        |
| -------------------- | ---------------------------- |
| **Repository**       | `tanstack/router` (monorepo) |
| **Current Version**  | `1.142.11`                   |
| **Author**           | Tanner Linsley               |
| **License**          | MIT                          |
| **Node Requirement** | `>=22.12.0`                  |
| **Vite Requirement** | `>=7.0.0`                    |

---

## Architecture

### Package Structure

```
packages/
├── react-start/              # Main React Start package
├── react-start-client/       # Client-side React Start
├── react-start-server/       # Server-side React Start
├── solid-start/              # Solid.js Start
├── vue-start/                # Vue Start
├── start-client-core/        # Shared client core (createServerFn, middleware)
├── start-server-core/        # Shared server core (request handling, SSR)
├── start-plugin-core/        # Vite plugin core
├── start-storage-context/    # AsyncLocalStorage context
├── server-functions-plugin/  # Babel plugin for server functions
├── directive-functions-plugin/ # Directive processing
├── router-core/              # Core router logic
├── react-router/             # React Router
├── router-plugin/            # Router Vite plugin
└── zod-adapter/              # Zod validation adapter
    valibot-adapter/          # Valibot adapter
    arktype-adapter/          # ArkType adapter
```

### Key Dependencies

- **Build**: Vite 7+, Nitro (for deployment adapters)
- **Validation**: Zod, Valibot, ArkType adapters
- **State**: TanStack Query integration (`router-ssr-query`)
- **History**: `@tanstack/history` for navigation

---

## Core Concepts

### 1. Server Functions (`createServerFn`)

The primary API for server-side code execution:

```tsx
import {createServerFn} from '@tanstack/react-start'

// GET request (default)
const getData = createServerFn().handler(async () => {
  return {message: 'Hello from server!'}
})

// POST with validation
const saveData = createServerFn({method: 'POST'})
  .inputValidator((data: {name: string}) => data)
  .handler(async ({data}) => {
    return await db.save(data)
  })
```

**Key features:**

- Type-safe RPC between client and server
- Automatic serialization/deserialization
- Middleware support (auth, logging, etc.)
- Input validation with adapters (Zod, Valibot, ArkType)

### 2. Middleware System

```tsx
import {createMiddleware} from '@tanstack/react-start'

const authMiddleware = createMiddleware().server(async ({next, context}) => {
  const user = await getUser()
  return next({context: {user}})
})

const protectedFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({context}) => {
    // context.user is available
  })
```

### 3. Request Handler

The `createStartHandler` function handles all incoming requests:

```tsx
// packages/start-server-core/src/createStartHandler.ts
export function createStartHandler(cb: HandlerCallback): RequestHandler {
  // 1. Handles server function calls (/_server prefix)
  // 2. Executes route middleware
  // 3. Renders React/Solid/Vue app with SSR
  // 4. Supports streaming responses
}
```

---

## File Structure (Typical App)

```
src/
├── routes/
│   ├── __root.tsx          # Root layout
│   ├── index.tsx           # Home route
│   └── posts/
│       ├── index.tsx       # /posts
│       └── $postId.tsx     # /posts/:postId
├── serverActions/
│   └── userActions.ts      # Server functions
├── app.tsx                  # Start instance
└── entry.server.tsx         # Server entry
```

---

## Key Files in the Codebase

| File                                                   | Purpose                               |
| ------------------------------------------------------ | ------------------------------------- |
| `packages/start-client-core/src/createServerFn.ts`     | Server function factory (731 lines)   |
| `packages/start-server-core/src/createStartHandler.ts` | Main request handler (511 lines)      |
| `packages/start-client-core/src/createMiddleware.ts`   | Middleware system                     |
| `packages/react-start/src/plugin/vite.ts`              | Vite plugin configuration             |
| `packages/server-functions-plugin/`                    | Babel transforms for server functions |

---

## Deployment Targets

TanStack Start supports multiple deployment platforms via Nitro:

- **Cloudflare Workers/Pages**
- **Netlify**
- **Vercel**
- **Node.js**
- **Bun**
- **Static (SSG)**

---

## Recent Development Activity

Based on recent commits:

- `v1.142.11` - Latest release
- Deprecating `json` function in favor of `Response.json`
- Streaming fixes
- Compiler plugin improvements
- h3 v2 compatibility updates

---

## Hotspots (Most Complex/Changed Files)

1. **Link tests** - `packages/react-router/tests/link.test.tsx` (6,615 lines)
2. **Router tests** - `packages/react-router/tests/router.test.tsx` (3,330 lines)
3. **Router core** - `packages/router-core/src/router.ts` (6 TODOs)
4. **Start handler** - `packages/start-server-core/src/createStartHandler.ts` (10 TODOs)

---

## Framework Comparison

| Feature          | TanStack Start      | Next.js         | Remix      |
| ---------------- | ------------------- | --------------- | ---------- |
| Server Functions | `createServerFn()`  | `'use server'`  | Actions    |
| Type Safety      | End-to-end          | Partial         | Partial    |
| Middleware       | Built-in chain      | Edge middleware | Loaders    |
| Validation       | Zod/Valibot/ArkType | Manual          | Manual     |
| Streaming        | Native              | Native          | Native     |
| Frameworks       | React, Solid, Vue   | React only      | React only |

---

## Getting Started

```bash
# Create new project
npx create-tanstack-app@latest my-app

# Or add to existing project
npm install @tanstack/react-start @tanstack/react-router
```

**Docs**: https://tanstack.com/start

---

## Comparison with Current Stack (Next.js + ZSA)

### Similarities to Our Current Approach

| Our Pattern        | TanStack Equivalent                 |
| ------------------ | ----------------------------------- |
| ZSA server actions | `createServerFn()`                  |
| ZSA middleware     | `createMiddleware()`                |
| Zod validation     | `inputValidator()` with zod-adapter |
| Next.js App Router | TanStack Router (file-based)        |

### Key Differences

1. **Server Functions vs Server Actions**

   - TanStack: Explicit `createServerFn()` with method specification
   - Next.js/ZSA: `'use server'` directive with implicit POST

2. **Routing**

   - TanStack: Type-safe routes with params/search validation built-in
   - Next.js: File-based routing, separate validation needed

3. **Data Loading**

   - TanStack: Route loaders with automatic caching
   - Next.js: Server Components or client-side fetching

4. **Deployment**
   - TanStack: Nitro-based, multi-platform
   - Next.js: Vercel-optimized, OpenNext for Cloudflare

### Migration Considerations

If migrating from Next.js + ZSA to TanStack Start:

```tsx
// Current (ZSA)
export const createTeam = createServerAction()
  .input(z.object({name: z.string()}))
  .handler(async ({input}) => {
    return await db.teams.create(input)
  })

// TanStack Start equivalent
export const createTeam = createServerFn({method: 'POST'})
  .inputValidator(zodValidator(z.object({name: z.string()})))
  .handler(async ({data}) => {
    return await db.teams.create(data)
  })
```

### Pros of TanStack Start

- End-to-end type safety (routes, params, search)
- Multi-framework support (React, Solid, Vue)
- Built-in caching and prefetching
- Cleaner middleware composition
- Better Cloudflare Workers support (native)

### Cons / Risks

- Newer framework (less battle-tested)
- Requires Vite 7+ and Node 22+
- Smaller ecosystem than Next.js
- Migration effort from existing Next.js app
- Learning curve for team
