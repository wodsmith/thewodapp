
## Development Commands

### Build and Development
- `pnpm dev` - Start development server
- `pnpm build` - Build Next.js application
- `pnpm build:prod` - Build for production deployment with OpenNext
- `pnpm start` - Start production server locally
- `pnpm preview` - Preview production build with Cloudflare

### Code Quality
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome
- `pnpm check` - Run Biome check (lint + format)
- `pnpm type-check` - Run TypeScript type checking
- `pnpm type-check:changed` - Type check only changed files

### Database Operations
- `pnpm db:generate` - Generate Drizzle migrations (never write SQL manually)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:migrate:dev` - Apply migrations to local D1 database
- `pnpm db:migrate:prod` - Apply migrations to production D1 database
- `pnpm db:seed` - Seed local database

### Testing
- `pnpm test` - Run all tests with Vitest (single run mode)
- Test files are located in `test/` directory
- Use `vitest.config.mjs` configuration

### Email Development
- `pnpm email:dev` - Start React Email development server on port 3001
- Email templates are in `src/react-email/`

### Cloudflare
- `pnpm cf-typegen` - Generate Cloudflare types (run after wrangler.jsonc changes)
- `pnpm deploy:prod` - Deploy to production

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15.3.2 App Router, React 19, TypeScript
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Authentication**: Lucia Auth with KV sessions
- **Deployment**: Cloudflare Workers with OpenNext
- **UI**: Tailwind CSS, Shadcn UI, Radix primitives
- **State**: Zustand (client), Server Components, NUQS (URL state)
- **API**: Server Actions with ZSA, Next.js API routes

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Main dashboard
│   ├── (main)/            # Core app features (workouts, etc.)
│   ├── (settings)/        # User settings
│   ├── (admin)/           # Admin panel
│   └── api/               # API routes
├── components/            # React components
├── db/                    # Database schema and migrations
│   ├── schemas/           # Modular schema files
│   └── migrations/        # Auto-generated migrations
├── server/                # Server-side business logic
├── actions/               # Server actions
├── utils/                 # Shared utilities
├── state/                 # Client state (Zustand)
├── schemas/               # Zod validation schemas
└── react-email/          # Email templates
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
- **Never write SQL migrations manually** - always use `pnpm db:generate [MIGRATION_NAME]`
- Never use Drizzle transactions (D1 doesn't support them)
- Never pass `id` when inserting (auto-generated with CUID2)
- Always filter by `teamId` for multi-tenant data
- Use helper functions in `src/server/` for business logic
- **D1 has a 100 SQL parameter limit** - use `autochunk` from `@/utils/batch-query` for `inArray` queries with dynamic arrays:
  ```typescript
  import { autochunk } from "@/utils/batch-query"

  // Instead of: db.select().from(table).where(inArray(table.id, ids))
  const results = await autochunk(
    { items: ids, otherParametersCount: 1 }, // count other WHERE params
    async (chunk) => db.select().from(table).where(inArray(table.id, chunk))
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
- Server actions with ZSA: `import { useServerAction } from "@repo/zsa-react"`
- Named object parameters for functions with >1 parameter
- Consistent error handling with proper HTTP status codes
- Rate limiting on auth endpoints

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

## Notes
- This is a workout management SaaS for CrossFit gyms
- Built on Cloudflare edge infrastructure for global performance
- Uses credit-based billing system with Stripe integration
- Supports team collaboration with fine-grained permissions

## Project Management
- This project uses Linear for issue tracking and project management
- For Linear-specific guidelines, refer to `.claude/agents/project-manager-linear.md`
- Use the project-manager-linear agent for creating and managing Linear issues

## MCP Agent Mail: coordination for multi-agent workflows

What it is
- A mail-like layer that lets coding agents coordinate asynchronously via MCP tools and resources.
- Provides identities, inbox/outbox, searchable threads, and advisory file reservations, with human-auditable artifacts in Git.

Why it's useful
- Prevents agents from stepping on each other with explicit file reservations (leases) for files/globs.
- Keeps communication out of your token budget by storing messages in a per-project archive.
- Offers quick reads (`resource://inbox/...`, `resource://thread/...`) and macros that bundle common flows.

How to use effectively
1) Same repository
   - Register an identity: call `ensure_project`, then `register_agent` using this repo's absolute path as `project_key`.
   - Reserve files before you edit: `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true)` to signal intent and avoid conflict.
   - Communicate with threads: use `send_message(..., thread_id="FEAT-123")`; check inbox with `fetch_inbox` and acknowledge with `acknowledge_message`.
   - Read fast: `resource://inbox/{Agent}?project=<abs-path>&limit=20` or `resource://thread/{id}?project=<abs-path>&include_bodies=true`.
   - Tip: set `AGENT_NAME` in your environment so the pre-commit guard can block commits that conflict with others' active exclusive file reservations.

2) Across different repos in one project (e.g., Next.js frontend + FastAPI backend)
   - Option A (single project bus): register both sides under the same `project_key` (shared key/path). Keep reservation patterns specific (e.g., `frontend/**` vs `backend/**`).
   - Option B (separate projects): each repo has its own `project_key`; use `macro_contact_handshake` or `request_contact`/`respond_contact` to link agents, then message directly. Keep a shared `thread_id` (e.g., ticket key) across repos for clean summaries/audits.

Macros vs granular tools
- Prefer macros when you want speed or are on a smaller model: `macro_start_session`, `macro_prepare_thread`, `macro_file_reservation_cycle`, `macro_contact_handshake`.
- Use granular tools when you need control: `register_agent`, `file_reservation_paths`, `send_message`, `fetch_inbox`, `acknowledge_message`.

Common pitfalls
- "from_agent not registered": always `register_agent` in the correct `project_key` first.
- "FILE_RESERVATION_CONFLICT": adjust patterns, wait for expiry, or use a non-exclusive reservation when appropriate.
- Auth errors: if JWT+JWKS is enabled, include a bearer token with a `kid` that matches server JWKS; static bearer is used only when JWT is disabled.