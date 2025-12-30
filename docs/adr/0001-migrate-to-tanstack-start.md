---
status: proposed
date: 2025-12-22
decision-makers: [Ian Jones]
consulted: []
informed: []
---

# ADR-0001: Migrate from Next.js to TanStack Start on Cloudflare

## Context and Problem Statement

The WodApp is currently built on Next.js 15 with the App Router, deployed to Cloudflare Workers via OpenNext. While this stack works, we face several pain points:

1. **OpenNext complexity**: We rely on a third-party adapter (OpenNext) to deploy Next.js to Cloudflare, which adds a layer of abstraction and potential compatibility issues
2. **Type safety gaps**: Route parameters and search params require manual validation; there's no end-to-end type safety from route definition to component
3. **Server action patterns**: We use ZSA (a custom wrapper) to add middleware and validation to server actions, but this is a custom solution we maintain
4. **Build complexity**: The Next.js + OpenNext + Cloudflare pipeline has multiple moving parts

Should we migrate to TanStack Start, which offers native Cloudflare support and end-to-end type safety?

## Decision Drivers

- **Cloudflare-native deployment** - Eliminate the OpenNext abstraction layer
- **End-to-end type safety** - Type-safe routes, params, search params, and server functions
- **Simpler server function patterns** - Built-in middleware and validation without custom wrappers
- **Future-proofing** - TanStack ecosystem is actively developed and gaining adoption
- **Migration effort** - Must be achievable incrementally without a full rewrite
- **Team familiarity** - Learning curve for new patterns and APIs
- **Production stability** - Framework maturity and community support

## Considered Options

1. **Stay on Next.js + OpenNext** - Continue with current stack
2. **Migrate to TanStack Start** - Full migration to TanStack ecosystem
3. **Migrate to Remix** - Alternative React framework with Cloudflare support
4. **Migrate to SolidStart** - Non-React alternative with excellent performance

## Decision Outcome

Chosen option: **"Migrate to TanStack Start"**, because it provides the best combination of type safety, Cloudflare-native deployment, and migration path from our current patterns.

### Consequences

- Good, because we eliminate the OpenNext abstraction layer for Cloudflare deployment
- Good, because we gain end-to-end type safety for routes, params, and search params
- Good, because `createServerFn()` closely mirrors our existing ZSA patterns, easing migration
- Good, because TanStack Router's file-based routing is similar to Next.js App Router
- Good, because we can leverage TanStack Query integration for data fetching
- Good, because the framework is actively maintained by Tanner Linsley with strong community
- Bad, because TanStack Start is newer and less battle-tested than Next.js
- Bad, because we need to migrate ~50+ routes and server actions
- Bad, because team needs to learn new APIs and patterns
- Bad, because some Next.js-specific features (ISR, image optimization) need alternatives
- Neutral, because both frameworks support React 19 and modern patterns

### Confirmation

The migration will be confirmed successful when:

1. All existing routes are migrated and functional
2. All server actions are converted to `createServerFn()`
3. Type safety is verified across route params and search params
4. Deployment to Cloudflare Workers succeeds without OpenNext
5. Performance benchmarks match or exceed current metrics
6. All existing tests pass

## Pros and Cons of the Options

### Option 1: Stay on Next.js + OpenNext

Continue with the current Next.js 15 + OpenNext + Cloudflare stack.

- Good, because no migration effort required
- Good, because team is already familiar with the stack
- Good, because Next.js has the largest ecosystem and community
- Good, because extensive documentation and tutorials available
- Neutral, because ZSA provides adequate server action patterns
- Bad, because OpenNext adds complexity and potential compatibility issues
- Bad, because no end-to-end type safety for routes
- Bad, because we're dependent on OpenNext maintainers for Cloudflare compatibility
- Bad, because Next.js is optimized for Vercel, not Cloudflare

### Option 2: Migrate to TanStack Start

Full migration to TanStack Start with native Cloudflare deployment.

- Good, because native Cloudflare Workers/Pages support via Nitro
- Good, because end-to-end type safety (routes, params, search, server functions)
- Good, because `createServerFn()` is similar to our ZSA patterns
- Good, because built-in middleware system without custom wrappers
- Good, because TanStack Query integration for data fetching
- Good, because file-based routing similar to Next.js App Router
- Good, because active development and growing community
- Neutral, because requires Node 22+ and Vite 7+ (we already use modern tooling)
- Bad, because newer framework with less production usage
- Bad, because smaller ecosystem than Next.js
- Bad, because migration effort for existing codebase
- Bad, because some team learning curve

### Option 3: Migrate to Remix

Migrate to Remix with Cloudflare adapter.

- Good, because mature framework with Cloudflare support
- Good, because strong data loading patterns (loaders/actions)
- Good, because good developer experience
- Neutral, because decent type safety but not as comprehensive as TanStack
- Bad, because different mental model from current Next.js patterns
- Bad, because no built-in middleware for server functions
- Bad, because less active development since Shopify acquisition
- Bad, because migration effort similar to TanStack Start

### Option 4: Migrate to SolidStart

Migrate to SolidStart (Solid.js framework).

- Good, because excellent performance (fine-grained reactivity)
- Good, because native Cloudflare support
- Good, because smaller bundle sizes
- Bad, because not React - requires learning new framework
- Bad, because smaller ecosystem than React
- Bad, because team has no Solid.js experience
- Bad, because would require rewriting all components, not just routes

## Migration Strategy

### Phase 1: Proof of Concept (1-2 weeks)

1. Create a new TanStack Start project alongside existing Next.js app
2. Migrate 2-3 representative routes (simple, complex, with server functions)
3. Validate Cloudflare deployment works
4. Benchmark performance

### Phase 2: Infrastructure (1 week)

1. Set up TanStack Start project structure
2. Configure Drizzle ORM integration
3. Set up authentication (Lucia) in new framework
4. Configure environment variables and secrets

### Phase 3: Incremental Migration (4-6 weeks)

1. Migrate routes by feature area:
   - Authentication routes
   - Dashboard routes
   - Workout management
   - Team/settings
   - Admin routes
2. Convert ZSA actions to `createServerFn()`
3. Update components to use TanStack Router hooks

### Phase 4: Cutover (1 week)

1. Final testing and QA
2. DNS cutover to new deployment
3. Monitor for issues
4. Deprecate old Next.js codebase

### Code Migration Examples

#### Route Migration

```tsx
// Before (Next.js)
// app/workouts/[workoutId]/page.tsx
export default async function WorkoutPage({
  params,
}: {
  params: {workoutId: string}
}) {
  const workout = await getWorkout(params.workoutId)
  return <WorkoutDetail workout={workout} />
}

// After (TanStack Start)
// routes/workouts/$workoutId.tsx
export const Route = createFileRoute('/workouts/$workoutId')({
  loader: async ({params}) => {
    return await getWorkout(params.workoutId)
  },
  component: WorkoutPage,
})

function WorkoutPage() {
  const workout = Route.useLoaderData()
  return <WorkoutDetail workout={workout} />
}
```

#### Server Function Migration

```tsx
// Before (ZSA)
export const createWorkout = createServerAction()
  .input(z.object({name: z.string(), description: z.string()}))
  .handler(async ({input, ctx}) => {
    return await db.workouts.create(input)
  })

// After (TanStack Start)
export const createWorkout = createServerFn({method: 'POST'})
  .middleware([authMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    ),
  )
  .handler(async ({data, context}) => {
    return await db.workouts.create(data)
  })
```

## Technical Requirements

### Minimum Versions

| Dependency | Required Version |
| ---------- | ---------------- |
| Node.js    | >= 22.12.0       |
| Vite       | >= 7.0.0         |
| React      | >= 18.0.0        |
| TypeScript | >= 5.0.0         |

### Key Dependencies to Add

```json
{
  "@tanstack/react-start": "^1.142.x",
  "@tanstack/react-router": "^1.142.x",
  "@tanstack/zod-adapter": "^1.142.x"
}
```

### Dependencies to Remove

```json
{
  "next": "remove",
  "@opennextjs/cloudflare": "remove",
  "zsa": "remove (replaced by createServerFn)",
  "zsa-react": "remove"
}
```

## Risks and Mitigations

| Risk                                 | Likelihood | Impact | Mitigation                                              |
| ------------------------------------ | ---------- | ------ | ------------------------------------------------------- |
| TanStack Start has breaking changes  | Medium     | High   | Pin versions, follow changelog, have rollback plan      |
| Migration takes longer than expected | Medium     | Medium | Incremental migration, keep Next.js running in parallel |
| Performance regression               | Low        | High   | Benchmark before/after, optimize as needed              |
| Missing Next.js features             | Medium     | Medium | Identify alternatives early (image optimization, etc.)  |
| Team struggles with new patterns     | Low        | Medium | Documentation, pair programming, gradual rollout        |

## More Information

### Related Documents

- [TanStack Start Research](../research/tanstack-start-research.md) - Detailed analysis of TanStack Start architecture
- [Project Plan](../project-plan.md) - Overall project roadmap

### External Resources

- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [Cloudflare Workers with TanStack Start](https://tanstack.com/start/latest/docs/framework/react/hosting#cloudflare)

### Decision Timeline

- **2025-12-22**: ADR proposed
- **TBD**: Team review and discussion
- **TBD**: Decision accepted/rejected
- **TBD**: Migration begins (if accepted)
