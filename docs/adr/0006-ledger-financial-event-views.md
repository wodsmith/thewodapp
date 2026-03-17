---
status: proposed
date: 2026-03-16
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0006: Display Financial Events in Ledger App

## Context and Problem Statement

ADR-0003 introduces a `financial_events` table in PlanetScale that records every financial state change (payments, refunds, disputes, chargebacks) as an append-only log. That data currently has no UI — it's only queryable via raw SQL.

Stripe does not retain transaction data indefinitely. We need to own our transactional data and make it accessible to WODsmith platform owners for internal bookkeeping. The `apps/ledger/` app already exists as an internal tool (password-protected, deployed at `ledger.wodsmith.com`) but currently only manages invoice documents.

How should we expose financial event data in the ledger app?

## Decision Drivers

* Must connect to the same PlanetScale database that `apps/wodsmith-start` writes to
* Must be read-only — no mutations from the ledger app
* Must work within existing ledger auth (password-based, WODsmith owners only)
* Must not affect existing ledger document management features
* Must reuse the Hyperdrive connection pattern from `apps/wodsmith-start`
* Should support slicing data by event type, team, and date range
* Should default to last 30 days to keep initial loads fast

## Considered Options

* **Option A: Direct PlanetScale connection via Hyperdrive** — ledger connects to PlanetScale directly using the same Hyperdrive pattern as wodsmith-start
* **Option B: API layer** — ledger calls wodsmith-start server functions or a shared API to fetch data

## Decision Outcome

Chosen option: **"Option A: Direct PlanetScale connection via Hyperdrive"**, because both apps run on Cloudflare Workers, the Hyperdrive pattern is proven, and adding an API layer introduces unnecessary latency and coupling for a read-only internal tool.

### Consequences

* Good, because WODsmith owners can view all financial events without querying Stripe
* Good, because data persists locally even after Stripe retention windows expire
* Good, because reuses proven Hyperdrive connection pattern — minimal new infrastructure
* Good, because read-only access eliminates risk of accidental mutations
* Good, because existing document management features are completely unaffected (separate route, separate DB)
* Bad, because ledger now depends on PlanetScale availability (acceptable — wodsmith-start has the same dependency)
* Neutral, because ledger will import wodsmith-start's schema types — requires keeping them in sync

### Non-Goals

* Write operations or manual adjustments from ledger (future ADR if needed)
* Organizer-facing financial views (those belong in wodsmith-start)
* Data replication/sync into ledger's D1 database
* Automated reconciliation reports (ADR-0003 Phase 6 covers this)
* Modifying the financial event recording logic (that's ADR-0003's scope)

## Implementation Plan

### Phase 1: PlanetScale Connection in Ledger

**Add Hyperdrive binding to `apps/ledger/alchemy.run.ts`:**

```typescript
import { Hyperdrive } from "alchemy/cloudflare"

// Reuse the same PlanetScale credentials as wodsmith-start
const hyperdrive = await Hyperdrive(`ledger-hyperdrive-${stage}`, {
  origin: {
    host: psPassword.host,
    database: psDbName,
    user: psPassword.username,
    password: psPassword.password.unencrypted,
    port: 3306,
    scheme: "mysql",
  },
  caching: {
    disabled: false, // read-only queries can benefit from caching
  },
  adopt: true,
  dev: {
    origin: `mysql://${psPassword.username}:${psPassword.password.unencrypted}@${psPassword.host}:3306/${psDbName}?sslaccept=strict`,
  },
})
```

Add `HYPERDRIVE: hyperdrive` to the TanStack Start bindings.

**Add PlanetScale DB module: `apps/ledger/src/db/planetscale.ts`**

```typescript
import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import mysql from "mysql2"
import * as schema from "./ps-schema"

export type PlanetScaleDatabase = MySql2Database<typeof schema>

export const getPsDb = createServerOnlyFn((): PlanetScaleDatabase => {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
  if (!connectionString) {
    throw new Error("No PlanetScale connection available.")
  }
  const url = new URL(connectionString)
  url.searchParams.delete("ssl-mode")

  const connection = mysql.createConnection({
    uri: url.toString(),
    disableEval: true,
  })

  return drizzle({ client: connection, schema, casing: "snake_case", mode: "planetscale" })
})
```

**Add read-only schema subset: `apps/ledger/src/db/ps-schema.ts`**

Copy only the tables needed for read queries from wodsmith-start:
- `financialEventTable` from `financial-events.ts`
- `commercePurchaseTable` (select columns only — id, totalCents, status, teamId, competitionId)
- `teamTable` (id, name — for display purposes)

These are read-only schema definitions — no relations needed, just table shapes for SELECT queries.

**Add dependencies to `apps/ledger/package.json`:**
- `mysql2` (PlanetScale driver)
- `drizzle-orm` (already present but may need mysql2 adapter)

### Phase 2: Server Functions for Financial Event Queries

**New file: `apps/ledger/src/server-fns/financial-events.ts`**

Three server functions, all read-only:

```typescript
// 1. Event log — flat list with filters
export const getFinancialEvents = createServerFn({ method: "GET" })
  .validator(z.object({
    eventType: z.string().optional(),
    teamId: z.string().optional(),
    startDate: z.string().optional(),   // ISO date
    endDate: z.string().optional(),     // ISO date
    page: z.number().default(1),
    pageSize: z.number().default(50),
  }))
  .handler(async ({ data }) => { /* ... */ })

// 2. Purchase-level view — events grouped by purchaseId with net balance
export const getPurchaseEvents = createServerFn({ method: "GET" })
  .validator(z.object({
    purchaseId: z.string().optional(),
    teamId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(50),
  }))
  .handler(async ({ data }) => { /* ... */ })

// 3. Summary — revenue totals by team and/or period
export const getFinancialSummary = createServerFn({ method: "GET" })
  .validator(z.object({
    groupBy: z.enum(["team", "month", "eventType"]).default("month"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }))
  .handler(async ({ data }) => { /* ... */ })
```

All functions:
- Call `requireAuth()` before executing
- Use `getPsDb()` for PlanetScale access
- Default date range: last 30 days
- Wrap numeric aggregation results with `Number()` (PlanetScale returns strings for COUNT/SUM)

### Phase 3: Route and UI Components

**New route: `apps/ledger/src/routes/_authenticated/platform-transactions.tsx`**

A tabbed view with three tabs:

1. **Event Log** — TanStack Table showing all financial events
   - Columns: date, event type, amount, purchase ID, team name, reason, Stripe refs
   - Filters: event type dropdown, team dropdown, date range picker
   - Color-coded event types (green for payments, red for refunds/disputes)
   - Pagination (50 per page)

2. **By Purchase** — Events grouped by purchase
   - Each purchase row shows: purchase ID, total, net balance (sum of events), event count
   - Expandable rows to see individual events
   - Flag purchases where net balance ≠ total (potential reconciliation issues)

3. **Summary** — Aggregate view
   - Revenue totals by month (bar chart or table)
   - Breakdown by team
   - Refund rate, dispute rate

**New components:**
- `apps/ledger/src/components/financial-event-table.tsx` — TanStack Table for event log
- `apps/ledger/src/components/purchase-group-table.tsx` — grouped purchase view
- `apps/ledger/src/components/financial-summary.tsx` — summary/totals view
- `apps/ledger/src/components/date-range-filter.tsx` — reusable date range picker
- `apps/ledger/src/components/event-type-badge.tsx` — color-coded event type badge

**Navigation**: Add "Platform Transactions" link to the existing header/nav alongside "Documents".

### Phase 4: Update Wrangler Config

**Update `apps/ledger/wrangler.jsonc`:**

Add Hyperdrive binding for local dev:
```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "placeholder-set-after-deploy"
    }
  ]
}
```

Run `pnpm cf-typegen` after to regenerate `worker-configuration.d.ts`.

### Affected Files

| File | Change |
|------|--------|
| `apps/ledger/alchemy.run.ts` | Add PlanetScale password resource, Hyperdrive binding |
| `apps/ledger/wrangler.jsonc` | Add Hyperdrive binding for local dev |
| `apps/ledger/package.json` | Add `mysql2` dependency |
| `apps/ledger/src/db/planetscale.ts` | **New** — PlanetScale connection via Hyperdrive |
| `apps/ledger/src/db/ps-schema.ts` | **New** — read-only schema subset for financial events |
| `apps/ledger/src/server-fns/financial-events.ts` | **New** — query functions for events, purchases, summary |
| `apps/ledger/src/routes/_authenticated/platform-transactions.tsx` | **New** — tabbed transaction view |
| `apps/ledger/src/components/financial-event-table.tsx` | **New** — event log table |
| `apps/ledger/src/components/purchase-group-table.tsx` | **New** — purchase-grouped view |
| `apps/ledger/src/components/financial-summary.tsx` | **New** — summary/totals view |
| `apps/ledger/src/components/date-range-filter.tsx` | **New** — date range filter |
| `apps/ledger/src/components/event-type-badge.tsx` | **New** — event type badge |
| `apps/ledger/worker-configuration.d.ts` | Regenerated — includes Hyperdrive type |

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `mysql2` | latest | PlanetScale MySQL driver (matches wodsmith-start) |

No other new packages. Uses existing Drizzle ORM, TanStack Router, TanStack Table, Shadcn UI, and Tailwind.

### Verification

- [ ] `apps/ledger` connects to PlanetScale via Hyperdrive in deployed environment
- [ ] `apps/ledger` connects to PlanetScale directly in local dev
- [ ] Event log view renders financial events with correct amounts and types
- [ ] Event log filters work: by event type, team, date range
- [ ] Purchase view groups events by purchase and shows net balance
- [ ] Purchase view flags mismatched balances (net ≠ total and net ≠ 0)
- [ ] Summary view shows revenue totals by month
- [ ] Summary view shows breakdown by team
- [ ] Default date range is last 30 days
- [ ] Pagination works across all views
- [ ] All queries are read-only — no INSERT/UPDATE/DELETE on PlanetScale
- [ ] Existing document management features are unaffected
- [ ] Existing ledger auth protects the new route
- [ ] `pnpm type-check` passes in `apps/ledger`
- [ ] Numeric aggregation results handle PlanetScale string returns (wrapped with `Number()`)
- [ ] Navigation includes link to "Platform Transactions"

## Pros and Cons of the Options

### Option A: Direct PlanetScale connection via Hyperdrive (chosen)

* Good, because simple — one connection, no intermediary
* Good, because reuses proven Hyperdrive pattern from wodsmith-start
* Good, because read-only access is safe — no risk of accidental writes
* Good, because Hyperdrive caching benefits read-heavy workload
* Bad, because ledger must maintain its own copy of schema types
* Neutral, because adds PlanetScale as a runtime dependency for ledger

### Option B: API layer through wodsmith-start

* Good, because single source of truth for data access
* Good, because ledger doesn't need PlanetScale credentials
* Bad, because adds latency (Worker → Worker → PlanetScale vs Worker → PlanetScale)
* Bad, because requires building and maintaining API endpoints in wodsmith-start
* Bad, because couples ledger deployment to wodsmith-start availability
* Bad, because overkill for internal read-only queries

## More Information

* Depends on ADR-0003 (financial event log table must exist and be populated)
* The read-only schema subset in `ps-schema.ts` should be updated when `financial-events.ts` schema changes in wodsmith-start
* Hyperdrive caching can be enabled for the ledger connection since all queries are read-only (unlike wodsmith-start which disables caching for write consistency)
* Future: if we add more PlanetScale-backed views to ledger, the connection pattern established here is reusable
