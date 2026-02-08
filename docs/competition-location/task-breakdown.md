# Competition Location - Task Breakdown

This document provides a granular task breakdown for implementing competition location support using a normalized `addresses` table.

## Epic Overview

**Epic:** Add Location Support to Competitions
**Scope:** Database, API, Organizer UI, Public Display
**Approach:** Normalized `addresses` table with FK references

---

## Phase 1: Foundation

### Task 1.1: Create Addresses Table Schema

**Description:** Create new `addresses` table for storing location data

**Files to create:**
- `apps/wodsmith-start/src/db/schemas/addresses.ts`

**Changes:**
- Define `addressesTable` with columns:
  - `id` (cuid2 primary key)
  - `addressType` ('competition', 'venue', 'gym', 'team')
  - `name` (venue/location name)
  - `streetLine1`, `streetLine2`
  - `city`, `stateProvince`, `postalCode`, `countryCode`
  - `notes`
  - `createdAt`, `updatedAt`
- Define `addressesRelations`

**Acceptance Criteria:**
- [ ] Schema compiles without errors
- [ ] Table exported from schema index

---

### Task 1.2: Add FK to Competitions Table

**Description:** Add `primaryAddressId` FK to competitions table

**Files to modify:**
- `apps/wodsmith-start/src/db/schemas/competitions.ts`

**Changes:**
- Add `primaryAddressId` column with FK reference to `addressesTable`
- Update `competitionsRelations` to include `primaryAddress` relation

**Acceptance Criteria:**
- [ ] Schema compiles without errors
- [ ] Relation properly configured

---

### Task 1.3: Add FK to Venues Table

**Description:** Add `addressId` FK to competition_venues table

**Files to modify:**
- `apps/wodsmith-start/src/db/schemas/competitions.ts`

**Changes:**
- Add `addressId` column with FK reference to `addressesTable`
- Update `competitionVenuesRelations` to include `address` relation

**Acceptance Criteria:**
- [ ] Schema compiles without errors
- [ ] Relation properly configured

---

### Task 1.4: Export Schema & Push Changes

**Description:** Export addresses schema and push to local D1

**Files to modify:**
- `apps/wodsmith-start/src/db/schema.ts`

**Commands:**
```bash
cd apps/wodsmith-start
pnpm db:push
```

**Acceptance Criteria:**
- [ ] `pnpm db:push` succeeds
- [ ] Tables created in local D1
- [ ] Existing data unaffected

---

### Task 1.5: Create Address Types

**Description:** Create TypeScript types for address data

**Files to create:**
- `apps/wodsmith-start/src/types/address.ts`

**Contents:**
- `Address` interface
- `AddressInput` type (without id, timestamps)
- `LocationBadgeDisplay` type

**Acceptance Criteria:**
- [ ] Types compile without errors
- [ ] Types exported and importable

---

### Task 1.6: Create Address Utility Functions

**Description:** Create utility functions for formatting and displaying addresses

**Files to create:**
- `apps/wodsmith-start/src/utils/address.ts`

**Functions to implement:**
- `formatLocationBadge()` - Format for competition row badge
- `formatFullAddress()` - Format complete address
- `hasAddressData()` - Check if address has meaningful data
- `formatCityLine()` - Format city/state/country line
- `normalizeState()` - Normalize state to abbreviation (e.g., "Texas" → "TX")
- `normalizeCountry()` - Normalize country to ISO 3166-1 alpha-2 code
- `getCountryDisplayName()` - Get display name from ISO code
- `normalizeAddressInput()` - Normalize address before saving

**Acceptance Criteria:**
- [ ] All functions handle null/undefined gracefully
- [ ] `formatLocationBadge()` follows priority rules
- [ ] Normalization works correctly

---

### Task 1.7: Add Zod Validation Schemas

**Description:** Add validation schemas for address data

**Files to create:**
- `apps/wodsmith-start/src/schemas/address.ts`

**Schemas to add:**
- `addressSchema` - Address field validation
- `addressInputSchema` - Input validation

**Acceptance Criteria:**
- [ ] Schemas validate field lengths
- [ ] Schemas handle nullable fields correctly

---

## Phase 2: Server Functions

### Task 2.1: Create Address Server Functions

**Description:** Create CRUD server functions for addresses

**Files to create:**
- `apps/wodsmith-start/src/server-fns/address-fns.ts`

**Functions:**
- `createAddressFn` - Create new address with normalization
- `updateAddressFn` - Update existing address
- `getAddressFn` - Get address by ID

**Acceptance Criteria:**
- [ ] Functions normalize state/country on save
- [ ] Functions return proper types
- [ ] Error handling works

---

### Task 2.2: Update getPublicCompetitionsFn

**Description:** Include primaryAddress relation in public competitions query

**Files to modify:**
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`

**Changes:**
- Add `primaryAddress: true` to query `with` clause
- Update return type if needed

**Acceptance Criteria:**
- [ ] API returns address data
- [ ] Competition row can access address
- [ ] No performance regression

---

### Task 2.3: Update getCompetitionBySlugFn

**Description:** Include full address details in competition detail query

**Files to modify:**
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`

**Changes:**
- Add `primaryAddress: true` to query `with` clause
- Update return type if needed

**Acceptance Criteria:**
- [ ] API returns full address details
- [ ] Detail page can display full location

---

### Task 2.4: Update updateCompetitionFn

**Description:** Handle address creation/update when editing competition

**Files to modify:**
- `apps/wodsmith-start/src/server-fns/competition-fns.ts`

**Changes:**
- Accept address data in update payload
- If competition has `primaryAddressId`, update existing address
- If not, create new address and link it
- Handle clearing address (set `primaryAddressId` to null)

**Acceptance Criteria:**
- [ ] Can save new address from edit form
- [ ] Can update existing address
- [ ] Can clear address
- [ ] Normalization applied on save

---

### Task 2.5: Update Venue Server Functions

**Description:** Include venue address data in venue queries/updates

**Files to modify:**
- Venue-related server functions

**Changes:**
- Add `address: true` to venue queries
- Handle venue address creation/update
- Handle `addressId` nullable FK

**Acceptance Criteria:**
- [ ] Venue queries return address data
- [ ] Can update venue address
- [ ] Null addressId means use competition's primary

---

## Phase 3: Organizer UI

### Task 3.1: Create AddressFields Component

**Description:** Create reusable form component for address fields

**Files to create:**
- `apps/wodsmith-start/src/components/forms/address-fields.tsx`

**Component features:**
- All address input fields
- Proper form integration (react-hook-form)
- Responsive grid layout (City/State/Postal in row)
- Optional prefix prop for nested forms

**Acceptance Criteria:**
- [ ] Component renders all fields
- [ ] Works with react-hook-form
- [ ] Handles null values
- [ ] Responsive on mobile

---

### Task 3.2: Add Location Section to Competition Edit Form

**Description:** Integrate address fields into the competition edit form

**Files to modify:**
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`

**Changes:**
- Add address fields to form schema (nested under `address`)
- Add collapsible location section
- Conditionally show for in-person competitions only
- Populate with existing address data
- Save address on form submit

**Acceptance Criteria:**
- [ ] Location section visible for in-person competitions
- [ ] Hidden for online competitions
- [ ] Existing address data loads correctly
- [ ] Address saves on submit
- [ ] Collapsible works correctly

---

### Task 3.3: Add Venue Location Selection

**Description:** Allow selecting location for venues

**Files to modify:**
- Venue management component

**Changes:**
- Add radio group: "Use main competition location" (default) / "Different location"
- Show address fields when "Different location" selected
- Save venue address data
- Clear addressId when switching back to main

**Acceptance Criteria:**
- [ ] Radio selection shows/hides address fields
- [ ] "Use main competition location" is default
- [ ] Venue address saves correctly
- [ ] Existing venues show correct state

---

## Phase 4: Public Display

### Task 4.1: Update Competition Row Location Badge

**Description:** Display smart location badge on competition list items

**Files to modify:**
- `apps/wodsmith-start/src/components/competition-row.tsx`

**Changes:**
- Import `formatLocationBadge` utility
- Call with `competition.primaryAddress`
- Use globe icon for online, map-pin for in-person
- Handle mobile layout

**Acceptance Criteria:**
- [ ] Shows "City, ST" for US competitions
- [ ] Shows "City, CC" for international
- [ ] Shows "Online" with globe for online competitions
- [ ] Falls back to organizing team name
- [ ] Works on mobile

---

### Task 4.2: Update Competition Hero Location Display

**Description:** Show location info in competition hero section

**Files to modify:**
- `apps/wodsmith-start/src/components/competition-hero.tsx`

**Changes:**
- Import `formatLocationBadge` utility
- Add location badge below dates
- Use appropriate icon (globe/map-pin)

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
- Display location notes in muted box
- Handle online competitions (show "Online" message)
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
- Pass `competition.primaryAddress` data

**Acceptance Criteria:**
- [ ] Location card appears on detail page
- [ ] Positioned appropriately in layout
- [ ] Data displays correctly

---

### Task 4.5: Update Schedule Display with Venue Locations

**Description:** Show venue location context in schedule/heat displays

**Files to modify:**
- Schedule display components

**Changes:**
- Show venue name with location for venues with custom address
- Visual indicator for venues at different locations
- Consider grouping by location

**Acceptance Criteria:**
- [ ] Venues with custom address show location
- [ ] Venues using main location show name only
- [ ] Clear visual distinction

---

## Phase 5: Testing & Polish

### Task 5.1: Add Unit Tests for Address Utilities

**Description:** Test address formatting and normalization functions

**Files to create:**
- `apps/wodsmith-start/test/utils/address.test.ts`

**Tests:**
- `formatLocationBadge` - all priority cases (online, city+state, city+country, city only, name only, fallback)
- `formatFullAddress` - field combinations
- `hasAddressData` - true/false cases
- `formatCityLine` - formatting variations
- `normalizeState` - "Texas" → "TX", "tx" → "TX", passthrough unknown
- `normalizeCountry` - "United States" → "US", "UK" → "GB", passthrough ISO codes
- `getCountryDisplayName` - "US" → "United States"

**Acceptance Criteria:**
- [ ] All utility functions tested
- [ ] Edge cases covered
- [ ] Tests pass

---

### Task 5.2: Manual Testing & QA

**Description:** End-to-end testing of location feature

**Test scenarios:**
- [ ] Create competition with full address
- [ ] Edit competition address
- [ ] Clear competition address
- [ ] Online competition shows "Online" correctly
- [ ] Competition list shows location badges
- [ ] Competition detail shows location card
- [ ] Create venue with different location
- [ ] Venue uses main location by default
- [ ] Schedule shows venue locations
- [ ] Mobile layout works
- [ ] Backwards compatibility (old competitions without address)

---

### Task 5.3: Generate Migration for Production

**Description:** Generate Drizzle migration for deployment

**Commands:**
```bash
cd apps/wodsmith-start
pnpm db:generate --name=add-addresses-table
```

**Acceptance Criteria:**
- [ ] Migration file generated
- [ ] Migration applies cleanly
- [ ] Rollback possible if needed

---

## Dependencies

```
Phase 1 (Foundation)
  ├── Task 1.1: Create Addresses Schema
  ├── Task 1.2: Add FK to Competitions
  ├── Task 1.3: Add FK to Venues
  ├── Task 1.4: Export & Push Schema
  ├── Task 1.5: Address Types
  ├── Task 1.6: Address Utilities
  └── Task 1.7: Zod Schemas

Phase 2 (Server) - depends on Phase 1
  ├── Task 2.1: Address Server Functions
  ├── Task 2.2: getPublicCompetitionsFn
  ├── Task 2.3: getCompetitionBySlugFn
  ├── Task 2.4: updateCompetitionFn
  └── Task 2.5: Venue Server Functions

Phase 3 (Organizer UI) - depends on Phase 2
  ├── Task 3.1: AddressFields Component
  ├── Task 3.2: Competition Edit Form
  └── Task 3.3: Venue Location Selection

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

## Parallelization

**Can run in parallel within Phase 1:**
- Tasks 1.1, 1.2, 1.3 (schema changes)
- Tasks 1.5, 1.6, 1.7 (types/utils/schemas)

**Can run in parallel after Phase 2:**
- Phase 3 (Organizer UI) and Phase 4 (Public Display)

**Sequential dependencies:**
- Schema tasks → Push → Server functions → UI

## Notes

- All fields nullable for backwards compatibility
- State/country normalized on save, not display
- Venues with null `addressId` use competition's `primaryAddress`
- Online competitions should have null `primaryAddressId`
- Mobile testing is critical for competition row badge
