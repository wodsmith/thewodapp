# Stripe Commerce Implementation Plan

**Last Updated**: 2025-01-28
**Status**: Planning (Updated after review)
**Owner**: Engineering Team

## Overview

Implement a commerce system for competition registrations with variable platform fees, comprehensive fee tracking, and future support for Stripe Connect payouts to competition organizers.

### Business Requirements

- **Platform Fee Structure**: Variable by competition
  - Default: 2.5% + $2.00 per transaction
  - Configurable per competition for flexibility
- **Stripe Processing Fee**: 2.9% + $0.30 per transaction
- **Stripe Fee Handling**: Organizer chooses who pays
  - Default: Organizer absorbs Stripe fees
  - Optional: Pass Stripe fees to customer (customer pays all fees)
  - Configurable per competition for flexibility
- **Fee Transparency**: Store and display all fee breakdowns
- **Refund Policy**: No refunds
- **Free Competitions**: Supported (skip payment flow when fee is $0)
- **Team Registration Payment**: Captain pays for entire team
- **Future Capability**: Stripe Connect payouts to organizers

### Key Architecture Decision

**Two-Phase Registration Flow**: To integrate commerce with the existing complex registration logic (team creation, membership, invitations), we use a two-phase approach:

1. **Phase 1 (Before Payment)**: Create registration with `paymentStatus: 'PENDING_PAYMENT'` - does NOT create team_membership or invite teammates yet
2. **Phase 2 (After Payment)**: Webhook completes the registration - creates team_membership, athlete team, invites teammates

This prevents orphaned records if payment fails while maintaining the existing registration logic.

### Revenue Examples (Registration Fee: $50)

**Option A: Organizer absorbs Stripe fee** (default)
```
Registration Fee:        $50.00
Platform Fee (2.5%+$2):  $3.25
---
Total Charged:           $53.25
Stripe deducts:          $1.84
Net received:            $51.41
Wodsmith keeps:          $3.25
Organizer receives:      $48.16
```

**Option B: Pass Stripe fees to customer** (configurable per competition)
```
Registration Fee:        $50.00
Platform Fee (2.5%+$2):  $3.25
Stripe Fee (2.9%+$0.30): $1.84
---
Total Charged:           $55.09
Wodsmith receives:       $3.25
Organizer receives:      $50.00 (exactly registration fee set)
```

Organizers can choose their preferred model when creating competitions.

---

## Payout Timing Strategy

### WodSmith Approach: Immediate Payouts

**Decision**: Pay organizers immediately after each registration (via Stripe Connect transfers)

**Rationale**:
- Organizers need working capital for event preparation (equipment, venue, prizes)
- Simpler to implement - no delayed payout logic or scheduling
- Lets organizers manage their own cash flow and risk
- Aligns with no-refund policy (organizers keep funds, handle cancellations themselves)

**Implementation** (Phase 2):
- Use Stripe Connect `transfer_data.destination` for automatic transfers
- Funds move to organizer's connected account as registrations come in
- Platform fee deducted automatically before transfer
- Organizer's Stripe account payout schedule determines when they receive funds (typically 2-day rolling)

---

## Implementation Phases

### Phase 1: Commerce Foundation (MVP) ⭐ CURRENT FOCUS

**Goal**: Basic registration payments without organizer payouts

**Timeline**: 1-2 weeks
**Scope**: Athletes can pay for competition registrations, fees tracked, no payouts yet

#### Deliverables

1. **Database Schema** - Commerce tables and fee tracking
2. **Fee Calculation System** - Compute platform/Stripe fees
3. **Payment Flow** - Stripe PaymentIntent integration
4. **Webhook Handler** - Process payment confirmations
5. **Registration Creation** - Auto-create registration on payment success

---

### Phase 2: Stripe Connect Integration (Post-MVP)

**Goal**: Enable payouts to competition organizers

**Timeline**: 2-3 weeks
**Scope**: Multi-party payments with organizer revenue distribution

#### Deliverables

1. **Connected Account Onboarding** - Express account creation
2. **Multi-Party Payments** - Application fees and transfers
3. **Payout Scheduling** - 14-day pre-event payout logic
4. **Organizer Dashboard** - Revenue tracking and history

---

### Phase 3: Future Enhancements (Optional)

**Goal**: Advanced commerce features

**Timeline**: TBD based on demand

#### Potential Features

- Advanced revenue analytics for organizers
- Payout history export (CSV/PDF)

---

## Phase 1 Detailed Implementation

### 1.1 Database Schema

#### New Tables

**File**: `src/db/schemas/commerce.ts`

**`commerce_product`** - Purchasable products (competition registrations)

```typescript
import { commonColumns, createCommerceProductId, createCommercePurchaseId } from "./common"

export const commerceProductTable = sqliteTable('commerce_product', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCommerceProductId())
    .notNull(),
  name: text({ length: 255 }).notNull(), // "Competition Registration - [Event Name]"
  type: text({ length: 50 }).notNull(), // 'COMPETITION_REGISTRATION' | 'ADDON'
  resourceId: text().notNull(), // competitionId
  priceCents: integer().notNull(), // Base registration fee
}, (table) => [
  // Prevent duplicate products for same resource
  uniqueIndex('commerce_product_resource_idx').on(table.type, table.resourceId),
])
```

**`commerce_purchase`** - Purchase transaction records

```typescript
export const commercePurchaseTable = sqliteTable('commerce_purchase', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCommercePurchaseId())
    .notNull(),
  userId: text()
    .notNull()
    .references(() => userTable.id, { onDelete: 'cascade' }),
  productId: text()
    .notNull()
    .references(() => commerceProductTable.id, { onDelete: 'cascade' }),
  status: text({ length: 20 }).notNull(), // 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

  // Context for competition registrations
  competitionId: text(), // Stored directly for queries (not just in metadata)
  divisionId: text(), // Stored directly for queries

  // Amounts (all in cents)
  totalCents: integer().notNull(), // Amount charged to customer
  platformFeeCents: integer().notNull(), // Wodsmith revenue
  stripeFeeCents: integer().notNull(), // Stripe's fee
  organizerNetCents: integer().notNull(), // What organizer receives

  // Stripe references (using Checkout Sessions, not PaymentIntents directly)
  stripeCheckoutSessionId: text(), // Checkout Session ID
  stripePaymentIntentId: text(), // Set after checkout completes (from session.payment_intent)

  // Extensibility (JSON for team registration data, etc.)
  metadata: text({ length: 10000 }), // JSON

  completedAt: integer({ mode: 'timestamp' }),
}, (table) => [
  index('commerce_purchase_user_idx').on(table.userId),
  index('commerce_purchase_product_idx').on(table.productId),
  index('commerce_purchase_status_idx').on(table.status),
  index('commerce_purchase_stripe_session_idx').on(table.stripeCheckoutSessionId),
  index('commerce_purchase_competition_idx').on(table.competitionId),
])
```

**Relations**:

```typescript
export const commerceProductRelations = relations(commerceProductTable, ({ many }) => ({
  purchases: many(commercePurchaseTable),
}))

export const commercePurchaseRelations = relations(commercePurchaseTable, ({ one }) => ({
  user: one(userTable, {
    fields: [commercePurchaseTable.userId],
    references: [userTable.id],
  }),
  product: one(commerceProductTable, {
    fields: [commercePurchaseTable.productId],
    references: [commerceProductTable.id],
  }),
}))
```

#### Schema Additions to Existing Tables

**`competition_division_fees` table** - Per-division pricing (NEW)

Since divisions (scaling_levels) can be reused across competitions, fees are stored per competition+division:

```typescript
export const competitionDivisionFeesTable = sqliteTable('competition_division_fees', {
  ...commonColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => createCompetitionDivisionFeeId())
    .notNull(),
  competitionId: text()
    .notNull()
    .references(() => competitionsTable.id, { onDelete: 'cascade' }),
  divisionId: text()
    .notNull()
    .references(() => scalingLevelsTable.id, { onDelete: 'cascade' }),
  feeCents: integer().notNull(), // e.g., 20000 = $200, 35000 = $350
}, (table) => [
  // Each division can only have one fee per competition
  uniqueIndex('competition_division_fees_unique_idx').on(table.competitionId, table.divisionId),
  index('competition_division_fees_competition_idx').on(table.competitionId),
])

// Add to common.ts:
export const createCompetitionDivisionFeeId = () => `cdfee_${createId()}`
```

**Example**: A competition with divisions priced differently:
| Division | Fee |
|----------|-----|
| Individual RX | $200 |
| Individual Scaled | $150 |
| Team of 3 | $350 |

**`competitions` table** - Add to `src/db/schemas/competitions.ts`:
```typescript
{
  // ... existing fields

  // Default registration fee (used if no division-specific fee exists)
  defaultRegistrationFeeCents: integer().default(0), // $0 = free by default

  // Fee configuration (nullable = use platform defaults)
  platformFeePercentage: integer(), // Basis points, null = default 250 (2.5%)
  platformFeeFixed: integer(), // Cents, null = default 200 ($2.00)
  passStripeFeesToCustomer: integer({ mode: 'boolean' }).default(false),
}
```

**Fee Resolution Logic**:
```typescript
// Get fee for a specific division
async function getRegistrationFee(competitionId: string, divisionId: string): Promise<number> {
  const divisionFee = await db.query.competitionDivisionFeesTable.findFirst({
    where: and(
      eq(competitionDivisionFeesTable.competitionId, competitionId),
      eq(competitionDivisionFeesTable.divisionId, divisionId),
    ),
  })

  if (divisionFee) {
    return divisionFee.feeCents
  }

  // Fall back to competition default
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
  })

  return competition?.defaultRegistrationFeeCents ?? 0
}
```

**`competition_registrations` table** - Add to existing schema:
```typescript
{
  // ... existing fields

  // Payment tracking
  commercePurchaseId: text().references(() => commercePurchaseTable.id),
  paymentStatus: text({ length: 20 }), // 'FREE' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED'
  paidAt: integer({ mode: 'timestamp' }),
}
```

**`teams` table** (Phase 2 prep) - Add to `src/db/schemas/teams.ts`:
```typescript
{
  // ... existing fields
  stripeConnectedAccountId: text(), // Stripe Express account ID
  stripeAccountStatus: text({ length: 20 }), // 'NOT_CONNECTED' | 'PENDING' | 'VERIFIED'
  stripeOnboardingCompletedAt: integer({ mode: 'timestamp' }),
}
```

#### ID Generators

**Add to `src/db/schemas/common.ts`**:
```typescript
// Commerce ID generators
export const createCommerceProductId = () => `cprod_${createId()}`
export const createCommercePurchaseId = () => `cpur_${createId()}`
```

---

### 1.2 Fee Calculation System

**File**: `src/server/commerce/fee-calculator.ts`

```typescript
// Platform default fee configuration
export const PLATFORM_DEFAULTS = {
  platformPercentageBasisPoints: 250, // 2.5%
  platformFixedCents: 200, // $2.00
  stripePercentageBasisPoints: 290, // 2.9%
  stripeFixedCents: 30, // $0.30
} as const

interface FeeConfiguration {
  platformPercentageBasisPoints: number // 250 = 2.5%
  platformFixedCents: number // 200 = $2.00
  stripePercentageBasisPoints: number // 290 = 2.9%
  stripeFixedCents: number // 30 = $0.30
  passStripeFeesToCustomer: boolean // false = organizer absorbs, true = customer pays
}

interface FeeBreakdown {
  registrationFeeCents: number
  platformFeeCents: number
  stripeFeeCents: number
  totalChargeCents: number
  organizerNetCents: number
  passedToCustomer: boolean
}

export function calculateCompetitionFees(
  registrationFeeCents: number,
  config: FeeConfiguration
): FeeBreakdown {
  // Platform fee = (registration * %) + fixed
  const platformFeeCents =
    Math.round(registrationFeeCents * (config.platformPercentageBasisPoints / 10000)) +
    config.platformFixedCents

  // Subtotal before Stripe processing
  const subtotalCents = registrationFeeCents + platformFeeCents

  if (config.passStripeFeesToCustomer) {
    // Customer pays Stripe fees - solve for total that covers Stripe's cut
    //
    // IMPORTANT: Stripe charges fees on the TOTAL amount, creating a circular dependency.
    // We need to solve: total = subtotal + (total * stripeRate) + stripeFixed
    // Rearranging: total - (total * stripeRate) = subtotal + stripeFixed
    //              total * (1 - stripeRate) = subtotal + stripeFixed
    //              total = (subtotal + stripeFixed) / (1 - stripeRate)
    const stripeRate = config.stripePercentageBasisPoints / 10000
    const totalChargeCents = Math.ceil(
      (subtotalCents + config.stripeFixedCents) / (1 - stripeRate)
    )

    // Stripe fee is what they actually take from the total
    const stripeFeeCents = Math.round(totalChargeCents * stripeRate) + config.stripeFixedCents
    const organizerNetCents = registrationFeeCents // Organizer gets exactly what they set

    return {
      registrationFeeCents,
      platformFeeCents,
      stripeFeeCents,
      totalChargeCents,
      organizerNetCents,
      passedToCustomer: true
    }
  } else {
    // Organizer absorbs Stripe fees - deducted from total
    const totalChargeCents = subtotalCents
    const stripeFeeCents =
      Math.round(totalChargeCents * (config.stripePercentageBasisPoints / 10000)) +
      config.stripeFixedCents

    // Net received after Stripe takes their cut
    const netReceivedCents = totalChargeCents - stripeFeeCents
    const organizerNetCents = netReceivedCents - platformFeeCents

    return {
      registrationFeeCents,
      platformFeeCents,
      stripeFeeCents,
      totalChargeCents,
      organizerNetCents,
      passedToCustomer: false
    }
  }
}
```

**Example Usage**:
```typescript
// Example 1: Organizer absorbs Stripe fees (default)
const feesAbsorbed = calculateCompetitionFees(5000, {
  platformPercentageBasisPoints: 250,  // 2.5%
  platformFixedCents: 200,              // $2.00
  stripePercentageBasisPoints: 290,     // 2.9%
  stripeFixedCents: 30,                 // $0.30
  passStripeFeesToCustomer: false
})
// Result:
// {
//   registrationFeeCents: 5000,     // $50.00
//   platformFeeCents: 325,          // $3.25
//   stripeFeeCents: 184,            // $1.84
//   totalChargeCents: 5325,         // $53.25 (customer pays)
//   organizerNetCents: 4816,        // $48.16 (organizer receives)
//   passedToCustomer: false
// }

// Example 2: Customer pays Stripe fees (uses algebraic formula)
const feesPassed = calculateCompetitionFees(5000, {
  platformPercentageBasisPoints: 250,  // 2.5%
  platformFixedCents: 200,              // $2.00
  stripePercentageBasisPoints: 290,     // 2.9%
  stripeFixedCents: 30,                 // $0.30
  passStripeFeesToCustomer: true
})
// Result:
// {
//   registrationFeeCents: 5000,     // $50.00
//   platformFeeCents: 325,          // $3.25
//   stripeFeeCents: 190,            // $1.90 (corrected - Stripe takes 2.9% of $55.17 + $0.30)
//   totalChargeCents: 5517,         // $55.17 (corrected - solves: 5517 = 5325 + 0.029*5517 + 30)
//   organizerNetCents: 5000,        // $50.00 (organizer receives exactly registration fee)
//   passedToCustomer: true
// }
// Verification: 5517 - round(5517 * 0.029) - 30 = 5517 - 160 - 30 = 5327 ≈ 5325 (subtotal)
```

---

### 1.3 Registration Payment Flow

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ PAID COMPETITION REGISTRATION FLOW                           │
└─────────────────────────────────────────────────────────────┘

1. Athlete visits /compete/[slug]/register
   ↓
2. Selects division, enters details (team name, teammates for team divisions)
   ↓
3. Clicks "Register" → initiateRegistrationPayment()
   → Validates: auth, registration window, not already registered
   → If FREE ($0): Creates registration directly, returns success
   → If PAID: Creates commerce_purchase (PENDING), Stripe Checkout Session
   → Returns checkoutUrl for redirect
   ↓
4. Frontend: Redirects to Stripe Checkout (hosted page)
   → Athlete enters payment on Stripe's secure hosted page
   → Stripe handles card validation, 3D Secure, etc.
   ↓
5. Stripe Webhook: checkout.session.completed
   → Idempotency check (skip if already COMPLETED)
   → Marks commerce_purchase as COMPLETED
   → Calls registerForCompetition() with stored data
     → Creates team_membership
     → Creates athlete team (if team division)
     → Invites teammates (if team division)
     → Updates user sessions
   → Updates registration paymentStatus = 'PAID'
   → Sends confirmation email
   ↓
6. Stripe redirects to success URL
   → /compete/[slug]/register/success?session_id={CHECKOUT_SESSION_ID}

┌─────────────────────────────────────────────────────────────┐
│ FREE COMPETITION REGISTRATION FLOW                           │
└─────────────────────────────────────────────────────────────┘

1-2. Same as above
   ↓
3. Clicks "Register" → initiateRegistrationPayment()
   → Detects registrationFeeCents = 0
   → Calls registerForCompetition() directly
   → Sets paymentStatus = 'FREE'
   → Returns { isFree: true, registrationId }
   ↓
4. Frontend: Redirects to success page (no payment needed)

**Why Stripe Checkout instead of Stripe Elements?**
- Hosted by Stripe = less PCI compliance burden
- Handles 3D Secure, Apple Pay, Google Pay automatically
- Mobile-optimized out of the box
- Stripe handles all payment UI edge cases
```

#### Server Actions

**File**: `src/actions/commerce.action.ts`

Uses same pattern as `credits.action.ts` - plain async functions with `withRateLimit()`.

```typescript
"use server"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  commercePurchaseTable,
  commerceProductTable,
  competitionsTable,
  competitionRegistrationsTable,
} from "@/db/schema"
import { calculateCompetitionFees, PLATFORM_DEFAULTS } from "@/server/commerce/fee-calculator"
import { getStripe } from "@/lib/stripe"
import { requireVerifiedEmail } from "@/utils/auth"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

// Input type matching existing registration form data
type InitiateRegistrationPaymentInput = {
  competitionId: string
  divisionId: string
  // Team registration data (stored for webhook to use)
  teamName?: string
  affiliateName?: string
  teammates?: Array<{
    email: string
    firstName?: string
    lastName?: string
    affiliateName?: string
  }>
}

/**
 * Initiate payment for competition registration
 *
 * For FREE competitions ($0), creates registration directly.
 * For PAID competitions, creates pending purchase + PaymentIntent.
 * Registration is completed by webhook after payment succeeds.
 */
export async function initiateRegistrationPayment(input: InitiateRegistrationPaymentInput) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    const userId = session.user.id

    // 1. Get competition and validate
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    // 2. Validate registration window
    const now = new Date()
    if (competition.registrationOpensAt && new Date(competition.registrationOpensAt) > now) {
      throw new Error("Registration has not opened yet")
    }
    if (competition.registrationClosesAt && new Date(competition.registrationClosesAt) < now) {
      throw new Error("Registration has closed")
    }

    // 3. Check not already registered
    const existingRegistration = await db.query.competitionRegistrationsTable.findFirst({
      where: and(
        eq(competitionRegistrationsTable.eventId, input.competitionId),
        eq(competitionRegistrationsTable.userId, userId),
      ),
    })
    if (existingRegistration) {
      throw new Error("You are already registered for this competition")
    }

    // 4. Check for existing pending purchase (resume payment flow)
    const existingPurchase = await db.query.commercePurchaseTable.findFirst({
      where: and(
        eq(commercePurchaseTable.userId, userId),
        eq(commercePurchaseTable.competitionId, input.competitionId),
        eq(commercePurchaseTable.status, "PENDING"),
      ),
    })

    if (existingPurchase?.stripeCheckoutSessionId) {
      // Check if existing checkout session is still valid
      const checkoutSession = await getStripe().checkout.sessions.retrieve(
        existingPurchase.stripeCheckoutSessionId
      )
      // Return existing if not expired and not completed
      if (checkoutSession.status === "open") {
        return {
          purchaseId: existingPurchase.id,
          checkoutUrl: checkoutSession.url,
          totalCents: existingPurchase.totalCents,
          isFree: false,
        }
      }
      // Session expired or completed - create new one below
    }

    // 5. Get registration fee for this division
    const registrationFeeCents = await getRegistrationFee(input.competitionId, input.divisionId)

    // 6. FREE DIVISION - create registration directly
    if (registrationFeeCents === 0) {
      const { registerForCompetition } = await import("@/server/competitions")
      const result = await registerForCompetition({
        competitionId: input.competitionId,
        userId,
        divisionId: input.divisionId,
        teamName: input.teamName,
        affiliateName: input.affiliateName,
        teammates: input.teammates,
      })

      // Mark as free registration
      await db.update(competitionRegistrationsTable)
        .set({ paymentStatus: "FREE" })
        .where(eq(competitionRegistrationsTable.id, result.registrationId))

      return {
        purchaseId: null,
        clientSecret: null,
        totalCents: 0,
        isFree: true,
        registrationId: result.registrationId,
      }
    }

    // 7. PAID COMPETITION - calculate fees
    const feeBreakdown = calculateCompetitionFees(registrationFeeCents, {
      platformPercentageBasisPoints: competition.platformFeePercentage ?? PLATFORM_DEFAULTS.platformPercentageBasisPoints,
      platformFixedCents: competition.platformFeeFixed ?? PLATFORM_DEFAULTS.platformFixedCents,
      stripePercentageBasisPoints: PLATFORM_DEFAULTS.stripePercentageBasisPoints,
      stripeFixedCents: PLATFORM_DEFAULTS.stripeFixedCents,
      passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
    })

    // 8. Find or create product (idempotent)
    let product = await db.query.commerceProductTable.findFirst({
      where: and(
        eq(commerceProductTable.type, "COMPETITION_REGISTRATION"),
        eq(commerceProductTable.resourceId, input.competitionId),
      ),
    })

    if (!product) {
      const [newProduct] = await db.insert(commerceProductTable).values({
        name: `Competition Registration - ${competition.name}`,
        type: "COMPETITION_REGISTRATION",
        resourceId: input.competitionId,
        priceCents: registrationFeeCents,
      }).returning()
      product = newProduct
    }

    // 9. Create purchase record
    const [purchase] = await db.insert(commercePurchaseTable).values({
      userId,
      productId: product!.id,
      status: "PENDING",
      competitionId: input.competitionId,
      divisionId: input.divisionId,
      totalCents: feeBreakdown.totalChargeCents,
      platformFeeCents: feeBreakdown.platformFeeCents,
      stripeFeeCents: feeBreakdown.stripeFeeCents,
      organizerNetCents: feeBreakdown.organizerNetCents,
      // Store team data for webhook to use when creating registration
      metadata: JSON.stringify({
        teamName: input.teamName,
        affiliateName: input.affiliateName,
        teammates: input.teammates,
      }),
    }).returning()

    // 10. Get division label for checkout display
    const division = await db.query.scalingLevelsTable.findFirst({
      where: eq(scalingLevelsTable.id, input.divisionId),
    })

    // 11. Create Stripe Checkout Session
    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: feeBreakdown.totalChargeCents,
            product_data: {
              name: `${competition.name} Registration`,
              description: division?.label ?? "Competition Registration",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        purchaseId: purchase.id,
        userId,
        competitionId: input.competitionId,
        divisionId: input.divisionId,
        type: "COMPETITION_REGISTRATION",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/compete/${competition.slug}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/compete/${competition.slug}/register?canceled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      customer_email: session.user.email, // Pre-fill email
    })

    // 12. Update purchase with Checkout Session ID
    await db.update(commercePurchaseTable)
      .set({ stripeCheckoutSessionId: checkoutSession.id })
      .where(eq(commercePurchaseTable.id, purchase.id))

    return {
      purchaseId: purchase.id,
      checkoutUrl: checkoutSession.url,
      totalCents: feeBreakdown.totalChargeCents,
      isFree: false,
    }
  }, RATE_LIMITS.PURCHASE)
}

/**
 * Get fee breakdown for a specific division (for display before payment)
 */
export async function getRegistrationFeeBreakdown(competitionId: string, divisionId: string) {
  const db = getDb()

  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
  })
  if (!competition) throw new Error("Competition not found")

  // Get per-division fee (falls back to competition default)
  const registrationFeeCents = await getRegistrationFee(competitionId, divisionId)

  if (registrationFeeCents === 0) {
    return { isFree: true, totalCents: 0, registrationFeeCents: 0 }
  }

  return {
    isFree: false,
    registrationFeeCents,
    ...calculateCompetitionFees(registrationFeeCents, {
      platformPercentageBasisPoints: competition.platformFeePercentage ?? PLATFORM_DEFAULTS.platformPercentageBasisPoints,
      platformFixedCents: competition.platformFeeFixed ?? PLATFORM_DEFAULTS.platformFixedCents,
      stripePercentageBasisPoints: PLATFORM_DEFAULTS.stripePercentageBasisPoints,
      stripeFixedCents: PLATFORM_DEFAULTS.stripeFixedCents,
      passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
    }),
  }
}

/**
 * Get all division fees for a competition (for admin/display)
 */
export async function getCompetitionDivisionFees(competitionId: string) {
  const db = getDb()

  const fees = await db.query.competitionDivisionFeesTable.findMany({
    where: eq(competitionDivisionFeesTable.competitionId, competitionId),
    with: {
      division: true,
    },
  })

  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
  })

  return {
    defaultFeeCents: competition?.defaultRegistrationFeeCents ?? 0,
    divisionFees: fees.map(f => ({
      divisionId: f.divisionId,
      divisionLabel: f.division?.label,
      feeCents: f.feeCents,
    })),
  }
}
```

#### Webhook Handler

**File**: `src/app/api/webhooks/stripe/route.ts`

Uses `checkout.session.completed` event (not `payment_intent.succeeded`) since we're using Stripe Checkout.

```typescript
import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { and, eq } from "drizzle-orm"
import { getStripe } from "@/lib/stripe"
import { getDb } from "@/db"
import { commercePurchaseTable, competitionRegistrationsTable } from "@/db/schema"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    console.error("ERROR: [Webhook] Missing stripe-signature header")
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  // Step 1: Verify webhook signature
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("ERROR: [Webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Step 2: Process verified event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "checkout.session.expired":
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
        break

      default:
        console.log(`INFO: [Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("ERROR: [Webhook] Processing failed:", err)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = getDb()
  const purchaseId = session.metadata?.purchaseId
  const competitionId = session.metadata?.competitionId
  const divisionId = session.metadata?.divisionId
  const userId = session.metadata?.userId

  if (!purchaseId || !competitionId || !divisionId || !userId) {
    console.error("ERROR: [Webhook] Missing required metadata in Checkout Session")
    return
  }

  // IDEMPOTENCY CHECK 1: Get purchase and check status
  const existingPurchase = await db.query.commercePurchaseTable.findFirst({
    where: eq(commercePurchaseTable.id, purchaseId),
  })

  if (!existingPurchase) {
    console.error(`ERROR: [Webhook] Purchase not found: ${purchaseId}`)
    return
  }

  if (existingPurchase.status === "COMPLETED") {
    console.log(`INFO: [Webhook] Purchase ${purchaseId} already completed, skipping`)
    return
  }

  // IDEMPOTENCY CHECK 2: Check if registration already exists
  const existingRegistration = await db.query.competitionRegistrationsTable.findFirst({
    where: eq(competitionRegistrationsTable.commercePurchaseId, purchaseId),
  })

  if (existingRegistration) {
    console.log(`INFO: [Webhook] Registration for purchase ${purchaseId} already exists`)
    if (existingPurchase.status !== "COMPLETED") {
      await db.update(commercePurchaseTable)
        .set({ status: "COMPLETED", completedAt: new Date() })
        .where(eq(commercePurchaseTable.id, purchaseId))
    }
    return
  }

  // Parse stored registration data
  let registrationData: {
    teamName?: string
    affiliateName?: string
    teammates?: Array<{
      email: string
      firstName?: string
      lastName?: string
      affiliateName?: string
    }>
  } = {}

  if (existingPurchase.metadata) {
    try {
      registrationData = JSON.parse(existingPurchase.metadata)
    } catch {
      console.warn("WARN: [Webhook] Failed to parse purchase metadata")
    }
  }

  // Create registration using existing logic
  const { registerForCompetition } = await import("@/server/competitions")

  try {
    const result = await registerForCompetition({
      competitionId,
      userId,
      divisionId,
      teamName: registrationData.teamName,
      affiliateName: registrationData.affiliateName,
      teammates: registrationData.teammates,
    })

    // Update registration with payment info
    await db.update(competitionRegistrationsTable)
      .set({
        commercePurchaseId: purchaseId,
        paymentStatus: "PAID",
        paidAt: new Date(),
      })
      .where(eq(competitionRegistrationsTable.id, result.registrationId))

    // Mark purchase as completed
    await db.update(commercePurchaseTable)
      .set({
        status: "COMPLETED",
        stripePaymentIntentId: session.payment_intent as string,
        completedAt: new Date(),
      })
      .where(eq(commercePurchaseTable.id, purchaseId))

    console.log(`INFO: [Webhook] Registration created: ${result.registrationId}`)

    // TODO: Send confirmation email

  } catch (err) {
    console.error(`ERROR: [Webhook] Failed to create registration:`, err)
    await db.update(commercePurchaseTable)
      .set({ status: "FAILED" })
      .where(eq(commercePurchaseTable.id, purchaseId))
    throw err
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const db = getDb()
  const purchaseId = session.metadata?.purchaseId

  if (!purchaseId) return

  // Mark purchase as expired/cancelled
  await db.update(commercePurchaseTable)
    .set({ status: "CANCELLED" })
    .where(
      and(
        eq(commercePurchaseTable.id, purchaseId),
        eq(commercePurchaseTable.status, "PENDING")
      )
    )

  console.log(`INFO: [Webhook] Checkout expired for purchase: ${purchaseId}`)
}
```

**Idempotency Notes**:
- Stripe can deliver webhooks multiple times due to network issues or retries
- We check purchase status AND registration existence before processing
- Use conditional updates (`WHERE status = 'PENDING'`) as safeguard
- Always acknowledge webhooks (return 200) even for duplicates
- Re-throw errors for transient failures so Stripe retries

---

### 1.4 Frontend Integration

**Integration Strategy**: Modify the existing `RegistrationForm` component to add a payment step after form validation, rather than creating a separate payment form.

#### Modified Registration Flow

1. User fills out existing form (division, team name, teammates)
2. Clicks "Register" → validates form → calls `initiateRegistrationPayment()`
3. If FREE: Redirects to success immediately
4. If PAID: Redirects to Stripe Checkout (hosted payment page)
5. Stripe redirects back to success URL after payment

#### Update Existing Registration Form

**File**: `src/app/(compete)/compete/[slug]/register/_components/registration-form.tsx`

With Stripe Checkout, the frontend is simpler - just redirect to the checkout URL:

```typescript
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { initiateRegistrationPayment, getRegistrationFeeBreakdown } from "@/actions/commerce.action"
// ... existing imports (NO Stripe Elements needed!)

export function RegistrationForm({
  competition,
  scalingGroup,
  userId,
  registrationOpen,
  registrationOpensAt,
  registrationClosesAt,
}: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ... existing form setup with react-hook-form

  const onSubmit = async (data: FormValues) => {
    // ... existing validation

    setIsSubmitting(true)

    try {
      const result = await initiateRegistrationPayment({
        competitionId: competition.id,
        divisionId: data.divisionId,
        teamName: isTeamDivision ? data.teamName : undefined,
        affiliateName: data.affiliateName || undefined,
        teammates: isTeamDivision ? data.teammates : undefined,
      })

      // FREE registration - redirect to success
      if (result.isFree) {
        toast.success("Successfully registered!")
        router.push(`/compete/${competition.slug}`)
        return
      }

      // PAID registration - redirect to Stripe Checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }

      throw new Error("Failed to create checkout session")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed")
      setIsSubmitting(false)
    }
  }

  // Watch selected division for fee display
  const selectedDivisionId = form.watch("divisionId")

  return (
    <div className="space-y-6">
      {/* Fee display card - updates when division changes */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Fee</CardTitle>
        </CardHeader>
        <CardContent>
          <FeeBreakdownDisplay
            competitionId={competition.id}
            divisionId={selectedDivisionId || null}
          />
        </CardContent>
      </Card>

      {/* ... rest of existing form (division selector, team fields, etc.) */}

      {/* Submit button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Processing..." : "Register"}
      </Button>
    </div>
  )
}

// Fee breakdown display component - updates when division changes
function FeeBreakdownDisplay({
  competitionId,
  divisionId,
}: {
  competitionId: string
  divisionId: string | null
}) {
  const [fees, setFees] = useState<{
    isFree: boolean
    registrationFeeCents?: number
    platformFeeCents?: number
    totalChargeCents?: number
  } | null>(null)

  useEffect(() => {
    if (!divisionId) {
      setFees(null)
      return
    }
    getRegistrationFeeBreakdown(competitionId, divisionId).then(setFees)
  }, [competitionId, divisionId])

  if (!divisionId) {
    return <p className="text-muted-foreground text-sm">Select a division to see pricing</p>
  }

  if (!fees) return <Skeleton className="h-20" />
  if (fees.isFree) return <p className="text-green-600 font-medium">Free Registration</p>

  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span>Registration Fee</span>
        <span>${((fees.registrationFeeCents ?? 0) / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Platform Fee</span>
        <span>${((fees.platformFeeCents ?? 0) / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-medium pt-1 border-t">
        <span>Total</span>
        <span>${((fees.totalChargeCents ?? 0) / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}
```

#### Success Page

**File**: `src/app/(compete)/compete/[slug]/register/success/page.tsx`

```typescript
import { redirect } from "next/navigation"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserCompetitionRegistration } from "@/server/competitions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function RegistrationSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await getSessionFromCookie()

  if (!session) {
    redirect(`/sign-in?redirect=/compete/${slug}`)
  }

  // Verify registration exists
  const { getCompetition } = await import("@/server/competitions")
  const competition = await getCompetition(slug)

  if (!competition) {
    redirect("/compete")
  }

  const registration = await getUserCompetitionRegistration(competition.id, session.userId)

  if (!registration) {
    // Payment may still be processing - show pending state
    return (
      <div className="mx-auto max-w-lg py-12">
        <Card>
          <CardContent className="pt-6 text-center">
            <p>Processing your registration...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a few moments. You&apos;ll receive a confirmation email shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      <Card>
        <CardHeader className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Registration Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p>You&apos;re registered for <strong>{competition.name}</strong></p>

          <div className="pt-4">
            <Button asChild>
              <Link href={`/compete/${slug}`}>View Competition</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

### 1.5 Organizer Commerce Configuration

Organizers need a UI to configure registration fees for their competition. This lives in the competition admin area.

#### Routes

```
/compete/organizer/[slug]/settings/registration
  └── Registration fee configuration
      ├── Default fee (applies to divisions without specific fee)
      ├── Per-division fee overrides
      └── Fee handling options (who pays Stripe fees)
```

#### Page Component

**File**: `src/app/(compete)/compete/organizer/[slug]/settings/registration/page.tsx`

```typescript
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { getCompetitionDivisionFees } from "@/actions/commerce.action"
import { RegistrationFeeSettings } from "./_components/registration-fee-settings"
import { requireTeamPermission } from "@/utils/team-auth"

export default async function RegistrationSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const competition = await getCompetition(slug)

  if (!competition) notFound()

  // Verify organizer has permission
  await requireTeamPermission(competition.organizingTeamId, "MANAGE_COMPETITIONS")

  // Get current fee configuration
  const feeConfig = await getCompetitionDivisionFees(competition.id)

  // Get divisions from competition's scaling group
  const divisions = await getDivisionsForCompetition(competition.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registration Settings</h1>
        <p className="text-muted-foreground">
          Configure registration fees for {competition.name}
        </p>
      </div>

      <RegistrationFeeSettings
        competition={competition}
        divisions={divisions}
        currentFees={feeConfig}
      />
    </div>
  )
}
```

#### Settings Component

**File**: `src/app/(compete)/compete/organizer/[slug]/settings/registration/_components/registration-fee-settings.tsx`

```typescript
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  updateCompetitionFeeConfig,
  updateDivisionFee,
} from "@/actions/commerce.action"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Users, User } from "lucide-react"

const feeSchema = z.object({
  defaultFeeDollars: z.string().regex(/^\d+(\.\d{0,2})?$/, "Invalid amount"),
  passStripeFeesToCustomer: z.boolean(),
})

type Props = {
  competition: Competition
  divisions: Array<{ id: string; label: string; teamSize: number }>
  currentFees: {
    defaultFeeCents: number
    divisionFees: Array<{ divisionId: string; divisionLabel: string; feeCents: number }>
  }
}

export function RegistrationFeeSettings({ competition, divisions, currentFees }: Props) {
  const [divisionFees, setDivisionFees] = useState<Record<string, string>>(
    Object.fromEntries(
      currentFees.divisionFees.map((f) => [f.divisionId, (f.feeCents / 100).toFixed(2)])
    )
  )

  const form = useForm({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      defaultFeeDollars: (currentFees.defaultFeeCents / 100).toFixed(2),
      passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
    },
  })

  const onSubmitGlobal = async (data: z.infer<typeof feeSchema>) => {
    try {
      await updateCompetitionFeeConfig({
        competitionId: competition.id,
        defaultRegistrationFeeCents: Math.round(parseFloat(data.defaultFeeDollars) * 100),
        passStripeFeesToCustomer: data.passStripeFeesToCustomer,
      })
      toast.success("Fee settings updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  const handleDivisionFeeChange = async (divisionId: string, dollarAmount: string) => {
    setDivisionFees((prev) => ({ ...prev, [divisionId]: dollarAmount }))
  }

  const saveDivisionFee = async (divisionId: string) => {
    const amount = divisionFees[divisionId]
    if (!amount) return

    try {
      const cents = Math.round(parseFloat(amount) * 100)
      await updateDivisionFee({
        competitionId: competition.id,
        divisionId,
        feeCents: cents,
      })
      toast.success("Division fee updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  const removeDivisionFee = async (divisionId: string) => {
    try {
      await updateDivisionFee({
        competitionId: competition.id,
        divisionId,
        feeCents: null, // Remove override, use default
      })
      setDivisionFees((prev) => {
        const next = { ...prev }
        delete next[divisionId]
        return next
      })
      toast.success("Division fee removed - will use default")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove")
    }
  }

  return (
    <div className="space-y-6">
      {/* Global Fee Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Default Registration Fee</CardTitle>
          <CardDescription>
            This fee applies to all divisions unless overridden below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmitGlobal)} className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                {...form.register("defaultFeeDollars")}
                placeholder="0.00"
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">USD</span>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="passStripeFeesToCustomer"
                checked={form.watch("passStripeFeesToCustomer")}
                onCheckedChange={(checked) =>
                  form.setValue("passStripeFeesToCustomer", checked)
                }
              />
              <Label htmlFor="passStripeFeesToCustomer">
                Pass processing fees to customer
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              If enabled, Stripe's 2.9% + $0.30 processing fee is added to the registration total.
              Otherwise, it's deducted from your payout.
            </p>

            <Button type="submit">Save Default Settings</Button>
          </form>
        </CardContent>
      </Card>

      {/* Per-Division Fees */}
      <Card>
        <CardHeader>
          <CardTitle>Division-Specific Fees</CardTitle>
          <CardDescription>
            Override the default fee for specific divisions (e.g., charge more for team divisions)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {divisions.map((division) => {
              const hasOverride = divisionFees[division.id] !== undefined
              const isTeam = division.teamSize > 1

              return (
                <div
                  key={division.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {isTeam ? (
                      <Users className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{division.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {isTeam ? `Team of ${division.teamSize}` : "Individual"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasOverride ? (
                      <>
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <Input
                          value={divisionFees[division.id]}
                          onChange={(e) =>
                            handleDivisionFeeChange(division.id, e.target.value)
                          }
                          onBlur={() => saveDivisionFee(division.id)}
                          className="w-24"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDivisionFee(division.id)}
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline">Uses default</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDivisionFeeChange(
                              division.id,
                              form.getValues("defaultFeeDollars")
                            )
                          }
                        >
                          Set custom fee
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fee Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Preview</CardTitle>
          <CardDescription>What athletes will see at checkout</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {divisions.map((division) => {
              const feeDollars = divisionFees[division.id]
                ?? form.getValues("defaultFeeDollars")
              const feeCents = Math.round(parseFloat(feeDollars || "0") * 100)

              if (feeCents === 0) {
                return (
                  <div key={division.id} className="flex justify-between">
                    <span>{division.label}</span>
                    <span className="text-green-600">Free</span>
                  </div>
                )
              }

              // Calculate with platform fee (simplified preview)
              const platformFee = Math.round(feeCents * 0.025) + 200 // 2.5% + $2
              const total = feeCents + platformFee

              return (
                <div key={division.id} className="flex justify-between">
                  <span>{division.label}</span>
                  <span>${(total / 100).toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### Server Actions for Fee Management

**Add to**: `src/actions/commerce.action.ts`

```typescript
/**
 * Update competition-level fee configuration
 */
export async function updateCompetitionFeeConfig(input: {
  competitionId: string
  defaultRegistrationFeeCents?: number
  platformFeePercentage?: number
  platformFeeFixed?: number
  passStripeFeesToCustomer?: boolean
}) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    // Verify user has permission to manage this competition
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(competition.organizingTeamId, "MANAGE_COMPETITIONS")

    // Update competition
    await db.update(competitionsTable)
      .set({
        defaultRegistrationFeeCents: input.defaultRegistrationFeeCents,
        platformFeePercentage: input.platformFeePercentage,
        platformFeeFixed: input.platformFeeFixed,
        passStripeFeesToCustomer: input.passStripeFeesToCustomer,
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, input.competitionId))

    return { success: true }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Update or remove a division-specific fee
 */
export async function updateDivisionFee(input: {
  competitionId: string
  divisionId: string
  feeCents: number | null // null = remove override
}) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    // Verify permission
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(competition.organizingTeamId, "MANAGE_COMPETITIONS")

    if (input.feeCents === null) {
      // Remove override
      await db.delete(competitionDivisionFeesTable)
        .where(
          and(
            eq(competitionDivisionFeesTable.competitionId, input.competitionId),
            eq(competitionDivisionFeesTable.divisionId, input.divisionId),
          )
        )
    } else {
      // Upsert fee
      const existing = await db.query.competitionDivisionFeesTable.findFirst({
        where: and(
          eq(competitionDivisionFeesTable.competitionId, input.competitionId),
          eq(competitionDivisionFeesTable.divisionId, input.divisionId),
        ),
      })

      if (existing) {
        await db.update(competitionDivisionFeesTable)
          .set({ feeCents: input.feeCents, updatedAt: new Date() })
          .where(eq(competitionDivisionFeesTable.id, existing.id))
      } else {
        await db.insert(competitionDivisionFeesTable).values({
          competitionId: input.competitionId,
          divisionId: input.divisionId,
          feeCents: input.feeCents,
        })
      }
    }

    return { success: true }
  }, RATE_LIMITS.DEFAULT)
}
```

#### Navigation

Add link to competition admin sidebar:

```typescript
// In competition organizer layout/sidebar
{
  label: "Registration",
  href: `/compete/organizer/${slug}/settings/registration`,
  icon: DollarSign,
}
```

---

### 1.6 Environment Configuration

**`.env` additions**:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Get from Stripe Dashboard
```

**`wrangler.jsonc` additions**:
```jsonc
{
  "vars": {
    // ... existing vars
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_xxxxx"
  },
  "secret": {
    // ... existing secrets
    "STRIPE_SECRET_KEY": "sk_test_xxxxx",
    "STRIPE_WEBHOOK_SECRET": "whsec_xxxxx"
  }
}
```

---

### 1.6 Testing Strategy

#### Local Webhook Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
```

#### Test Cards (Stripe Test Mode)

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires authentication: 4000 0025 0000 3155
```

#### Test Checklist

**Free Competition Flow**:
- [ ] Free competition ($0 fee) → registration created directly
- [ ] Free competition → paymentStatus = 'FREE'
- [ ] Free competition → no Stripe interaction

**Paid Competition Flow**:
- [ ] Paid competition → PaymentIntent created
- [ ] Payment success webhook → Purchase marked COMPLETED
- [ ] Payment success webhook → Registration created via `registerForCompetition()`
- [ ] Payment success webhook → paymentStatus = 'PAID'
- [ ] Payment failed → Purchase marked FAILED
- [ ] Webhook signature verification works

**Team Registration**:
- [ ] Team registration → team data stored in purchase metadata
- [ ] Team registration → webhook creates athlete team and invites teammates
- [ ] Captain pays for entire team

**Fee Calculations**:
- [ ] Fee calculations accurate for various amounts
- [ ] "Organizer absorbs" fees calculate correctly
- [ ] "Pass to customer" fees calculate correctly (algebraic formula)
- [ ] Fee breakdown displays correctly in UI

**Admin Fee Configuration**:
- [ ] Organizer can set default registration fee
- [ ] Organizer can set per-division fee overrides
- [ ] Organizer can toggle "pass fees to customer"
- [ ] Fee preview shows accurate athlete totals
- [ ] Permission check prevents unauthorized access

**Edge Cases**:
- [ ] User already registered → error before payment
- [ ] Registration window closed → error before payment
- [ ] Duplicate webhook delivery → idempotent (no duplicate registration)
- [ ] Resume abandoned payment → existing PaymentIntent returned
- [ ] Per-division pricing displays correctly when switching divisions

---

## Phase 2 Implementation (Future)

### 2.1 Stripe Connect Onboarding Flow

```typescript
// src/actions/stripe-connect.action.ts
export const createConnectedAccountAction = createServerAction()
  .handler(async () => {
    const { user } = await getSessionFromCookie()
    const team = await getCurrentTeam()

    // Create Express Connected Account
    const account = await getStripe().accounts.create({
      type: 'express',
      country: 'US',
      email: user.email,
      capabilities: {
        transfers: { requested: true }
      },
      business_type: 'individual',
      metadata: {
        teamId: team.id,
        teamName: team.name
      }
    })

    // Save to database
    await db.update(teamsTable)
      .set({
        stripeConnectedAccountId: account.id,
        stripeAccountStatus: 'PENDING'
      })
      .where(eq(teamsTable.id, team.id))

    // Create account link for onboarding
    const accountLink = await getStripe().accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/compete/organizer/stripe/onboard`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/compete/organizer/stripe/complete`,
      type: 'account_onboarding'
    })

    return { url: accountLink.url }
  })
```

### 2.2 Multi-Party Payment Update

```typescript
// Update createCompetitionPurchaseAction to use connected accounts
const paymentIntent = await getStripe().paymentIntents.create({
  amount: feeBreakdown.totalChargeCents,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  application_fee_amount: feeBreakdown.platformFeeCents, // Wodsmith keeps this
  transfer_data: {
    destination: organizingTeam.stripeConnectedAccountId // Organizer gets rest
  },
  metadata: {
    purchaseId: purchase.id,
    competitionId: input.competitionId
  }
})
```

### 2.3 Payout Tracking & Reporting

```typescript
// Track transfers for reporting purposes
// Note: Transfers happen automatically via Stripe Connect
// This is just for internal tracking and organizer dashboards

interface PayoutRecord {
  transferId: string
  competitionId: string
  organizingTeamId: string
  registrationId: string
  amountCents: number
  platformFeeCents: number
  status: 'pending' | 'paid' | 'failed'
  createdAt: Date
}

// Webhook handler for transfer events
async function handleTransferPaid(transfer: Stripe.Transfer) {
  // Update payout record status
  await db.update(commercePayoutsTable)
    .set({
      status: 'paid',
      paidAt: new Date()
    })
    .where(eq(commercePayoutsTable.stripeTransferId, transfer.id))

  // Update organizer's revenue dashboard
}
```

---

## Migration Plan

### Step 1: Generate Migration

```bash
pnpm db:generate add-commerce-schema
```

### Step 2: Review Generated SQL

Check `src/db/migrations/` for new migration file, verify:
- All tables created with correct columns
- Foreign keys established
- Indexes on frequently queried columns (userId, productId, status)

### Step 3: Apply to Local Database

```bash
pnpm db:migrate:dev
```

### Step 4: Seed Initial Fee Configuration

```typescript
// src/db/seed-commerce.ts
await db.insert(commercePlatformFeeTable).values([
  {
    name: 'Wodsmith Platform Fee',
    type: 'PLATFORM',
    percentageBasisPoints: 250,  // 2.5%
    fixedCents: 200,              // $2.00
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Stripe Processing Fee',
    type: 'STRIPE',
    percentageBasisPoints: 290,  // 2.9%
    fixedCents: 30,               // $0.30
    isActive: true,
    createdAt: new Date()
  }
])
```

### Step 5: Test Locally

- Run full payment flow with Stripe test mode
- Verify webhook handling
- Check database records

### Step 6: Deploy to Production

```bash
# Apply migration
pnpm db:migrate:prod

# Deploy application
pnpm deploy:prod

# Configure Stripe webhook in dashboard
# Point to: https://wodsmith.com/api/webhooks/stripe
```

---

## Files Overview

### New Files (Phase 1)

```
src/
├── db/schemas/
│   └── commerce.ts                          # Commerce tables (product, purchase, division_fees)
├── server/commerce/
│   └── fee-calculator.ts                    # Fee computation + getRegistrationFee()
├── actions/
│   └── commerce.action.ts                   # Server actions (initiateRegistrationPayment, etc.)
├── app/api/webhooks/stripe/
│   └── route.ts                             # Stripe webhook handler
├── app/(compete)/compete/[slug]/register/
│   └── success/
│       └── page.tsx                         # Payment success page
└── app/(compete)/compete/organizer/[slug]/settings/registration/
    ├── page.tsx                             # Organizer fee configuration page
    └── _components/
        └── registration-fee-settings.tsx   # Fee config UI component

docs/features/
└── commerce-implementation-plan.md          # This document
```

### Modified Files (Phase 1)

```
src/
├── db/
│   ├── schema.ts                            # Export commerce tables
│   └── schemas/
│       ├── common.ts                        # Add commerce ID generators
│       ├── competitions.ts                  # Add registrationFeeCents, fee config fields
│       └── teams.ts                         # Add Stripe Connect fields (Phase 2 prep)
├── app/(compete)/compete/[slug]/register/
│   ├── page.tsx                             # No changes needed
│   └── _components/
│       └── registration-form.tsx            # Add checkout redirect, fee display
├── lib/
│   └── stripe.ts                            # Already exists (verify)
└── utils/
    └── with-rate-limit.ts                   # Already exists (verify RATE_LIMITS.PURCHASE)

Root:
├── .env                                      # Add STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
├── wrangler.jsonc                           # Add webhook secret binding
└── package.json                             # No new deps! (stripe already installed for server)
```

---

## Success Criteria

### Phase 1 Completion Checklist

- [ ] **Database Schema**
  - [ ] `commerce_product` table created with unique index on (type, resourceId)
  - [ ] `commerce_purchase` table created with proper indexes
  - [ ] ID generators added to `common.ts` (`createCommerceProductId`, `createCommercePurchaseId`)
  - [ ] Drizzle relations defined for commerce tables
  - [ ] Fee fields added to `competitions` table (`registrationFeeCents`, `platformFeePercentage`, `passStripeFeesToCustomer`)
  - [ ] Payment fields added to `competition_registrations` table (`commercePurchaseId`, `paymentStatus`, `paidAt`)
  - [ ] Migration applied to dev and prod databases

- [ ] **Fee Calculation**
  - [ ] Fee calculator function implemented with `PLATFORM_DEFAULTS` export
  - [ ] Algebraic formula for "pass to customer" scenario verified
  - [ ] Both fee scenarios working (organizer absorbs vs customer pays)
  - [ ] Unit tests for various amounts and edge cases

- [ ] **Payment Flow**
  - [ ] `initiateRegistrationPayment` action implemented
  - [ ] Free competitions ($0) skip payment and create registration directly
  - [ ] Paid competitions create purchase + PaymentIntent
  - [ ] Existing pending purchase is resumed (idempotent)
  - [ ] Frontend payment step integrated into existing RegistrationForm

- [ ] **Webhook Handling**
  - [ ] Webhook endpoint at `/api/webhooks/stripe`
  - [ ] Separate signature verification vs processing error handling
  - [ ] Proper TypeScript types (no `any`)
  - [ ] Idempotency checks at purchase AND registration level
  - [ ] Uses `registerForCompetition()` for full registration logic
  - [ ] Team registration data passed through from purchase metadata

- [ ] **Registration Integration**
  - [ ] Existing `registerForCompetition()` reused (team membership, athlete team, invites)
  - [ ] `paymentStatus` field set correctly ('FREE', 'PENDING_PAYMENT', 'PAID')
  - [ ] `commercePurchaseId` linked correctly
  - [ ] Sessions updated after registration

- [ ] **Organizer Fee Configuration**
  - [ ] Registration settings page at `/compete/organizer/[slug]/settings/registration`
  - [ ] Default fee configuration works
  - [ ] Per-division fee overrides work
  - [ ] "Pass fees to customer" toggle works
  - [ ] Fee preview shows accurate totals
  - [ ] Permission check prevents unauthorized access

- [ ] **Testing**
  - [ ] Free competition flow tested
  - [ ] Paid competition flow tested (individual and team)
  - [ ] Per-division pricing tested
  - [ ] Duplicate webhook delivery handled (idempotent)
  - [ ] Resume abandoned payment tested
  - [ ] Local webhook testing with Stripe CLI successful

- [ ] **Documentation**
  - [ ] Implementation plan documented (this file)
  - [ ] Code comments added to complex logic

---

## Risk Mitigation

### Potential Issues & Solutions

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Webhook failures** | Payments succeed but registrations not created | Implement retry logic, manual reconciliation tool, monitor webhook delivery in Stripe dashboard |
| **Fee calculation errors** | Incorrect charges or revenue splits | Comprehensive unit tests, validation against Stripe's fee calculator, logging of all calculations |
| **Duplicate purchases** | User creates multiple purchases for same registration | Add unique constraint on (userId, competitionId, divisionId) in registrations table |
| **Stripe API changes** | Breaking changes to PaymentIntent API | Pin Stripe API version (currently 2025-02-24.acacia), monitor Stripe changelog |
| **Payment fraud** | Stolen credit cards used for registrations | Enable Stripe Radar (fraud detection), require email verification, monitor chargeback rate |
| **D1 database limits** | High traffic during registration opens | Implement queueing for webhook processing, use Cloudflare Durable Objects for critical transactions |

---

## Monitoring & Observability

### Key Metrics to Track

1. **Payment Success Rate**
   - Target: >95%
   - Alert if drops below 90%

2. **Webhook Processing Time**
   - Target: <2 seconds
   - Alert if exceeds 5 seconds

3. **Revenue Accuracy**
   - Daily reconciliation: Stripe revenue vs database records
   - Alert on any discrepancies

4. **Failed Payments**
   - Monitor `payment_intent.payment_failed` events
   - Track decline codes for insights

### Logging Strategy

```typescript
// Add structured logging to all commerce operations
import { logger } from '@/utils/logger'

logger.info('Purchase created', {
  purchaseId: purchase.id,
  competitionId: competition.id,
  amountCents: fees.totalChargeCents,
  platformFeeCents: fees.platformFeeCents
})

logger.error('Payment failed', {
  purchaseId: purchase.id,
  stripePaymentIntentId: paymentIntent.id,
  errorCode: error.code,
  errorMessage: error.message
})
```

---

## Future Considerations

### Potential Enhancements Beyond Phase 3

1. **International Payments**
   - Multi-currency support
   - Dynamic fee calculations based on country
   - Compliance with regional payment regulations

2. **Subscription Model**
   - Recurring payments for gym memberships
   - Competition series passes
   - Early bird pricing with automatic billing

3. **Installment Plans**
   - Split payment for expensive competitions
   - Integration with Affirm/Klarna for financing

4. **Team Registrations**
   - Bulk registration discounts
   - Shared payment splitting
   - Team captain payment coordination

5. **Promo Codes & Discounts**
   - Percentage or fixed amount discounts
   - Limited-time promotional pricing
   - Referral program integration

6. **Advanced Analytics**
   - Revenue forecasting
   - Registration conversion funnels
   - Pricing optimization recommendations

---

## Appendix

### A. Stripe Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [PaymentIntents API](https://stripe.com/docs/api/payment_intents)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)

### B. Fee Calculation Examples

**Scenario 1: Organizer Absorbs Stripe Fees** (default)

| Registration Fee | Platform Fee | Total Charged | Stripe Deducts | Net Received | Wodsmith Keeps | Organizer Gets |
|------------------|--------------|---------------|----------------|--------------|----------------|----------------|
| $25.00 | $2.63 | $27.63 | $1.10 | $26.53 | $2.63 | $23.90 |
| $50.00 | $3.25 | $53.25 | $1.84 | $51.41 | $3.25 | $48.16 |
| $100.00 | $4.50 | $104.50 | $3.33 | $101.17 | $4.50 | $96.67 |
| $200.00 | $7.00 | $207.00 | $6.30 | $200.70 | $7.00 | $193.70 |

**Scenario 2: Customer Pays Stripe Fees** (optional per competition)

*Uses algebraic formula: `total = (subtotal + stripeFixed) / (1 - stripeRate)`*

| Registration Fee | Platform Fee | Stripe Fee | Total Charged | Wodsmith Keeps | Organizer Gets |
|------------------|--------------|------------|---------------|----------------|----------------|
| $25.00 | $2.63 | $1.13 | $28.76 | $2.63 | $25.00 |
| $50.00 | $3.25 | $1.90 | $55.15 | $3.25 | $50.00 |
| $100.00 | $4.50 | $3.43 | $107.93 | $4.50 | $100.00 |
| $200.00 | $7.00 | $6.49 | $213.49 | $7.00 | $200.00 |

*Note: In Scenario 2, organizer receives exactly the registration fee they set. The Stripe fee is calculated to ensure that after Stripe deducts their percentage from the total, the remaining amount covers both the subtotal and the fixed Stripe fee.*

### C. Database ERD

```
┌──────────────────┐         ┌──────────────────┐
│  competitions    │         │  commerce_product│
│                  │         │                  │
│  id (PK)        │◄────────┤  resourceId (FK) │
│  name            │         │  id (PK)         │
│  registrationFee │         │  name            │
│  platformFee%   │         │  type            │
│  platformFeeFixed│         │  priceCents      │
└──────────────────┘         └──────────────────┘
                                      │
                                      │
                                      ▼
┌──────────────────┐         ┌──────────────────┐
│  users           │         │ commerce_purchase│
│                  │         │                  │
│  id (PK)        │◄────────┤  userId (FK)     │
└──────────────────┘         │  productId (FK)  │──┐
                             │  status          │  │
                             │  totalCents      │  │
                             │  platformFeeCents│  │
                             │  stripeFeeCents  │  │
                             │  stripePaymentId │  │
                             └──────────────────┘  │
                                      │            │
                                      ▼            │
                             ┌──────────────────┐  │
                             │ competition_reg  │  │
                             │                  │  │
                             │  id (PK)         │  │
                             │  userId (FK)     │  │
                             │  competitionId(FK)│ │
                             │  purchaseId (FK)◄┘──┘
                             │  isPaid          │
                             │  paidAt          │
                             └──────────────────┘
```

---

## Changes from Review (2025-01-28)

### Issues Addressed from `commerce-plan-review.md`:

| Issue | Resolution |
|-------|------------|
| **Server action pattern mismatch** | Changed from `createServerAction()` to plain async functions with `withRateLimit()` matching `credits.action.ts` |
| **Missing webhook idempotency** | Added dual idempotency checks (purchase status + registration existence) |
| **Missing common columns/ID generators** | Added `createCommerceProductId`, `createCommercePurchaseId` to schema |
| **Missing Drizzle relations** | Added `commerceProductRelations`, `commercePurchaseRelations` |
| **Missing divisionId as column** | Added `competitionId` and `divisionId` as proper columns on `commerce_purchase` |
| **Product deduplication issue** | Changed to find-or-create pattern with unique index |
| **Missing Stripe signature error handling** | Separated signature verification from processing errors with proper HTTP status codes |
| **Frontend error handling** | Added proper error state and user-friendly messages |
| **TypeScript `any` types** | Changed webhook handler to use `Stripe.PaymentIntent` type |

### Additional Improvements:

| Enhancement | Description |
|-------------|-------------|
| **Stripe Checkout** | Using hosted Stripe Checkout page instead of Stripe Elements - simpler, handles 3DS/Apple Pay automatically |
| **Organizer fee configuration** | Organizer UI at `/compete/organizer/[slug]/settings/registration` for setting fees |
| **Per-division pricing** | `competition_division_fees` table allows different fees per division (e.g., $200 Individual, $350 Team) |
| **Fee resolution logic** | Division fee → competition default → $0 (free) |
| **Free competition support** | $0 fee skips payment flow |
| **Team registration payment** | Captain pays for entire team; team data stored in metadata for webhook |
| **Two-phase registration** | Payment creates purchase first; webhook calls `registerForCompetition()` |
| **Resume abandoned checkout** | Existing pending checkouts are returned if still open |
| **Checkout expiration handling** | Webhook handles `checkout.session.expired` to mark purchases as CANCELLED |
| **Dynamic fee display** | Fee breakdown updates when user selects different division |
| **No frontend Stripe deps** | No @stripe/react-stripe-js needed - just redirect to checkout URL |

---

**Document Version**: 2.3
**Last Updated**: 2025-01-28
**Changes**:
- v2.3: Switched from Stripe Elements to Stripe Checkout (hosted page)
- v2.2: Added organizer fee configuration UI (section 1.5)
- v2.1: Added per-division pricing support
- v2.0: Initial review fixes
**Next Review**: After Phase 1 completion
