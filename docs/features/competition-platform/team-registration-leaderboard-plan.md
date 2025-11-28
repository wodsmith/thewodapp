# Competition Leaderboard Implementation Plan

## Overview
Display competition results with support for both individual and team registrations.

---

## Leaderboard Display

### Query for Leaderboard
**File**: `src/server/competitions.ts`

```typescript
export async function getCompetitionLeaderboard(competitionId: string) {
  const db = getDb()

  const registrations = await db.query.competitionRegistrationsTable.findMany({
    where: eq(competitionRegistrationsTable.eventId, competitionId),
    with: {
      division: true,
      user: {
        columns: {
          firstName: true,
          lastName: true,
        }
      },
      teammates: {
        where: eq(competitionRegistrationTeammatesTable.status, 'accepted'),
        with: {
          user: {
            columns: { firstName: true, lastName: true }
          },
          affiliate: true,
        },
        orderBy: asc(competitionRegistrationTeammatesTable.position),
      }
    },
    orderBy: [
      asc(competitionRegistrationsTable.divisionId),
      asc(competitionRegistrationsTable.teamName),
    ]
  })

  return registrations.map(reg => ({
    id: reg.id,
    teamName: reg.teamName || `${reg.user.firstName} ${reg.user.lastName}`,
    division: reg.division.label,
    teammates: reg.teammates.map(t => ({
      name: `${t.firstName || t.user?.firstName} ${t.lastName || t.user?.lastName}`,
      affiliate: t.affiliate?.name,
    })),
  }))
}
```

**Display Logic**:
- Individual registrations: Show athlete name (from `user`)
- Team registrations: Show `teamName` with accepted teammates listed below
- Only show **accepted** teammates (hide pending)

---

## UI Components

### Leaderboard Component
**File**: `src/components/compete/leaderboard.tsx`

Update to show teams and teammates.

---

## Testing Checklist

### Leaderboard
- [ ] Individual registrations show athlete name
- [ ] Team registrations show team name
- [ ] Only accepted teammates shown
- [ ] Pending teammates hidden from public

---

## Migration Phase

### Phase: Leaderboard
1. Update leaderboard query to join teammates
2. Update leaderboard display component
3. Show team names and accepted teammates
4. Test display logic
