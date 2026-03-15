# Add competition-wide registration caps to competitions
## Status
Proposed
## Context
The competition system already supports division-level capacity:

- `competitions.defaultMaxSpotsPerDivision` provides a default per-division cap
- `competition_divisions.maxSpots` provides a division-specific override
- existing capacity checks count both active registrations and pending Stripe purchases / reservations

That works for controlling division composition, but it does not solve the organizer use case of a single competition-wide ceiling, such as “this competition can host at most 60 total teams regardless of division mix.”

## Decision
Add a new nullable integer column to `competitions`:

- `maxTotalRegistrations`
- default `null`
- `null` means unlimited

This cap is enforced in addition to existing division-level caps.

A registration attempt is valid only when:

1. the selected division is not full
2. the competition-wide total is not full

Competition-wide occupancy counts:

- active competition registrations
- pending Stripe purchases / reservations

This mirrors the current division-capacity behavior.

## Explicit decisions
- Do not store this in `competition.settings`
- Keep the implementation close to `competition-divisions-fns.ts` for now
- The schema column should default to `null` so the migration is straightforward and existing competitions remain unlimited
- Add a “5 spots remaining” callout in the registration UI on the public competition page when the competition-wide remaining count is low

## Why this approach
This is the simplest design that matches existing patterns:

- explicit schema column, not JSON config
- easy SQL querying and enforcement
- easy migration with no backfill burden
- keeps existing division cap behavior intact
- supports both venue-wide and division-specific constraints simultaneously

## Rejected alternatives
### Store total cap in `competition.settings`
Rejected because it makes validation and querying harder and is inconsistent with the existing explicit capacity fields.

### Use only division caps
Rejected because it cannot express the organizer’s actual need: a hard ceiling across all divisions combined.

### Replace division caps with a total cap
Rejected because division caps and total caps solve different problems and should coexist.

## Data model
### Schema change
Update `apps/wodsmith-start/src/db/schemas/competitions.ts` to add:

```typescript
maxTotalRegistrations: int().default(null),
```

Behavior:

- `null` = unlimited
- no backfill needed
- all existing competitions remain unlimited after migration

### Migration
Add nullable `max_total_registrations` to `competitions` with a default of `NULL`.

Migration goals:

- easy rollout
- no data rewrite
- no behavior changes for existing competitions unless organizers opt in

## Capacity semantics
### What counts toward the total cap
The competition-wide cap includes:

- records in `competition_registrations` for the competition
- excluding registrations with `status = REMOVED`
- pending records in `commerce_purchase` for the competition
- purchases with `status = PENDING` and created within the last 35 minutes (stale pending purchases are excluded)

### Capacity rules
If `maxTotalRegistrations` is `null`:

- competition-wide capacity is unlimited

If only the total cap is set:

- total cap is enforced
- divisions can remain unlimited

If only division caps are set:

- current behavior remains unchanged

If both total and division caps are set:

- both must pass
- registration is blocked if either one is full

## Server-side design
### Pure helper
Add competition-wide capacity calculation logic close to the existing capacity utilities.

Suggested shape:

```typescript
export interface CompetitionCapacityInput {
  registrationCount: number | string
  pendingCount: number | string
  maxTotalRegistrations: number | null | undefined
}

export interface CompetitionCapacityResult {
  effectiveMax: number | null
  totalOccupied: number
  spotsAvailable: number | null
  isFull: boolean
}

export function calculateCompetitionCapacity(
  input: CompetitionCapacityInput,
): CompetitionCapacityResult
```

Behavior:

- coerce SQL counts with `Number(...)`
- `effectiveMax = input.maxTotalRegistrations ?? null`
- `totalOccupied = registrationCount + pendingCount`
- `spotsAvailable = effectiveMax !== null ? effectiveMax - totalOccupied : null`
- `isFull = effectiveMax !== null && totalOccupied >= effectiveMax`

### Server function placement
Keep the competition-wide cap lookup close to the current capacity logic in `apps/wodsmith-start/src/server-fns/competition-divisions-fns.ts`.

Add a helper/server function that returns:

```typescript
{
  maxTotalRegistrations: number | null
  registered: number
  confirmedCount: number
  pendingCount: number
  available: number | null
  isFull: boolean
}
```

## Registration enforcement
### Payment initiation
Update `apps/wodsmith-start/src/server-fns/registration-fns.ts` in `initiateRegistrationPaymentFn`:

- after duplicate-registration checks
- before purchase creation / free registration creation

Add a competition-wide capacity check.

If full, throw a competition-level error such as:

- `This competition is full. Registration is no longer available.`

Division-level checks continue as they do now.

### Paid registrations
For paid registration flows:

- pending purchases count toward the total cap
- re-check total capacity during registration finalization, in the same places division capacity is currently re-checked
- exclude the current pending purchase from the re-check when appropriate, just like the division-cap self-exclusion flow

If the competition fills during checkout:

- fail finalization cleanly
- mark the purchase appropriately using the existing capacity-failure pattern
- surface a competition-level “competition filled during checkout” error path

### Free registrations
Keep the same race-condition posture as the current division-capacity logic:

- pre-check before creation
- do not introduce a new atomic reservation system in v1

## Organizer UI
### Settings form
Update the existing capacity settings UI in:

- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/settings.tsx`
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/capacity-settings-form.tsx`

Add a field:

- `Total competition cap`

Help text:

- `Maximum total registrations across all divisions. Leave blank for unlimited.`

Behavior:

- blank input saves `null`
- numeric input saves the cap
- no change to the current division default capacity controls

## Athlete-facing UI
### Public competition page / registration UI
On the competition registration UI, add a low-capacity callout when the competition-wide capacity is almost full.

Requirement:

- show a “5 spots remaining” style callout when competition-wide remaining spots are low

Recommended behavior:

- if `available` is `null`, show nothing
- if `available > 5`, show nothing extra
- if `1 <= available <= 5`, show a prominent callout like `5 spots remaining`, `3 spots remaining`, or `1 spot remaining`
- if `available === 0`, show sold-out/full messaging and block registration

This should appear in the registration UI on the public competition page, alongside existing division selection and availability context.

Likely file:

- `apps/wodsmith-start/src/routes/compete/$slug/register.tsx`

Depending on component structure, the rendering may live in a child registration form component that already consumes `publicDivisions`.

## Public data shape
To support the callout, include competition-wide capacity in the public registration loader data.

Suggested additions to the registration route data:

- `competitionCapacity.available`
- `competitionCapacity.isFull`
- `competitionCapacity.maxTotalRegistrations`

This can be fetched through the new helper in `competition-divisions-fns.ts`.

## Implementation plan
- **Affected paths**: `apps/wodsmith-start/src/db/schemas/competitions.ts`, `apps/wodsmith-start/src/server-fns/competition-divisions-fns.ts`, `apps/wodsmith-start/src/server-fns/registration-fns.ts`, `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/settings.tsx`, `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/capacity-settings-form.tsx`, `apps/wodsmith-start/src/routes/compete/$slug/register.tsx`
- **Schema work**: add `maxTotalRegistrations` with default `null`, then generate and apply the migration
- **Capacity logic**: add pure competition-capacity calculation with numeric coercion safeguards close to existing division-capacity utilities
- **Server queries**: add a competition-wide capacity lookup in `competition-divisions-fns.ts` that counts active registrations plus pending purchases
- **Organizer UI**: extend the existing capacity settings form to edit the total competition cap
- **Public UI**: load competition-wide capacity into the public registration route and render the low-remaining callout when `available <= 5`
- **Enforcement**: check the total cap during registration initiation and re-check it during paid registration completion
- **Tests**: add tests for capacity calculation, total-cap enforcement, and low-remaining UI behavior if practical

## Verification
- [ ] Existing competitions remain unlimited after migration
- [ ] Blank organizer input persists as `null`
- [ ] Numeric organizer input persists as `maxTotalRegistrations`
- [ ] Total cap blocks registration when confirmed plus pending reaches the limit
- [ ] Pending purchases count toward the total cap
- [ ] Removed registrations do not count toward the total cap
- [ ] Division caps still behave exactly as before
- [ ] Registration is blocked when total cap is full even if a division has room
- [ ] Registration is blocked when a division is full even if total cap has room
- [ ] Public registration UI shows a low-capacity callout when `1-5` spots remain
- [ ] Public registration UI shows full/sold-out behavior when `0` spots remain

## Non-goals
- Waitlist support
- Atomic reservation guarantees beyond current patterns
- Replacing or removing division caps
- Broad redesign of the registration page
