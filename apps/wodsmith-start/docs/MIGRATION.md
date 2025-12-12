# Migration Guide: Next.js → TanStack Start

Comprehensive guide for understanding how patterns from the Next.js version (`apps/wodsmith`) translate to TanStack Start (`apps/wodsmith-start`).

## Quick Reference

| Concept | Next.js | TanStack Start |
|---------|---------|----------------|
| Routing | `app/` + `page.tsx` | `routes/` + `file.tsx` |
| Server Functions | ZSA `createServerAction()` | `createServerFn()` |
| Server Directive | `"use server"` | Auto-detected from `src/server-functions/` |
| Data Invalidation | `revalidatePath()` | TanStack Query invalidation |
| Cloudflare Access | `getRequestContext().env` | `env` from `cloudflare:workers` |
| Session Storage | Lucia + custom KV | Custom KV or cookies |
| Layout Files | `layout.tsx` | Parent route file (e.g., `_main.tsx`) |
| API Routes | `app/api/*/route.ts` | `routes/api/*.ts` |

---

## Routing Patterns

### Route Structure

**Next.js** uses directory-based routing with `page.tsx`:

```
app/
├── (main)/
│   ├── workouts/
│   │   ├── page.tsx          # /workouts
│   │   ├── [id]/
│   │   │   └── page.tsx      # /workouts/:id
│   │   └── new/
│   │       └── page.tsx      # /workouts/new
│   └── layout.tsx
├── (auth)/
│   ├── sign-in/
│   │   └── page.tsx          # /sign-in
│   └── layout.tsx
└── layout.tsx
```

**TanStack Start** uses file-based routing with file naming:

```
routes/
├── _main/
│   ├── workouts.index.tsx    # /workouts
│   ├── workouts.$id.tsx      # /workouts/:id
│   └── workouts.new.tsx      # /workouts/new
├── _main.tsx                 # Layout
├── _auth/
│   └── sign-in.tsx           # /sign-in
├── _auth.tsx                 # Layout
└── __root.tsx                # Root layout
```

### Route File Patterns

| Pattern | Example | Path |
|---------|---------|------|
| Index route | `workouts.index.tsx` | `/workouts` |
| Nested under group | `_main/workouts.index.tsx` | `/workouts` |
| Dynamic segment | `workouts.$id.tsx` | `/workouts/123` |
| Multi-segment | `workouts.$id.edit.tsx` | `/workouts/123/edit` |
| Layout | `_main.tsx` | Parent for all `_main/*` routes |
| Root | `__root.tsx` | Global root |

### Common Migrations

**Sign-In Page:**
```typescript
// Next.js: (auth)/sign-in/page.tsx
export default function SignInPage() { ... }

// TanStack: routes/_auth/sign-in.tsx
export const Route = createFileRoute('/_auth/sign-in')({
  component: SignInPage,
})
```

**Workout Detail:**
```typescript
// Next.js: (main)/workouts/[id]/page.tsx
export default function WorkoutPage({ params }) {
  const id = params.id
}

// TanStack: routes/_main/workouts.$id.tsx
export const Route = createFileRoute('/_main/workouts/$id')({
  loader: async ({ params }) => {
    return getWorkoutFn({ id: params.id })
  },
  component: WorkoutPage,
})

function WorkoutPage() {
  const workout = Route.useLoaderData()
  const { id } = Route.useParams()
}
```

**Nested Dynamic Routes:**
```typescript
// Next.js: (compete)/compete/[slug]/page.tsx
// TanStack: routes/_compete/compete.$slug.tsx

// Next.js: (compete)/compete/[slug]/register/page.tsx
// TanStack: routes/_compete/compete.$slug.register.tsx
```

---

## Server Functions

### Basic Pattern Conversion

**Next.js (ZSA):**
```typescript
"use server"
import { createServerAction } from "@repo/zsa"

export const createWorkout = createServerAction()
  .input(z.object({
    name: z.string(),
    description: z.string().optional(),
  }))
  .handler(async ({ input }) => {
    // Business logic
    await db.insert(schema.workouts).values({
      name: input.name,
      description: input.description,
    })
    
    revalidatePath("/workouts")
    return { success: true }
  })
```

**TanStack Start:**
```typescript
import { createServerFn } from '@tanstack/react-start'

const createWorkoutSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
})

export const createWorkout = createServerFn('POST')
  .validator(createWorkoutSchema)
  .handler(async ({ data }) => {
    // Business logic
    await db.insert(schema.workouts).values({
      name: data.name,
      description: data.description,
    })
    
    // Note: No revalidatePath - use client-side invalidation
    return { success: true }
  })
```

### Key Differences

1. **No `"use server"` directive** - File location determines if it's a server function
2. **Input is `data` not `input`** - `{ data }` destructuring in handler
3. **HTTP method required** - `createServerFn('GET')`, `createServerFn('POST')`
4. **Manual validation** - Use `.validator()` instead of `.input()`
5. **No auto-revalidation** - Handle cache invalidation on client

### Server Function Organization

Keep all server functions in `src/server-functions/` directory:

```
src/server-functions/
├── workouts.ts      # Workout CRUD
├── movements.ts     # Movement operations
├── auth.ts          # Auth operations
├── team.ts          # Team management
└── ...
```

Each file exports multiple functions for a domain:

```typescript
// src/server-functions/workouts.ts
export const getWorkoutsFn = createServerFn('GET').handler(...)
export const getWorkoutFn = createServerFn('GET').handler(...)
export const createWorkout = createServerFn('POST').handler(...)
export const updateWorkout = createServerFn('PUT').handler(...)
export const deleteWorkout = createServerFn('DELETE').handler(...)
```

### Error Handling

**Next.js (ZSA):**
```typescript
export const loginAction = createServerAction()
  .input(z.object({ email, password }))
  .handler(async ({ input }) => {
    const user = await authenticateUser(input)
    if (!user) {
      return { error: 'Invalid credentials' }
    }
    return { user }
  })
```

**TanStack Start:**
```typescript
export const login = createServerFn('POST')
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const user = await authenticateUser(data)
    if (!user) {
      throw new Error('Invalid credentials')  // Use throw for errors
    }
    return { user }
  })
```

Server functions should throw errors. Catch them client-side:

```typescript
try {
  const result = await login({ data: formData })
} catch (error) {
  console.error(error.message)
}
```

---

## Route Loaders

TanStack Start uses loaders to fetch data server-side before rendering:

```typescript
export const Route = createFileRoute('/_main/workouts/$id')({
  loader: async ({ params }) => {
    // Runs on server
    const workout = await getWorkoutFn({ id: params.id })
    return { workout, stats: await getStatsFn() }
  },
  component: WorkoutPage,
  errorComponent: WorkoutError,      // Error boundary
  pendingComponent: WorkoutSkeleton,  // Loading state
})

function WorkoutPage() {
  // Access loader data
  const { workout, stats } = Route.useLoaderData()
  
  // Access URL params
  const { id } = Route.useParams()
  
  // Navigate
  const navigate = useNavigate()
  
  return (
    <div>
      <h1>{workout.name}</h1>
      <p>{workout.description}</p>
    </div>
  )
}
```

### Loader vs Server Function

| Use Case | Pattern |
|----------|---------|
| Initial page data | Loader (server-side, automatic) |
| Form submission | Server function (called from client) |
| Refetch after mutation | Server function + navigate/invalidate |
| Dependent data | Loader (runs once at route init) |

---

## Authentication Patterns

### Session Management

**Next.js:**
```typescript
import { cookies, headers } from "next/headers"
import { Session, User } from "lucia"

export async function getSessionFromCookie(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("session_id")?.value
  if (!sessionToken) return null
  
  const kv = getRequestContext().env.KV_SESSIONS
  const session = await kv.get(sessionToken)
  return session ? JSON.parse(session) : null
}
```

**TanStack Start:**
```typescript
import { env } from 'cloudflare:workers'

export async function getSessionFromCookie(): Promise<Session | null> {
  // Implementation same as Next.js but with Cloudflare env:
  const kv = env.KV_SESSIONS  // Instead of getRequestContext().env
  // ... rest of logic
}
```

### Login Flow

**Next.js (ZSA):**
```typescript
"use server"

export const loginAction = createServerAction()
  .input(loginSchema)
  .handler(async ({ input }) => {
    const user = await authenticateUser(input.email, input.password)
    if (!user) return { error: 'Invalid' }
    
    const session = await createSessionForUser(user.id)
    const cookieStore = await cookies()
    cookieStore.set('session_id', session.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    
    redirect('/dashboard')
  })
```

**TanStack Start:**
```typescript
export const login = createServerFn('POST')
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const user = await authenticateUser(data.email, data.password)
    if (!user) throw new Error('Invalid credentials')
    
    const session = await createSessionForUser(user.id)
    // Session cookie is set internally by framework
    await setSessionCookie(session.token)
    
    throw redirect({ to: '/dashboard' })  // Use throw redirect
  })
```

### Client-Side Session

**Next.js:**
```typescript
// Use custom hook from utils/auth.ts
const session = useSessionStore()
```

**TanStack Start:**
```typescript
// Same pattern works
const session = useSessionStore()

// Or fetch server-side:
const sessionData = await getCurrentUserFn()
```

---

## Data Mutations & Cache Invalidation

### Pattern Differences

**Next.js:**
```typescript
"use server"

export const updateWorkout = createServerAction()
  .handler(async ({ input }) => {
    await db.update(schema.workouts).set(input)
    revalidatePath('/workouts')      // Auto-invalidate cached pages
    return { success: true }
  })
```

**TanStack Start:**
```typescript
export const updateWorkout = createServerFn('PUT')
  .handler(async ({ data }) => {
    await db.update(schema.workouts).set(data)
    // No auto-revalidation - client decides cache strategy
    return { success: true }
  })

// Client-side:
async function handleUpdate(data) {
  const result = await updateWorkout({ data })
  if (result.success) {
    // Option 1: Refetch loader data
    await navigate({ to: '.', search: {} })
    
    // Option 2: Use TanStack Query to invalidate
    queryClient.invalidateQueries({ queryKey: ['workouts'] })
  }
}
```

### TanStack Query Integration

For dynamic data that needs refetching:

```typescript
// Server function (src/server-functions/workouts.ts)
export const getWorkouts = createServerFn('GET')
  .handler(async () => {
    const session = await getSessionFromCookie()
    return db.query.workouts.findMany({
      where: eq(schema.workouts.teamId, session.teamId)
    })
  })

// Route with client-side fetching
import { useQuery } from '@tanstack/react-query'

function WorkoutsPage() {
  const { data: workouts } = useQuery({
    queryKey: ['workouts'],
    queryFn: () => getWorkouts(),
  })
  
  return <WorkoutList workouts={workouts} />
}
```

---

## API Routes

### Conversion Pattern

**Next.js:**
```typescript
// app/api/workouts/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  
  const results = await searchWorkouts(q)
  return Response.json({ results })
}
```

**TanStack Start:**
```typescript
// routes/api/workouts-search.ts
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/workouts-search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const q = url.searchParams.get('q')
        
        const results = await searchWorkouts(q)
        return json({ results })
      }
    }
  }
})
```

### Webhook Handler

**Next.js (Stripe):**
```typescript
// app/api/webhooks/stripe/route.ts
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')!
  const body = await request.text()
  
  const event = stripe.webhooks.constructEvent(body, sig, webhook_secret)
  
  switch (event.type) {
    case 'charge.succeeded':
      await handleChargeSucceeded(event.data.object)
      break
  }
  
  return Response.json({ received: true })
}
```

**TanStack Start:**
```typescript
// routes/api/webhooks/stripe.ts
export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get('stripe-signature')!
        const body = await request.text()
        
        const event = stripe.webhooks.constructEvent(body, sig, webhook_secret)
        
        switch (event.type) {
          case 'charge.succeeded':
            await handleChargeSucceeded(event.data.object)
            break
        }
        
        return json({ received: true })
      }
    }
  }
})
```

---

## Component Patterns

### Form Submission

**Next.js (with ZSA):**
```typescript
import { useServerAction } from "@repo/zsa-react"

function CreateWorkoutForm() {
  const { execute, isPending } = useServerAction(createWorkout)
  
  const handleSubmit = async (data) => {
    await execute(data)
    toast.success('Workout created')
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={isPending}>Create</button>
    </form>
  )
}
```

**TanStack Start:**
```typescript
function CreateWorkoutForm() {
  const [isPending, startTransition] = useTransition()
  
  const handleSubmit = (data) => {
    startTransition(async () => {
      try {
        const result = await createWorkout({ data })
        if (result.success) {
          toast.success('Workout created')
          navigate({ to: '/workouts' })
        }
      } catch (error) {
        toast.error(error.message)
      }
    })
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={isPending}>Create</button>
    </form>
  )
}
```

### Conditional Rendering Based on Session

**Next.js:**
```typescript
import { getSession } from "@/utils/auth"

export default async function Dashboard() {
  const session = await getSession()
  
  if (!session) {
    redirect('/sign-in')
  }
  
  return <div>Welcome {session.user.email}</div>
}
```

**TanStack Start:**
```typescript
export const Route = createFileRoute('/_main/dashboard')({
  loader: async () => {
    const session = await requireAuthFn()  // Throws if not authenticated
    return { user: session }
  },
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useLoaderData()
  return <div>Welcome {user.email}</div>
}
```

---

## Database Operations

### Query Pattern

**Next.js & TanStack - Same:**
```typescript
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'

const workouts = await getDb()
  .select()
  .from(schema.workouts)
  .where(eq(schema.workouts.teamId, teamId))
```

### Connection String

**Next.js:**
```typescript
// Uses OpenNext, which handles Cloudflare D1
const db = drizzle(getRequestContext().env.DB, { schema })
```

**TanStack Start:**
```typescript
// src/db/index.ts
import { env } from 'cloudflare:workers'

export function getDb() {
  return drizzle(env.DB, { schema })
}
```

### Batch Queries (D1 100-param limit)

Both use same `autochunk` utility:

```typescript
import { autochunk } from '@/utils/batch-query'

const results = await autochunk(
  { items: workoutIds, otherParametersCount: 1 },
  async (chunk) => {
    return db.select()
      .from(schema.workouts)
      .where(inArray(schema.workouts.id, chunk))
  }
)
```

---

## Environment Variables

### Development

**Next.js:**
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
DATABASE_URL=file:./local.db
```

**TanStack Start:**
```bash
# .dev.vars
SESSION_SECRET=your-secret-here
DATABASE_ID=local
```

### Production

**Next.js (OpenNext):**
```
Cloudflare Dashboard → Workers → Secrets
```

**TanStack Start:**
```
Cloudflare Dashboard → Workers → Settings → Secrets
+ Bindings in wrangler.jsonc
```

---

## Type Safety

### Validation

Both use Zod:

```typescript
// Next.js
export const createWorkout = createServerAction()
  .input(z.object({ name: z.string() }))
  .handler(async ({ input }) => { ... })

// TanStack
export const createWorkout = createServerFn('POST')
  .validator(z.object({ name: z.string() }))
  .handler(async ({ data }) => { ... })
```

### Types Inference

**Next.js:**
```typescript
import { useServerAction } from "@repo/zsa-react"
import type { createWorkout } from "@/actions/workouts"

type CreateWorkoutInput = Parameters<typeof createWorkout>[0]
```

**TanStack:**
```typescript
import { createWorkout } from '~/server-functions/workouts'

// Access via server function type
const result = await createWorkout({ data: {} })
type Result = Awaited<ReturnType<typeof createWorkout>>
```

---

## Common Gotchas

### 1. **Session Cookie Not Set**
- Ensure `.setSessionCookie()` is called in login flow
- Check `SESSION_SECRET` is 32+ characters
- Verify KV binding in `wrangler.jsonc`

### 2. **Redirect Timing**
- Must `throw redirect()` (not `return`)
- Only works in server functions/loaders, not client

### 3. **D1 Transaction Limitations**
- No transaction support
- Use manual rollback logic if needed
- Avoid complex multi-table operations

### 4. **Type Errors in Routes**
- Ensure file in `src/routes/` structure
- Server functions must be in `src/server-functions/`
- Import paths must match `tsconfig.json` aliases

### 5. **Cloudflare Binding Access**
- Use `env` from `cloudflare:workers`
- Only available server-side
- Not available in client components

### 6. **Query Invalidation**
- No automatic invalidation like `revalidatePath`
- Must manually call server function or invalidate query
- Use `Route.useNavigate()` to reload loader data

---

## Testing Patterns

### Unit Test

Both use Vitest:

```typescript
import { describe, it, expect } from 'vitest'

describe('createWorkout', () => {
  it('creates workout with valid input', async () => {
    const result = await createWorkout({
      data: { name: 'Test', teamId: 'team-1' }
    })
    
    expect(result.success).toBe(true)
    expect(result.workout.id).toBeDefined()
  })
})
```

### Integration Test

```typescript
import { beforeEach, afterEach } from 'vitest'

describe('Workout Flow', () => {
  beforeEach(async () => {
    await setupTestDB()
  })
  
  afterEach(async () => {
    await cleanupTestDB()
  })
  
  it('creates and retrieves workout', async () => {
    const create = await createWorkout({ data: {...} })
    const get = await getWorkoutFn({ id: create.workout.id })
    
    expect(get.workout.id).toBe(create.workout.id)
  })
})
```

---

## Migration Checklist

- [ ] Create `src/routes/` structure matching route groups
- [ ] Create `src/server-functions/` with all ZSA actions converted
- [ ] Update `src/db/index.ts` to use `env` from `cloudflare:workers`
- [ ] Migrate auth utilities to use Cloudflare env
- [ ] Convert layouts to parent route files
- [ ] Update all route components to use loaders
- [ ] Convert server actions to server functions
- [ ] Update form components to use `useTransition`
- [ ] Set up TanStack Query for dynamic data
- [ ] Test authentication flow
- [ ] Test all CRUD operations
- [ ] Test error handling
- [ ] Update deployment scripts
- [ ] Run type checking: `tsc --noEmit`

---

## Additional Resources

- [TanStack Start Docs](https://tanstack.com/start/latest/docs)
- [TanStack Router Guide](https://tanstack.com/router/latest/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
