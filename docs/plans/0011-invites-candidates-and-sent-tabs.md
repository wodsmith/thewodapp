---
title: "Invites: rename Roster → Candidates + add Sent audit tab"
status: proposed
related-adr: docs/adr/0011-competition-invites.md
related-plan: docs/plans/0011-competition-invites-execution.md
beads: broadcast-6ss
---

# Invites: rename Roster → Candidates + add Sent audit tab

Small UX evolution on the organizer Invites page that ships in a single PR
behind the existing `competition-invites` PostHog flag. No schema changes.

## Why

The current "Roster" tab on `/compete/organizer/$competitionId/invites`
mis-names what the organizer is doing. The tab is a **candidate-picking
surface**: athletes pulled from qualification-source leaderboards plus a
bespoke draft list, with multi-select that drives the "Send invites (N)"
dialog. "Roster" implies a fixed registered list, which is wrong both for
this product (these athletes have not registered yet) and for the
function (the page is upstream of registration, not downstream of it).

There is also no surface that answers the organizer's natural follow-up
question after a send round: **"who has actually been invited, and where
are we with each one?"** Today the only invite-state hints are inline
"already invited" badges on candidate rows and a status pill on bespoke
drafts. There is nothing grouped by division, nothing that surfaces
declined/expired/revoked rows, and no way to copy a still-live claim
link for an existing pending invite from a single audit view.

This plan addresses both gaps with the smallest diff that ships value.

## Scope

In:

- Rename the `Roster` tab to **`Candidates`** in the organizer route shell.
- Add a new **`Sent`** tab grouping every issued invite by championship
  division, with status counts and per-row read-only actions (copy live
  claim link).
- Update `lat.md/competition-invites.md` and the existing execution plan
  doc to reflect both changes.

Out:

- Schema changes. The new tab reads existing `competition_invites` rows.
- New mutations. Revoke / reissue / resend stay where ADR-0011 placed
  them (round builder, Phase 3 / sub-arc D).
- Round-aware grouping. Rounds are still phase 3.
- Per-division capacity math. Same.
- Server-side pagination. Volume per championship is small enough to
  ship the same hydrate-then-filter pattern the Candidates tab uses.

## Naming

Recommended:

| Before  | After        | Pairs with     |
| ------- | ------------ | -------------- |
| Roster  | **Candidates** | Sources        |
| —       | **Sent**       | (new)          |

`Candidates` reads cleanly against `Sources` ("Sources define where
candidates come from"). `Sent` is the tightest description of the audit
tab and is unambiguous against `Candidates`. Alternatives considered:
`Pool` / `Eligible` / `Pick Athletes` for the rename; `Status` /
`Invitations` / `Tracking` for the new tab. Final names land with the
PR review on this plan.

The internal helpers (`getChampionshipRoster`, `RosterRow`, the
`championship-roster-table.tsx` component) keep their names — they
describe a server-side join across source-competition leaderboards, and
that meaning is correct. Only user-facing tab labels change.

## Final tab order

```
Candidates | Sources | Sent | Round History (disabled) | Email Templates (disabled) | Series Global (disabled)
```

`Sent` slots in after `Sources` because the natural left-to-right flow
mirrors the workflow: define sources, pick candidates, audit what's been
sent.

## Implementation sketch

### 1. Rename Roster → Candidates (UI only)

Files:

- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/index.tsx`
  - Local tab state default: `useState("roster")` → `useState("candidates")`.
  - `<TabsTrigger value="roster">Roster</TabsTrigger>` →
    `<TabsTrigger value="candidates">Candidates</TabsTrigger>`.
  - `<TabsContent value="roster">` → `<TabsContent value="candidates">`.
  - Empty-state copy in the Candidates tab: leave existing wording — it
    already references the **Sources** tab by name and is still correct.
- `lat.md/competition-invites.md`
  - Update `## Organizer route shell` to list `Candidates` instead of
    `Roster` and reference the new `Sent` tab.

No component renames, no server-fn renames, no test renames.

### 2. Add Sent tab

#### Server function

Add `listAllInvitesFn` next to `listActiveInvitesFn` in
`apps/wodsmith-start/src/server-fns/competition-invite-fns.ts`. It is
identical to `listActiveInvitesFn` except it drops the
`activeMarker = "active"` filter so terminal rows (`declined`,
`expired`, `revoked`) are returned alongside `pending` and
`accepted_paid`. Reasoning for a new fn rather than widening the
existing one:

- The bespoke section in the Candidates tab depends on
  `listActiveInvitesFn` returning **only** active rows so terminal
  history doesn't pollute the staged-drafts list.
- A widened `listActiveInvitesFn` would force every caller to filter
  client-side, which is exactly the foot-gun the active-marker
  pattern was designed to avoid.

The DTO (`ActiveInviteSummary`) is reusable as-is. We extend it with
two columns the audit view needs:

- `lastSentAt: Date | null` — for sort + "sent N days ago".
- `divisionLabel: string` — eliminates a per-row lookup in the
  component. Sourced via the same `championshipDivisions` map the
  loader already pulls.

Both can be added to the new fn's projection without touching the
existing one.

#### Loader

Extend the route loader's `Promise.all` to call `listAllInvitesFn`. Pass
the result through to the page as `allInvites`. No other loader work.

#### Component

New component:
`apps/wodsmith-start/src/components/organizer/invites/sent-invites-by-division.tsx`.

Behaviour:

- Groups `allInvites` by `championshipDivisionId`. Renders one card per
  division using the `championshipDivisions` ordering.
- Card header shows the division label and a horizontal counter row:
  `Pending · Accepted · Declined · Expired · Revoked`. Each counter is
  a clickable filter chip; "All" resets.
- Card body is a table with columns: Athlete, Origin
  (`source` / `bespoke`), Source attribution (placement label for
  source-origin rows, bespoke reason for bespoke rows), Status badge,
  Sent (relative time), Actions (copy live claim link if `claimUrl !==
  null`; otherwise no-op).
- Empty-state per division when there are no invites for it.
- Page-level filter row above the cards: status chips, origin chips,
  free-text search by name/email. Filters reduce row count inside each
  division card; division cards stay rendered with empty-states so the
  organizer always sees the full division layout.

Status badge styles re-use the same colour mapping the Candidates tab
already uses for the bespoke section (lines 814–826 of
`invites/index.tsx` today) — extracted into a shared helper to avoid
drift between the two surfaces.

#### Page wiring

- `<TabsTrigger value="sent">Sent</TabsTrigger>` placed after the
  `sources` trigger, before the disabled placeholders.
- `<TabsContent value="sent">` renders the new component.

### 3. Doc + lat.md updates

- `lat.md/competition-invites.md` — new section
  `## Sent invites tab` after `## Organizer route shell`, plus the
  rename mentioned in step 1.
- `docs/plans/0011-competition-invites-execution.md` — append a short
  sub-section under Phase 2D / 2.16 noting the rename and the Sent tab,
  pointing back to this plan.
- `docs/adr/0011-competition-invites.md` — no change required. The ADR
  uses "Roster" to describe the **server-side computation**, which we
  are not renaming.

### 4. Tests

- Component test for the new `sent-invites-by-division.tsx`:
  - Renders a card per division.
  - Filter chip narrows visible rows without removing division cards.
  - Empty division shows empty-state copy.
  - Copy-link button is hidden for terminal rows (`claimUrl === null`).
- Smoke route test exercising the new tab is **not** added in this PR —
  the route loader changes are mechanical (one extra `Promise.all`
  entry) and the component test covers the surface.

## Sequence of commits in the implementation PR

The implementation lands in a follow-up PR after this plan PR is
approved. Anticipated commit shape:

1. `refactor(invites): rename Roster tab → Candidates (UI only)`
2. `feat(invites): add listAllInvitesFn server fn`
3. `feat(invites): add sent-invites-by-division component`
4. `feat(invites): wire Sent tab into organizer invites page`
5. `docs(invites): update lat.md + execution plan`

## Open questions

- Confirm tab names: `Candidates` and `Sent`, or pick alternatives.
- Do we want a `Resend` action on terminal `expired` rows in v1, or
  defer to the round builder? Recommendation: defer. Keeps the diff
  small and avoids re-implementing logic that round-aware sending
  (Phase 3) will replace.
- Do we want the "Sent" tab to land before or after the route loader
  starts deduping invite fetches? Today the loader does a separate
  `listActiveInvitesFn` call; this plan adds a second
  `listAllInvitesFn` call. A future cleanup could collapse to one fn,
  but doing that now would conflict with the active-marker rationale
  above.

## Rollout

- Behind the existing `competition-invites` PostHog flag (route is
  already gated).
- Single PR for the implementation work. No DB migration. No
  feature-flag changes.
