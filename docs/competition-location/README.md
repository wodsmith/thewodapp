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

Adding structured location/address support to competitions using a **normalized `addresses` table**:

1. **Addresses Table** - Reusable table for all location data
2. **Competition Location** - `primaryAddressId` FK on competitions
3. **Venue Locations** - Optional `addressId` FK for multi-venue competitions
4. **Smart Location Badge** - City/State or City/Country display on competition rows
5. **Location Display** - Location cards on public competition pages

### Architecture

```
┌─────────────────────────────┐
│       competitions          │
│  primaryAddressId ──────────┼──┐
└─────────────────────────────┘  │
                                 │
┌─────────────────────────────┐  │
│        addresses            │◀─┘
│  (reusable for teams,       │◀─┐
│   gyms, users later)        │  │
└─────────────────────────────┘  │
                                 │
┌─────────────────────────────┐  │
│    competition_venues       │  │
│  addressId (nullable) ──────┼──┘
│  (null = use primary)       │
└─────────────────────────────┘
```

### Key Changes

| Area | Changes |
|------|---------|
| Database | New `addresses` table, `primaryAddressId` FK on competitions, `addressId` FK on venues |
| Organizer UI | New location section on competition edit form |
| Public UI | Updated competition row badge, new location card component |
| Utilities | `formatLocationBadge()`, normalization functions |

### Display Logic

```
Online competition       → "Online" (globe icon)
City + State             → "Austin, TX" (map pin)
City + Country           → "London, GB" (map pin)
City only               → "Austin" (map pin)
Name only               → "CrossFit Central" (map pin)
Fallback                → Organizing team name (map pin)
```

### Normalization

- **State**: Normalized to abbreviation on save (e.g., "Texas" → "TX")
- **Country**: Stored as ISO 3166-1 alpha-2 code (e.g., "US", "GB")

### Venue Location Logic

- `addressId = null` → Venue uses competition's `primaryAddress`
- `addressId` set → Venue has its own address
- UI shows radio: "Use main competition location" (default) / "Different location"

## Getting Started

1. Read the [PRD](./PRD.md) for full context
2. Review the [schema spec](./schema-spec.md) for database changes
3. Follow the [implementation plan](./implementation-plan.md) for code guidance
4. Use the [task breakdown](./task-breakdown.md) for tracking work

## Implementation Order

```
1. Foundation (Addresses Schema, Types, Utilities)
2. Server Functions (Address CRUD, Competition queries)
3. Organizer UI (Edit form location section)
4. Public Display (Row badge, Hero, Location card)
5. Venue Locations (Radio selection, venue addresses)
6. Testing & Migration
```

## Related Files

### To Create

- `apps/wodsmith-start/src/db/schemas/addresses.ts`
- `apps/wodsmith-start/src/types/address.ts`
- `apps/wodsmith-start/src/utils/address.ts`
- `apps/wodsmith-start/src/schemas/address.ts`
- `apps/wodsmith-start/src/server-fns/address-fns.ts`
- `apps/wodsmith-start/src/components/forms/address-fields.tsx`
- `apps/wodsmith-start/src/components/competition-location-card.tsx`

### To Modify

- `apps/wodsmith-start/src/db/schemas/competitions.ts`
- `apps/wodsmith-start/src/db/schema.ts`
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`
- `apps/wodsmith-start/src/components/competition-row.tsx`
- `apps/wodsmith-start/src/components/competition-hero.tsx`

## Benefits of Normalized Approach

1. **No `is_primary` conflicts** - Single FK on competition, not boolean on addresses
2. **Reusable** - Same table can store team addresses, gym locations, user addresses
3. **Clean updates** - Update address once, reflected everywhere it's referenced
4. **Simpler venue logic** - `addressId` null = use primary, non-null = custom location
5. **Future-proof** - Easy to add address search, geocoding, etc.
