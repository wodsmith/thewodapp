## Monorepo Structure

This is a **monorepo** with multiple applications:

- `apps/wodsmith-start` - **Primary app** - TanStack Start application on Cloudflare Workers
- `apps/docs` - Documentation site
- `apps/posthog-proxy` - PostHog analytics proxy
- `packages/*` - Shared packages

## Development Commands (wodsmith-start)

Run these from `apps/wodsmith-start/`:

### Build and Development

- `pnpm dev` - Start development server
- `pnpm build` - Build TanStack Start application
- `pnpm preview` - Preview production build with Cloudflare

### Code Quality

- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome
- `pnpm check` - Run Biome check (lint + format)
- `pnpm type-check` - Run TypeScript type checking

### Database Operations

- `pnpm db:push` - Push schema changes to local D1 (use during development)
- `pnpm db:generate --name=X` - Generate migration (only before merging to main)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:migrate:local` - Apply migrations to local D1 database

### Testing

- `pnpm test` - Run all tests with Vitest (single run mode)
- Test files are located in `test/` directory

### Cloudflare

- `pnpm cf-typegen` - Generate Cloudflare types (run after wrangler.jsonc changes)
- `npx alchemy deploy` - Deploy using Alchemy IaC
- `pnpm alchemy:dev` - Deploy local dev environment with Alchemy (required after changing env vars in `.dev.vars`)

## Architecture Overview (wodsmith-start)

### Tech Stack

- **Framework**: TanStack Start (React 19, TypeScript, Vinxi/Vite)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Authentication**: Custom auth with KV sessions
- **Deployment**: Cloudflare Workers via Alchemy IaC
- **UI**: Tailwind CSS, Shadcn UI, Radix primitives
- **State**: Zustand (client), TanStack Router loaders (server)
- **API**: TanStack Start server functions (`createServerFn`)

### Project Structure (wodsmith-start)

```
apps/wodsmith-start/src/
├── routes/                 # TanStack Router file-based routes
│   ├── api/               # API routes (server handlers)
│   └── compete/           # Competition features
├── components/            # React components
├── db/                    # Database schema and migrations
│   ├── schema.ts          # Main schema exports
│   └── migrations/        # Auto-generated migrations
├── server/                # Server-only business logic
├── server-fns/            # Server functions (createServerFn)
├── lib/                   # Shared utilities
│   ├── env.ts             # Server-only env access (getAppUrl, etc.)
│   └── stripe.ts          # Server-only Stripe client
├── utils/                 # Shared utilities
├── state/                 # Client state (Zustand)
└── schemas/               # Zod validation schemas
```

### Multi-Tenancy

- Team-based data isolation with `teamId` filtering
- Role-based permissions (admin, member roles)
- Team switching via team-switcher component
- All database operations must include team context

### Database Schema

Database is modularly structured in `src/db/schemas/`:

- `users.ts` - User accounts and authentication
- `teams.ts` - Team/organization management
- `workouts.ts` - Workout management system
- `programming.ts` - Programming tracks and scheduling
- `billing.ts` - Credit billing system
- `scaling.ts` - Workout scaling options
- `scheduling.ts` - Schedule templates and scheduling
- Main schema exports from `src/db/schema.ts`

## Development Guidelines

### Code Style

- Use TypeScript everywhere, prefer interfaces over types
- Functional components, avoid classes
- Server Components by default, `use client` only when necessary
- Add `import "server-only"` to server-only files (except page.tsx)
- Use semantic commit messages: `feat:`, `fix:`, `chore:`
- Use `pnpm` as package manager

### Database

- **Local development**: Use `pnpm db:push` to apply schema changes directly (no migration files)
- **Before merging**: Generate migrations with `pnpm db:generate --name=feature-name`
- **Never write SQL migrations manually** - always use drizzle-kit
- Never use Drizzle transactions (D1 doesn't support them)
- Never pass `id` when inserting (auto-generated with CUID2)
- Always filter by `teamId` for multi-tenant data
- Use helper functions in `src/server/` for business logic
- **D1 has a 100 SQL parameter limit** - use `autochunk` from `@/utils/batch-query` for `inArray` queries with dynamic arrays:

  ```typescript
  import {autochunk} from '@/utils/batch-query'

  // Instead of: db.select().from(table).where(inArray(table.id, ids))
  const results = await autochunk(
    {items: ids, otherParametersCount: 1}, // count other WHERE params
    async (chunk) => db.select().from(table).where(inArray(table.id, chunk)),
  )
  ```

### Authentication & Authorization

- Session handling: `getSessionFromCookie()` for server components
- Client session: `useSessionStore()` from `src/state/session.ts`
- Team authorization utilities in `src/utils/team-auth.ts`
- Protect routes with team context validation
- When checking roles use available roles from `src/db/schemas/teams.ts`

### State Management

- Server state: React Server Components
- Client state: Zustand stores in `src/state/`
- URL state: NUQS for search parameters
- Forms: React Hook Form with Zod validation

### API Patterns

- Server functions with TanStack Start: `createServerFn` (see below)
- Named object parameters for functions with >1 parameter
- Consistent error handling with proper HTTP status codes
- Rate limiting on auth endpoints

### TanStack Start Server Functions (wodsmith-start)

#### Environment Variables

**ALWAYS** use `env` from `cloudflare:workers` - never use `process.env`:

```typescript
import {env} from 'cloudflare:workers'

env.DB // D1 database binding
env.KV_SESSION // KV namespace binding
env.APP_URL // Environment variable
env.STRIPE_SECRET_KEY // Secret
```

**TypeScript not recognizing env vars?** If you've added new bindings in `alchemy.run.ts` and deployed with `pnpm alchemy:dev`, but TypeScript doesn't see them, run:

```bash
pnpm cf-typegen
```

This regenerates `worker-configuration.d.ts` from `wrangler.jsonc` to update the type definitions.

#### Server-Only Functions with createServerOnlyFn

For server-only utilities that access `cloudflare:workers` env, use `createServerOnlyFn`:

```typescript
// src/lib/env.ts
import {createServerOnlyFn} from '@tanstack/react-start'
import {env} from 'cloudflare:workers'

export const getAppUrl = createServerOnlyFn((): string => {
  return env.APP_URL || 'https://wodsmith.com'
})
```

**Key difference from `createServerFn`:**

- `createServerFn` - RPC callable from client, executes on server
- `createServerOnlyFn` - ONLY runs on server, throws if called from client

Functions using `createServerOnlyFn` can be imported at top-level anywhere - no dynamic imports needed.

#### Server Functions (createServerFn)

- Server functions should be defined in `src/server-fns/` files
- **When calling from client components**, use the `useServerFn` hook:

  ```typescript
  import {useServerFn} from '@tanstack/react-start'
  import {myServerFn} from '@/server-fns/my-fns'

  function MyComponent() {
    const myFn = useServerFn(myServerFn)
    const handleClick = async () => {
      const result = await myFn({data: {foo: 'bar'}})
    }
  }
  ```

- Server functions can be called directly (without `useServerFn`) in:
  - Route loaders
  - Other server functions

#### Safe Top-Level Imports

These can be imported at the top of any file:

- `@tanstack/react-start` - Framework utilities
- `@/lib/env` - Server-only env utilities (uses `createServerOnlyFn`)
- `@/lib/stripe` - Server-only Stripe client (uses `createServerOnlyFn`)
- `@/server/*` - Server-only business logic (uses `createServerOnlyFn`)
- `@/db` - Database access (uses `cloudflare:workers` internally)
- `zod` - Validation schemas
- `@/db/schema` - Schema type definitions

#### Centralized Server Utilities

Use centralized utilities instead of accessing env directly:

```typescript
// GOOD - Use centralized utilities
import {getAppUrl} from '@/lib/env'
import {getStripe} from '@/lib/stripe'

const appUrl = getAppUrl()
const stripe = getStripe()

// BAD - Direct env access scattered everywhere
import {env} from 'cloudflare:workers'
const appUrl = env.APP_URL || 'https://wodsmith.com'
```

### UI Components

- Use Shadcn UI components from `src/components/ui/`
- Mobile-first responsive design with Tailwind
- Support both light and dark modes
- Use Suspense for loading states

### Testing

- Tests in `test/` directory using Vitest + jsdom
- Always run tests in single-run mode (no watch mode)
- Configure fail-fast behavior

## Important Files

### Configuration

- `wrangler.jsonc` - Cloudflare Workers configuration (run `pnpm cf-typegen` after changes)
- `drizzle.config.ts` - Database configuration
- `biome.json` - Linting and formatting rules
- `components.json` - Shadcn UI configuration

### Key Utilities

- `src/utils/auth.ts` - Authentication logic
- `src/utils/team-auth.ts` - Team authorization
- `src/utils/kv-session.ts` - Session management
- `src/constants.ts` - App constants and configuration

### Environment

- `.env` - Environment variables for development
- `.dev.vars` - Cloudflare Worker environment variables

## Documentation

Refer to `docs/` directory for:

- `project-plan.md` - Comprehensive project overview
- `architecture/` - Architecture decisions and patterns
- `tasks/` - Development task documentation

## Cloudflare Workers Constraints

### SubtleCrypto is Async-Only

In Cloudflare Workers, the SubtleCrypto API is **async-only**. Any library that uses crypto operations must use async methods:

```typescript
// BAD - Will throw "SubtleCryptoProvider cannot be used in a synchronous context"
const event = stripe.webhooks.constructEvent(body, signature, secret)

// GOOD - Use async version
const event = await stripe.webhooks.constructEventAsync(body, signature, secret)
```

This affects:

- Stripe webhook signature verification (`constructEventAsync` instead of `constructEvent`)
- Any HMAC/hash operations
- Password hashing libraries

## Notes

- This is a workout management SaaS for CrossFit gyms
- Built on Cloudflare edge infrastructure for global performance
- Uses credit-based billing system with Stripe integration
- Supports team collaboration with fine-grained permissions

## Project Management

- This project uses Linear for issue tracking and project management
- For Linear-specific guidelines, refer to `.claude/agents/project-manager-linear.md`
- Use the project-manager-linear agent for creating and managing Linear issues
