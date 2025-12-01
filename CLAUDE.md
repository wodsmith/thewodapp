# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev                  # Start dev server (localhost:3000)
pnpm build               # Build for production
pnpm preview             # Build and preview with OpenNext

# Database (Drizzle + Cloudflare D1)
pnpm db:generate [name]  # Generate migration (NEVER write SQL manually)
pnpm db:migrate:dev      # Apply migrations locally
pnpm db:studio           # Open Drizzle Studio
pnpm db:seed             # Seed sample data

# Code Quality
pnpm lint                # Biome linting
pnpm format              # Biome formatting
pnpm type-check          # TypeScript check (uses tsgo)
pnpm test                # Run Vitest tests (single-run, no watch)

# Email
pnpm email:dev           # Email template dev server (port 3001)
```

## Architecture

**Monorepo Structure:**
- `apps/wodsmith/` - Main Next.js 15 app (App Router)
- `packages/zsa`, `packages/zsa-react` - Type-safe server actions

**App Router Groups:**
- `(main)` - Core features: workouts, programming, movements, log, calculator
- `(auth)` - Authentication flows
- `(admin)` - Admin dashboard
- `(settings)` - User settings
- `(compete)` - Competitions feature
- `api/` - API routes including webhooks

**Key Directories in `apps/wodsmith/src/`:**
- `server/` - Business logic services (workouts.ts, teams.ts, programming-tracks.ts, etc.)
- `db/schemas/` - Drizzle schema files (users, teams, workouts, programming, etc.)
- `actions/` - Server actions using zsa
- `utils/auth.ts` - Lucia Auth with Cloudflare KV sessions
- `utils/team-auth.ts` - Team-based permission helpers

**Data Flow:**
1. Server Components → `server/*.ts` services → Drizzle ORM → D1
2. Client Components → Server Actions (`actions/`) → services → D1
3. Always filter by `teamId` in multi-tenant queries

## Code Patterns

**Server Actions:** Use `@repo/zsa` for type-safe actions, `@repo/zsa-react` for client hooks
```typescript
import { useServerAction } from "@repo/zsa-react"
```

**Authentication:**
- Server: `getSessionFromCookie()` from `src/utils/auth.ts`
- Client: `useSessionStore()` from `src/state/session.ts`

**Database:**
- Never write raw SQL - use `pnpm db:generate [name]`
- Never pass `id` in insert/update (auto-generated)
- No transactions (D1 doesn't support them)
- Common columns: `id`, `createdAt`, `updatedAt`, `updateCounter`

**Components:**
- Server Components by default, `"use client"` only when needed
- Use Shadcn UI + Radix + Tailwind
- Add `import "server-only"` for server-only files (except page.tsx)

**Functions:**
- Use `function` keyword for pure functions
- Multiple params → named object: `fn({ param1, param2 })`

**Cloudflare:**
- After modifying `wrangler.jsonc`, run `pnpm cf-typegen`
- Use existing KV namespace, don't create new ones
- Global types go in `custom-env.d.ts` (not `cloudflare-env.d.ts`)

## Standards

**Commits:** Use `fix:`, `feat:`, or `chore:` prefixes

**Testing:** Run in single-run mode with fail-fast

**Naming:**
- Files/folders: kebab-case
- Components: PascalCase
- Variables/functions: camelCase

**No:**
- `any` type
- Enums (use maps)
- `--no-verify` on commits
- Interactive git commands (`rebase -i`, `commit --amend`)
