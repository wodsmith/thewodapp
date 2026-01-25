# Competition Location Implementation Plan

This document provides a detailed technical implementation plan for adding location support to competitions using a normalized `addresses` table.

## Implementation Phases

### Phase 1: Database Schema & Core Types
### Phase 2: Server Functions & API
### Phase 3: Edit Form UI
### Phase 4: Public Display Components
### Phase 5: Venue Locations (Secondary)

---

## Phase 1: Database Schema & Core Types

### 1.1 Create Addresses Schema

**File:** `apps/wodsmith-start/src/db/schemas/addresses.ts` (new file)

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
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
  stateProvince: text('state_province'), // Normalized abbreviation (e.g., "TX")
  postalCode: text('postal_code'),
  countryCode: text('country_code'), // ISO 3166-1 alpha-2 (e.g., "US")
  notes: text('notes'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const addressesRelations = relations(addressesTable, ({ many }) => ({
  competitions: many(competitionsTable),
  venues: many(competitionVenuesTable),
}));
```

### 1.2 Update Competition Schema

**File:** `apps/wodsmith-start/src/db/schemas/competitions.ts`

Add FK to `competitionsTable`:

```typescript
// Add import
import { addressesTable } from './addresses';

// Add to competitionsTable columns
primaryAddressId: text('primary_address_id').references(() => addressesTable.id),
```

Update relations:

```typescript
export const competitionsRelations = relations(competitionsTable, ({ one, many }) => ({
  // ... existing relations
  primaryAddress: one(addressesTable, {
    fields: [competitionsTable.primaryAddressId],
    references: [addressesTable.id],
  }),
}));
```

### 1.3 Update Venue Schema

**File:** `apps/wodsmith-start/src/db/schemas/competitions.ts`

Add FK to `competitionVenuesTable`:

```typescript
// Add to competitionVenuesTable columns
addressId: text('address_id').references(() => addressesTable.id),
```

Update relations:

```typescript
export const competitionVenuesRelations = relations(competitionVenuesTable, ({ one }) => ({
  // ... existing relations
  address: one(addressesTable, {
    fields: [competitionVenuesTable.addressId],
    references: [addressesTable.id],
  }),
}));
```

### 1.4 Export from Schema Index

**File:** `apps/wodsmith-start/src/db/schema.ts`

```typescript
export * from './schemas/addresses';
```

### 1.5 Push Schema Changes

```bash
cd apps/wodsmith-start
pnpm db:push
```

### 1.6 Create Address Types

**File:** `apps/wodsmith-start/src/types/address.ts` (new file)

```typescript
export interface Address {
  id: string;
  addressType: string | null;
  name: string | null;
  streetLine1: string | null;
  streetLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  countryCode: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AddressInput = Omit<Address, 'id' | 'createdAt' | 'updatedAt'>;

export type LocationBadgeDisplay = {
  text: string;
  icon: 'map-pin' | 'globe';
};
```

### 1.7 Create Address Utility Functions

**File:** `apps/wodsmith-start/src/utils/address.ts` (new file)

```typescript
import type { Address, LocationBadgeDisplay } from '@/types/address';

/**
 * Format location for badge display in competition rows
 * Priority:
 * 1. Online competition → "Online" with globe icon
 * 2. City + State → "City, ST"
 * 3. City + Country → "City, CC"
 * 4. City only → "City"
 * 5. Name only → name
 * 6. Fallback → organizingTeamName
 */
export function formatLocationBadge(
  address: Partial<Address> | null,
  competitionType: 'in-person' | 'online',
  organizingTeamName?: string | null
): LocationBadgeDisplay {
  // Online competitions
  if (competitionType === 'online') {
    return { text: 'Online', icon: 'globe' };
  }

  // Has city and state (typically US)
  if (address?.city && address?.stateProvince) {
    return {
      text: `${address.city}, ${address.stateProvince}`,
      icon: 'map-pin'
    };
  }

  // Has city and country (international)
  if (address?.city && address?.countryCode) {
    return {
      text: `${address.city}, ${address.countryCode}`,
      icon: 'map-pin'
    };
  }

  // City only
  if (address?.city) {
    return { text: address.city, icon: 'map-pin' };
  }

  // Name only
  if (address?.name) {
    return { text: address.name, icon: 'map-pin' };
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
export function formatFullAddress(address: Partial<Address> | null): string | null {
  if (!address) return null;

  const parts: string[] = [];

  if (address.streetLine1) {
    parts.push(address.streetLine1);
  }
  if (address.streetLine2) {
    parts.push(address.streetLine2);
  }

  const cityStateZip = [
    address.city,
    address.stateProvince,
    address.postalCode,
  ].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1'); // Format as "City, State Zip"

  if (cityStateZip) {
    parts.push(cityStateZip);
  }

  if (address.countryCode) {
    const countryName = getCountryDisplayName(address.countryCode);
    parts.push(countryName || address.countryCode);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Check if address has meaningful data
 */
export function hasAddressData(address: Partial<Address> | null): boolean {
  if (!address) return false;
  return Boolean(
    address.name ||
    address.streetLine1 ||
    address.city ||
    address.stateProvince ||
    address.countryCode
  );
}

/**
 * Format city line for display (City, State or City, Country)
 */
export function formatCityLine(address: Partial<Address> | null): string | null {
  if (!address?.city) return null;

  if (address.stateProvince) {
    return `${address.city}, ${address.stateProvince}${address.postalCode ? ` ${address.postalCode}` : ''}`;
  }

  if (address.countryCode) {
    return `${address.city}, ${address.countryCode}`;
  }

  return address.city;
}

/**
 * Normalize state input to abbreviation
 * e.g., "Texas" → "TX", "tx" → "TX"
 */
export function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim().toUpperCase();

  // US state mapping
  const stateMap: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC',
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
    'UNITED STATES': 'US', 'USA': 'US', 'U.S.A.': 'US', 'U.S.': 'US', 'AMERICA': 'US',
    'UNITED KINGDOM': 'GB', 'UK': 'GB', 'ENGLAND': 'GB', 'GREAT BRITAIN': 'GB',
    'CANADA': 'CA', 'AUSTRALIA': 'AU', 'GERMANY': 'DE', 'DEUTSCHLAND': 'DE',
    'FRANCE': 'FR', 'SPAIN': 'ES', 'ESPANA': 'ES', 'ITALY': 'IT', 'ITALIA': 'IT',
    'MEXICO': 'MX', 'BRASIL': 'BR', 'BRAZIL': 'BR', 'JAPAN': 'JP',
    'CHINA': 'CN', 'INDIA': 'IN', 'RUSSIA': 'RU', 'SOUTH KOREA': 'KR',
    'NETHERLANDS': 'NL', 'BELGIUM': 'BE', 'SWITZERLAND': 'CH', 'SWEDEN': 'SE',
    'NORWAY': 'NO', 'DENMARK': 'DK', 'FINLAND': 'FI', 'IRELAND': 'IE',
    'AUSTRIA': 'AT', 'POLAND': 'PL', 'PORTUGAL': 'PT', 'GREECE': 'GR',
    'NEW ZEALAND': 'NZ', 'SOUTH AFRICA': 'ZA', 'ARGENTINA': 'AR', 'CHILE': 'CL',
    'COLOMBIA': 'CO', 'PERU': 'PE', 'ICELAND': 'IS', 'CZECH REPUBLIC': 'CZ',
  };

  // If already a 2-letter code, return uppercase
  if (trimmed.length === 2) {
    return trimmed;
  }

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
    'ES': 'Spain', 'IT': 'Italy', 'MX': 'Mexico', 'BR': 'Brazil',
    'JP': 'Japan', 'CN': 'China', 'IN': 'India', 'RU': 'Russia',
    'KR': 'South Korea', 'NL': 'Netherlands', 'BE': 'Belgium',
    'CH': 'Switzerland', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark',
    'FI': 'Finland', 'IE': 'Ireland', 'AT': 'Austria', 'PL': 'Poland',
    'PT': 'Portugal', 'GR': 'Greece', 'NZ': 'New Zealand', 'ZA': 'South Africa',
    'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru',
    'IS': 'Iceland', 'CZ': 'Czech Republic',
  };

  return displayMap[isoCode.toUpperCase()] || isoCode;
}

/**
 * Normalize address input before saving
 */
export function normalizeAddressInput(address: Partial<Address>): Partial<Address> {
  return {
    ...address,
    stateProvince: normalizeState(address.stateProvince),
    countryCode: normalizeCountry(address.countryCode),
  };
}
```

### 1.8 Add Zod Validation Schemas

**File:** `apps/wodsmith-start/src/schemas/address.ts` (new file)

```typescript
import { z } from 'zod';

export const addressSchema = z.object({
  addressType: z.enum(['competition', 'venue', 'gym', 'team']).nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  streetLine1: z.string().max(200).nullable().optional(),
  streetLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  stateProvince: z.string().max(10).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  countryCode: z.string().max(2).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const addressInputSchema = addressSchema;

export type AddressSchemaType = z.infer<typeof addressSchema>;
```

---

## Phase 2: Server Functions & API

### 2.1 Create Address Server Functions

**File:** `apps/wodsmith-start/src/server-fns/address-fns.ts` (new file)

```typescript
import { createServerFn } from '@tanstack/react-start';
import { db } from '@/db';
import { addressesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { addressInputSchema } from '@/schemas/address';
import { normalizeAddressInput } from '@/utils/address';

export const createAddressFn = createServerFn({ method: 'POST' })
  .validator(addressInputSchema)
  .handler(async ({ data }) => {
    const normalized = normalizeAddressInput(data);

    const [address] = await db
      .insert(addressesTable)
      .values({
        ...normalized,
        addressType: normalized.addressType ?? 'competition',
      })
      .returning();

    return address;
  });

export const updateAddressFn = createServerFn({ method: 'POST' })
  .validator(addressInputSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const normalized = normalizeAddressInput(rest);

    const [address] = await db
      .update(addressesTable)
      .set({
        ...normalized,
        updatedAt: new Date(),
      })
      .where(eq(addressesTable.id, id))
      .returning();

    return address;
  });

export const getAddressFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const address = await db.query.addressesTable.findFirst({
      where: eq(addressesTable.id, data.id),
    });
    return address ?? null;
  });
```

### 2.2 Update getPublicCompetitionsFn

**File:** `apps/wodsmith-start/src/server-fns/competition-fns.ts`

Include primaryAddress in the query:

```typescript
// Update the query to include primaryAddress relation
const competitions = await db.query.competitionsTable.findMany({
  // ... existing options
  with: {
    // ... existing relations
    primaryAddress: true,
  },
});
```

### 2.3 Update getCompetitionBySlugFn

Include full address details:

```typescript
// Update the query to include primaryAddress
const competition = await db.query.competitionsTable.findFirst({
  where: eq(competitionsTable.slug, data.slug),
  with: {
    // ... existing relations
    primaryAddress: true,
  },
});
```

### 2.4 Update updateCompetitionFn

Handle address creation/linking:

```typescript
// In the update handler, handle address
if (data.address) {
  // If competition already has an address, update it
  if (existingCompetition.primaryAddressId) {
    await updateAddressFn({ data: { id: existingCompetition.primaryAddressId, ...data.address } });
  } else {
    // Create new address and link it
    const address = await createAddressFn({ data: { ...data.address, addressType: 'competition' } });
    await db
      .update(competitionsTable)
      .set({ primaryAddressId: address.id })
      .where(eq(competitionsTable.id, competitionId));
  }
}
```

---

## Phase 3: Edit Form UI

### 3.1 Create AddressFields Component

**File:** `apps/wodsmith-start/src/components/forms/address-fields.tsx` (new file)

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

interface AddressFieldsProps {
  form: UseFormReturn<any>;
  prefix?: string;
}

export function AddressFields({ form, prefix = 'address' }: AddressFieldsProps) {
  const fieldName = (name: string) => prefix ? `${prefix}.${name}` : name;

  return (
    <div className="space-y-4">
      {/* Location Name */}
      <FormField
        control={form.control}
        name={fieldName('name')}
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
        name={fieldName('streetLine1')}
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
        name={fieldName('streetLine2')}
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
            name={fieldName('stateProvince')}
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
        name={fieldName('countryCode')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country</FormLabel>
            <FormControl>
              <Input
                placeholder="US"
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
        name={fieldName('notes')}
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

### 3.2 Integrate into Edit Form

In the competition edit form, add a collapsible location section:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AddressFields } from '@/components/forms/address-fields';
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
      <AddressFields form={form} prefix="address" />
    </CollapsibleContent>
  </Collapsible>
)}
```

---

## Phase 4: Public Display Components

### 4.1 Update Competition Row

**File:** `apps/wodsmith-start/src/components/competition-row.tsx`

```tsx
import { formatLocationBadge } from '@/utils/address';
import { MapPinIcon, GlobeIcon } from 'lucide-react';

// In the component:
const locationBadge = formatLocationBadge(
  competition.primaryAddress,
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

```tsx
import { formatLocationBadge } from '@/utils/address';
import { MapPinIcon, GlobeIcon } from 'lucide-react';

// In the component:
const locationBadge = formatLocationBadge(
  competition.primaryAddress,
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
import { hasAddressData, formatFullAddress, getCountryDisplayName } from '@/utils/address';
import type { Address } from '@/types/address';

interface CompetitionLocationCardProps {
  address: Partial<Address> | null;
  competitionType: 'in-person' | 'online';
  organizingTeamName?: string | null;
}

export function CompetitionLocationCard({
  address,
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

  const hasLocation = hasAddressData(address);
  const fullAddress = formatFullAddress(address);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPinIcon className="h-5 w-5" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {address?.name && (
          <p className="font-semibold">{address.name}</p>
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

        {address?.notes && (
          <div className="rounded-md bg-muted p-3">
            <div className="flex items-start gap-2">
              <InfoIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {address.notes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Phase 5: Venue Locations

### 5.1 Update Venue Management UI

Add radio group for venue location selection:

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AddressFields } from '@/components/forms/address-fields';

// In venue edit form:
<FormField
  control={form.control}
  name="useMainLocation"
  render={({ field }) => (
    <FormItem className="space-y-3">
      <FormLabel>Venue Location</FormLabel>
      <FormControl>
        <RadioGroup
          onValueChange={(value) => field.onChange(value === 'main')}
          defaultValue={field.value ? 'main' : 'different'}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="main" id="main" />
            <Label htmlFor="main">Use main competition location</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="different" id="different" />
            <Label htmlFor="different">Different location</Label>
          </div>
        </RadioGroup>
      </FormControl>
    </FormItem>
  )}
/>

{!useMainLocation && <AddressFields form={form} prefix="venueAddress" />}
```

---

## Testing Checklist

### Unit Tests

- [ ] `formatLocationBadge()` - all priority cases
- [ ] `formatFullAddress()` - various field combinations
- [ ] `hasAddressData()` - true/false cases
- [ ] `formatCityLine()` - formatting variations
- [ ] `normalizeState()` - "Texas" → "TX", "tx" → "TX", passthrough
- [ ] `normalizeCountry()` - "United States" → "US", "UK" → "GB", passthrough
- [ ] `getCountryDisplayName()` - "US" → "United States"

### Integration Tests

- [ ] Competition edit form saves address data
- [ ] Address displays correctly on competition row
- [ ] Location card renders for in-person vs online
- [ ] Venue location selection works correctly
- [ ] Backwards compatibility - competitions without address data

### Manual Testing

- [ ] Create new competition with full address
- [ ] Edit competition address
- [ ] Clear competition address
- [ ] Online competition shows correctly
- [ ] Competition list shows location badges
- [ ] Competition detail shows location card
- [ ] Create venue with different location
- [ ] Mobile layout works

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `src/db/schemas/addresses.ts` | Addresses table schema |
| `src/types/address.ts` | Address type definitions |
| `src/utils/address.ts` | Address formatting utilities |
| `src/schemas/address.ts` | Zod validation schemas |
| `src/server-fns/address-fns.ts` | Address CRUD server functions |
| `src/components/forms/address-fields.tsx` | Reusable address form fields |
| `src/components/competition-location-card.tsx` | Location display card |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schemas/competitions.ts` | Add `primaryAddressId` FK, `addressId` on venues |
| `src/db/schema.ts` | Export addresses |
| `src/server-fns/competition-fns.ts` | Include address relations in queries |
| `src/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form.tsx` | Add location section |
| `src/components/competition-row.tsx` | Update location badge |
| `src/components/competition-hero.tsx` | Add location display |
| `src/routes/compete/$slug/index.tsx` | Add location card |
| Venue management components | Add venue location selection |
