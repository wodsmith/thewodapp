# Competition Location Feature Documentation

This directory contains the comprehensive documentation for adding location support to competitions in Wodsmith.

## Documents

| Document | Description |
|----------|-------------|
| [PRD.md](./PRD.md) | Product Requirements Document - business requirements, user stories, feature specs |
| [implementation-plan.md](./implementation-plan.md) | Technical implementation plan with code examples |
| [schema-spec.md](./schema-spec.md) | Database schema specification with SQL and Drizzle definitions |
| [task-breakdown.md](./task-breakdown.md) | Granular task breakdown for implementation |

## Quick Summary

### What We're Building

Adding structured location/address support to competitions:

1. **Competition Location** - Full address fields on competitions
2. **Venue Locations** - Optional offsite locations for multi-venue competitions
3. **Smart Location Badge** - City/State or City/Country display on competition rows
4. **Location Display** - Location cards on public competition pages

### Key Changes

| Area | Changes |
|------|---------|
| Database | 8 new columns on `competitions`, 9 new columns on `competition_venues` |
| Organizer UI | New location section on competition edit form |
| Public UI | Updated competition row badge, new location card component |
| Utilities | New `formatLocationBadge()` and related functions |

### Display Logic

```
Online competition       → "Online" (globe icon)
City + State             → "Austin, TX" (map pin)
City + Country           → "London, UK" (map pin)
City only               → "Austin" (map pin)
Location name only      → "CrossFit Central" (map pin)
Fallback                → Organizing team name (map pin)
```

## Getting Started

1. Read the [PRD](./PRD.md) for full context
2. Review the [schema spec](./schema-spec.md) for database changes
3. Follow the [implementation plan](./implementation-plan.md) for code guidance
4. Use the [task breakdown](./task-breakdown.md) for tracking work

## Implementation Order

```
1. Foundation (Schema, Types, Utilities)
2. Server Functions (API updates)
3. Organizer UI (Edit form)
4. Public Display (Row badge, Detail page)
5. Testing & Migration
```

## Related Files

### To Modify

- `apps/wodsmith-start/src/db/schemas/competitions.ts`
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`
- `apps/wodsmith-start/src/components/competition-row.tsx`
- `apps/wodsmith-start/src/components/competition-hero.tsx`

### To Create

- `apps/wodsmith-start/src/types/location.ts`
- `apps/wodsmith-start/src/utils/location.ts`
- `apps/wodsmith-start/src/components/forms/location-fields.tsx`
- `apps/wodsmith-start/src/components/competition-location-card.tsx`
