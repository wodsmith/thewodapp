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
- `src/agents/` — Cloudflare Agents (Durable Object classes) for AI-augmented features

### apps/crm

The CRM app is a separate TanStack Start application shell for future customer relationship workflows.

It keeps its own Cloudflare Worker, D1 database, and R2 bucket so CRM-specific data and files can evolve independently. The copied Ledger document, invoice, and financial-event surfaces were removed during the initial cleanup.

#### CRM D1 Schema

The CRM D1 schema mirrors the OpenClaw workspace object model using typed metadata tables plus EAV entry values.

The schema defines objects, fields, entries, entry fields, entry relations, statuses, and documents in [[apps/crm/src/db/schema.ts]]. IDs are generated as 32-character nanoid-compatible strings in Drizzle runtime defaults. JSON-like field metadata is stored in D1 text columns, and timestamps use SQLite `CURRENT_TIMESTAMP` text defaults.

Relation fields keep their metadata in `fields`, while normalized links live in `entry_relations`. This preserves EAV compatibility and gives many-to-one or many-to-many CRM relationships a queryable table.

#### CRM Local Seed

The CRM local seed imports OpenClaw workspace data into the app's local D1 database for development.

`pnpm --filter crm db:seed:local` runs `apps/crm/scripts/seed-local-d1-from-duckdb.mjs`, which reads the OpenClaw DuckDB workspace, reapplies CRM D1 migrations, imports objects, fields, entries, field values, statuses, and documents, then derives normalized entry relations from relation fields.

#### CRM Deployment

CRM deploys through its own GitHub Actions workflow so app changes do not depend on the main WODsmith deploy path.

`.github/workflows/deploy-crm.yml` triggers on pushes to `main` that touch `apps/crm/**` or the workflow itself, and can also be run manually. It deploys `apps/crm` with Alchemy using `pnpm run crm-deploy`, binding the production app to `https://crm.wodsmith.com`.

The CRM deploy workflow pins Bun to match the main WODsmith deploy workflow, avoiding unverified runtime updates during Alchemy deployment.

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

The event details view ([[apps/wodsmith-start/src/components/event-details-content.tsx]]) groups divisions by price tier, each tier collapsible (default open) with a chevron toggle.

### compete/organizer

Competition management dashboard for organizers. Accessible at `/compete/organizer/{competitionId}/`. Handles divisions, heats, scheduling, scoring, volunteers, and settings.

### compete/cohost

Co-host dashboard for users invited to help manage a competition. Accessible at `/compete/cohost/{competitionId}/`. Mirrors the organizer dashboard but filters navigation and features based on `CohostMembershipMetadata` permissions.

### admin

Platform-level admin routes for WODsmith operators. Manages teams, competitions, entitlements, and demo data.

### api

API routes for webhooks (Stripe, auth callbacks), cron jobs, file uploads, and internal endpoints.

## SEO and Structured Data

Public pages use per-route `head` configs for metadata, Open Graph, Twitter cards, and canonical URLs. Structured data uses JSON-LD via the [[apps/wodsmith-start/src/components/json-ld.tsx#JsonLd]] component, which escapes `<`, `>`, `&`, and Unicode line separators to prevent script-breakout XSS.

### Page Metadata

Every public route defines a `head` function with title, description, OG/Twitter tags, and canonical link.

Title format is `{Page Title} | WODsmith`. The root layout (`__root.tsx`) provides fallback title, charset, and viewport.

### Structured Data Schemas

Landing page includes `Organization` and `WebSite` JSON-LD. Competition detail pages include `SportsEvent` and `BreadcrumbList`.

`SportsEvent` has dynamic offers/availability based on registration status. All JSON-LD is rendered server-side via the `JsonLd` component.

### Sitemap

`/api/sitemap` returns a dynamic XML sitemap listing static pages and all public published competitions with their leaderboard sub-pages. Referenced from `robots.txt`. Cached for 1 hour.

Slug values are XML-escaped. `<lastmod>` is only emitted when `updatedAt` exists. Returns a 500 XML response on failure.

### robots.txt

Disallows `/api/`, `/_auth/`, `/admin/`, `/dashboard/` from crawlers. References the sitemap URL.

## AI Agents

AI features use Cloudflare Agents (npm `agents`), which are Durable Object subclasses with auto-syncing state and WebSocket transport.

Wiring is split across three layers:

- **Infrastructure**: `alchemy.run.ts` declares each agent as a `DurableObjectNamespace({ className, sqlite: true })` and adds it to the Worker bindings.
- **Worker entry**: `src/server.ts` re-exports the agent class (Cloudflare requires DO classes on the entry module), authenticates `/agents/*` connections, resolves the named Durable Object with `getAgentByName`, then forwards the request to the stub.
- **React client**: `useAgent({ agent: '<kebab-case-class>', name })` from `agents/react` opens a WebSocket and exposes `state` (auto-synced) and `stub` (typed RPC over `@callable()` methods).

Pure helpers and Zod schemas for each agent live under `src/lib/<agent-name>/` so they can be TDD-tested without spinning up the LLM. DB-backed context loaders sit under `src/server/<agent-name>/` and stay server-only.

Inference goes through Cloudflare AI Gateway using the AI SDK gateway provider. `alchemy.run.ts` provisions the Durable Object namespace, Workers AI binding, and managed gateway name/token bindings used by the agent.

### Entitlement gating

Every AI feature is gated by a `features` row in the database; access is granted per-team through the existing entitlements system. The check uses [[apps/wodsmith-start/src/server/entitlements.ts#hasFeature]] and is applied in three places for defense in depth:

1. Page loader — calls `loadAi...ContextFn` which returns `{hasAccess: false}` when not entitled; UI renders an upgrade paywall instead of the feature
2. Write server function — throws on missing entitlement so writes from a stale client are rejected
3. Agent WebSocket route — requires a valid session and an agent name ending in the current user id; because this route is handled before TanStack Start request context exists, [[apps/wodsmith-start/src/server.ts]] validates the raw request cookie via [[apps/wodsmith-start/src/utils/auth.ts#getSessionFromRequestCookie]]
4. Agent's `@callable()` entrypoint — calls [[apps/wodsmith-start/src/server/judge-scheduler/access.ts#requireAiSchedulingAgentAccess]] with the user id from the authenticated agent name before loading roster context or burning Workers AI tokens; this path uses direct DB permission checks and avoids Start cookie helpers because Durable Objects do not have Start request context

### AI judge scheduling

[[apps/wodsmith-start/src/agents/judge-scheduler-agent.ts#JudgeSchedulerAgent]] proposes judge rotations for one event at a time.

The system prompt instructs it to treat volunteer availability and credentials as *soft* preferences. The agent emits `confidence='low'` and a `softViolations[]` list when it has to override a preference to fill coverage.

Intent-based tools the agent calls (per Anthropic's "Building Effective Agents"):

- `get_event_context` — heats with timing/lanes/occupancy + event defaults
- `get_judge_roster` — eligible judges with availability/credentials/load
- `get_prior_rotations` — recent rotations from other workouts in the same competition (style examples)
- `propose_rotation` — emit one rotation; auto-merges with `validateProposal` violations and pushes to `state.proposals` so the client sees it stream in
- `revoke_proposal` — withdraw a previous proposal
- `check_coverage` — wraps [[apps/wodsmith-start/src/lib/judge-rotation-utils.ts#calculateCoverage]] over the current proposal set
- `mark_complete` — final summary

The organizer page at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/judges-ai.tsx]] mirrors the existing rotation timeline visuals (heats × lanes grid, color-coded coverage). Each streamed proposal renders with its confidence badge, rationale, and any soft violations; the organizer toggles per-proposal Accept/Reject. "Save as Draft" calls [[apps/wodsmith-start/src/server-fns/judge-scheduler-ai-fns.ts#applyAiProposalsFn]], which revalidates proposal membership, event ownership, lane bounds, and slot overlaps before writing `competition_judge_rotations`. The organizer still publishes via the existing rotation timeline screen so versioning + materialization stay in one place.
