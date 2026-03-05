---
status: proposed
date: 2026-02-26
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0002: Add Series-Level Aggregated Revenue View

## Context and Problem Statement

Organizers who run multi-competition series (e.g., "2026 Throwdowns Series") currently have no way to see aggregated revenue across all competitions in a series. They must navigate to each competition's revenue page individually, mentally summing totals and comparing division performance across events.

The existing series detail page (`/compete/organizer/_dashboard/series/$groupId/`) shows series metadata, registration questions, and a list of competitions — but no financial data. How should we surface aggregated revenue stats at the series level?

## Decision Drivers

* Organizers need a single view to understand total series revenue without clicking into each competition
* The existing competition list on the series detail page is the natural place to add this — no new navigation required
* Revenue data already exists in `commerce_purchases` with `competitionId` and `divisionId` foreign keys
* The per-competition revenue pattern (`getCompetitionRevenueStats`) is proven and can be extended
* Keep the UI consistent with the existing per-competition revenue display (`RevenueStatsDisplay`)
* CSV export needed for accounting/reporting workflows

## Considered Options

* **Option A: Inline revenue in existing competition list with expandable division breakdown**
* **Option B: New separate `/series/$groupId/revenue` sub-route**
* **Option C: Dashboard-style view with charts and graphs**

## Decision Outcome

Chosen option: **"Option A: Inline revenue in existing competition list"**, because it requires no new navigation, builds on the existing series detail page layout, and gives organizers immediate context — each competition row shows gross/net revenue, and expanding reveals division-level detail. Aggregated summary cards at the top provide the rollup.

### Consequences

* Good, because organizers see revenue alongside competition details in one view
* Good, because no new routes or navigation changes required
* Good, because reuses existing revenue calculation patterns
* Bad, because the `OrganizerCompetitionsList` component grows in complexity (it currently has no data-fetching concerns or expandable rows)
* Neutral, because the registration list view (who's registered where across competitions) is deferred to a separate effort

### Non-Goals

* Aggregated registration list (athlete-level view across competitions) — deferred
* PDF export — CSV only for V1
* Real-time revenue updates — standard loader refresh
* Modifying the per-competition revenue page — it stays as-is

## Implementation Plan

### Data Layer

**New server function: `getSeriesRevenueStatsFn`**

Create in `src/server-fns/commerce-fns.ts`. Input: `{ groupId: string }`. Logic:

1. Fetch all competition IDs in the group: `SELECT id FROM competitions WHERE groupId = ?`
2. Run a **single aggregated query** against `commerce_purchases` grouped by `competitionId` and `divisionId`, joined with `competitions` (for name/date) and `scaling_levels` (for division label). This avoids N+1 queries — critical since series will have 20+ competitions.

```sql
SELECT
  cp.competitionId,
  c.name AS competitionName,
  c.startDate,
  cp.divisionId,
  sl.label AS divisionLabel,
  COUNT(*) AS purchaseCount,
  SUM(cp.totalCents) AS grossCents,
  SUM(cp.platformFeeCents) AS platformFeeCents,
  SUM(cp.stripeFeeCents) AS stripeFeeCents,
  SUM(cp.organizerNetCents) AS organizerNetCents
FROM commerce_purchases cp
JOIN competitions c ON c.id = cp.competitionId
LEFT JOIN scaling_levels sl ON sl.id = cp.divisionId
WHERE cp.competitionId IN (SELECT id FROM competitions WHERE groupId = ?)
  AND cp.status = 'COMPLETED'
GROUP BY cp.competitionId, cp.divisionId
ORDER BY c.startDate ASC
```

3. Also fetch division fee configs per competition for ticket price display (single query with `inArray` on competition IDs).
4. Shape results into `SeriesRevenueStats`:

```typescript
interface SeriesRevenueStats {
  totalGrossCents: number
  totalOrganizerNetCents: number
  totalStripeFeeCents: number
  totalPlatformFeeCents: number
  totalPurchaseCount: number
  byCompetition: Array<{
    competitionId: string
    competitionName: string
    startDate: string
    grossCents: number
    organizerNetCents: number
    purchaseCount: number
    byDivision: Array<{
      divisionId: string
      divisionLabel: string
      purchaseCount: number
      registrationFeeCents: number
      grossCents: number
      platformFeeCents: number
      stripeFeeCents: number
      organizerNetCents: number
    }>
  }>
}
```

This approach uses 3 queries total (competitions, aggregated purchases, division fees) regardless of series size.

**Important**: Wrap all `Number()` on aggregate results — PlanetScale returns strings for COUNT/SUM columns. This is critical for the grouped aggregation query above.

**CSV export server function: `exportSeriesRevenueCsvFn`**

Create in `src/server-fns/commerce-fns.ts`. Input: `{ groupId: string }`. Returns CSV string with columns:
- Competition Name, Competition Date, Division, Registration Count, Gross Revenue, Stripe Fees, Platform Fees, Net Revenue

One row per competition-division pair. Summary row at bottom with totals.

### UI Changes

**Modify series detail page loader** (`src/routes/compete/organizer/_dashboard/series/$groupId/index.tsx`):
- Add `getSeriesRevenueStatsFn({ data: { groupId } })` to the parallel fetch in the loader
- Pass `seriesRevenueStats` to the component

**Add aggregated summary cards** on the series detail page (above the competition list):
- Two summary cards: **Gross Revenue** and **Net Revenue** (aggregated across all competitions)
- Follow the card pattern from `RevenueStatsDisplay` (DollarSign and TrendingUp icons)

**Enhance competition list rows** — either modify `OrganizerCompetitionsList` or create a new `SeriesCompetitionRevenueList` component:
- Each competition row (collapsed): Name + Date + Gross + Net
- Sort by `startDate` ascending (soonest first, not `createdAt` descending)
- Expandable: clicking a row reveals a division breakdown table matching the existing `RevenueStatsDisplay` division table pattern (Division, Athletes, Ticket Price, Gross, Platform Fee, Stripe Fee, Net)
- Use Shadcn `Collapsible` or `Accordion` from Radix for expand/collapse

**Recommendation**: Create a new `SeriesCompetitionRevenueList` component rather than overloading `OrganizerCompetitionsList`. The existing component handles filtering, series badges, and remove-from-series actions. The revenue list has different concerns (expandable rows, revenue data, CSV export). Keep them separate.

**Add CSV export button** near the summary cards:
- Download icon button, calls `exportSeriesRevenueCsvFn` and triggers browser download
- Place next to or below the summary cards

* **Affected paths**:
  - `src/server-fns/commerce-fns.ts` — new `getSeriesRevenueStatsFn`, `exportSeriesRevenueCsvFn`
  - `src/server/commerce/fee-calculator.ts` — export `SeriesRevenueStats` type (or define in commerce-fns)
  - `src/routes/compete/organizer/_dashboard/series/$groupId/index.tsx` — loader + UI changes
  - `src/components/series-competition-revenue-list.tsx` — new component
* **Dependencies**: No new packages. Uses existing Shadcn Accordion/Collapsible primitives.
* **Patterns to follow**:
  - Revenue calculation: `src/server/commerce/fee-calculator.ts` (`getCompetitionRevenueStats`)
  - Revenue display: `src/routes/compete/organizer/$competitionId/-components/revenue-stats-display.tsx`
  - Server function pattern: `createServerFn` with zod input validation in `src/server-fns/`
  - Summary cards: existing 4-card grid pattern in `RevenueStatsDisplay`
* **Patterns to avoid**:
  - Don't add revenue concerns to `OrganizerCompetitionsList` — keep it focused on competition management
  - Don't use Drizzle transactions (D1 legacy, but also not needed here)
  - Don't compute fees client-side — all aggregation happens server-side
* **Configuration**: No new env vars or config needed

### Verification

- [ ] Series detail page shows two summary cards (Gross Revenue, Net Revenue) aggregated across all competitions in the series
- [ ] Competition rows are sorted by `startDate` ascending (earliest competition first)
- [ ] Each competition row displays: competition name, date, gross revenue, net revenue
- [ ] Expanding a competition row shows a division breakdown table (Division, Athletes, Ticket Price, Gross, Platform Fee, Stripe Fee, Net)
- [ ] CSV export downloads a file with one row per competition-division pair and a totals summary row
- [ ] Series with zero revenue shows $0.00 in summary cards and empty state in competition rows
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes (existing tests don't break)

## Pros and Cons of the Options

### Option A: Inline revenue in existing competition list

Enhance the series detail page by adding summary cards and making each competition row expandable with division-level revenue breakdown.

* Good, because no new routes — organizers find it where they already look
* Good, because reuses existing revenue calculation and display patterns
* Good, because competitions ordered by date gives natural chronological view
* Bad, because series detail page grows in scope (was metadata-only, now includes financial data)
* Neutral, because requires a new component to avoid overloading the existing list

### Option B: New separate sub-route

Create `/compete/organizer/_dashboard/series/$groupId/revenue` as a dedicated revenue page.

* Good, because clean separation of concerns
* Good, because can be linked from series detail page
* Bad, because adds navigation friction — organizers must click through to another page
* Bad, because series detail page still lacks financial context

### Option C: Dashboard with charts

Full dashboard view with bar charts, trend lines, and interactive visualizations.

* Good, because visually rich and engaging
* Bad, because significant additional complexity (charting library, responsive design)
* Bad, because overkill for the current need — organizers primarily need numbers, not trends
* Bad, because longer to build with diminishing returns

## More Information

* Related: The per-competition revenue page (`/compete/organizer/$competitionId/revenue`) will remain unchanged. It provides the deep-dive view for a single competition.
* Future: An aggregated registration list view (which athletes are registered for which competitions) is planned as a follow-up. It will likely be a separate tab or section on the series detail page.
* The implementation uses a single aggregated SQL query (not per-competition calls) since the primary client will have 20+ competitions per series. This is baked into the design from the start.
* Revisit if: Query performance degrades — consider adding a `commerce_purchases` composite index on `(competitionId, status)` if not already covered.
