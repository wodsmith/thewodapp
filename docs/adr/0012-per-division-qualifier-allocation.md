---
status: proposed
date: 2026-04-26
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0012: Per-Division Qualifier Allocation for Competition Invite Sources

## Context and Problem Statement

[ADR-0011](./0011-competition-invites.md) ships qualification sources with two integer allocation knobs: `globalSpots` (single number per source — total top-N for a single comp, or extra global-leaderboard spots for a series) and `directSpotsPerComp` (series only — top-N out of *each* comp in the series). Both are scalar; neither knows about divisions. There *is* a `divisionMappings` JSON column on the source, but it is currently used as a sparse mapping table and not exposed to the organizer as a first-class allocation surface.

Today the organizer-facing [`InviteSourcesList`](./../../apps/wodsmith-start/src/components/organizer/invites/invite-sources-list.tsx) renders one card per source with one number for "qualifying spots." That number then drives the `accepted/maxSpots` ratio rendered under each division card in the [Sent invites tab](./../../lat.md/competition-invites.md). The ratio falls back to `accepted` (no denominator) when there is no per-division target — and right now there is *no* way for the organizer to set a per-division target on a source. The denominator the Sent tab is reading is `competition_divisions.maxSpots` from the championship — i.e. the *registration* capacity of the championship division — which conflates "how many spots are reserved for this division" with "how many of those should come from this particular source." A source that, in practice, only feeds Rx (because Scaled gets its slots from a different qualifier feed) has no way to express that.

The pattern the organizer expects is the same as event divisions today: a competition-level *default* (`competitions.defaultMaxSpotsPerDivision`) with a per-division *override* (`competition_divisions.maxSpots`). The user wants this exact shape for qualifier allocation: a source-level "Top N qualifies" default plus per-division overrides keyed by the championship's divisions.

The current modal-based "Add/Edit source" UX is also too narrow to host a per-division allocation table. Pulling the source into a details page lets us host a divisions table without cramming the modal — and lines up with how event divisions are edited today (list page → details).

How should the data model and UX express per-division qualifier allocation per source, while staying consistent with the existing default-plus-override pattern and keeping the championship competition as the owner of all allocation data?

## Decision Drivers

- Must support a **source-level default** ("Top N qualifies") that applies to every championship division when no override is set.
- Must support **per-division overrides** keyed by the **championship's** divisions, not the source's divisions. The championship owns its divisional layout; the source merely contributes spots into it.
- Must mirror the **event-divisions UX pattern** organizers already know: default at the parent level, overrides per division, "uses default" indicator.
- Must keep the **Sent tab denominator correct**: the `accepted/maxSpots` ratio under each division card must reflect the *invite allocation* (sum of per-division qualifier targets across sources for that championship division), not the registration capacity of the championship's division.
- Must be **typed and queryable** — the existing `divisionMappings` JSON blob is opaque to SQL, can't be indexed, and can't participate in the roster/sent-tab joins without a parse step.
- Must remain **championship-owned** — every qualifier-allocation row scopes to a championship competition (via its source rows), so deleting the championship cascades cleanly through the source's allocations.
- Must be **non-destructive to ADR-0011's roster math** in Phase 1: until the organizer opts in to per-division overrides, behavior should match today (global Top N stands).
- Must be **incrementally shippable** — allocation table can land before the details page; details page can ship behind a route flag while the modal still works.

## Considered Options

### A. Keep `divisionMappings` JSON; add an "overrides" key

Extend the existing JSON shape on `competitionInviteSourcesTable.divisionMappings` to carry per-division `spots` overrides. UI reads/writes JSON.

**Pros:** No new table. Migration-free.
**Cons:** JSON is opaque to roster queries that need to join `(source, championshipDivisionId) → spotsAllocated`. Type safety relies on a Zod parser at every read site. The existing `divisionMappings` is *also* used to express source-division → championship-division mapping (a different concept — "the Rx field of the qualifier feeds the Rx field of the championship") — overloading it conflates mapping with allocation. **Rejected** — wrong storage primitive for a value the organizer edits constantly and the roster query reads on every render.

### B. New table `competition_invite_source_division_allocations`

Promote per-division allocation to its own MySQL table, keyed by `(sourceId, championshipDivisionId)`, carrying `spots` (int). Source row keeps `globalSpots` as the *default*; absence of an allocation row means "use the default." Adds a typed read path for the roster + sent-tab denominator.

**Pros:** Mirrors `defaultMaxSpotsPerDivision` + `competition_divisions.maxSpots` exactly. Indexable. Joinable. Each row is championship-owned via `sourceId → championshipCompetitionId`. Lets the organizer leave most divisions on the default and override only what differs. No conflict with the existing `divisionMappings` mapping concept.
**Cons:** New table. Roster math gets a third source of allocation truth (default → override → series direct-per-comp scaling). Bounded by per-division row count, which is small.

### C. Per-division allocation columns on `competitionInviteSourcesTable`

Add `divisionAAllocation`, `divisionBAllocation`, ... — one column per division.

**Pros:** None.
**Cons:** Divisions are dynamic per championship. Not viable. **Rejected** trivially.

### D. Move allocation onto `competition_divisions` (championship-side, shared across sources)

Store one number per championship division — total invite spots for that division — and let the championship divvy it among sources implicitly.

**Pros:** Most "championship-owned" of the options; one place to read.
**Cons:** Loses per-source attribution. Two sources feeding Rx can't carry distinct caps ("3 from Throwdown A, 2 from Throwdown B") — the whole point of having multiple sources is that each contributes a known amount. **Rejected** — collapses the semantics ADR-0011 was built on.

## Decision Outcome

Chosen option: **B. New table `competition_invite_source_division_allocations`**, because it preserves per-source attribution (which ADR-0011's roster computation depends on), gives the roster query a typed/indexed read path, and matches the default-plus-override pattern organizers already use for event divisions. The championship keeps ownership: every allocation row is reachable via `sourceId → championshipCompetitionId`, and cascading deletes follow that path.

The source row's `globalSpots` (single competition) and `directSpotsPerComp` (series) become the *defaults* applied to championship divisions that have no allocation row. An allocation row's presence means "this division differs from the default"; its absence means "use the default." This matches `competitions.defaultMaxSpotsPerDivision` + `competition_divisions.maxSpots` semantics one-for-one.

The "Edit source" modal is replaced by a details page at `compete/organizer/$competitionId/invites/sources/$sourceId`, which hosts the existing source fields plus a divisions table (one row per championship division, with a "Use default" toggle and a numeric input). The list page keeps its summary card and links into the details route. The modal stays around only for *creating* a source (where there are no overrides to edit yet).

### Consequences

- **Good**, because the Sent tab's `accepted/maxSpots` ratio gets a real per-(source, division) denominator — summed across sources for the division card, replacing today's reliance on `competition_divisions.maxSpots` (which is registration capacity, not invite allocation).
- **Good**, because the data model mirrors a pattern organizers already understand (event divisions default + override), so no new mental model.
- **Good**, because championship ownership is preserved — every allocation row is reachable from the championship via `competition_invite_sources.championshipCompetitionId`, and deletion cascades follow that path.
- **Good**, because per-source attribution survives — two sources feeding the same division each carry their own override, and roster math sums them rather than guessing.
- **Bad**, because the roster computation gets a third allocation tier (per-division override → source default → series scaling), which adds branches to `allocatedSpotsFor`. Mitigated by writing a single `resolveAllocations(source, championshipDivisions)` helper that returns a `Record<championshipDivisionId, number>` for each source.
- **Bad**, because converting the modal into a details page means a new route, loader, and form — more surface than a modal-only edit. Mitigated by reusing the existing edit handlers as server fns.
- **Neutral**, because `divisionMappings` JSON stays for source-side → championship-side division *mapping* (a separate concept from allocation). If the user later wants to deprecate it, that's a follow-up ADR.

### Non-Goals

- **Per-division allocation on bespoke invites.** Bespoke invitees aren't tied to a source row; they're allocated by the organizer at invite time. This ADR only adds per-division allocation to *source-derived* invites.
- **Per-event allocation.** Allocation is per championship *division*, not per event within the championship.
- **Renaming `globalSpots` / `directSpotsPerComp`.** Those columns stay as-is; we just use them as defaults rather than the only allocation knob. A future cleanup ADR can rename if the new defaults-vs-overrides framing makes the names misleading.
- **Auto-syncing allocations when championship divisions are added or removed.** New championship divisions inherit the source default (no allocation row). Removed championship divisions cascade-delete their allocation rows in the helper, not the schema.
- **A migration of existing `divisionMappings` JSON allocations into the new table.** ADR-0011 ships with a sparse `divisionMappings` blob; today no organizer-facing UI writes per-division spot counts into it, so there's no data to migrate.

## Detailed Design

### Database Schema

#### `competition_invite_source_division_allocations` (new)

| Column | Type | Description |
|---|---|---|
| `id` | varchar(255) PK | ULID |
| `sourceId` | varchar(255) | FK-by-convention → `competition_invite_sources.id`. Cascading delete handled in the source-delete helper. |
| `championshipDivisionId` | varchar(255) | FK-by-convention → `competition_divisions.id` of the championship competition. |
| `spots` | int NOT NULL | Override count for this division. `0` means "this division gets none from this source"; absence of the row means "use the source default." |
| `commonColumns` | — | `createdAt` / `updatedAt` per house style. |

Indexes:
- `(sourceId, championshipDivisionId)` UNIQUE — one allocation per (source, division).
- `(championshipDivisionId)` — for the Sent-tab denominator query that sums across sources for one division card.

#### Existing tables — no schema changes

- `competition_invite_sources.globalSpots` and `directSpotsPerComp` keep their columns and types; semantics shift from "the allocation" to "the default applied when no override exists for a championship division."
- `competition_divisions.maxSpots` is unchanged — still the registration capacity. The Sent tab stops using it as the invite-allocation denominator.

### Allocation Resolution

A single helper, `resolveSourceAllocations(source, championshipDivisions, allocations)`, returns `Record<championshipDivisionId, number>`. Algorithm:

1. For each championship division, look up an allocation row for `(source.id, division.id)`.
2. If present, use `allocation.spots`.
3. Else, use the source default: `globalSpots` (single comp) or `directSpotsPerComp × seriesCompCount + globalSpots` (series — preserves existing series math, applied per division).

The roster computation calls this once per source and sums the resulting maps. The Sent tab's per-division denominator is the same sum, scoped to one championship division.

### UX

- The source list (`InviteSourcesList`) keeps its card layout. Each card's allocated-spots summary becomes a sum of resolved allocations across championship divisions.
- A new route `compete/organizer/$competitionId/invites/sources/$sourceId` hosts a source details page: the existing source meta fields at the top, plus a "Per-division allocation" table — one row per championship division, with a "Use default ({source.globalSpots})" toggle and a numeric input shown when toggled off.
- The "Edit" button on the source card navigates to the details page; the "Add source" button still opens the existing creation modal (no overrides at create time).
- The Sent tab's division card ratio reads from the resolved allocation sum instead of `competition_divisions.maxSpots`. The existing fallback ("X accepted" with no denominator) applies when *every* source-allocation for that division is null and no source default applies.

### Backwards Compatibility

- Existing sources continue to work without any allocation rows — they hit the default branch.
- The Sent tab's ratio for an already-shipped championship matches today's behavior on the day of deploy: with no allocation rows present, the resolved denominator equals `globalSpots` (or the series formula) per division — which, for organizers who haven't differentiated by division, is the answer they want.
- Bespoke invites are unaffected.

### Route Updates

The organizer-facing tree under `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/` today is a single file (`index.tsx`) hosting six tabs. Each tab — and the new details route — needs allocation-aware logic. The athlete-facing `compete/$slug/claim/$token.tsx` route picks up the new `over_allocated` reason from the loader.

#### `invites/index.tsx` — loader

Today the loader runs `Promise.all` against sources, divisions, the first division's roster, the active-invites projection, and the audit projection. Add a sixth parallel call: `listInviteSourceAllocationsFn({ championshipCompetitionId })` returning `Record<sourceId, Record<championshipDivisionId, number>>` — the resolved map, with defaults already applied. Children consume the map directly; nothing in the route does default-vs-override branching at render time.

The loader also exposes a `divisionAllocationTotals: Record<championshipDivisionId, number>` derived from summing the resolved map across sources. The Sent tab and Candidates tab both read from this single denominator.

#### Candidates tab

Today the Candidates tab renders `ChampionshipRosterTable` for the selected division, using `directSpotsPerComp` / `globalSpots` for the cutoff line. Update:

- The cutoff line for each source's per-comp / global block uses the source's resolved allocation for the *selected* championship division, not the source-level default.
- Smart-select buttons ("select to fill division") use `divisionAllocationTotals[selectedDivisionId]` minus already-issued (active) invites in that division as the target count.
- Bespoke drafts continue to ignore allocation — they're outside the source model.
- The "Send invites" dialog (`SendInvitesDialog`) gets a per-recipient breakdown showing `${sourceName} → ${divisionLabel}: spot N of M` so the organizer can see whether a send would over-issue. A red badge appears when issuing the selected list would push any (source, division) bucket over its allocation; the Send button stays enabled (over-issue is allowed by `issueInvitesFn`, see below) but the warning is surfaced inline.

#### Sources tab

`InviteSourcesList` keeps its summary card. Each source card's "Contributes N qualifying spots" line becomes a sum of the resolved map for that source. The `renderSourceExtras` slot the component already accepts is the natural place to show a one-line "Per-division: Rx 3 · Scaled 2 · Masters default (5)" preview. The "Edit" button navigates to the new details route instead of opening the modal; the modal stays for **Add source** (no overrides at create time, so the modal is appropriate).

#### Sources details page (new) — `invites/sources/$sourceId.tsx`

New nested route. Loader: source row + championship divisions + the source's allocation rows + roster preview for one division. Page layout:

1. **Source meta** — same fields the modal had (kind, source comp/series, default spots, notes).
2. **Per-division allocation table** — one row per championship division. Each row shows the championship division label, a "Use default" toggle (on by default), and a numeric input shown when toggled off. Inline preview of the resolved value: bold when overridden, muted when defaulted.
3. **Save** persists via a single server fn `saveInviteSourceAllocationsFn({ sourceId, allocations: Array<{ championshipDivisionId, spots: number | null }> })` — `null` deletes the row (revert to default), a number upserts. Permission gate: same `MANAGE_COMPETITIONS` as the existing source endpoints.
4. **Delete source** lives at the bottom (existing `DeleteInviteSourceDialog`), and the delete helper also removes the source's allocation rows in the same transaction.

#### Sent tab

`SentInvitesByDivision` is the surface that already renders allocation-shaped metadata: a per-division `${accepted}/${maxSpots} spots filled` headline plus a row of per-source chips `${sourceName}: ${accepted}/${allocated}` (with `—` denominator for Bespoke). Three concrete updates:

1. **Division headline denominator.** `divisions[].maxSpots` is loader-supplied. Today the loader populates it from `competition_divisions.maxSpots` (championship registration cap). Switch it to `divisionAllocationTotals[divisionId]` — sum of resolved per-source allocations for that championship division. Fallback ("X accepted" with no denominator) fires when the resolved total is `0` *and* the source defaults sum to `0`.
2. **Per-source chip denominator.** The component's local `allocationFor(source, championshipDivisionId)` helper today parses `competitionInviteSourcesTable.divisionMappings` JSON to compute the chip's `allocated`. That helper is **deleted**. Replace with a new prop `allocationsBySourceByDivision: Record<sourceId, Record<championshipDivisionId, number>>` — the same resolved map the loader already computes for the rest of the route. The chip filter ("show source X if allocated > 0 or accepted > 0") and Bespoke handling (no allocation, em-dash denominator, only shown when accepted > 0) stay as-is.
3. **Prop surface.** `sources`, `competitionNamesById`, `seriesNamesById` props stay (still needed for source-name resolution). Remove the JSON-parsing branch from the component — allocation is now derived data passed in, not parsed at render. Update the test fixtures in `test/components/sent-invites-by-division.test.tsx` to feed the new prop instead of writing `divisionMappings` JSON onto fake source rows.

The `// @lat: [[competition-invites#Sent invites tab]]` reference at the top of the component stays valid — the corresponding lat.md section needs a one-paragraph addendum explaining the new prop and the deleted JSON-parse path.

#### Round History / Email Templates / Series Global tabs

Placeholders today; no allocation work in this ADR. When Phase 3 of ADR-0011 lands the round builder, the per-(source, division) cap is read from the same loader map, so no further plumbing is needed at that point.

### Claim-time Allocation Guardrail

The user requirement: an athlete cannot claim an invite if accepting it would push the source's allocation for the championship division over its cap.

#### Where the check lives

The check fires inside `getInviteByTokenFn` after `assertInviteClaimable` passes and before identity match — same place the existing `already_paid` cross-check sits. A new helper `assertInviteWithinAllocation(invite, allocations, currentAcceptedCounts)` returns the discriminated `over_allocated` reason on miss. The route loader at `compete/$slug/claim/$token.tsx` branches on `reason === "over_allocated"` and renders dedicated copy: "This division has filled its spots from this qualifier. The organizer has been notified." with a contact-organizer CTA, similar to how `already_paid` redirects to `/registered`.

#### What "currentAccepted" means

Authoritative consumption of an allocation slot is `competition_invites.status = "accepted_paid"`. Counting only `accepted_paid` keeps the math consistent with ADR-0011's existing capacity model (Stripe-in-flight stays `pending`). The query is one indexed lookup: `count(*) where sourceId = $sid and championshipDivisionId = $did and status = 'accepted_paid'`.

#### Race window

The window between two athletes hitting the same last spot through Stripe is the same race ADR-0011 already handles for division registration capacity: the **authoritative** gate is at payment confirmation in the Stripe workflow, where the increment is wrapped in a transaction with a re-check of the count under lock. The claim-time check is **best-effort UX** — it stops the obvious case ("the spot was filled an hour ago") from getting through to Stripe Checkout, but it doesn't pretend to prevent the genuine race.

The Stripe workflow's `pending → accepted_paid` step is updated to add: if `count(accepted_paid for (sourceId, championshipDivisionId)) >= allocation`, refund-and-fail the registration with an organizer-visible error rather than committing the row. This is the same pattern division capacity uses today; the new dimension is per-(source, division) instead of per-division.

#### Bespoke invites

Bespoke invites have `sourceId IS NULL` and are outside the allocation model — the guardrail short-circuits to "ok" when `invite.sourceId` is null. The organizer chose to invite this person directly; allocation caps don't apply.

#### Organizer override

The send dialog can still issue more invites than the allocation allows (organizers may intentionally over-invite expecting some to decline — Round 1 logic). The guardrail only fires on **claim**, not on **issue**. A surfaced "would exceed allocation" warning at issue time (see Candidates tab above) lets the organizer make that call deliberately.

## Implementation Phases

1. **Schema + helper.** Add the table, write `resolveSourceAllocations`, unit-test against ADR-0011's existing roster fixtures. No UI changes.
2. **Loader + Sent tab denominator switch.** Add `listInviteSourceAllocationsFn` and `divisionAllocationTotals` to the route loader. Swap the Sent tab's `divisions[].maxSpots` source from `competition_divisions.maxSpots` to the resolved-allocation total. No new UI.
3. **Source details page.** New `sources/$sourceId.tsx` route + loader + form + `saveInviteSourceAllocationsFn`. Wire the "Edit" button to navigate. Add the per-division override table.
4. **Candidates tab cutoff + send-dialog warning.** Use per-division allocations for the roster cutoff lines and surface an over-issue warning in `SendInvitesDialog`.
5. **Claim guardrail.** Add `assertInviteWithinAllocation` + the `over_allocated` reason and route copy. Wire the Stripe workflow's authoritative re-check.
6. **Roster computation.** Update `getChampionshipRoster` to use per-division allocations when emitting cutoff lines (catches the in-loader compute paths the route doesn't directly own).

Phases 1–2 are invisible to the organizer. Phase 3 unlocks the override UI. Phase 4 surfaces the warning organizers need to use the override responsibly. Phase 5 closes the athlete-side loop. Phase 6 is the cleanup pass.
