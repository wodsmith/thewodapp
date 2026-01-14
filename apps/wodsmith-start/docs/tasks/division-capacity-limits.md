# Division Spot Limits Implementation Plan

## Overview
Add capacity limits to competition divisions:
- Competition-level default (e.g., 16 spots per division)
- Division-specific override (e.g., 20 for popular divisions)
- Athlete-facing display of available spots
- Database-level enforcement before payment

## Schema Changes

### 1. `competitions` table
Add column:
```typescript
defaultMaxSpotsPerDivision: integer() // null = unlimited
```

### 2. `competition_divisions` table
Add column:
```typescript
maxSpots: integer() // null = use competition default
```

**Migration**: `pnpm db:generate add-division-capacity`

---

## Files to Modify

### Schema
- `src/db/schemas/competitions.ts` - Add `defaultMaxSpotsPerDivision`
- `src/db/schemas/commerce.ts` - Add `maxSpots` to `competitionDivisionsTable`

### Server Functions
- `src/server-fns/competition-divisions-fns.ts` - Add capacity functions:
  - `updateCompetitionDefaultCapacityFn` - Set competition default
  - `updateDivisionCapacityFn` - Set division override
  - Update `getPublicCompetitionDivisionsFn` to return spots available
- `src/server-fns/registration-fns.ts` - Add capacity check before payment

### Registration Enforcement
- `src/server-fns/registration-fns.ts`:
  - Add `checkDivisionCapacityFn` helper
  - Call before free registration (line ~194)
  - Call before creating Stripe checkout (line ~272)
- `src/routes/api/webhooks/stripe.ts`:
  - Re-check capacity before `registerForCompetition` (line ~145)
  - Return error + refund path if full

### Organizer UI
- `src/routes/compete/organizer/$competitionId/settings.tsx` - Add capacity settings section
- `src/routes/compete/organizer/$competitionId/-components/capacity-settings-form.tsx` - New component
- `src/components/divisions/organizer-division-item.tsx` - Add spots field inline

### Athlete UI
- `src/components/event-details-content.tsx` - Show "X spots left" or "Sold Out"
- `src/routes/compete/$slug/register.tsx` - Show available spots, disable if full

---

## Implementation Details

### Capacity Check Logic
```typescript
async function getDivisionSpotsAvailable(
  competitionId: string,
  divisionId: string
): Promise<{ maxSpots: number | null; registered: number; available: number | null }> {
  // 1. Get division config (maxSpots override)
  // 2. Get competition default (defaultMaxSpotsPerDivision)
  // 3. Count registrations for this division
  // 4. Calculate: effectiveMax = divisionMaxSpots ?? competitionDefault ?? null
  // 5. Return { maxSpots: effectiveMax, registered, available: effectiveMax ? effectiveMax - registered : null }
}
```

### Enforcement Points
1. **Before payment initiation** (`initiateRegistrationPaymentFn`):
   - Check spots available
   - Throw error if full: "This division is full"

2. **In Stripe webhook** (`handleCheckoutCompleted`):
   - Re-check capacity before creating registration
   - If full: log error, mark purchase as FAILED, trigger refund
   - Send "division filled during payment" email to user

### Race Condition Handling
D1 doesn't support transactions, but:
- Primary check before payment catches most cases
- Webhook re-check prevents overselling for paid
- For free divisions: accept slight potential for 1-2 over capacity (acceptable tradeoff vs complexity)
- Alternative: use KV for atomic counters (future enhancement if needed)

---

## Organizer UI Mockup

**Settings Page - New Section:**
```
┌─────────────────────────────────────────────────────┐
│ Capacity Settings                                   │
├─────────────────────────────────────────────────────┤
│ Default spots per division                          │
│ ┌──────────────────────────┐                        │
│ │ [16                    ] │  Leave blank for       │
│ └──────────────────────────┘  unlimited             │
│                                                     │
│ [Save Changes]                                      │
└─────────────────────────────────────────────────────┘
```

**Division Item - Inline:**
```
┌─────────────────────────────────────────────────────┐
│ ≡ #1 Open Male (Indy)          3 athletes   [🗑️]   │
│     Max spots: [   ] (blank = use default 16)       │
└─────────────────────────────────────────────────────┘
```

---

## Athlete UI Mockup

**Division Display (event-details-content.tsx):**
```
FREE (4 divisions)
│
├─ [Open Male (Indy)]       3/16 spots • 13 left
├─ [Open Female (Indy)]     16/16 spots • SOLD OUT
├─ [Scaled Male (Indy)]     0/16 spots
└─ [Scaled Female (Indy)]   0 athletes (unlimited)
```

**Registration Page:**
- Show division selector with spots info
- Disable "sold out" divisions
- Show warning if < 5 spots left

---

## Task Breakdown

1. **Schema & Migration**
   - Add columns to schema files
   - Generate migration
   - Apply to dev

2. **Server Functions**
   - Add capacity helper function
   - Add organizer update functions
   - Update public divisions query to include capacity

3. **Enforcement**
   - Add checks to registration-fns.ts
   - Add re-check to Stripe webhook
   - Handle "full during payment" edge case

4. **Organizer UI**
   - Create capacity settings form
   - Add inline spots to division manager

5. **Athlete UI**
   - Update division display component
   - Update registration page

6. **Testing**
   - Test capacity enforcement
   - Test edge cases (exactly at limit, over limit)

---

## Verification

1. **Organizer flow:**
   - Set default capacity on competition
   - Override capacity on specific division
   - Verify values persist

2. **Athlete flow:**
   - View competition with capacity limits
   - Register when spots available
   - Attempt registration when full (should fail)

3. **Edge cases:**
   - Paid registration fills last spot during payment
   - Multiple users race for last spot
   - Division with no override uses competition default
   - Competition with no default = unlimited
