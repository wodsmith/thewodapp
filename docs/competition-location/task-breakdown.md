# Competition Location - Task Breakdown

This document provides a granular task breakdown for implementing competition location support.

## Epic Overview

**Epic:** Add Location Support to Competitions
**Scope:** Database, API, Organizer UI, Public Display
**Estimated Scope:** Medium-Large feature

---

## Phase 1: Foundation

### Task 1.1: Database Schema - Competition Location

**Description:** Add location fields to the competitions table

**Files to modify:**
- `apps/wodsmith-start/src/db/schemas/competitions.ts`

**Changes:**
- Add 8 new columns to `competitionsTable`:
  - `locationName`
  - `addressLine1`
  - `addressLine2`
  - `city`
  - `state`
  - `postalCode`
  - `country`
  - `locationNotes`

**Acceptance Criteria:**
- [ ] Schema compiles without errors
- [ ] `pnpm db:push` applies changes to local D1
- [ ] Can insert competition with location data
- [ ] Existing competitions unaffected

---

### Task 1.2: Database Schema - Venue Location

**Description:** Add optional location fields to competition venues table

**Files to modify:**
- `apps/wodsmith-start/src/db/schemas/competitions.ts`

**Changes:**
- Add 9 new columns to `competitionVenuesTable`:
  - `isOffsite` (boolean, default false)
  - `locationName`
  - `addressLine1`
  - `addressLine2`
  - `city`
  - `state`
  - `postalCode`
  - `country`
  - `locationNotes`

**Acceptance Criteria:**
- [ ] Schema compiles without errors
- [ ] Can create venue with offsite location
- [ ] Existing venues unaffected

---

### Task 1.3: Create Location Types

**Description:** Create TypeScript types for location data

**Files to create:**
- `apps/wodsmith-start/src/types/location.ts`

**Contents:**
- `CompetitionLocation` interface
- `VenueLocation` interface
- `LocationBadgeDisplay` type

**Acceptance Criteria:**
- [ ] Types compile without errors
- [ ] Types exported and importable

---

### Task 1.4: Create Location Utility Functions

**Description:** Create utility functions for formatting and displaying locations

**Files to create:**
- `apps/wodsmith-start/src/utils/location.ts`

**Functions to implement:**
- `formatLocationBadge()` - Format for competition row badge
- `formatFullAddress()` - Format complete address
- `hasLocationData()` - Check if location has meaningful data
- `formatCityLine()` - Format city/state/country line

**Acceptance Criteria:**
- [ ] All functions handle null/undefined gracefully
- [ ] `formatLocationBadge()` follows priority rules
- [ ] Unit tests pass (if applicable)

---

### Task 1.5: Add Zod Validation Schemas

**Description:** Add validation schemas for location data

**Files to modify:**
- `apps/wodsmith-start/src/schemas/competition.ts` (or create new file)

**Schemas to add:**
- `competitionLocationSchema`
- `venueLocationSchema`

**Acceptance Criteria:**
- [ ] Schemas validate field lengths
- [ ] Schemas handle nullable fields correctly
- [ ] Schemas integrate with existing competition schemas

---

## Phase 2: Server Functions

### Task 2.1: Update getPublicCompetitionsFn

**Description:** Include location fields in public competitions list query

**Files to modify:**
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`

**Changes:**
- Add to select: `city`, `state`, `country`, `locationName`, `competitionType`
- Ensure fields included in return type

**Acceptance Criteria:**
- [ ] API returns location fields
- [ ] Competition row can access location data
- [ ] No performance regression

---

### Task 2.2: Update getCompetitionBySlugFn

**Description:** Include full location details in competition detail query

**Files to modify:**
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`

**Changes:**
- Add all 8 location fields to select
- Ensure fields included in return type

**Acceptance Criteria:**
- [ ] API returns all location fields
- [ ] Detail page can display full location

---

### Task 2.3: Update updateCompetitionFn

**Description:** Allow updating location fields when editing competition

**Files to modify:**
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`

**Changes:**
- Merge location schema with update schema
- Include location fields in update object
- Handle null values appropriately

**Acceptance Criteria:**
- [ ] Can save location data from edit form
- [ ] Can clear location fields
- [ ] Partial updates work correctly

---

### Task 2.4: Update Venue Server Functions

**Description:** Include venue location fields in venue queries/updates

**Files to modify:**
- Venue-related server functions (identify specific file)

**Changes:**
- Add location fields to venue queries
- Handle `isOffsite` flag
- Support venue location updates

**Acceptance Criteria:**
- [ ] Venue queries return location data
- [ ] Can update venue location
- [ ] `isOffsite` toggle works

---

## Phase 3: Organizer UI

### Task 3.1: Create LocationFields Component

**Description:** Create reusable form component for location fields

**Files to create:**
- `apps/wodsmith-start/src/components/forms/location-fields.tsx`

**Component features:**
- All location input fields
- Proper form integration (react-hook-form)
- Responsive grid layout
- Optional prefix prop for nested forms

**Acceptance Criteria:**
- [ ] Component renders all fields
- [ ] Works with react-hook-form
- [ ] Handles null values
- [ ] Responsive on mobile

---

### Task 3.2: Add Location Section to Competition Edit Form

**Description:** Integrate location fields into the competition edit form

**Files to modify:**
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`

**Changes:**
- Add location fields to form schema
- Add collapsible location section
- Conditionally show for in-person competitions
- Populate with existing data
- Save location on form submit

**Acceptance Criteria:**
- [ ] Location section visible for in-person competitions
- [ ] Hidden for online competitions
- [ ] Existing location data loads correctly
- [ ] Location saves on submit
- [ ] Collapsible works correctly

---

### Task 3.3: Add Venue Location Toggle & Fields

**Description:** Allow setting offsite location on venues

**Files to modify:**
- Venue management component (identify specific file)

**Changes:**
- Add `isOffsite` toggle switch
- Show location fields when toggled on
- Save venue location data

**Acceptance Criteria:**
- [ ] Toggle shows/hides location fields
- [ ] Venue location saves correctly
- [ ] Existing venues show correct state

---

## Phase 4: Public Display

### Task 4.1: Update Competition Row Location Badge

**Description:** Display smart location badge on competition list items

**Files to modify:**
- `apps/wodsmith-start/src/components/competition-row.tsx`

**Changes:**
- Import `formatLocationBadge` utility
- Replace organizing team name with location badge
- Use globe icon for online, map-pin for in-person
- Handle mobile layout

**Acceptance Criteria:**
- [ ] Shows "City, ST" for US competitions
- [ ] Shows "City, Country" for international
- [ ] Shows "Online" with globe for online competitions
- [ ] Falls back to organizing team name
- [ ] Works on mobile

---

### Task 4.2: Update Competition Hero Location Display

**Description:** Show location info in competition hero section

**Files to modify:**
- `apps/wodsmith-start/src/components/competition-hero.tsx`

**Changes:**
- Add location badge below dates
- Use appropriate icon (globe/map-pin)
- Format location text appropriately

**Acceptance Criteria:**
- [ ] Location displays in hero
- [ ] Correct icon for competition type
- [ ] Fallback handling works

---

### Task 4.3: Create CompetitionLocationCard Component

**Description:** Create detailed location card for competition detail pages

**Files to create:**
- `apps/wodsmith-start/src/components/competition-location-card.tsx`

**Component features:**
- Show venue name, full address
- Display location notes
- Handle online competitions
- Handle missing location data

**Acceptance Criteria:**
- [ ] Shows full address formatted
- [ ] Shows location notes if present
- [ ] Shows "Online" message for online competitions
- [ ] Handles missing data gracefully

---

### Task 4.4: Add Location Card to Competition Detail Page

**Description:** Integrate location card into public competition detail page

**Files to modify:**
- `apps/wodsmith-start/src/routes/compete/$slug/index.tsx` (or relevant file)

**Changes:**
- Import location card component
- Add to page layout in appropriate position
- Pass competition location data

**Acceptance Criteria:**
- [ ] Location card appears on detail page
- [ ] Positioned appropriately in layout
- [ ] Data displays correctly

---

### Task 4.5: Update Schedule Display with Venue Locations

**Description:** Show venue location context in schedule/heat displays

**Files to modify:**
- Schedule display components (identify specific files)

**Changes:**
- Show venue name with location for offsite venues
- Visual indicator for offsite venues
- Consider grouping by location

**Acceptance Criteria:**
- [ ] Offsite venues show location
- [ ] Non-offsite venues show name only
- [ ] Clear visual distinction

---

## Phase 5: Testing & Polish

### Task 5.1: Add Unit Tests for Location Utilities

**Description:** Test location formatting functions

**Files to create:**
- `apps/wodsmith-start/test/utils/location.test.ts`

**Tests:**
- `formatLocationBadge` all priority cases
- `formatFullAddress` field combinations
- `hasLocationData` true/false cases
- `formatCityLine` formatting

**Acceptance Criteria:**
- [ ] All utility functions tested
- [ ] Edge cases covered
- [ ] Tests pass

---

### Task 5.2: Manual Testing & QA

**Description:** End-to-end testing of location feature

**Test scenarios:**
- [ ] Create competition with full location
- [ ] Edit competition location
- [ ] Clear competition location
- [ ] Online competition shows correctly
- [ ] Competition list shows location badges
- [ ] Competition detail shows location card
- [ ] Create venue with offsite location
- [ ] Schedule shows venue locations
- [ ] Mobile layout works
- [ ] Backwards compatibility (old competitions)

---

### Task 5.3: Generate Migration for Production

**Description:** Generate Drizzle migration for deployment

**Commands:**
```bash
cd apps/wodsmith-start
pnpm db:generate --name=add-competition-location
```

**Acceptance Criteria:**
- [ ] Migration file generated
- [ ] Migration applies cleanly
- [ ] Rollback possible if needed

---

## Dependencies

```
Phase 1 (Foundation)
  ├── Task 1.1: Competition Schema
  ├── Task 1.2: Venue Schema
  ├── Task 1.3: Location Types
  ├── Task 1.4: Location Utilities
  └── Task 1.5: Zod Schemas

Phase 2 (Server) - depends on Phase 1
  ├── Task 2.1: getPublicCompetitionsFn
  ├── Task 2.2: getCompetitionBySlugFn
  ├── Task 2.3: updateCompetitionFn
  └── Task 2.4: Venue Server Functions

Phase 3 (Organizer UI) - depends on Phase 2
  ├── Task 3.1: LocationFields Component
  ├── Task 3.2: Competition Edit Form
  └── Task 3.3: Venue Location Toggle

Phase 4 (Public Display) - depends on Phase 2
  ├── Task 4.1: Competition Row Badge
  ├── Task 4.2: Competition Hero
  ├── Task 4.3: Location Card Component
  ├── Task 4.4: Detail Page Integration
  └── Task 4.5: Schedule Display

Phase 5 (Testing) - depends on all phases
  ├── Task 5.1: Unit Tests
  ├── Task 5.2: Manual Testing
  └── Task 5.3: Migration Generation
```

## Notes

- Phase 1 tasks can be done in parallel
- Phase 2 tasks can be started once Phase 1 is complete
- Phase 3 and Phase 4 can be done in parallel after Phase 2
- Consider feature flagging if phased rollout is desired
- Mobile testing is critical for competition row badge
