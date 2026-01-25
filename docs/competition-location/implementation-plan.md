# Competition Location Implementation Plan

This document provides a detailed technical implementation plan for adding location support to competitions.

## Implementation Phases

### Phase 1: Database Schema & Core Types
### Phase 2: Server Functions & API
### Phase 3: Edit Form UI
### Phase 4: Public Display Components
### Phase 5: Venue Locations (Secondary)

---

## Phase 1: Database Schema & Core Types

### 1.1 Update Competition Schema

**File:** `apps/wodsmith-start/src/db/schemas/competitions.ts`

Add the following columns to `competitionsTable`:

```typescript
// Location fields
locationName: text('location_name'),
addressLine1: text('address_line_1'),
addressLine2: text('address_line_2'),
city: text('city'),
state: text('state'),
postalCode: text('postal_code'),
country: text('country'),
locationNotes: text('location_notes'),
```

### 1.2 Update Venue Schema

**File:** `apps/wodsmith-start/src/db/schemas/competitions.ts`

Add the following columns to `competitionVenuesTable`:

```typescript
// Venue-specific location (for offsite venues)
locationName: text('location_name'),
addressLine1: text('address_line_1'),
addressLine2: text('address_line_2'),
city: text('city'),
state: text('state'),
postalCode: text('postal_code'),
country: text('country'),
locationNotes: text('location_notes'),
isOffsite: integer('is_offsite', { mode: 'boolean' }).default(false),
```

### 1.3 Generate Migration

```bash
cd apps/wodsmith-start
pnpm db:push  # For local development
# Before merging: pnpm db:generate --name=add-competition-location
```

### 1.4 Create Location Types

**File:** `apps/wodsmith-start/src/types/location.ts` (new file)

```typescript
export interface CompetitionLocation {
  locationName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  locationNotes: string | null;
}

export interface VenueLocation extends CompetitionLocation {
  isOffsite: boolean;
}

export type LocationBadgeDisplay = {
  text: string;
  icon: 'map-pin' | 'globe';
};
```

### 1.5 Create Location Utility Functions

**File:** `apps/wodsmith-start/src/utils/location.ts` (new file)

```typescript
import type { CompetitionLocation, LocationBadgeDisplay } from '@/types/location';

/**
 * Format location for badge display in competition rows
 * Priority:
 * 1. Online competition → "Online" with globe icon
 * 2. City + State → "City, ST"
 * 3. City + Country (non-US) → "City, Country"
 * 4. City only → "City"
 * 5. Location name only → locationName
 * 6. Fallback → organizingTeamName
 */
export function formatLocationBadge(
  location: Partial<CompetitionLocation> | null,
  competitionType: 'in-person' | 'online',
  organizingTeamName?: string | null
): LocationBadgeDisplay {
  // Online competitions
  if (competitionType === 'online') {
    return { text: 'Online', icon: 'globe' };
  }

  // Has city and state (typically US)
  if (location?.city && location?.state) {
    return {
      text: `${location.city}, ${location.state}`,
      icon: 'map-pin'
    };
  }

  // Has city and country (international)
  if (location?.city && location?.country) {
    return {
      text: `${location.city}, ${location.country}`,
      icon: 'map-pin'
    };
  }

  // City only
  if (location?.city) {
    return { text: location.city, icon: 'map-pin' };
  }

  // Location name only
  if (location?.locationName) {
    return { text: location.locationName, icon: 'map-pin' };
  }

  // Fallback to organizing team name
  if (organizingTeamName) {
    return { text: organizingTeamName, icon: 'map-pin' };
  }

  // Ultimate fallback
  return { text: 'Location TBA', icon: 'map-pin' };
}

/**
 * Format full address for display
 */
export function formatFullAddress(location: Partial<CompetitionLocation> | null): string | null {
  if (!location) return null;

  const parts: string[] = [];

  if (location.addressLine1) {
    parts.push(location.addressLine1);
  }
  if (location.addressLine2) {
    parts.push(location.addressLine2);
  }

  const cityStateZip = [
    location.city,
    location.state,
    location.postalCode,
  ].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1'); // Format as "City, State Zip"

  if (cityStateZip) {
    parts.push(cityStateZip);
  }

  if (location.country) {
    parts.push(location.country);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Normalize state input to abbreviation
 * e.g., "Texas" → "TX", "tx" → "TX"
 */
export function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim().toUpperCase();
  // US state mapping (expand as needed)
  const stateMap: Record<string, string> = {
    'TEXAS': 'TX', 'CALIFORNIA': 'CA', 'NEW YORK': 'NY',
    'FLORIDA': 'FL', 'COLORADO': 'CO', 'ARIZONA': 'AZ',
    // ... add more as needed
  };
  return stateMap[trimmed] || trimmed;
}

/**
 * Normalize country to ISO 3166-1 alpha-2 code
 * e.g., "United States" → "US", "usa" → "US"
 */
export function normalizeCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim().toUpperCase();
  const countryMap: Record<string, string> = {
    'UNITED STATES': 'US', 'USA': 'US', 'U.S.A.': 'US', 'U.S.': 'US',
    'UNITED KINGDOM': 'GB', 'UK': 'GB', 'ENGLAND': 'GB',
    'CANADA': 'CA', 'AUSTRALIA': 'AU', 'GERMANY': 'DE',
    'FRANCE': 'FR', 'SPAIN': 'ES', 'ITALY': 'IT', 'MEXICO': 'MX',
    // ... add more as needed
  };
  return countryMap[trimmed] || trimmed;
}

/**
 * Get display name for country ISO code
 */
export function getCountryDisplayName(isoCode: string | null | undefined): string | null {
  if (!isoCode) return null;
  const displayMap: Record<string, string> = {
    'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada',
    'AU': 'Australia', 'DE': 'Germany', 'FR': 'France',
    'ES': 'Spain', 'IT': 'Italy', 'MX': 'Mexico',
    // ... add more as needed
  };
  return displayMap[isoCode.toUpperCase()] || isoCode;
}

/**
 * Check if location has meaningful data
 */
export function hasLocationData(location: Partial<CompetitionLocation> | null): boolean {
  if (!location) return false;
  return Boolean(
    location.locationName ||
    location.addressLine1 ||
    location.city ||
    location.state ||
    location.country
  );
}

/**
 * Format city line for display (City, State or City, Country)
 */
export function formatCityLine(location: Partial<CompetitionLocation> | null): string | null {
  if (!location?.city) return null;

  if (location.state) {
    return `${location.city}, ${location.state}${location.postalCode ? ` ${location.postalCode}` : ''}`;
  }

  if (location.country) {
    return `${location.city}, ${location.country}`;
  }

  return location.city;
}
```

---

## Phase 2: Server Functions & API

### 2.1 Update Zod Schemas

**File:** `apps/wodsmith-start/src/schemas/competition.ts`

Add location validation schema:

```typescript
import { z } from 'zod';

export const competitionLocationSchema = z.object({
  locationName: z.string().max(200).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(10).nullable().optional(), // Normalized to abbreviation (e.g., "TX")
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().max(2).nullable().optional(), // ISO 3166-1 alpha-2 (e.g., "US", "GB")
  locationNotes: z.string().max(1000).nullable().optional(),
});

export const venueLocationSchema = competitionLocationSchema.extend({
  isOffsite: z.boolean().optional().default(false),
});
```

### 2.2 Update Competition Server Functions

**File:** `apps/wodsmith-start/src/server-fns/competition-fns.ts`

Update `getPublicCompetitionsFn` to include location fields:

```typescript
// In the select statement, add:
locationName: competitionsTable.locationName,
city: competitionsTable.city,
state: competitionsTable.state,
country: competitionsTable.country,
competitionType: competitionsTable.competitionType,
```

Update `getCompetitionBySlugFn` to include all location fields:

```typescript
// Add to columns selection:
locationName: competitionsTable.locationName,
addressLine1: competitionsTable.addressLine1,
addressLine2: competitionsTable.addressLine2,
city: competitionsTable.city,
state: competitionsTable.state,
postalCode: competitionsTable.postalCode,
country: competitionsTable.country,
locationNotes: competitionsTable.locationNotes,
```

### 2.3 Update Competition Update Function

**File:** `apps/wodsmith-start/src/server-fns/competition-fns.ts`

Update `updateCompetitionFn` to handle location fields:

```typescript
// In the update schema, merge with location schema
const updateSchema = existingSchema.merge(competitionLocationSchema);

// In the update handler, include location fields in the update object
```

---

## Phase 3: Edit Form UI

### 3.1 Update Edit Form Schema

**File:** `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx`

Add location fields to the form schema:

```typescript
const formSchema = z.object({
  // ... existing fields

  // Location fields
  locationName: z.string().max(200).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  locationNotes: z.string().max(1000).optional().nullable(),
});
```

### 3.2 Add Location Section Component

Create a reusable location form section:

**File:** `apps/wodsmith-start/src/components/forms/location-fields.tsx` (new file)

```tsx
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { UseFormReturn } from 'react-hook-form';

interface LocationFieldsProps {
  form: UseFormReturn<any>;
  prefix?: string;
}

export function LocationFields({ form, prefix = '' }: LocationFieldsProps) {
  const fieldName = (name: string) => prefix ? `${prefix}.${name}` : name;

  return (
    <div className="space-y-4">
      {/* Location Name */}
      <FormField
        control={form.control}
        name={fieldName('locationName')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Venue / Location Name</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., CrossFit Central Arena"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Street Address */}
      <FormField
        control={form.control}
        name={fieldName('addressLine1')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Street Address</FormLabel>
            <FormControl>
              <Input
                placeholder="123 Main Street"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Address Line 2 */}
      <FormField
        control={form.control}
        name={fieldName('addressLine2')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address Line 2</FormLabel>
            <FormControl>
              <Input
                placeholder="Suite, Building, Unit (optional)"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* City, State, Postal */}
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-3">
          <FormField
            control={form.control}
            name={fieldName('city')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Austin"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="col-span-1">
          <FormField
            control={form.control}
            name={fieldName('state')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input
                    placeholder="TX"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="col-span-2">
          <FormField
            control={form.control}
            name={fieldName('postalCode')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="78701"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Country */}
      <FormField
        control={form.control}
        name={fieldName('country')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country</FormLabel>
            <FormControl>
              <Input
                placeholder="United States"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Location Notes */}
      <FormField
        control={form.control}
        name={fieldName('locationNotes')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Additional Directions / Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Parking instructions, entry points, etc."
                className="resize-none"
                rows={3}
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
```

### 3.3 Integrate into Edit Form

In the competition edit form, add a collapsible location section:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LocationFields } from '@/components/forms/location-fields';
import { MapPinIcon, ChevronDownIcon } from 'lucide-react';

// In the form JSX, after existing sections:
{competitionType === 'in-person' && (
  <Collapsible defaultOpen className="border rounded-lg">
    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 font-medium">
      <span className="flex items-center gap-2">
        <MapPinIcon className="h-4 w-4" />
        Location
      </span>
      <ChevronDownIcon className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
    </CollapsibleTrigger>
    <CollapsibleContent className="px-4 pb-4">
      <LocationFields form={form} />
    </CollapsibleContent>
  </Collapsible>
)}
```

---

## Phase 4: Public Display Components

### 4.1 Update Competition Row

**File:** `apps/wodsmith-start/src/components/competition-row.tsx`

```tsx
import { formatLocationBadge } from '@/utils/location';
import { MapPinIcon, GlobeIcon } from 'lucide-react';

// In the component, replace the location display:
const locationBadge = formatLocationBadge(
  {
    city: competition.city,
    state: competition.state,
    country: competition.country,
    locationName: competition.locationName,
  },
  competition.competitionType,
  competition.organizingTeam?.name
);

// In the JSX:
<span className="flex items-center gap-1">
  {locationBadge.icon === 'globe' ? (
    <GlobeIcon className="h-3.5 w-3.5" />
  ) : (
    <MapPinIcon className="h-3.5 w-3.5" />
  )}
  {locationBadge.text}
</span>
```

### 4.2 Update Competition Hero

**File:** `apps/wodsmith-start/src/components/competition-hero.tsx`

Add location display below dates:

```tsx
import { formatLocationBadge, hasLocationData, formatCityLine } from '@/utils/location';
import { MapPinIcon, GlobeIcon } from 'lucide-react';

// In the component:
const locationBadge = formatLocationBadge(
  competition,
  competition.competitionType,
  competition.organizingTeam?.name
);

// In the JSX (after dates section):
<div className="flex items-center gap-2 text-sm">
  {locationBadge.icon === 'globe' ? (
    <GlobeIcon className="h-4 w-4" />
  ) : (
    <MapPinIcon className="h-4 w-4" />
  )}
  <span>{locationBadge.text}</span>
</div>
```

### 4.3 Create Location Card Component

**File:** `apps/wodsmith-start/src/components/competition-location-card.tsx` (new file)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPinIcon, GlobeIcon, InfoIcon } from 'lucide-react';
import { hasLocationData, formatFullAddress } from '@/utils/location';
import type { CompetitionLocation } from '@/types/location';

interface CompetitionLocationCardProps {
  location: Partial<CompetitionLocation> | null;
  competitionType: 'in-person' | 'online';
  organizingTeamName?: string | null;
}

export function CompetitionLocationCard({
  location,
  competitionType,
  organizingTeamName,
}: CompetitionLocationCardProps) {
  if (competitionType === 'online') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GlobeIcon className="h-5 w-5" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This is an online competition. No physical location required.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasLocation = hasLocationData(location);
  const fullAddress = formatFullAddress(location);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPinIcon className="h-5 w-5" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {location?.locationName && (
          <p className="font-semibold">{location.locationName}</p>
        )}

        {fullAddress ? (
          <p className="whitespace-pre-line text-muted-foreground">
            {fullAddress}
          </p>
        ) : organizingTeamName ? (
          <p className="text-muted-foreground">{organizingTeamName}</p>
        ) : (
          <p className="text-muted-foreground">Location to be announced</p>
        )}

        {location?.locationNotes && (
          <div className="rounded-md bg-muted p-3">
            <div className="flex items-start gap-2">
              <InfoIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {location.locationNotes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.4 Add Location Card to Competition Detail Page

**File:** `apps/wodsmith-start/src/routes/compete/$slug/index.tsx` (or relevant detail page)

Import and add the location card component in the page layout.

---

## Phase 5: Venue Locations (Secondary)

### 5.1 Update Venue Management UI

**File:** `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/settings.tsx` (or dedicated venue page)

Add location toggle and fields to venue edit form:

```tsx
// In venue edit dialog/form:
<FormField
  control={form.control}
  name="isOffsite"
  render={({ field }) => (
    <FormItem className="space-y-3">
      <FormLabel>Venue Location</FormLabel>
      <FormControl>
        <RadioGroup
          onValueChange={(value) => field.onChange(value === 'offsite')}
          defaultValue={field.value ? 'offsite' : 'main'}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="main" id="main" />
            <Label htmlFor="main">Use main competition location</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="offsite" id="offsite" />
            <Label htmlFor="offsite">Different location</Label>
          </div>
        </RadioGroup>
      </FormControl>
    </FormItem>
  )}
/>

{isOffsite && <LocationFields form={form} />}
```

### 5.2 Update Schedule Display

When displaying venue information in schedules, show location context:

```tsx
// In schedule/heat display:
{venue.isOffsite && venue.city && (
  <span className="text-xs text-muted-foreground">
    @ {venue.locationName || formatCityLine(venue)}
  </span>
)}
```

---

## Testing Checklist

### Unit Tests

- [ ] `formatLocationBadge()` - all priority cases
- [ ] `formatFullAddress()` - various field combinations
- [ ] `hasLocationData()` - true/false cases
- [ ] `formatCityLine()` - city+state, city+country, city only

### Integration Tests

- [ ] Competition edit form saves location data
- [ ] Location displays correctly on competition row
- [ ] Location card renders for in-person vs online
- [ ] Venue location toggle works correctly
- [ ] Backwards compatibility - competitions without location data

### Manual Testing

- [ ] Create new competition with full location
- [ ] Edit existing competition to add location
- [ ] View competition list with location badges
- [ ] View competition detail with location card
- [ ] Create venue with offsite location
- [ ] View schedule with venue locations

---

## Migration Notes

### Backwards Compatibility

- All location fields are optional
- Existing competitions without location data will fallback to organizing team name
- No data migration required - existing data remains unchanged

### Deployment Steps

1. Deploy schema changes (migration)
2. Deploy server function updates
3. Deploy UI components
4. Verify backwards compatibility

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `src/types/location.ts` | Location type definitions |
| `src/utils/location.ts` | Location formatting utilities |
| `src/components/forms/location-fields.tsx` | Reusable location form fields |
| `src/components/competition-location-card.tsx` | Location display card |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schemas/competitions.ts` | Add location columns |
| `src/schemas/competition.ts` | Add Zod validation |
| `src/server-fns/competition-fns.ts` | Include location in queries |
| `src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx` | Add location section |
| `src/components/competition-row.tsx` | Update location badge |
| `src/components/competition-hero.tsx` | Add location display |
| `src/routes/compete/$slug/index.tsx` | Add location card |
| Venue management components | Add venue location fields |
