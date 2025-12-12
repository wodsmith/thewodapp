# TanStack Start Best Practices Guide

**Version**: 1.141.1  
**Reference**: [TanStack Start Official Documentation](https://tanstack.com/start/latest/docs/framework/react/)

## Table of Contents

1. [Server Functions](#server-functions)
2. [Input Validation with Zod](#input-validation-with-zod)
3. [Route Loaders vs Server Functions](#route-loaders-vs-server-functions)
4. [Root Route Structure](#root-route-structure)
5. [Error Handling](#error-handling)
6. [Middleware Patterns](#middleware-patterns)
7. [API Routes (Server Routes)](#api-routes-server-routes)

---

## Server Functions

### Overview

Server functions allow you to define server-only logic that runs seamlessly from anywhere in your application—components, loaders, hooks, or other server functions. They maintain type safety across the network boundary automatically.

### Modern createServerFn() Syntax

The recommended approach uses the fluent configuration API with optional HTTP method specification:

```typescript
import { createServerFn } from '@tanstack/react-start'

// GET request (default)
export const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})

// POST request
export const saveData = createServerFn({ method: 'POST' }).handler(async () => {
  // Server-only logic
  return { success: true }
})
```

### Why Object Config vs String Method

Use object config with optional `method` property:
- **Recommended**: `createServerFn({ method: 'POST' })`
- **Default**: No method = GET request
- Provides explicit configuration
- Better IDE autocomplete
- Aligns with TanStack Start API design

### Where to Call Server Functions

Server functions are universally callable from:

- **Route Loaders** — perfect for SSR data fetching
- **React Components** — use with `useServerFn()` hook
- **Other Server Functions** — compose server logic
- **Event Handlers** — form submissions, clicks

```typescript
// Route loader
export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
})

// Component with useServerFn
function PostList() {
  const getPosts = useServerFn(getServerPosts)
  
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: () => getPosts(),
  })
  
  return <div>{/* render posts */}</div>
}
```

### Server Context & Request Handling

Access HTTP request details:

```typescript
import { getRequestHeader, setResponseStatus } from '@tanstack/react-start'

export const getUser = createServerFn()
  .handler(async () => {
    const userAgent = getRequestHeader('user-agent')
    setResponseStatus(200)
    return { userAgent }
  })
```

Available utilities:
- `getRequest()` — full Request object
- `getRequestHeader()` — read specific headers
- `setResponseHeader()` — set response headers
- `setResponseStatus()` — custom HTTP status codes

---

## Input Validation with Zod

### Best Practice Pattern

Always validate inputs at the boundary for security and type safety:

```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name required'),
  age: z.number().min(0).max(150),
  email: z.string().email(),
})

export const createUser = createServerFn({ method: 'POST' })
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    // data is fully typed and validated
    const { name, age, email } = data
    
    // Safe to use validated data
    return await db.users.create({ name, age, email })
  })
```

### Validation at Every Boundary

```typescript
// Client -> Server
const result = await createUser({
  name: 'John',
  age: 30,
  email: 'john@example.com',
})

// TypeScript ensures input matches schema
// Runtime validation prevents bad data
```

### FormData Handling

```typescript
export const submitForm = createServerFn({ method: 'POST' })
  .inputValidator((data) => {
    if (!(data instanceof FormData)) {
      throw new Error('Expected FormData')
    }
    
    return {
      name: data.get('name')?.toString() || '',
      email: data.get('email')?.toString() || '',
    }
  })
  .handler(async ({ data }) => {
    // Process validated form data
    return { success: true }
  })
```

### Why Validation Matters

- **Security**: Prevents malicious input
- **Type Safety**: Full TypeScript support on server
- **Network Safety**: Validates data crossing boundary
- **DX**: Clear error messages

---

## Route Loaders vs Server Functions

### When to Use Route Loaders

**Route loaders** are ideal for:
- Initial page data during SSR
- Critical rendering data (not deferred)
- Declarative data requirements

```typescript
export const Route = createFileRoute('/posts')({
  loader: async () => {
    // Runs before component renders (SSR + client)
    return await fetchPosts()
  },
  component: PostListComponent,
})
```

### When to Use Server Functions

**Server functions** excel at:
- On-demand operations (mutations, refetches)
- Composing server logic
- Sharing logic between routes
- Client-triggered operations

```typescript
// Mutation (doesn't fit loader pattern)
export const updatePost = createServerFn({ method: 'PUT' })
  .inputValidator(UpdatePostSchema)
  .handler(async ({ data }) => {
    return await db.posts.update(data)
  })

// Use in component
function PostEditor() {
  const handleSave = async (post) => {
    await updatePost(post)
  }
  
  return <form onSubmit={handleSave}>{/* form */}</form>
}
```

### Key Difference

| Aspect | Loader | Server Function |
|--------|--------|-----------------|
| Timing | Before render | On-demand |
| Use Case | Page data | Operations |
| Composability | Limited | Excellent |
| Type Safety | Implicit | Explicit |

---

## Root Route Structure

### Anatomy of __root.tsx

The root route manages the document shell and global layout:

```typescript
// src/routes/__root.tsx
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'WodSmith' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

### HeadContent Component

Renders meta tags, title, links, and head scripts:

```typescript
<head>
  <HeadContent />
  {/* Outputs: meta tags, title from route.head() */}
</head>
```

**Must be placed in `<head>` tag** for proper functioning.

### Scripts Component

Loads client-side JavaScript and hydration code:

```typescript
<body>
  {/* Page content */}
  <Scripts />
  {/* Must be at end of body for proper JS loading */}
</body>
```

**Must be at end of `<body>` tag** for optimal performance.

### Head Configuration

Define meta, title, and links declaratively:

```typescript
export const Route = createFileRoute('/products')({
  head: () => ({
    meta: [
      { name: 'description', content: 'Browse products' },
      { property: 'og:title', content: 'Products' },
    ],
  }),
})
```

### Root Route Responsibilities

- Document shell (`<html>`, `<head>`, `<body>`)
- Global layout
- Navigation shell
- HeadContent and Scripts components
- Shared providers (auth, theme, etc.)

---

## Error Handling

### Error Throws

Errors thrown in server functions serialize to the client:

```typescript
import { createServerFn } from '@tanstack/react-start'

export const riskyOperation = createServerFn()
  .handler(async () => {
    if (Math.random() > 0.5) {
      throw new Error('Operation failed')
    }
    return { success: true }
  })

// Client-side
try {
  await riskyOperation()
} catch (error) {
  console.error(error.message) // "Operation failed"
}
```

### Redirects from Server Functions

Use `redirect()` for navigation from server functions:

```typescript
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const requireAuth = createServerFn()
  .handler(async () => {
    const user = await getCurrentUser()
    
    if (!user) {
      throw redirect({ to: '/login' })
    }
    
    return user
  })

// Usage in loader
export const Route = createFileRoute('/dashboard')({
  loader: () => requireAuth(),
})
```

### Not Found Errors

Throw `notFound()` for missing resources:

```typescript
import { notFound } from '@tanstack/react-router'

export const getPost = createServerFn()
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const post = await db.posts.find(data.id)
    
    if (!post) {
      throw notFound()
    }
    
    return post
  })
```

### Error Boundaries

Wrap server function calls with error boundaries for graceful error UI:

```typescript
function PostComponent() {
  const [error, setError] = useState<Error | null>(null)
  
  const handleSubmit = async () => {
    try {
      await updatePost(data)
    } catch (err) {
      setError(err as Error)
    }
  }
  
  if (error) return <ErrorUI error={error} />
  
  return <PostForm onSubmit={handleSubmit} />
}
```

---

## Middleware Patterns

### Request Middleware vs Server Function Middleware

```typescript
import { createMiddleware } from '@tanstack/react-start'

// Request middleware: All server requests
const loggingMiddleware = createMiddleware().server(async ({ next }) => {
  console.log('Request started')
  const result = await next()
  console.log('Request completed')
  return result
})

// Server function middleware: Only server functions
const authMiddleware = createMiddleware({ type: 'function' })
  .inputValidator(z.object({ token: z.string() }))
  .server(async ({ next, data }) => {
    // Validate token
    return next()
  })
```

### Composing Middleware

Stack middleware for layered behavior:

```typescript
const authMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    // Auth logic
    return next()
  })

const loggingMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ next }) => {
    // Logging after auth
    return next()
  })

// Apply to server function
export const protectedAction = createServerFn()
  .middleware([loggingMiddleware])
  .handler(async () => {
    // Runs through middleware chain
    return { success: true }
  })
```

### Context Management

Pass data through middleware chain:

```typescript
const workspaceMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    return next({
      context: {
        workspaceId: 'ws-123',
      },
    })
  })

const requireWorkspace = createMiddleware({ type: 'function' })
  .middleware([workspaceMiddleware])
  .server(async ({ next, context }) => {
    if (!context.workspaceId) {
      throw new Error('Workspace required')
    }
    return next()
  })
```

### Client-Side Middleware

Run logic before/after RPC calls:

```typescript
const authMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    // Before RPC: add auth header
    return next({
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    })
  })
  .server(async ({ next }) => {
    // After: handle auth
    return next()
  })
```

### Global Middleware

Apply to all server operations via `src/start.ts`:

```typescript
// src/start.ts
import { createStart } from '@tanstack/react-start'
import { globalAuthMiddleware } from '@/middleware/auth'

export const startInstance = createStart(() => {
  return {
    functionMiddleware: [globalAuthMiddleware],
  }
})
```

---

## API Routes (Server Routes)

### Basic Server Route Structure

Define HTTP endpoints alongside React routes:

```typescript
// src/routes/api/users.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response(
          JSON.stringify({ users: [] }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      },
      POST: async ({ request }) => {
        const body = await request.json()
        return new Response(JSON.stringify({ created: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

### Dynamic Path Parameters

```typescript
// src/routes/api/users/$id.ts
export const Route = createFileRoute('/api/users/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params
        const user = await db.users.find(id)
        
        if (!user) {
          return new Response('Not found', { status: 404 })
        }
        
        return json(user)
      },
    },
  },
})
```

### Using json() Helper

Simplify JSON responses:

```typescript
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/status')({
  server: {
    handlers: {
      GET: async () => {
        return json({ status: 'ok', timestamp: new Date() })
      },
    },
  },
})
```

### Middleware on Routes

```typescript
// src/routes/api/protected.ts
export const Route = createFileRoute('/api/protected')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request }) => {
        // Only runs if auth middleware passes
        return json({ data: 'secret' })
      },
    },
  },
})
```

### Wildcard Routes

Capture remaining path segments:

```typescript
// src/routes/api/files/$.ts
export const Route = createFileRoute('/api/files/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { _splat } = params // "path/to/file.txt"
        return json({ file: _splat })
      },
    },
  },
})
```

### Response Customization

```typescript
export const Route = createFileRoute('/api/data')({
  server: {
    handlers: {
      GET: async () => {
        return new Response('Custom response', {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'max-age=3600',
            'X-Custom-Header': 'value',
          },
        })
      },
    },
  },
})
```

### Combining Routes & API in One File

```typescript
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  // Server: HTTP endpoints
  server: {
    handlers: {
      GET: async () => {
        return json(await db.posts.findAll())
      },
      POST: async ({ request }) => {
        const data = await request.json()
        return json(await db.posts.create(data), { status: 201 })
      },
    },
  },
  // Client: React component
  component: PostsPage,
})

function PostsPage() {
  // Render posts
}
```

---

## Best Practices Summary

### ✅ Do's

1. **Use createServerFn() with object config** — Modern, explicit, type-safe
2. **Validate all inputs with Zod** — Security and type guarantees
3. **Use loaders for SSR data** — Critical path data
4. **Use server functions for mutations** — On-demand operations
5. **Handle errors explicitly** — Throw redirect, notFound, or custom errors
6. **Compose middleware** — Build reusable authentication, logging, etc.
7. **Keep server code server-only** — Use server functions wisely

### ❌ Don'ts

1. **Don't skip input validation** — Network boundary requires protection
2. **Don't mix loader and server function logic** — Use appropriate tool for job
3. **Don't ignore HeadContent and Scripts** — Required for proper hydration
4. **Don't throw generic errors** — Be specific about what went wrong
5. **Don't make middleware too complex** — Keep concerns separated
6. **Don't forget to handle FormData** — Common in real apps

### Performance Tips

1. Loaders run during SSR — keep fast
2. Server functions are RPC calls — minimize round-trips
3. Use caching in loaders where appropriate
4. Middleware runs for every call — keep lightweight
5. Error handling doesn't need awaiting in some cases

### Type Safety

Always let TypeScript infer types:

```typescript
// Good: Let inference work
export const getUser = createServerFn()
  .inputValidator(UserSchema)
  .handler(async ({ data }) => {
    // TypeScript knows data is User type
    return { user: data }
  })

// Avoid: Over-explicit types
export const getUser = createServerFn<User, UserResponse>()
  // Less readable, same safety
```

---

## Additional Resources

- [Official TanStack Start Docs](https://tanstack.com/start/latest/docs/framework/react/)
- [TanStack Router Docs](https://tanstack.com/router/latest/docs)
- [Zod Validation Library](https://zod.dev/)

---

**Last Updated**: December 2025  
**TanStack Start Version**: 1.141.1
