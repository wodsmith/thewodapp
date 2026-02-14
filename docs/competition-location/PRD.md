# Competition Location Feature PRD

## Overview

Add structured location/address support to competitions in Wodsmith, enabling organizers to specify where their competition takes place and allowing athletes to see location details including city/state or city/country information.

## Problem Statement

Currently, competitions in Wodsmith lack dedicated location fields. The only location information displayed is the organizing team's name, which:

1. Doesn't provide actual address information for athletes to navigate to events
2. Doesn't distinguish between online and in-person events effectively
3. Doesn't allow for multi-venue competitions where different events happen at different locations
4. Provides no geographic context (city, state, country) for browsing competitions

## Goals

1. **Primary:** Add structured location data to competitions that can be displayed and used for navigation
2. **Secondary:** Support optional venue-specific locations for multi-venue competitions
3. **Tertiary:** Improve competition discovery by displaying city/state (or city/country for international events)

## Non-Goals

- Geocoding or map integration (future enhancement)
- Address validation/autocomplete (future enhancement)
- Distance-based search (future enhancement)
- Travel/accommodation recommendations

## User Stories

### Organizer Stories

1. **As a competition organizer**, I want to add my competition's address so athletes know where to go
2. **As a competition organizer**, I want to specify different locations for different venues (e.g., main stage vs offsite location)
3. **As a competition organizer**, I want to edit location details after initial creation
4. **As an online competition organizer**, I want my competition to show as "Online" rather than a physical location

### Athlete Stories

1. **As an athlete**, I want to see where a competition is located before registering
2. **As an athlete**, I want to see the city/state of competitions when browsing so I can find local events
3. **As an athlete**, I want to know if specific events are at different venues
4. **As an athlete**, I want to easily distinguish online competitions from in-person ones

## Feature Requirements

### 1. Competition Location (Primary)

#### 1.1 Database Schema - Normalized Addresses

**Approach:** Create a reusable `addresses` table instead of inline fields.

**New Table: `addresses`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | text | Yes | Primary key (cuid2) |
| `addressType` | text | No | Type: 'competition', 'venue', 'gym', 'team' |
| `name` | text | No | Venue/location name (e.g., "CrossFit Central Arena") |
| `streetLine1` | text | No | Street address |
| `streetLine2` | text | No | Suite, unit, building, etc. |
| `city` | text | No | City name |
| `stateProvince` | text | No | State/Province (normalized to abbreviation, e.g., "TX") |
| `postalCode` | text | No | ZIP/Postal code |
| `countryCode` | text | No | Country (ISO 3166-1 alpha-2, e.g., "US", "GB") |
| `notes` | text | No | Additional directions, parking info, etc. |

**Modified Table: `competitions`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `primaryAddressId` | text | No | FK to addresses.id |

**Benefits:**
- Single `primaryAddressId` FK avoids `is_primary` boolean conflicts
- Reusable for teams, gyms, users in the future
- Clean updates - change address once, reflected everywhere

**Validation Rules:**
- For `competitionType: "in-person"`: City is recommended but not required
- For `competitionType: "online"`: `primaryAddressId` should be null
- All fields optional to support gradual adoption

#### 1.2 Edit Form Updates

Add a "Location" section to the competition edit form (`organizer/$competitionId/edit.tsx`):

- **Conditional Display:** Only show location fields when `competitionType` is "in-person"
- **Field Grouping:**
  - Location Name (single field)
  - Address Block (line1, line2)
  - City/State/Postal Row (3 columns)
  - Country (dropdown or text with normalization)
  - Location Notes (textarea)
- **Collapsible:** Consider making this a collapsible section for cleaner UX

#### 1.3 Public Display

**Competition Row (`competition-row.tsx`):**
- Replace organizing team name with smart location badge:
  - If `city` and `stateProvince`: Show "City, ST" (e.g., "Austin, TX")
  - If `city` and `countryCode` (no state): Show "City, CC" (e.g., "London, GB")
  - If only `city`: Show "City"
  - If `competitionType: "online"`: Show "Online" with globe icon
  - Fallback: Show organizing team name (backwards compatible)

**Competition Hero (`competition-hero.tsx`):**
- Add location section below dates
- Show full location name and address
- Optionally link to maps (future enhancement)

**Competition Details:**
- Add "Location" card/section with:
  - Venue name
  - Full address
  - Location notes/directions
  - Map embed placeholder (future)

### 2. Venue Locations (Secondary)

#### 2.1 Database Schema

Add FK to `competitionVenuesTable`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `addressId` | text | No | FK to addresses.id (null = use competition's primary) |

**Logic:**
- If `addressId` is null: Venue uses competition's `primaryAddress`
- If `addressId` is set: Venue has its own address
- UI should indicate "Main Location" vs "Different Location"
- Default option: "Use main competition location" (explicit choice in UI)

#### 2.2 Venue Edit Form

Update venue management UI to include:
- Radio: "Use main competition location" (default) / "Different location"
- When "Different location" selected: Show location fields
- Clear location fields when switched back to main location

#### 2.3 Schedule Display

When displaying heats/schedule:
- Show venue location if `addressId` is set
- Group events by venue with location context
- Consider adding "Get Directions" link

### 3. Location Badge Logic

The competition row location badge should use this priority:

```
1. Online competition → Show "Online" with globe icon
2. Has city + stateProvince → Show "City, ST"
3. Has city + countryCode (non-US) → Show "City, CC"
4. Has city only → Show "City"
5. Has name only → Show name
6. Fallback → Show organizingTeam.name
```

**Implementation Details:**
- Create a `formatLocationBadge(address, competitionType, teamName)` utility function
- Function should handle all edge cases
- Return both display text and icon type (map-pin vs globe)

## Technical Specification

### Database Migration

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

### Files to Modify

1. **Schema:** `src/db/schemas/addresses.ts` (new file)
2. **Schema:** `src/db/schemas/competitions.ts` (add FK + relation)
3. **Server Functions:** `src/server-fns/competition-fns.ts`
4. **Server Functions:** `src/server-fns/address-fns.ts` (new file)
5. **Edit Form:** `src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`
6. **Competition Row:** `src/components/competition-row.tsx`
7. **Competition Hero:** `src/components/competition-hero.tsx`
8. **Venue Management:** Venue edit components
9. **Utilities:** `src/utils/address.ts` (new file)

### API Changes

Update/create these server functions:
- `getPublicCompetitionsFn` - Include primaryAddress relation
- `getCompetitionBySlugFn` - Include full address details
- `updateCompetitionFn` - Handle address creation/update
- `createAddressFn` - Create new address record
- `updateAddressFn` - Update existing address
- `getCompetitionVenuesFn` - Include venue address data

### Zod Schemas

Add validation schemas:
- `addressSchema` - Address field validation with normalization
- Update `updateCompetitionSchema` to include `primaryAddressId`

## UI/UX Design

### Competition Edit Form - Location Section

```
┌─────────────────────────────────────────────────────────┐
│ Location                                           [▼]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Venue/Location Name                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CrossFit Central Arena                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Street Address                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 123 Main Street                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Address Line 2                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Building C                                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌──────────────────┐ ┌─────────┐ ┌──────────────────┐  │
│ │ City             │ │ State   │ │ Postal Code      │  │
│ │ Austin           │ │ TX      │ │ 78701            │  │
│ └──────────────────┘ └─────────┘ └──────────────────┘  │
│                                                         │
│ Country                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ United States                            [▼]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Additional Directions / Notes                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Free parking available in the lot behind the        │ │
│ │ building. Enter through the side door marked        │ │
│ │ "Competition Entrance"                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Venue Location Selection

```
┌─────────────────────────────────────────────────────────┐
│ Venue Location                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ◉ Use main competition location                         │
│ ○ Different location                                    │
│                                                         │
│ [Location fields shown only when "Different" selected]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Competition Row - Location Badge

**In-Person with Location:**
```
📍 Austin, TX
```

**Online Competition:**
```
🌐 Online
```

**Fallback (no location):**
```
📍 CrossFit Central (organizing team name)
```

### Competition Detail Page - Location Card

```
┌─────────────────────────────────────────────────────────┐
│ 📍 Location                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ CrossFit Central Arena                                  │
│ 123 Main Street, Building C                             │
│ Austin, TX 78701                                        │
│ United States                                           │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 📋 Free parking available in the lot behind the        │
│    building. Enter through the side door marked         │
│    "Competition Entrance"                               │
│                                                         │
│ [Get Directions ↗]  (future enhancement)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Rollout Plan

### Phase 1: Foundation & Schema
1. Create `addresses` table schema
2. Add FK columns to competitions and venues
3. Create address utility functions
4. Create address server functions

### Phase 2: Organizer UI
1. Update competition edit form with location section
2. Handle address create/update on form submit

### Phase 3: Public Display
1. Update competition row badge display
2. Update competition hero
3. Create location card component
4. Add location card to detail pages

### Phase 4: Venue Locations
1. Update venue management UI with location selection
2. Update schedule display with venue locations

### Phase 5: Enhancements (Future)
1. Add Google Maps integration for address autocomplete
2. Add map embed on detail pages
3. Add distance-based competition search
4. Add "Get Directions" functionality

## Success Metrics

1. **Adoption:** % of in-person competitions with location data filled in
2. **Completeness:** % of competitions with city data (for badge display)
3. **User Feedback:** Qualitative feedback from organizers on ease of use

## Open Questions

1. ~~Should we pre-populate location from organizing team's location (if exists)?~~ Future enhancement
2. ~~Do we want to support multiple countries dropdown with ISO codes?~~ Yes, normalize to ISO 3166-1 alpha-2
3. ~~Should address validation be a future requirement?~~ Yes, future
4. ~~Do we need to handle timezone inference from location?~~ No, timezone is separate field

## Appendix

### Current Competition Schema Fields (Reference)

From `src/db/schemas/competitions.ts`:
- `id`, `name`, `slug`, `description`
- `organizingTeamId`, `competitionTeamId`, `groupId`
- `startDate`, `endDate`, `registrationOpensAt`, `registrationClosesAt`
- `timezone`, `competitionType` (in-person | online)
- `profileImageUrl`, `bannerImageUrl`
- `visibility`, `status`
- `defaultRegistrationFeeCents`, fee settings
- `defaultHeatsPerRotation`, `defaultLaneShiftPattern`
- `defaultMaxSpotsPerDivision`
- `settings` (JSON)

### Current Venue Schema Fields (Reference)

From `src/db/schemas/competitions.ts`:
- `id`, `competitionId`
- `name`, `laneCount`, `transitionMinutes`, `sortOrder`
