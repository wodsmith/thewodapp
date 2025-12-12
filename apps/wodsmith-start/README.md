# Wodsmith Start

TanStack Start migration of the Wodsmith application - a complete rewrite from Next.js to TanStack Start with Cloudflare Workers.

## Overview

**Wodsmith Start** is the production version of Wodsmith built with:
- **Framework**: TanStack Start (RC) - Type-safe, client-first, full-stack React
- **Build**: Vite + Cloudflare Vite plugin
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Authentication**: Cloudflare KV sessions + custom auth system
- **Deployment**: Cloudflare Workers (edge compute globally)
- **UI**: Shadcn/Radix components + Tailwind CSS

This is a complete departure from the Next.js version (`apps/wodsmith`), using TanStack Router's file-based routing and TanStack Start's server functions instead of Next.js App Router and Server Actions.

## Key Differences from Next.js

### Routing
- **Next.js**: `app/` directory with `page.tsx` and `layout.tsx`
- **TanStack**: `routes/` directory with route files like `workouts.index.tsx`, `workouts.$id.tsx`
- Route groups use underscore prefix: `_main/`, `_auth/`, `_settings/`

### Server-Side Functions
- **Next.js**: ZSA `createServerAction()` with `"use server"` directive
- **TanStack**: `createServerFn()` from `@tanstack/react-start`
- No directive needed - server functions are auto-detected by file location

### Data Fetching
- **Next.js**: `revalidatePath()` to invalidate cached data
- **TanStack**: TanStack Query for client-side caching with manual invalidation
- Loaders run on server and pass data to components via `useLoaderData()`

### Cloudflare Bindings
- **Next.js**: `getRequestContext().env` (via OpenNext)
- **TanStack**: `env` from `cloudflare:workers` module

### Session Management
- **Next.js**: Lucia Auth library with KV custom session store
- **TanStack**: Custom session utilities in `src/utils/auth.ts`

## Development Commands

### Setup
```bash
# Install dependencies (installs Cloudflare types automatically)
pnpm install

# Generate Cloudflare type definitions
pnpm cf-typegen
```

### Development
```bash
# Start dev server (hot reload enabled)
pnpm dev

# Type check TypeScript
tsc --noEmit

# Format code with Biome
pnpm format

# Lint with Biome
pnpm lint
```

### Database
```bash
# Generate migrations from schema changes
pnpm db:generate [migration_name]

# Apply migrations to local D1
wrangler d1 migrations apply [db-name] --local

# Open Drizzle Studio for data exploration
pnpm db:studio
```

### Build & Deploy
```bash
# Build for production
pnpm build

# Preview production build locally
pnpm preview

# Deploy to Cloudflare Workers
pnpm deploy

# Type check before deployment
pnpm build  # includes `tsc --noEmit`
```

## Project Structure

```
src/
├── routes/                 # TanStack file-based routing
│   ├── __root.tsx         # Root layout
│   ├── _main/             # Dashboard & main app routes
│   ├── _auth/             # Authentication routes
│   ├── _settings/         # User settings
│   ├── _admin/            # Admin panel
│   ├── _compete/          # Competition platform
│   └── api/               # API endpoints
├── server-functions/       # Server functions (createServerFn)
│   ├── auth.ts            # Auth operations
│   ├── workouts.ts        # Workout CRUD
│   ├── movements.ts       # Movement CRUD
│   ├── programming.ts     # Programming tracks
│   └── ...
├── components/            # React components
│   └── ui/               # Shadcn/Radix components
├── db/                   # Database layer
│   ├── index.ts          # Drizzle connection
│   └── schemas/          # Drizzle schemas
├── utils/                # Shared utilities
│   ├── auth.ts           # Session & auth logic
│   ├── team-auth.ts      # Team authorization
│   └── ...
├── styles/               # Global CSS (Tailwind)
└── types.ts             # Shared types
```

## Cloudflare Configuration

### wrangler.jsonc
Configures:
- **D1 Binding**: `DB` - SQLite database connection
- **KV Namespace**: `KV_SESSIONS` - Session storage (if using KV)
- **Environment Variables**: API keys, auth secrets
- **Workers Settings**: Memory limits, routes

### Environment Variables
Create `.dev.vars` for local development (mirrors `wrangler.jsonc` env):
```
SESSION_SECRET=your-32-character-secret-here
DATABASE_ID=your-d1-database-id
DATABASE_URL=file:./local.sqlite3
```

## Authentication Flow

1. User logs in via `/sign-in`
2. `loginFn` server function validates credentials
3. Session is stored in Cloudflare KV (or cookie-based)
4. Session token in HTTP-only cookie
5. `getCurrentUserFn` retrieves session on page load
6. Team context loaded from `active_team_cookie`

## Database Connection

```typescript
// src/db/index.ts
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'

export function getDb() {
  return drizzle(env.DB, { schema })
}
```

Note: Drizzle transactions aren't supported on D1. Use manual commit/rollback patterns.

## Multi-Tenancy

All data queries must filter by `teamId`:

```typescript
export const getWorkoutsFn = createServerFn('GET', async () => {
  const session = await getSessionFromCookie()
  const teamId = await getActiveOrPersonalTeamId(session.userId)
  
  const workouts = await db.query.workouts.findMany({
    where: eq(schema.workouts.teamId, teamId)
  })
  
  return { workouts }
})
```

## State Management

- **Server State**: Managed in server functions and loaders
- **Client State**: Zustand stores (`src/state/`)
- **URL State**: NUQS (if needed)
- **Cache**: TanStack Query (client-side caching)

## Common Patterns

### Server Function (CRUD)
```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const createWorkoutSchema = z.object({
  name: z.string().min(1),
  teamId: z.string(),
})

export const createWorkout = createServerFn('POST')
  .validator(createWorkoutSchema)
  .handler(async ({ data }) => {
    const workout = await db.insert(schema.workouts).values(data)
    return { success: true, workout }
  })
```

### Route with Loader
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { getWorkoutsFn } from '~/server-functions/workouts'

export const Route = createFileRoute('/_main/workouts/$id')({
  loader: async ({ params }) => {
    return getWorkoutsFn({ id: params.id })
  },
  component: WorkoutDetailPage,
})

function WorkoutDetailPage() {
  const workout = Route.useLoaderData()
  return <div>...</div>
}
```

### Client-Side Mutation
```typescript
import { useTransition } from 'react'
import { createWorkout } from '~/server-functions/workouts'

function CreateWorkoutForm() {
  const [isPending, startTransition] = useTransition()
  
  const handleSubmit = (data) => {
    startTransition(async () => {
      const result = await createWorkout({ data })
      if (result.success) {
        // Invalidate cache, navigate, etc.
      }
    })
  }
  
  return <form onSubmit={handleSubmit}>{/* ... */}</form>
}
```

## Deployment

### Prerequisites
- Cloudflare Workers account
- D1 database created
- KV namespace created (optional, for sessions)
- `wrangler` configured with credentials

### Deploy Steps
```bash
# 1. Ensure migrations are applied to production D1
wrangler d1 migrations apply [db-name] --remote

# 2. Build and deploy
pnpm build && wrangler deploy

# 3. Verify deployment
curl https://your-app.workers.dev/health
```

### Environment Setup
Cloudflare dashboard:
1. Create D1 database
2. Create KV namespace (optional)
3. Add bindings in `wrangler.jsonc`
4. Set secrets in Cloudflare dashboard:
   - `SESSION_SECRET`
   - API keys, etc.

## Troubleshooting

### Session Lost After Reload
- Check `SESSION_SECRET` is 32+ characters
- Verify KV namespace binding in `wrangler.jsonc`
- Check HTTP-only cookie isn't being blocked

### Database Errors
- Ensure D1 binding name matches `env.DB`
- Verify migrations applied: `wrangler d1 migrations list`
- Check connection string in `.dev.vars`

### Type Errors
- Run `pnpm cf-typegen` after `wrangler.jsonc` changes
- Ensure `tsconfig.json` paths match actual structure
- Server functions must be in `src/server-functions/`

## Performance Considerations

### Edge Computing
- Functions execute globally on Cloudflare edge
- ~100ms latency to nearest data center
- D1 requests add ~10-50ms depending on database size

### Optimization
- Use loaders for server-side data fetching
- Minimize client-side state hydration
- Leverage Cloudflare caching headers
- Use TanStack Query for client cache

## References

- [TanStack Start Docs](https://tanstack.com/start/latest/docs)
- [TanStack Router File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Drizzle ORM D1 Guide](https://orm.drizzle.team/docs/get-started-sqlite)

## Migration Guide

For detailed information about migrating from the Next.js version, see `docs/MIGRATION.md`.
