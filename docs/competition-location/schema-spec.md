# Competition Location Schema Specification

This document details the database schema changes required for the competition location feature.

## Overview

**Approach: Normalized Addresses Table**

Instead of inline location fields on competitions/venues, we create a reusable `addresses` table:

1. `addresses` - New table for all address data (reusable for teams, users, gyms later)
2. `competitions` - Add `primaryAddressId` FK
3. `competition_venues` - Add `addressId` FK (nullable, falls back to competition's primary)

## New Table: `addresses`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT | No | cuid2 | Primary key |
| `address_type` | TEXT | Yes | NULL | Type: 'competition', 'venue', 'gym', 'team' |
| `name` | TEXT | Yes | NULL | Location/venue name (e.g., "CrossFit Central Arena") |
| `street_line_1` | TEXT | Yes | NULL | Primary street address |
| `street_line_2` | TEXT | Yes | NULL | Apt, Suite, Unit, Building |
| `city` | TEXT | Yes | NULL | City name |
| `state_province` | TEXT | Yes | NULL | State/province abbreviation (normalized, e.g., "TX") |
| `postal_code` | TEXT | Yes | NULL | ZIP or postal code |
| `country_code` | TEXT | Yes | NULL | ISO 3166-1 alpha-2 (e.g., "US", "GB") |
| `notes` | TEXT | Yes | NULL | Additional directions, parking info |
| `created_at` | INTEGER | No | now | Unix timestamp |
| `updated_at` | INTEGER | No | now | Unix timestamp |

### Drizzle Schema Definition

```typescript
// In src/db/schemas/addresses.ts (new file)

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

export const addressesTable = sqliteTable('addresses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  addressType: text('address_type'), // 'competition', 'venue', 'gym', 'team'
  name: text('name'), // Venue/location name

  streetLine1: text('street_line_1'),
  streetLine2: text('street_line_2'),
  city: text('city'),
  stateProvince: text('state_province'), // Normalized abbreviation
  postalCode: text('postal_code'),
  countryCode: text('country_code'), // ISO 3166-1 alpha-2
  notes: text('notes'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

## Modified Table: `competitions`

Add single FK column:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `primary_address_id` | TEXT | Yes | NULL | FK to addresses.id |

### Drizzle Schema Changes

```typescript
// In src/db/schemas/competitions.ts - Add to competitionsTable

primaryAddressId: text('primary_address_id').references(() => addressesTable.id),
```

### Relations

```typescript
// Add to competition relations
export const competitionsRelations = relations(competitionsTable, ({ one, many }) => ({
  // ... existing relations
  primaryAddress: one(addressesTable, {
    fields: [competitionsTable.primaryAddressId],
    references: [addressesTable.id],
  }),
}));
```

## Modified Table: `competition_venues`

Add single FK column:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `address_id` | TEXT | Yes | NULL | FK to addresses.id (null = use competition's primary) |

### Drizzle Schema Changes

```typescript
// In src/db/schemas/competitions.ts - Add to competitionVenuesTable

addressId: text('address_id').references(() => addressesTable.id),
```

### Relations

```typescript
// Add to venue relations
export const competitionVenuesRelations = relations(competitionVenuesTable, ({ one }) => ({
  // ... existing relations
  address: one(addressesTable, {
    fields: [competitionVenuesTable.addressId],
    references: [addressesTable.id],
  }),
}));
```

## SQL Migration

```sql
-- Create addresses table
CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  address_type TEXT,
  name TEXT,
  street_line_1 TEXT,
  street_line_2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country_code TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add FK to competitions
ALTER TABLE competitions ADD COLUMN primary_address_id TEXT REFERENCES addresses(id);

-- Add FK to competition_venues
ALTER TABLE competition_venues ADD COLUMN address_id TEXT REFERENCES addresses(id);
```

## Data Model Relationships

```
┌─────────────────────────────────────────────┐
│             competitions                     │
├─────────────────────────────────────────────┤
│ id                                          │
│ name, slug, description                     │
│ competition_type ('in-person' | 'online')   │
│ ...                                         │
│                                             │
│ primary_address_id ─────────────────────┐   │
└─────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              addresses                       │
├─────────────────────────────────────────────┤
│ id (PK)                                     │
│ address_type                                │
│ name                                        │
│ street_line_1, street_line_2                │
│ city, state_province, postal_code           │
│ country_code                                │
│ notes                                       │
│ created_at, updated_at                      │
└─────────────────────────────────────────────┘
                    ▲
                    │
                    └─────────────────────┐
                                          │
┌─────────────────────────────────────────────┐
│         competition_venues                   │
├─────────────────────────────────────────────┤
│ id                                          │
│ competition_id                              │
│ name                                        │
│ lane_count, transition_minutes              │
│ sort_order                                  │
│                                             │
│ address_id ─────────────────────────────────┘
│ (nullable - if null, uses competition's     │
│  primary_address_id)                        │
└─────────────────────────────────────────────┘
```

## Location Logic

### Competition Location Display Priority

```
1. competitionType === 'online'
   → Display "Online" with globe icon

2. primaryAddress exists with city + state
   → Display "{city}, {state}"
   → Example: "Austin, TX"

3. primaryAddress exists with city + country
   → Display "{city}, {countryCode}"
   → Example: "London, GB"

4. primaryAddress exists with city only
   → Display "{city}"

5. primaryAddress exists with name only
   → Display "{name}"

6. organizingTeam.name exists
   → Display "{organizingTeam.name}"

7. No location data
   → Display "Location TBA"
```

### Venue Location Logic

```
IF venue.addressId IS NULL:
  → Venue uses competition.primaryAddress
  → Display venue name only (e.g., "Main Floor")

IF venue.addressId IS NOT NULL:
  → Venue has its own address
  → Display venue name with location (e.g., "YMCA Pool @ 456 Oak St")
```

## Field Constraints & Validation

### Character Limits

| Field | Max Length | Rationale |
|-------|------------|-----------|
| `name` | 200 | Generous for venue names with subtitles |
| `street_line_1` | 200 | Standard address length |
| `street_line_2` | 200 | Suite/building info |
| `city` | 100 | Longest city names worldwide |
| `state_province` | 10 | Abbreviations only |
| `postal_code` | 20 | International postal codes vary |
| `country_code` | 2 | ISO 3166-1 alpha-2 |
| `notes` | 1000 | Detailed directions/parking info |

### Zod Validation Schema

```typescript
import { z } from 'zod';

export const addressSchema = z.object({
  addressType: z.enum(['competition', 'venue', 'gym', 'team']).nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  streetLine1: z.string().max(200).nullable().optional(),
  streetLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  stateProvince: z.string().max(10).nullable().optional(), // Normalized abbreviation
  postalCode: z.string().max(20).nullable().optional(),
  countryCode: z.string().max(2).nullable().optional(), // ISO 3166-1 alpha-2
  notes: z.string().max(1000).nullable().optional(),
});

export type Address = z.infer<typeof addressSchema>;
```

## Benefits of Normalized Approach

1. **No `is_primary` conflicts** - Single `primaryAddressId` FK on competition
2. **Reusable** - Same table can store team addresses, gym locations, user addresses
3. **Clean updates** - Update address once, reflected everywhere it's referenced
4. **Simpler venue logic** - `addressId` null = use primary, non-null = custom location
5. **Future-proof** - Easy to add address search, geocoding, etc.

## Migration Commands

```bash
# During development (direct schema push)
cd apps/wodsmith-start
pnpm db:push

# Before merging to main (generate migration file)
pnpm db:generate --name=add-addresses-table
```

## Backwards Compatibility

- Online competitions: `primaryAddressId` remains null, display "Online"
- Existing competitions: No address yet, fallback to organizing team name
- Existing venues: `addressId` null, use competition's primary address
- No data migration required for existing records

## Example Data

### Address for Competition

```json
{
  "id": "addr_abc123",
  "addressType": "competition",
  "name": "CrossFit Central Arena",
  "streetLine1": "123 Main Street",
  "streetLine2": "Building C",
  "city": "Austin",
  "stateProvince": "TX",
  "postalCode": "78701",
  "countryCode": "US",
  "notes": "Free parking in lot behind building. Enter through side door marked 'Competition Entrance'."
}
```

### Competition with Address

```json
{
  "id": "comp_123",
  "name": "Summer Showdown 2025",
  "competitionType": "in-person",
  "primaryAddressId": "addr_abc123"
}
```

### Venue with Custom Address

```json
{
  "id": "venue_789",
  "competitionId": "comp_123",
  "name": "Swimming Events",
  "laneCount": 6,
  "addressId": "addr_pool456"
}
```

### Venue Using Competition's Primary Address

```json
{
  "id": "venue_790",
  "competitionId": "comp_123",
  "name": "Main Floor",
  "laneCount": 10,
  "addressId": null
}
```
