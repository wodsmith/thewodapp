Detailed Plan: Replacing ZSA with TanStack Start Server Functions
Executive Summary
Based on my analysis, I've identified the key differences and created a comprehensive migration strategy:
| Aspect | ZSA (Current) | TanStack Start (Target) |
|--------|---------------|------------------------|
| Server-side definition | createServerAction() | createServerFn() |
| Client-side hook | useServerAction() | useServerFn() + custom hook |
| Input validation | .input(schema) | .validator(schema) or .inputValidator() |
| Handler signature | ({ input, ctx }) | ({ data, context }) |
| Return format | [data, error] tuple | Direct return (throws on error) |
| Middleware | Procedure chaining | createMiddleware() + .middleware([]) |
| Error handling | ZSAError class | Standard Error + redirect()/notFound() |
---
Part 1: Server-Side Migration
1.1 Basic Action Pattern Conversion
Current ZSA Pattern:
// src/actions/team-actions.ts
"use server"
import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})
export const createTeamAction = createServerAction()
  .input(createTeamSchema)
  .handler(async ({ input }) => {
    try {
      const result = await createTeam(input)
      return { success: true, data: result }
    } catch (error) {
      if (error instanceof ZSAError) throw error
      throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create team")
    }
  })
Target TanStack Start Pattern:
// src/server-fns/team-fns.ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})
export const createTeamFn = createServerFn({ method: "POST" })
  .validator(createTeamSchema)
  .handler(async ({ data }) => {
    // Direct return - no try/catch wrapper needed for simple cases
    const result = await createTeam(data)
    return { success: true, data: result }
  })
1.2 Key Differences in Handler Signature
| ZSA | TanStack Start |
|-----|----------------|
| { input } | { data } |
| { ctx } | { context } |
| { request } | Access via getRequest() |
| { responseMeta } | Access via setResponseHeader() |
1.3 Middleware Migration
Current ZSA Procedure Pattern:
// ZSA uses procedure chaining
import { createServerActionProcedure } from "@repo/zsa"
const authedProcedure = createServerActionProcedure()
  .handler(async () => {
    const session = await getSessionFromCookie()
    if (!session) throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
    return { user: session.user }
  })
export const protectedAction = authedProcedure
  .createServerAction()
  .input(schema)
  .handler(async ({ input, ctx }) => {
    // ctx.user is available from procedure
  })
Target TanStack Start Middleware Pattern:
// src/middleware/auth.ts
import { createMiddleware } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getSessionFromCookie()
  
  if (!session) {
    throw redirect({ to: "/sign-in" })
  }
  
  return next({ context: { user: session.user, session } })
})
// Usage in server function
export const protectedFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(schema)
  .handler(async ({ data, context }) => {
    // context.user is available from middleware
  })
1.4 Error Handling Migration
Current ZSA Error Pattern:
import { ZSAError } from "@repo/zsa"
// ZSA error codes
throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
throw new ZSAError("FORBIDDEN", "Access denied")
throw new ZSAError("NOT_FOUND", "Resource not found")
throw new ZSAError("INTERNAL_SERVER_ERROR", "Something went wrong")
throw new ZSAError("INPUT_PARSE_ERROR", zodError)
Target TanStack Start Error Pattern:
import { redirect, notFound } from "@tanstack/react-router"
// For auth errors - use redirect
throw redirect({ to: "/sign-in" })
// For not found - use notFound
throw notFound()
// For other errors - throw standard Error (serialized to client)
throw new Error("Access denied")
// For custom error types, create a custom error class
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = "AppError"
  }
}
throw new AppError("FORBIDDEN", "Access denied", 403)
1.5 Validation with Zod 4
Current Zod 3 Pattern:
import { z } from "zod"
const schema = z.object({
  name: z.string().min(1),
})
export const action = createServerAction()
  .input(schema)
  .handler(...)
Target Zod 4 Pattern:
import { z } from "zod"  // Zod 4
const schema = z.object({
  name: z.string().min(1),
})
export const fn = createServerFn({ method: "POST" })
  .validator(schema)  // TanStack Start uses .validator() 
  .handler(...)
Note: TanStack Start also supports .inputValidator() for custom validation functions:
.inputValidator((data: unknown) => {
  // Custom validation logic
  return validatedData
})
---
Part 2: Client-Side Migration
2.1 Hook Migration
Current useServerAction Pattern:
"use client"
import { useServerAction } from "@repo/zsa-react"
import { createTeamAction } from "@/actions/team-actions"
function CreateTeamForm() {
  const { execute, isPending, data, error } = useServerAction(createTeamAction, {
    onError: ({ err }) => {
      toast.error(err?.message || "Failed")
    },
    onStart: () => {
      toast.loading("Creating...")
    },
    onSuccess: ({ data }) => {
      toast.success("Created!")
      router.push(`/teams/${data.teamId}`)
    },
  })
  const onSubmit = (formData: FormValues) => {
    execute(formData)
  }
}
Target TanStack Start Pattern:
TanStack Start provides useServerFn() but it's simpler - it just wraps the server function for client-side use. For the full useServerAction-like experience, you have several options:
Option A: Use with TanStack Query (Recommended)
"use client"
import { useServerFn } from "@tanstack/react-start"
import { useMutation } from "@tanstack/react-query"
import { createTeamFn } from "@/server-fns/team-fns"
function CreateTeamForm() {
  const createTeam = useServerFn(createTeamFn)
  
  const mutation = useMutation({
    mutationFn: createTeam,
    onError: (error) => {
      toast.error(error.message || "Failed")
    },
    onMutate: () => {
      toast.loading("Creating...")
    },
    onSuccess: (data) => {
      toast.dismiss()
      toast.success("Created!")
      router.navigate({ to: `/teams/${data.teamId}` })
    },
  })
  const onSubmit = (formData: FormValues) => {
    mutation.mutate({ data: formData })
  }
  return (
    // isPending, isError, data available from mutation
  )
}
Option B: Create a Custom Hook (Drop-in Replacement)
// src/hooks/use-server-action.ts
import { useServerFn } from "@tanstack/react-start"
import { useState, useCallback, useTransition } from "react"
type ServerFnResult<T> = {
  execute: (input: any) => Promise<T>
  isPending: boolean
  data: T | undefined
  error: Error | undefined
  reset: () => void
}
export function useServerAction<TFn extends (...args: any[]) => Promise<any>>(
  serverFn: TFn,
  opts?: {
    onError?: (error: Error) => void
    onStart?: () => void
    onSuccess?: (data: Awaited<ReturnType<TFn>>) => void
    onFinish?: () => void
  }
): ServerFnResult<Awaited<ReturnType<TFn>>> {
  const fn = useServerFn(serverFn)
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<Awaited<ReturnType<TFn>> | undefined>()
  const [error, setError] = useState<Error | undefined>()
  const execute = useCallback(
    async (input: Parameters<TFn>[0]["data"]) => {
      opts?.onStart?.()
      setError(undefined)
      try {
        const result = await fn({ data: input })
        setData(result)
        opts?.onSuccess?.(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        opts?.onError?.(error)
        throw error
      } finally {
        opts?.onFinish?.()
      }
    },
    [fn, opts]
  )
  const reset = useCallback(() => {
    setData(undefined)
    setError(undefined)
  }, [])
  return { execute, isPending, data, error, reset }
}
2.2 Form Integration
Current Pattern:
const { execute } = useServerAction(createTeamAction)
function onSubmit(data: FormValues) {
  execute(data)  // Direct object
}
Target Pattern:
const createTeam = useServerFn(createTeamFn)
function onSubmit(data: FormValues) {
  createTeam({ data })  // Wrapped in { data: ... }
}
---
Part 3: File Organization
3.1 Proposed Directory Structure
apps/wodsmith-start/src/
├── server-fns/                    # Server functions (replaces actions/)
│   ├── middleware/                # Shared middleware
│   │   ├── auth.ts               # Auth middleware
│   │   ├── team.ts               # Team context middleware
│   │   └── rate-limit.ts         # Rate limiting middleware
│   ├── team-fns.ts               # Team server functions
│   ├── workout-fns.ts            # Workout server functions
│   ├── user-fns.ts               # User server functions
│   └── ...
├── hooks/
│   └── use-server-action.ts      # Custom hook for ZSA-like API
└── ...
3.2 Naming Convention Changes
| ZSA | TanStack Start |
|-----|----------------|
| createTeamAction | createTeamFn |
| updateWorkoutAction | updateWorkoutFn |
| getUserTeamsAction | getUserTeamsFn |
---
Part 4: Migration Checklist per Action File
For each action file (31 files identified), follow this checklist:
Pre-Migration
- [ ] Identify all actions in the file
- [ ] Identify middleware/procedure dependencies
- [ ] Identify client-side usages (components using useServerAction)
Server-Side Migration
- [ ] Create new file in src/server-fns/
- [ ] Convert createServerAction() → createServerFn()
- [ ] Convert .input() → .validator()
- [ ] Convert { input } → { data } in handler
- [ ] Convert { ctx } → { context } in handler
- [ ] Add .middleware([]) for auth/team context
- [ ] Convert ZSAError → standard errors or redirects
- [ ] Remove "use server" directive (not needed)
Client-Side Migration
- [ ] Update imports from @repo/zsa-react → custom hook or TanStack Query
- [ ] Update execute(data) → fn({ data })
- [ ] Update error handling for new error format
- [ ] Test form submissions
Cleanup
- [ ] Remove old action file
- [ ] Update any remaining imports
---
Part 5: Specific Migration Examples
5.1 Simple Action (No Auth)
Before:
// src/actions/movement-actions.ts
"use server"
import { createServerAction } from "@repo/zsa"
export const getMovementsAction = createServerAction()
  .handler(async () => {
    return await getMovements()
  })
After:
// src/server-fns/movement-fns.ts
import { createServerFn } from "@tanstack/react-start"
export const getMovementsFn = createServerFn()
  .handler(async () => {
    return await getMovements()
  })
5.2 Authenticated Action
Before:
// src/actions/team-actions.ts
"use server"
import { createServerAction, ZSAError } from "@repo/zsa"
export const setActiveTeamAction = createServerAction()
  .input(z.object({ teamId: z.string() }))
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()
    if (!session?.teams) {
      throw new ZSAError("NOT_AUTHORIZED", "No teams found")
    }
    // ...
  })
After:
// src/server-fns/team-fns.ts
import { createServerFn } from "@tanstack/react-start"
import { authMiddleware } from "./middleware/auth"
export const setActiveTeamFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId: z.string() }))
  .handler(async ({ data, context }) => {
    // context.session available from middleware
    if (!context.session?.teams) {
      throw new Error("No teams found")
    }
    // ...
  })
5.3 Action with Team Context
Before:
export const createWorkoutAction = createServerAction()
  .input(workoutSchema)
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()
    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.MANAGE_WORKOUTS)
    // ...
  })
After:
import { authMiddleware } from "./middleware/auth"
import { teamMiddleware } from "./middleware/team"
export const createWorkoutFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware, teamMiddleware])
  .validator(workoutSchema)
  .handler(async ({ data, context }) => {
    // context.team and context.permissions available from middleware
    if (!context.permissions.includes(TEAM_PERMISSIONS.MANAGE_WORKOUTS)) {
      throw new Error("Permission denied")
    }
    // ...
  })
---
Part 6: Middleware Definitions
6.1 Auth Middleware
// src/server-fns/middleware/auth.ts
import { createMiddleware } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { getSessionFromCookie } from "@/utils/auth"
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getSessionFromCookie()
  
  if (!session) {
    throw redirect({ to: "/sign-in" })
  }
  
  if (!session.user.emailVerified) {
    throw redirect({ to: "/verify-email" })
  }
  
  return next({
    context: {
      session,
      user: session.user,
      teams: session.teams,
    },
  })
})
6.2 Team Context Middleware
// src/server-fns/middleware/team.ts
import { createMiddleware } from "@tanstack/react-start"
import { getTeamPermissions } from "@/utils/team-auth"
export const teamMiddleware = createMiddleware().server(async ({ next, context, data }) => {
  // Assumes authMiddleware ran first
  const { session } = context
  const teamId = data?.teamId
  
  if (!teamId) {
    throw new Error("Team ID required")
  }
  
  const team = session.teams?.find(t => t.id === teamId)
  if (!team) {
    throw new Error("Not a member of this team")
  }
  
  const permissions = await getTeamPermissions(session.user.id, teamId)
  
  return next({
    context: {
      ...context,
      team,
      teamId,
      permissions,
    },
  })
})
6.3 Rate Limit Middleware
// src/server-fns/middleware/rate-limit.ts
import { createMiddleware } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
export const rateLimitMiddleware = (limit: number, windowMs: number) =>
  createMiddleware().server(async ({ next }) => {
    const ip = getRequestHeader("x-forwarded-for") || "unknown"
    
    const isAllowed = await checkRateLimit(ip, limit, windowMs)
    if (!isAllowed) {
      throw new Error("Too many requests")
    }
    
    return next()
  })
---
Part 7: Questions for Clarification
Before proceeding with implementation, I have a few questions:
1. Return Format: ZSA returns [data, error] tuples. TanStack Start returns data directly and throws on error. Do you want to:
   - A) Adapt to the new pattern (recommended - cleaner)
   - B) Create a wrapper that maintains the tuple format for easier migration
2. Custom Hook: Do you want to:
   - A) Use TanStack Query for all mutations (recommended for caching)
   - B) Create a custom useServerAction hook that mimics ZSA's API
   - C) Both - use Query for complex cases, custom hook for simple ones
3. Error Types: Do you want to:
   - A) Use standard Error with message strings
   - B) Create a custom AppError class with codes (similar to ZSAError)
   - C) Use HTTP status codes via setResponseStatus()
4. Migration Order: Should we:
   - A) Migrate all actions at once (big bang)
   - B) Migrate feature-by-feature (auth first, then teams, etc.)
   - C) Create a compatibility layer so both can coexist during migration
---
Part 8: Estimated Effort
| Task | Files | Estimated Time |
|------|-------|----------------|
| Create middleware layer | 3-4 | 1 day |
| Create custom hooks | 1-2 | 0.5 day |
| Migrate action files (31) | 31 | 3-4 days |
| Update client components (~100) | ~100 | 4-5 days |
| Testing & fixes | - | 2-3 days |
| Total | | 10-14 days |
This can be parallelized if multiple developers work on different feature areas