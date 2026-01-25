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

#### 1.1 Database Schema

Add the following fields to the `competitionsTable`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locationName` | text | No | Venue/location name (e.g., "CrossFit Central Arena") |
| `addressLine1` | text | No | Street address |
| `addressLine2` | text | No | Suite, unit, building, etc. |
| `city` | text | No | City name |
| `state` | text | No | State/Province/Region |
| `postalCode` | text | No | ZIP/Postal code |
| `country` | text | No | Country (ISO code or full name) |
| `locationNotes` | text | No | Additional directions, parking info, etc. |

**Validation Rules:**
- For `competitionType: "in-person"`: City is recommended but not required
- For `competitionType: "online"`: Location fields should be empty/ignored
- All fields optional to support gradual adoption

#### 1.2 Edit Form Updates

Add a "Location" section to the competition edit form (`organizer/$competitionId/edit.tsx`):

- **Conditional Display:** Only show location fields when `competitionType` is "in-person"
- **Field Grouping:**
  - Location Name (single field)
  - Address Block (line1, line2)
  - City/State/Postal Row (3 columns)
  - Country
  - Location Notes (textarea)
- **Collapsible:** Consider making this a collapsible section for cleaner UX

#### 1.3 Public Display

**Competition Row (`competition-row.tsx`):**
- Replace organizing team name with smart location badge:
  - If `city` and `state`: Show "City, ST" (e.g., "Austin, TX")
  - If `city` and `country` (no state): Show "City, Country" (e.g., "London, UK")
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

Add optional location fields to `competitionVenuesTable`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locationName` | text | No | Override venue location name |
| `addressLine1` | text | No | Street address (if different from main) |
| `addressLine2` | text | No | Suite/building |
| `city` | text | No | City (if different from main) |
| `state` | text | No | State/Province |
| `postalCode` | text | No | ZIP/Postal |
| `country` | text | No | Country |
| `locationNotes` | text | No | Specific directions to this venue |
| `isOffsite` | boolean | No | Flag indicating this venue is NOT at main location |

**Logic:**
- If `isOffsite` is false or location fields are empty: Venue is at main competition location
- If `isOffsite` is true with location: Display venue-specific location
- UI should indicate "Main Venue" vs "Offsite Location"

#### 2.2 Venue Edit Form

Update venue management UI to include:
- Toggle: "This venue is at a different location"
- When toggled on: Show location fields
- Clear location fields when toggled off

#### 2.3 Schedule Display

When displaying heats/schedule:
- Show venue location if `isOffsite` is true
- Group events by venue with location context
- Consider adding "Get Directions" link

### 3. Location Badge Logic

The competition row location badge should use this priority:

```
1. Online competition → Show "Online" with globe icon
2. Has city + state → Show "City, ST"
3. Has city + country (non-US) → Show "City, Country"
4. Has city only → Show "City"
5. Has locationName only → Show locationName
6. Fallback → Show organizingTeam.name
```

**Implementation Details:**
- Create a `formatLocationBadge(competition)` utility function
- Function should handle all edge cases
- Return both display text and icon type (map-pin vs globe)

## Technical Specification

### Database Migration

```sql
-- Add location fields to competitions
ALTER TABLE competitions ADD COLUMN location_name TEXT;
ALTER TABLE competitions ADD COLUMN address_line_1 TEXT;
ALTER TABLE competitions ADD COLUMN address_line_2 TEXT;
ALTER TABLE competitions ADD COLUMN city TEXT;
ALTER TABLE competitions ADD COLUMN state TEXT;
ALTER TABLE competitions ADD COLUMN postal_code TEXT;
ALTER TABLE competitions ADD COLUMN country TEXT;
ALTER TABLE competitions ADD COLUMN location_notes TEXT;

-- Add location fields to competition_venues
ALTER TABLE competition_venues ADD COLUMN location_name TEXT;
ALTER TABLE competition_venues ADD COLUMN address_line_1 TEXT;
ALTER TABLE competition_venues ADD COLUMN address_line_2 TEXT;
ALTER TABLE competition_venues ADD COLUMN city TEXT;
ALTER TABLE competition_venues ADD COLUMN state TEXT;
ALTER TABLE competition_venues ADD COLUMN postal_code TEXT;
ALTER TABLE competition_venues ADD COLUMN country TEXT;
ALTER TABLE competition_venues ADD COLUMN location_notes TEXT;
ALTER TABLE competition_venues ADD COLUMN is_offsite INTEGER DEFAULT 0;
```

### Files to Modify

1. **Schema:** `src/db/schemas/competitions.ts`
2. **Server Functions:** `src/server-fns/competition-fns.ts`
3. **Edit Form:** `src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`
4. **Competition Row:** `src/components/competition-row.tsx`
5. **Competition Hero:** `src/components/competition-hero.tsx`
6. **Venue Management:** `src/routes/compete/organizer/$competitionId/settings.tsx` (or dedicated venue page)
7. **Public Schedule:** Schedule display components
8. **Utilities:** New `src/utils/location.ts` for formatting

### API Changes

Update these server functions to include location data:
- `getPublicCompetitionsFn` - Include location for list display
- `getCompetitionBySlugFn` - Include full location details
- `updateCompetitionFn` - Handle location field updates
- `getCompetitionVenuesFn` - Include venue location data

### Zod Schemas

Add validation schemas:
- `competitionLocationSchema` - Location field validation
- `venueLocationSchema` - Venue location validation
- Update `updateCompetitionSchema` to include location fields

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

### Phase 1: Core Competition Location
1. Add database schema fields for competition location
2. Update edit form with location section
3. Update competition row badge display
4. Update competition detail pages

### Phase 2: Venue Locations
1. Add database schema fields for venue locations
2. Update venue management UI
3. Update schedule display with venue locations

### Phase 3: Enhancements (Future)
1. Add Google Maps integration for address autocomplete
2. Add map embed on detail pages
3. Add distance-based competition search
4. Add "Get Directions" functionality

## Success Metrics

1. **Adoption:** % of in-person competitions with location data filled in
2. **Completeness:** % of competitions with city data (for badge display)
3. **User Feedback:** Qualitative feedback from organizers on ease of use

## Open Questions

1. Should we pre-populate location from organizing team's location (if exists)?
2. Do we want to support multiple countries dropdown with ISO codes?
3. Should address validation be a future requirement?
4. Do we need to handle timezone inference from location?

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
