# Soft Delete Registrations - Implementation Plan

## Summary

Add a `status` column to `competition_registrations` with a `REMOVED` state (alongside future states like `WITHDRAWN`). When an organizer removes a registration, we soft-delete by setting `status = 'REMOVED'` and deactivate associated team memberships, rather than hard-deleting rows. The organizer athletes page will filter out removed registrations by default but could later support filtering by status.

## Data Model Changes

### 1. Add registration status enum and column

**File: `src/db/schemas/competitions.ts`**

Add a `REGISTRATION_STATUS` constant:
```typescript
export const REGISTRATION_STATUS = {
  ACTIVE: "active",
  REMOVED: "removed",
} as const
```

Add a `status` column to `competitionRegistrationsTable`:
```typescript
status: varchar({ length: 20 })
  .$type<RegistrationStatus>()
  .default("active")
  .notNull(),
```

Add an index on `(eventId, status)` for efficient filtering.

### 2. Push schema change locally

Run `pnpm db:push` to apply the schema change to local D1.

## Server-Side Changes

### 3. Create `removeRegistrationFn` server function

**File: `src/server-fns/registration-fns.ts`**

New server function `removeRegistrationFn`:
- **Input**: `{ registrationId: string, competitionId: string }`
- **Auth**: Require `MANAGE_COMPETITIONS` permission on the competition's organizing team
- **Logic**:
  1. Fetch the registration (verify it exists, belongs to competitionId, is currently `active`)
  2. Set `competitionRegistrationsTable.status = 'REMOVED'`
  3. Deactivate the captain's team membership in the competition_event team (`teamMemberId` on the registration → set `isActive = false`)
  4. For team registrations (`athleteTeamId` is not null):
     - Deactivate all team memberships on the athlete team (set `isActive = false`)
     - Mark pending team invitations as expired/cancelled
  5. Delete heat assignments for this registration (`competitionHeatAssignmentsTable` where `registrationId` matches)
  6. Delete scores for team members linked to this competition event (scores where `competitionEventId` matches and `userId` is in the team)
  7. Return success with the updated registration

### 4. Filter removed registrations from organizer queries

**File: `src/server-fns/competition-detail-fns.ts`**

Update `getOrganizerRegistrationsFn` to exclude `REMOVED` registrations by default:
- Add `eq(competitionRegistrationsTable.status, "active")` to the where clause (or `ne(status, "removed")` to be forward-compatible with future statuses)

Update `getCompetitionRegistrationCountsFn` to only count active registrations.

### 5. Filter removed registrations from athlete-facing queries

Review and update these to exclude removed registrations:
- `getUserRegistrationsFn` in `competition-detail-fns.ts`
- `getRegistrationDetailsFn` in `registration-fns.ts`
- Division registration count queries (for capacity checks)
- Registration duplicate checks in `registerForCompetition()` (so a removed user could re-register)

## UI Changes

### 6. Add "Remove Registration" action to organizer athletes table

**File: `src/routes/compete/organizer/$competitionId/athletes.tsx`**

- Add a row action menu (dropdown with `MoreHorizontal` icon) to each registration row
- Include "Remove Registration" option with a confirmation dialog
- On confirm, call `removeRegistrationFn` and invalidate the router to refresh data
- Show a toast on success/failure

## Files to Modify

1. `src/db/schemas/competitions.ts` - Add `REGISTRATION_STATUS` constant and `status` column
2. `src/server-fns/registration-fns.ts` - Add `removeRegistrationFn`
3. `src/server-fns/competition-detail-fns.ts` - Filter removed registrations from organizer/athlete queries
4. `src/server/registration.ts` - Update duplicate checks to exclude removed registrations
5. `src/routes/compete/organizer/$competitionId/athletes.tsx` - Add row actions with remove button
6. `src/server-fns/competition-divisions-fns.ts` - Update registration count queries to exclude removed

## Notes

- **No migration yet** - use `pnpm db:push` for local dev per project conventions
- **D1 has no transactions** - the multi-step removal isn't atomic, but each step is idempotent and safe to retry
- **Score cleanup** - scores are tied to `competitionEventId + userId`, not directly to `registrationId`. We need to identify users from the registration to clean up their scores
- **Future states** - the `REGISTRATION_STATUS` enum is designed to easily add `WITHDRAWN` (athlete-initiated) or other states later
