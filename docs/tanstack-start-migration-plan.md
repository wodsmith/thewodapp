# Wodsmith Migration Plan: Next.js to TanStack Start

## Executive Summary

This document outlines a comprehensive migration plan for moving the Wodsmith application from Next.js 15 to TanStack Start with the Cloudflare Vite plugin. The migration covers both products: **Wodsmith Train** (workout management) and **Wodsmith Compete** (competition platform).

**Epic ID:** `thewodapp-dc6`

## Migration Overview

### Source Application (apps/wodsmith)
- **Framework:** Next.js 15.3.2 with App Router
- **Routes:** 70+ routes across 7 route groups
- **Authentication:** Lucia-style auth with Cloudflare KV sessions
- **Server Logic:** ZSA (Zod Server Actions) with 30 action files
- **Database:** Drizzle ORM with Cloudflare D1 (SQLite)
- **State:** Zustand stores (session, team-context, nav, config)
- **UI:** Shadcn/Radix components with Tailwind CSS

### Target Application (apps/wodsmith-start)
- **Framework:** TanStack Start (RC) with TanStack Router
- **Build:** Vite with Cloudflare Vite plugin
- **Server Logic:** TanStack server functions (`createServerFn`)
- **Routing:** File-based routing with nested layouts

---

## Architecture Mapping

### Route Pattern Translations

| Next.js Pattern | TanStack Start Pattern | Example |
|-----------------|----------------------|---------|
| `(group)/page.tsx` | `_group.tsx` + `_group/index.tsx` | `(auth)/sign-in` → `_auth/sign-in.tsx` |
| `[param]/page.tsx` | `$param.tsx` | `[id]/page.tsx` → `$id.tsx` |
| `layout.tsx` | Parent route file | `(main)/layout.tsx` → `_main.tsx` |
| `api/route.ts` | `api/*.ts` with handlers | `api/chat/route.ts` → `api/chat.ts` |
| `loading.tsx` | `pendingComponent` in route | N/A |
| `error.tsx` | `errorComponent` in route | N/A |

### Server-Side Pattern Translations

| Next.js Pattern | TanStack Start Pattern |
|-----------------|----------------------|
| ZSA `createServerAction()` | `createServerFn()` from `@tanstack/react-start` |
| `"use server"` directive | Server function auto-detection |
| `cookies()` from `next/headers` | `useSession()` from `@tanstack/react-start/server` |
| `headers()` from `next/headers` | `getRequest()` in server function handler |
| `revalidatePath()` | Query invalidation via TanStack Query |
| React `cache()` | Loader caching (automatic) |

### Cloudflare Bindings Access

```typescript
// Next.js (via OpenNext)
const env = getRequestContext().env

// TanStack Start
import { env } from 'cloudflare:workers'
```

---

## Phase Breakdown

### Phase 0: Foundation Setup (Priority: Critical)
**Bead ID:** `thewodapp-dc6.1`

Configure the TanStack Start base infrastructure:

1. **Update `vite.config.ts`**
   - Add Cloudflare plugin with D1/KV bindings
   - Configure path aliases matching existing app
   - Set up environment variables

2. **Update `wrangler.jsonc`**
   - Configure D1 database binding
   - Configure KV namespace for sessions
   - Add environment variables

3. **Update `package.json`**
   - Add all required dependencies from wodsmith
   - Add TanStack ecosystem packages (Query, Table, Form)
   - Add Drizzle, Lucia auth deps, etc.

4. **Configure `__root.tsx`**
   - Set up global providers
   - Add Tailwind CSS imports
   - Configure QueryClient

**Files:**
- `apps/wodsmith-start/vite.config.ts`
- `apps/wodsmith-start/wrangler.jsonc`
- `apps/wodsmith-start/package.json`
- `apps/wodsmith-start/src/routes/__root.tsx`

---

### Phase 1A: Database Layer (Priority: Critical)
**Bead ID:** `thewodapp-dc6.2`

Migrate Drizzle schema and D1 connection:

1. **Copy all schema files** from `src/db/schemas/`
   - users, teams, workouts, programming, competitions, etc.
   - Keep exact same structure

2. **Update `getDb()` function**
   ```typescript
   // Old (Next.js)
   import { getRequestContext } from "@cloudflare/next-on-pages"
   
   // New (TanStack Start)
   import { env } from 'cloudflare:workers'
   
   export function getDb() {
     return drizzle(env.DB, { schema })
   }
   ```

3. **Copy migrations** (unchanged - D1 compatible)

**Files:**
- `apps/wodsmith-start/src/db/index.ts`
- `apps/wodsmith-start/src/db/schema.ts`
- `apps/wodsmith-start/src/db/schemas/*.ts`

---

### Phase 1B: Core Utilities (Priority: Critical)
**Bead ID:** `thewodapp-dc6.3`

Migrate shared utilities (mostly copy-paste):

- `cn.ts` - className utility (no changes)
- `batch-query.ts` - D1 autochunk (no changes)
- `date-utils.ts` - Date formatting (no changes)
- `slugify.ts` - URL slug generation (no changes)
- `constants.ts` - App constants (no changes)

---

### Phase 2: Authentication System (Priority: Critical)
**Bead ID:** `thewodapp-dc6.4`

This is the most complex migration phase. The auth system needs significant adaptation.

1. **Migrate `auth.ts`**
   
   Replace Next.js patterns with TanStack Start built-in session:
   ```typescript
   // Old (Next.js)
   import { cookies, headers } from "next/headers"
   const cookieStore = await cookies()
   cookieStore.get("session")
   
   // New (TanStack Start) - Use built-in useSession
   import { useSession } from '@tanstack/react-start/server'
   
   type SessionData = {
     userId?: string
     email?: string
     teams?: Array<{ id: string; role: string }>
   }
   
   export function useAppSession() {
     return useSession<SessionData>({
       name: 'wodsmith-session',
       password: process.env.SESSION_SECRET!, // 32+ chars
       cookie: {
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'lax',
         httpOnly: true,
       },
     })
   }
   ```

2. **Migrate `kv-session.ts`**
   
   **Option A:** Use TanStack Start's built-in cookie sessions (recommended - simpler)
   
   **Option B:** Keep KV for more control, update access pattern:
   ```typescript
   // Old
   const kv = getRequestContext().env.KV_SESSIONS
   
   // New
   import { env } from 'cloudflare:workers'
   const kv = env.KV_SESSIONS
   ```

3. **Create auth server functions**
   
   ```typescript
   // src/server-functions/auth.ts
   import { createServerFn } from '@tanstack/react-start'
   import { redirect } from '@tanstack/react-router'
   import { useAppSession } from '../utils/session'
   
   export const getCurrentUserFn = createServerFn({ method: 'GET' })
     .handler(async () => {
       const session = await useAppSession()
       if (!session.data.userId) return null
       return await getUserById(session.data.userId)
     })
   
   export const loginFn = createServerFn({ method: 'POST' })
     .inputValidator((data: { email: string; password: string }) => data)
     .handler(async ({ data }) => {
       const user = await authenticateUser(data.email, data.password)
       if (!user) return { error: 'Invalid credentials' }
       
       const session = await useAppSession()
       await session.update({ userId: user.id, email: user.email })
       
       throw redirect({ to: '/dashboard' })
     })
   ```

4. **Migrate team authorization** (`team-auth.ts`)
   - Same logic, different cookie access
   - Update `requireTeamMembership()`, `hasTeamPermission()`

**Files:**
- `apps/wodsmith-start/src/utils/auth.ts`
- `apps/wodsmith-start/src/utils/kv-session.ts`
- `apps/wodsmith-start/src/utils/team-auth.ts`
- `apps/wodsmith-start/src/utils/password-hasher.ts`
- `apps/wodsmith-start/src/utils/webauthn.ts`
- `apps/wodsmith-start/src/server/auth-middleware.ts`

---

### Phase 3A-C: Server Functions (Priority: High)
**Bead IDs:** `thewodapp-dc6.5`, `thewodapp-dc6.6`, `thewodapp-dc6.7`

Convert all ZSA server actions to TanStack server functions.

**Pattern Translation:**

```typescript
// OLD: ZSA Action
"use server"
import { createServerAction } from "@repo/zsa"

export const createWorkoutAction = createServerAction()
  .input(z.object({ ... }))
  .handler(async ({ input }) => {
    await requireVerifiedEmail()
    // ... business logic
    revalidatePath("/workouts")
    return { success: true }
  })

// NEW: TanStack Server Function
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const createWorkoutSchema = z.object({ ... })

export const createWorkout = createServerFn({ method: 'POST' })
  .validator(createWorkoutSchema)
  .handler(async ({ data }) => {
    await requireVerifiedEmail()
    // ... business logic
    // Note: No revalidatePath - use query invalidation on client
    return { success: true }
  })
```

**Action Groups:**

| Phase | Domain | Files |
|-------|--------|-------|
| 3A | Auth/User | auth, user, team, team-membership, team-role |
| 3B | Training | workouts, movements, programming, scheduling, scaling, logs |
| 3C | Compete | competitions, divisions, heats, scores, sponsors, commerce |

---

### Phase 4: State Management (Priority: High)
**Bead ID:** `thewodapp-dc6.8`

Zustand stores work unchanged. Update session provider:

```typescript
// providers.tsx - Update session hydration
export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionHydration>
        {children}
      </SessionHydration>
    </QueryClientProvider>
  )
}
```

Session hydration changes:
- No more `/api/get-session` endpoint
- Use server function instead
- Or hydrate from loader data

---

### Phase 5A-B: UI Components (Priority: High)
**Bead IDs:** `thewodapp-dc6.9`, `thewodapp-dc6.10`

Shadcn/Radix components work unchanged. Main tasks:

1. **Copy `components/ui/` directory** (no changes needed)
2. **Update imports** if path aliases change
3. **Copy domain components** (nav, teams, programming, etc.)
4. **Update any components using `useServerAction` from ZSA**:

```typescript
// OLD
import { useServerAction } from "@repo/zsa-react"
const { execute, isPending } = useServerAction(createWorkoutAction)

// NEW
const [isPending, startTransition] = useTransition()
const handleSubmit = () => {
  startTransition(async () => {
    await createWorkout({ data: formData })
  })
}
```

---

### Phase 6A-G: Routes (Priority: High)
**Bead IDs:** `thewodapp-dc6.11` through `thewodapp-dc6.17`

#### Route Structure Mapping

**Auth Routes (`_auth/`):**
```
(auth)/sign-in/page.tsx       → _auth/sign-in.tsx
(auth)/sign-up/page.tsx       → _auth/sign-up.tsx
(auth)/forgot-password/       → _auth/forgot-password.tsx
(auth)/reset-password/        → _auth/reset-password.tsx
(auth)/verify-email/          → _auth/verify-email.tsx
(auth)/team-invite/           → _auth/team-invite.tsx
```

**Main App Routes (`_main/`):**
```
(main)/workouts/page.tsx              → _main/workouts.index.tsx
(main)/workouts/new/page.tsx          → _main/workouts.new.tsx
(main)/workouts/[id]/page.tsx         → _main/workouts.$id.tsx
(main)/workouts/[id]/edit/page.tsx    → _main/workouts.$id.edit.tsx
(main)/movements/page.tsx             → _main/movements.index.tsx
(main)/movements/[id]/page.tsx        → _main/movements.$id.tsx
(main)/programming/page.tsx           → _main/programming.index.tsx
(main)/programming/[trackId]/page.tsx → _main/programming.$trackId.tsx
```

**Competition Routes (`_compete/`):**
```
(compete)/compete/page.tsx                    → _compete/compete.index.tsx
(compete)/compete/athlete/page.tsx            → _compete/compete.athlete.tsx
(compete)/compete/organizer/page.tsx          → _compete/compete.organizer.index.tsx
(compete)/compete/organizer/[competitionId]/  → _compete/compete.organizer.$competitionId.tsx
(compete)/compete/[slug]/page.tsx             → _compete/compete.$slug.tsx
(compete)/compete/[slug]/register/page.tsx    → _compete/compete.$slug.register.tsx
```

**Admin Routes (`_admin/`):**
```
(admin)/admin/page.tsx                  → _admin/admin.index.tsx
(admin)/admin/teams/page.tsx            → _admin/admin.teams.tsx
(admin)/admin/teams/programming/        → _admin/admin.teams.programming.tsx
(admin)/admin/teams/scaling/            → _admin/admin.teams.scaling.tsx
(admin)/admin/entitlements/             → _admin/admin.entitlements.tsx
```

**Settings Routes (`_settings/`):**
```
(settings)/settings/page.tsx         → _settings/settings.index.tsx
(settings)/settings/profile/         → _settings/settings.profile.tsx
(settings)/settings/security/        → _settings/settings.security.tsx
(settings)/settings/teams/           → _settings/settings.teams.tsx
```

#### Route File Pattern

```typescript
// _main/workouts.$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { fetchWorkout } from '@/server-functions/workouts'

export const Route = createFileRoute('/_main/workouts/$id')({
  loader: async ({ params }) => {
    return fetchWorkout({ data: params.id })
  },
  component: WorkoutDetailPage,
  errorComponent: WorkoutError,
  pendingComponent: WorkoutLoading,
})

function WorkoutDetailPage() {
  const workout = Route.useLoaderData()
  const { id } = Route.useParams()
  
  return <WorkoutDetail workout={workout} />
}
```

---

### Phase 7: API Routes (Priority: Medium)
**Bead ID:** `thewodapp-dc6.18`

Convert Next.js API routes to TanStack Start server routes:

```typescript
// OLD: app/api/chat/route.ts
export async function POST(request: Request) {
  // ...
}

// NEW: routes/api/chat.ts
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ...
        return json({ response })
      }
    }
  }
})
```

API routes to migrate:
- `/api/chat` - AI chat endpoint
- `/api/get-session` - Session retrieval (may convert to server fn)
- `/api/upload` - File upload
- `/api/webhooks/stripe` - Stripe webhooks
- `/api/stripe/connect/callback` - Stripe Connect OAuth
- `/api/workouts/search` - Workout search
- `/api/og` - OpenGraph image generation

---

### Phase 8: Integration Testing (Priority: Medium)
**Bead ID:** `thewodapp-dc6.19`

1. Create test suite for migrated routes
2. Test authentication flows
3. Test CRUD operations
4. Test competition workflows
5. Test Stripe integrations

---

### Phase 9: Documentation (Priority: Low)
**Bead ID:** `thewodapp-dc6.20`

Document:
- Migration decisions and patterns used
- New TanStack-specific patterns
- Updated developer workflow
- Deployment changes

---

## TanStack Ecosystem Recommendations

Based on the migration, recommend using these TanStack products:

| Product | Use Case | Priority |
|---------|----------|----------|
| **TanStack Query** | Server state, caching, mutations | Required |
| **TanStack Router** | Routing (via Start) | Required |
| **TanStack Form** | Form handling (replace react-hook-form) | Recommended |
| **TanStack Table** | Competition leaderboards, admin tables | Recommended |
| **TanStack Virtual** | Long workout/movement lists | Optional |
| **TanStack Pacer** | Debouncing search inputs | Optional |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auth session handling differs | High | Thorough testing of all auth flows |
| Server action pattern changes | Medium | Create migration helper functions |
| Query invalidation vs revalidatePath | Medium | Establish clear invalidation patterns |
| Cloudflare binding access | Low | Well-documented pattern |
| UI components | Low | Mostly copy-paste |

---

## Migration Timeline Estimate

| Phase | Estimated Effort | Dependencies |
|-------|-----------------|--------------|
| Phase 0 | 1-2 days | None |
| Phase 1A-B | 1 day | Phase 0 |
| Phase 2 | 2-3 days | Phase 1 |
| Phase 3A-C | 3-4 days | Phase 2 |
| Phase 4 | 1 day | Phase 2 |
| Phase 5A-B | 2 days | Phase 4 |
| Phase 6A-G | 5-7 days | Phases 3-5 |
| Phase 7 | 1-2 days | Phase 6 |
| Phase 8 | 2-3 days | Phase 7 |
| Phase 9 | 1 day | Phase 8 |

**Total Estimated Effort: 3-4 weeks**

---

## Next Steps

1. Review and approve this migration plan
2. Begin Phase 0: Foundation Setup
3. Work through phases sequentially, with parallel work where possible
4. Track progress via beads (`thewodapp-dc6.*`)

---

## References

- [TanStack Start Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Router File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [TanStack Start Authentication](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)
- [Cloudflare Vite Plugin Example](https://tanstack.com/start/latest/docs/framework/react/examples/start-basic-cloudflare)
