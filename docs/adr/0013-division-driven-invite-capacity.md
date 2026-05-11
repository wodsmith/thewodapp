---
status: proposed
date: 2026-05-01
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0013: Division-Driven Capacity for Invite Sent Tab (Revert ADR-0012 Denominator Switch)

## Context and Problem Statement

[ADR-0012](./0012-per-division-qualifier-allocation.md) shipped a per-(source, championship-division) allocation table and switched the Sent tab's per-division headline denominator to the *sum of per-source allocations* for that division. Today on `comp_if3ptzzxa8jpjrdf6g0rgzhr` the divisions page shows a default of 1 spot per division with no per-division overrides — but the Sent tab shows "0/3 spots filled" because three sources each contribute their default `globalSpots: 1`, summing to 3. The organizer reads "this championship has 3 spots in this division" and is then surprised when the 2nd registration via the only enforced gate — `competition_divisions.maxSpots` / `competitions.defaultMaxSpotsPerDivision` — gets bounced.

There is exactly one place in the codebase that *enforces* a division's capacity: [`calculateDivisionCapacity`](./../../apps/wodsmith-start/src/utils/division-capacity.ts) — at registration time and again at payment completion. That gate keys off `divisionMaxSpots` (per-division override) with a fallback to the competition's `defaultMaxSpotsPerDivision`. The Sent tab denominator has no relationship to this gate today and can disagree with it freely. The number an organizer sees on the divisions page (the cap that will actually bounce a registration) is *not* the number they see on the Sent tab (a derived sum of upstream-source intent). When those numbers diverge silently, the organizer plans against fiction.

The user's framing: the championship competition's divisions are the source of truth for "how many people fit in this division." Source allocations describe an organizer's *intent* — "I expect Throwdown A to feed 3 athletes into Rx" — but they don't *create* spots; the championship division either has room or it doesn't. If the source-allocation totals don't match the division cap, that's an organizer-actionable warning, not a recomputation of capacity.

How should the Sent tab express division capacity so it (a) matches the gate that actually enforces registration limits and (b) surfaces — rather than silently absorbs — a mismatch with the organizer's source-allocation plan?

## Decision Drivers

- The Sent tab denominator must agree with the only enforced capacity gate, so the organizer's mental model and the system's behavior never diverge.
- The capacity number must be **edited in one place** — the divisions page already owns this.
- Per-source allocations remain valuable as **planning intent** (per ADR-0012) — the chip-level `accepted/allocated` breakdown stays. Only the division *headline* denominator changes.
- A mismatch between the sum of source allocations and the division cap is a **real organizer-facing concern** ("I planned for 3 from this source but the division only seats 1"), and the Sent tab is the natural place to surface it.
- The fix must preserve ADR-0012's claim-time guardrail (per-(source, division) allocation cap) — that guardrail and this denominator are independent: one bounds source contribution, the other bounds total division attendance.
- Loader change must be **minimal and reversible** — no schema migration, no new server fn.

## Considered Options

### A. Keep ADR-0012's denominator (sum of per-source allocations)

Status quo. Sent tab headline reads `divisionAllocationTotals[divisionId]`.

**Pros:** Already shipped. Tests pass.
**Cons:** Disagrees with the enforced gate by construction. Defaults silently inflate the visible cap (1 + 1 + 1 = 3 in the bug report). Organizer has no way to align the numbers without either editing every source's `globalSpots` to 0 (counterintuitive — the source still produces qualifiers) or adding per-division override rows for every source × division pair. **Rejected** — this ADR is the rejection.

### B. Sent tab headline reads `competition_divisions.maxSpots ?? competitions.defaultMaxSpotsPerDivision`

The denominator becomes the same value `calculateDivisionCapacity` reads. Per-source allocation chips stay (they remain useful as intent). When the **sum of per-source allocations** differs from the division cap, render an inline warning callout on the division card with a link to the divisions page.

**Pros:** Sent tab agrees with the enforced gate. One edit point for capacity (divisions page). Mismatches between intent (source allocations) and capacity (division cap) become visible instead of hidden. No schema migration. No new server fn — the loader already fetches both numbers.
**Cons:** Source allocations no longer "create" the visible cap, which means an organizer who relied on `globalSpots` defaults to set the cap implicitly will need to edit the divisions page once. That edit is one number per division, on a page they already use.

### C. Combine both — show the division cap *and* the allocation sum side-by-side

Render `accepted/divisionMaxSpots (allocated: N)`.

**Pros:** Most information. No data loss.
**Cons:** Three numbers in one headline is busy. The headline already competes with the per-source breakdown chips for attention. The mismatch case (B's warning) is the *only* time both numbers matter; in the typical case showing both is noise. **Rejected** in favor of B's "show one number, surface a warning when the other disagrees."

### D. Make `globalSpots` not contribute to a default per-division allocation

Force organizers to set per-division overrides for every (source, division) pair to get a non-zero allocation. Stops the "1 + 1 + 1 = 3" inflation at the source.

**Pros:** Removes the surprise.
**Cons:** Solves a symptom, not the cause. The Sent tab denominator would still be the sum of allocations — just with more zeros — and would still drift from the enforced cap whenever an organizer *did* set overrides. Doesn't address the underlying single-source-of-truth issue. **Rejected**.

## Decision Outcome

Chosen option: **B. Sent tab headline reads the championship division's cap (override → competition default → null), with an inline warning when the sum of per-source allocations disagrees.**

Specifically:

1. The Sent tab's `divisions[].maxSpots` prop is sourced from `competitionDivisions[].maxSpots ?? defaultMaxSpotsPerDivision ?? null`. This is exactly what `calculateDivisionCapacity` reads at registration time, so the two numbers are *the same value by construction*.
2. The per-source allocation chip (`accepted/allocated`) survives unchanged — ADR-0012's per-(source, division) attribution is a useful planning surface.
3. A new prop `allocationTotal` on each division (the sum of resolved per-source allocations for that championship division — what ADR-0012's loader already computes) drives an inline warning on the division card when `allocationTotal !== division.maxSpots`. The warning is a `<Link>` to the divisions page.
4. The claim-time allocation guardrail from ADR-0012 (per-source-per-division cap) is unaffected. It's a different gate — "this source has filled its slice of this division" — and it composes with the existing division-capacity gate ("this division has filled, regardless of source").

The divisions page is the single edit point for capacity. The Sent tab becomes a read-only reflection of the same number, with a warning when the organizer's allocation plan would exceed (or undershoot) what the division can hold.

### Consequences

- **Good**, because the only number that matters for "will the next registration go through" is the only number the organizer sees on the Sent tab headline. Bug report (`0/3 spots filled` when the cap is 1) goes away.
- **Good**, because mismatches between source-allocation intent and division capacity become organizer-visible. Today they're swallowed.
- **Good**, because the divisions page is the canonical edit surface — no new "where do I change this number?" surface for invite capacity.
- **Good**, because the change is loader-local plus a single prop on the Sent tab component. No schema migration. No server-fn changes.
- **Bad**, because organizers who relied on `globalSpots` defaults to *implicitly* set the visible cap (e.g. set `globalSpots: 5` knowing the Sent tab would read "5 spots") will need to edit the divisions page once to set the cap explicitly. Mitigated by the warning callout, which makes the new edit location obvious the first time the page is loaded after deploy.
- **Neutral**, because the per-source allocation table (ADR-0012's database addition) keeps its semantics: it constrains how many invites *each source* contributes to a division, just not the division's total cap.

### Non-Goals

- **Removing the per-(source, division) allocation table.** ADR-0012's table stays — it backs the chip-level `accepted/allocated` breakdown and the claim-time per-source guardrail.
- **Auto-syncing source-allocation totals when division caps change.** When the organizer raises the division cap from 2 to 5, the source allocations don't automatically rebalance. The warning fires until the organizer either edits the source allocations to match or accepts the mismatch.
- **Two-way sync.** Editing source allocations does not propagate to the division cap. The divisions page is the one-way authoritative edit point.
- **Warning at issue time.** The "would exceed allocation" warning in the send dialog (ADR-0012 Phase 4) operates on per-source allocations and is unaffected. This ADR's warning is on the Sent tab read surface only.

## Detailed Design

### Loader Change — `routes/compete/organizer/$competitionId/invites/index.tsx`

Today (ADR-0012 Phase 2):

```ts
const championshipDivisions = (divisionsResult.divisions ?? []).map((d) => {
  const total = divisionAllocationTotals[d.id] ?? 0
  return { id: d.id, label: d.label, maxSpots: total > 0 ? total : null }
})
```

After:

```ts
const defaultMax = divisionsResult.defaultMaxSpotsPerDivision ?? null
const championshipDivisions = (divisionsResult.divisions ?? []).map((d) => {
  const cap = d.maxSpots ?? defaultMax
  const allocationTotal = divisionAllocationTotals[d.id] ?? 0
  return {
    id: d.id,
    label: d.label,
    maxSpots: cap,
    allocationTotal,
  }
})
```

`divisionAllocationTotals` (computed by `listInviteSourceAllocationsFn`) is now used **only** to drive the mismatch warning. The headline denominator is the championship's enforced cap.

### Component Change — `SentInvitesByDivision`

Two surface changes:

1. The `divisions` prop adds an optional `allocationTotal: number` field. Existing callers that omit it default to `0` (no warning). The headline uses `division.maxSpots` (renamed nothing — the prop name still describes "the division's spots cap," which is now correct).
2. When `allocationTotal !== division.maxSpots && (allocationTotal > 0 || division.maxSpots !== null)`, render an inline warning under the spots-filled line:

   > ⚠ Source allocations sum to {allocationTotal}, but this division allows {division.maxSpots ?? "no cap"}. <Link to="/compete/organizer/$competitionId/divisions">Update division capacity →</Link>

   The warning suppresses when both numbers are 0/null (no cap set, no allocations — the "X accepted" fallback case). The warning is a single line, low-saturation amber, screen-reader announced via `role="status"` so the organizer's keyboard tab order is preserved.

The `null` case for `maxSpots` retains today's "X accepted" rendering (no denominator) — that's the "no cap configured" signal.

### Mismatch Semantics

- `allocationTotal > division.maxSpots` — the organizer's source plan would over-issue. Warning copy: "would exceed division capacity."
- `allocationTotal < division.maxSpots` — the source plan undershoots the cap. Warning copy: "fewer than division capacity allows."
- `allocationTotal === division.maxSpots` — silent (no warning).
- `division.maxSpots === null && allocationTotal > 0` — no division cap is set but sources are allocating. Warning copy: "no division cap set; source allocations cannot enforce a limit." Link still points to the divisions page.
- Both 0/null — silent ("X accepted" rendering).

### Enforcement Surfaces (unchanged by this ADR)

- **Registration time**: `calculateDivisionCapacity` reads `divisionMaxSpots ?? competitionDefaultMax`. Unchanged.
- **Payment completion**: re-checks the same calculation under transaction. Unchanged.
- **Claim time per-(source, division) allocation guardrail** (ADR-0012): `assertInviteWithinAllocation` reads the per-source allocation row and compares against accepted invites for that (source, division). Unchanged. Composes with division capacity — both must pass.

### Documentation Updates

- `lat.md/competition-invites.md` "Sent invites tab" section: replace the ADR-0012 Phase 2 paragraph (denominator from `divisionAllocationTotals`) with the ADR-0013 paragraph (denominator from division cap, with mismatch warning). Add `allocationTotal` to the `SentInvitesByDivisionProps` description.
- `lat.md/registration.md` "Capacity Management" section: add a one-sentence note that the invite Sent tab now reads the same `divisionMaxSpots ?? competitionDefaultMax` value, so organizers see one number across registration and invites.

### Backwards Compatibility

The component prop change is additive (`allocationTotal` is optional, defaults to `0`). Older test fixtures that pre-date ADR-0012 (no `allocationTotal`, just `maxSpots`) continue to render the headline correctly with no warning. The route loader is the only place that supplies the new prop.

The user-visible change: a championship that previously showed `0/3 spots filled` (sum of three `globalSpots: 1` defaults) now shows `0/1 spots filled` (the actual division cap) plus a warning that the source allocations sum to 3 — an immediate, actionable signal that something needs attention.

## Implementation Phases

1. **Loader switch + prop addition.** One file (`routes/compete/organizer/$competitionId/invites/index.tsx`), one component (`sent-invites-by-division.tsx`). The Sent tab headline reads the division cap; the warning renders when allocations don't match.
2. **Documentation.** Update `lat.md/competition-invites.md` "Sent invites tab" section. Add a breadcrumb in `lat.md/registration.md` "Capacity Management".
3. **Tests.** Update `test/components/sent-invites-by-division.test.tsx` to feed division caps via `maxSpots` and exercise the warning paths (no warning when matched, over warning, under warning, no-cap warning). Confirm the existing per-source chip behavior is unchanged.

No schema migration. No new server fn. No claim-time logic change.
