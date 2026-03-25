# Architecture

WODsmith is a competition management platform for functional fitness events, built as a Turborepo monorepo.

## Tech Stack

TanStack Start (React + Vite) deployed to Cloudflare Workers, with PlanetScale (MySQL/Vitess) via Drizzle ORM.

- **Frontend**: React 19, TanStack Router, Tailwind CSS 4, Radix UI, shadcn components
- **Server**: TanStack Start server functions (`createServerFn`), Cloudflare Workers runtime
- **Database**: PlanetScale (MySQL), Drizzle ORM with push-based local dev workflow
- **Auth**: Password, session-based via cookies
- **Payments**: Stripe Connect for organizer payouts, Stripe Checkout for registration fees
- **Observability**: evlog (wide events), Sentry (errors), PostHog (analytics)
- **Deployment**: Alchemy IaC to Cloudflare Workers, Vite build pipeline
- **Testing**: Vitest (unit/integration), Playwright (E2E), Testing Library (components)

## Monorepo Structure

The monorepo uses Turborepo with pnpm workspaces. The main app lives in `apps/wodsmith-start/`.

### apps/wodsmith-start

The primary web application containing all user-facing functionality.

- `src/routes/` — TanStack Router file-based routing with layout groups
- `src/server-fns/` — Server functions (RPC-style, called from components)
- `src/db/schemas/` — Drizzle ORM table definitions split by domain
- `src/components/` — React components (shadcn/ui base + domain-specific)
- `src/lib/` — Shared utilities (Stripe, logging, scoring, env)
- `src/data/` — Data access layer for database queries
- `src/schemas/` — Zod validation schemas for forms and API inputs
- `src/workflows/` — Multi-step business processes (registration, checkout)

### packages

Shared packages consumed by apps.

- `@repo/test-utils` — Shared test helpers and fixtures for Vitest
- `@repo/typescript-config` — Shared TypeScript configuration

## Route Groups

TanStack Router uses layout-based route groups to control access and shared UI.

### _auth

Public authentication routes — login, signup, password reset, email verification.

### _protected

Authenticated routes requiring a valid session. Contains the main app dashboard, team management, workout programming, and settings.

### compete

Public-facing competition pages. Athletes browse, register for, and view results of competitions at `/compete/{slug}`.

### compete/organizer

Competition management dashboard for organizers. Accessible at `/compete/organizer/{competitionId}/`. Handles divisions, heats, scheduling, scoring, volunteers, and settings.

### admin

Platform-level admin routes for WODsmith operators. Manages teams, competitions, entitlements, and demo data.

### api

API routes for webhooks (Stripe, auth callbacks), cron jobs, file uploads, and internal endpoints.

## SEO and Structured Data

Public pages use per-route `head` configs for metadata, Open Graph, Twitter cards, and canonical URLs. Structured data uses JSON-LD via the [[apps/wodsmith-start/src/components/json-ld.tsx#JsonLd]] component.

### Page Metadata

Every public route defines a `head` function with title, description, OG/Twitter tags, and canonical link.

Title format is `{Page Title} | WODsmith`. The root layout (`__root.tsx`) provides fallback title, charset, and viewport.

### Structured Data Schemas

Landing page includes `Organization` and `WebSite` JSON-LD. Competition detail pages include `SportsEvent` and `BreadcrumbList`.

`SportsEvent` has dynamic offers/availability based on registration status. All JSON-LD is rendered server-side via the `JsonLd` component.

### Sitemap

`/api/sitemap` returns a dynamic XML sitemap listing static pages and all public published competitions with their leaderboard sub-pages. Referenced from `robots.txt`. Cached for 1 hour.

### robots.txt

Disallows `/api/`, `/_auth/`, `/admin/`, `/dashboard/` from crawlers. References the sitemap URL.
