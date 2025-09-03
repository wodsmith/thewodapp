# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Authentication & Authorization
- Session handling: `getSessionFromCookie()` for server components
- Client session: `useSessionStore()` from `src/state/session.ts`
- Team authorization utilities in `src/utils/team-auth.ts`
- Protect routes with team context validation

### State Management
- Server state: React Server Components
- Client state: Zustand stores in `src/state/`
- URL state: NUQS for search parameters
- Forms: React Hook Form with Zod validation

### API Patterns
- Server actions with ZSA: `import { useServerAction } from "zsa-react"`
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