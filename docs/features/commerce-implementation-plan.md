# Stripe Commerce Implementation Plan

**Last Updated**: 2025-01-24
**Status**: Planning
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
- **Refund Policy**: No refunds (MVP simplification)
- **Future Capability**: Stripe Connect payouts to organizers

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

- Refund workflow (if policy changes)
- Advanced revenue analytics for organizers
- Financial reconciliation tools
- Tax reporting (1099-K generation)
- Dispute handling
- Partial refunds with fee retention
- Payout history export (CSV/PDF)

---

## Phase 1 Detailed Implementation

### 1.1 Database Schema

#### New Tables

**`commerce_product`** - Purchasable products (competition registrations)

```typescript
{
  id: string (CUID2)
  name: string // "Competition Registration - [Event Name]"
  type: 'COMPETITION_REGISTRATION' | 'ADDON' // Extensible for future products
  resourceId: string // competitionId
  priceCents: integer // Base registration fee
  createdAt: timestamp
}
```

**`commerce_purchase`** - Purchase transaction records

```typescript
{
  id: string (CUID2)
  userId: string (FK → user.id)
  productId: string (FK → commerce_product.id)
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

  // Amounts (all in cents)
  totalCents: integer // Amount charged to customer
  platformFeeCents: integer // Wodsmith revenue
  stripeFeeCents: integer // Stripe's fee
  organizerNetCents: integer // What organizer receives

  // Stripe references
  stripePaymentIntentId: string
  stripeChargeId: string // Set after payment succeeds

  // Extensibility
  metadata: json // Store additional context

  createdAt: timestamp
  completedAt: timestamp
}
```

**`commerce_platform_fee`** - Fee configuration management

```typescript
{
  id: string (CUID2)
  name: string // "Wodsmith Platform Fee", "Stripe Processing Fee"
  type: 'PLATFORM' | 'STRIPE'
  percentageBasisPoints: integer // 250 = 2.5%, 290 = 2.9%
  fixedCents: integer // 200 = $2.00, 30 = $0.30
  isActive: boolean // Allow fee updates without deleting history
  createdAt: timestamp
}
```

#### Schema Additions to Existing Tables

**`competitions` table**:
```typescript
{
  // ... existing fields
  platformFeePercentage: integer // Basis points, default 250 (2.5%)
  platformFeeFixed: integer // Cents, default 200 ($2.00)
  stripeFeePercentage: integer // Basis points, default 290 (2.9%)
  stripeFeeFixed: integer // Cents, default 30 ($0.30)
  passStripeFeesToCustomer: boolean // Default false (organizer absorbs)
}
```

**`competition_registrations` table**:
```typescript
{
  // ... existing fields
  commercePurchaseId: string (FK → commerce_purchase.id, nullable)
  // Keep existing: registrationFee, isPaid, paidAt
}
```

**`teams` table** (Phase 2 prep):
```typescript
{
  // ... existing fields
  stripeConnectedAccountId: string (nullable) // Stripe Express account ID
  stripeAccountStatus: 'NOT_CONNECTED' | 'PENDING' | 'VERIFIED' (nullable)
  stripeOnboardingCompletedAt: timestamp (nullable)
}
```

---

### 1.2 Fee Calculation System

**File**: `src/server/commerce/fee-calculator.ts`

```typescript
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
│ ATHLETE REGISTRATION PAYMENT FLOW                            │
└─────────────────────────────────────────────────────────────┘

1. Athlete visits /compete/[eventSlug]/register
   ↓
2. Selects division, enters details
   ↓
3. Frontend: createCompetitionPurchase()
   → Creates commerce_purchase (PENDING)
   → Creates Stripe PaymentIntent
   → Returns clientSecret
   ↓
4. Frontend: Stripe Elements payment form
   → Athlete enters card details
   → Stripe.confirmPayment()
   ↓
5. Stripe Webhook: payment_intent.succeeded
   → Marks commerce_purchase as COMPLETED
   → Creates competition_registration (isPaid=true)
   → Creates team_membership in competition team
   → Sends confirmation email
   ↓
6. Athlete redirected to /compete/[eventSlug]/register/success
```

#### Server Actions

**File**: `src/actions/commerce.action.ts`

```typescript
'use server'

import { z } from 'zod'
import { createServerAction } from '@repo/zsa'
import { getSessionFromCookie } from '@/utils/auth'
import { calculateCompetitionFees } from '@/server/commerce/fee-calculator'
import { getStripe } from '@/lib/stripe'
import { getDb } from '@/db'
import { commercePurchaseTable, commerceProductTable } from '@/db/schemas/commerce'
import { RATE_LIMITS, withRateLimit } from '@/utils/with-rate-limit'
import { eq } from 'drizzle-orm'

const createCompetitionPurchaseSchema = z.object({
  competitionId: z.string(),
  divisionId: z.string(),
  registrationFeeCents: z.number().int().positive()
})

export const createCompetitionPurchaseAction = createServerAction()
  .input(createCompetitionPurchaseSchema)
  .handler(async ({ input }) => {
    // Wrap in withRateLimit to match existing action patterns
    return withRateLimit(async () => {
      const { user } = await getSessionFromCookie()
      if (!user) throw new Error('Unauthorized')

      const db = getDb()

      // Get fee configuration from competition
      const competition = await db.query.competitionsTable.findFirst({
        where: (table, { eq }) => eq(table.id, input.competitionId)
      })
      if (!competition) throw new Error('Competition not found')

      // Calculate fees
      const feeBreakdown = calculateCompetitionFees(
        input.registrationFeeCents,
        {
          platformPercentageBasisPoints: competition.platformFeePercentage ?? 250,
          platformFixedCents: competition.platformFeeFixed ?? 200,
          stripePercentageBasisPoints: competition.stripeFeePercentage ?? 290,
          stripeFixedCents: competition.stripeFeeFixed ?? 30,
          passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false
        }
      )

      // Create product record if doesn't exist
      const product = await db.insert(commerceProductTable).values({
        name: `Competition Registration - ${competition.name}`,
        type: 'COMPETITION_REGISTRATION',
        resourceId: input.competitionId,
        priceCents: input.registrationFeeCents,
        createdAt: new Date()
      }).returning().get()

      // Create purchase record
      const purchase = await db.insert(commercePurchaseTable).values({
        userId: user.id,
        productId: product.id,
        status: 'PENDING',
        totalCents: feeBreakdown.totalChargeCents,
        platformFeeCents: feeBreakdown.platformFeeCents,
        stripeFeeCents: feeBreakdown.stripeFeeCents,
        organizerNetCents: feeBreakdown.organizerNetCents,
        metadata: { competitionId: input.competitionId, divisionId: input.divisionId },
        createdAt: new Date()
      }).returning().get()

      // Create Stripe PaymentIntent
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: feeBreakdown.totalChargeCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          purchaseId: purchase.id,
          userId: user.id,
          competitionId: input.competitionId,
          type: 'COMPETITION_REGISTRATION'
        }
      })

      // Update purchase with PaymentIntent ID
      await db.update(commercePurchaseTable)
        .set({ stripePaymentIntentId: paymentIntent.id })
        .where(eq(commercePurchaseTable.id, purchase.id))

      return {
        purchaseId: purchase.id,
        clientSecret: paymentIntent.client_secret,
        feeBreakdown
      }
    }, RATE_LIMITS.DEFAULT)
  })
```

#### Webhook Handler

**File**: `src/app/api/webhooks/stripe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getDb } from '@/db'
import { commercePurchaseTable, competitionRegistrationsTable } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

const stripe = getStripe()

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    )
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const db = getDb()
  const purchaseId = paymentIntent.metadata.purchaseId

  // IDEMPOTENCY: Check if purchase is already completed
  // Stripe can deliver webhooks multiple times - we must handle duplicates gracefully
  const existingPurchase = await db.query.commercePurchaseTable.findFirst({
    where: (table, { eq }) => eq(table.id, purchaseId)
  })

  if (!existingPurchase) {
    console.error(`Purchase not found: ${purchaseId}`)
    return // Don't throw - acknowledge webhook to prevent retries
  }

  // Already processed - return early (idempotent)
  if (existingPurchase.status === 'COMPLETED') {
    console.log(`Purchase ${purchaseId} already completed, skipping duplicate webhook`)
    return
  }

  // Update purchase status
  await db.update(commercePurchaseTable)
    .set({
      status: 'COMPLETED',
      stripeChargeId: paymentIntent.latest_charge,
      completedAt: new Date()
    })
    .where(
      and(
        eq(commercePurchaseTable.id, purchaseId),
        eq(commercePurchaseTable.status, 'PENDING') // Only update if still PENDING
      )
    )

  // IDEMPOTENCY: Check if registration already exists before creating
  const metadata = existingPurchase.metadata as any
  const existingRegistration = await db.query.competitionRegistrationsTable.findFirst({
    where: (table, { eq }) => eq(table.commercePurchaseId, purchaseId)
  })

  if (existingRegistration) {
    console.log(`Registration for purchase ${purchaseId} already exists, skipping`)
    return
  }

  // Create competition registration
  await db.insert(competitionRegistrationsTable).values({
    competitionId: metadata.competitionId,
    userId: existingPurchase.userId,
    divisionId: metadata.divisionId,
    commercePurchaseId: existingPurchase.id,
    registrationFee: existingPurchase.totalCents,
    isPaid: true,
    paidAt: new Date(),
    status: 'CONFIRMED',
    createdAt: new Date()
  })

  // TODO: Create team membership in competition team
  // TODO: Send confirmation email
}

async function handlePaymentFailed(paymentIntent: any) {
  const db = getDb()
  const purchaseId = paymentIntent.metadata.purchaseId

  // IDEMPOTENCY: Only update if not already in a terminal state
  await db.update(commercePurchaseTable)
    .set({ status: 'FAILED' })
    .where(
      and(
        eq(commercePurchaseTable.id, purchaseId),
        eq(commercePurchaseTable.status, 'PENDING') // Only update if still PENDING
      )
    )

  // TODO: Send payment failed email
}
```

**Idempotency Notes**:
- Stripe can deliver webhooks multiple times due to network issues or retries
- We check purchase status before processing to prevent duplicate registrations
- Use conditional updates (`WHERE status = 'PENDING'`) as additional safeguard
- Always acknowledge webhooks (return 200) even for duplicates to prevent infinite retries

---

### 1.4 Frontend Integration

**File**: `src/app/(main)/compete/[eventSlug]/register/page.tsx`

```typescript
import { RegistrationPaymentForm } from './_components/registration-payment-form'
import { getCompetitionBySlug } from '@/server/competitions'

export default async function CompetitionRegisterPage({
  params
}: {
  params: { eventSlug: string }
}) {
  const competition = await getCompetitionBySlug(params.eventSlug)

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">Register for {competition.name}</h1>

      <RegistrationPaymentForm competition={competition} />
    </div>
  )
}
```

**File**: `src/components/commerce/registration-payment-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useServerAction } from '@repo/zsa-react'
import { createCompetitionPurchaseAction } from '@/actions/commerce.action'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function RegistrationPaymentForm({ competition }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const { execute, isPending } = useServerAction(createCompetitionPurchaseAction)

  const handleInitiatePayment = async () => {
    const result = await execute({
      competitionId: competition.id,
      divisionId: selectedDivision.id,
      registrationFeeCents: competition.registrationFee
    })

    if (result.data) {
      setClientSecret(result.data.clientSecret)
    }
  }

  if (!clientSecret) {
    return (
      <div>
        {/* Division selection form */}
        <Button onClick={handleInitiatePayment} disabled={isPending}>
          Proceed to Payment
        </Button>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm />
    </Elements>
  )
}

function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/compete/[eventSlug]/register/success`
      }
    })

    if (error) {
      console.error(error)
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button type="submit" disabled={!stripe || isProcessing} className="mt-4">
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </Button>
    </form>
  )
}
```

---

### 1.5 Environment Configuration

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

- [ ] Create purchase → PaymentIntent created
- [ ] Payment success → Purchase marked COMPLETED
- [ ] Payment success → Registration created with isPaid=true
- [ ] Payment failed → Purchase marked FAILED
- [ ] Webhook signature verification works
- [ ] Fee calculations accurate for various amounts
- [ ] Multiple divisions supported
- [ ] Error handling for invalid competition/division

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
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/compete/stripe/onboard`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/compete/stripe/complete`,
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
│   └── commerce.ts                          # Commerce tables schema
├── server/commerce/
│   ├── fee-calculator.ts                    # Fee computation logic
│   └── purchase-manager.ts                  # Purchase business logic
├── actions/
│   └── commerce.action.ts                   # Server actions for purchases
├── app/api/webhooks/stripe/
│   └── route.ts                             # Stripe webhook handler
├── app/(main)/compete/[eventSlug]/register/
│   ├── page.tsx                             # Registration page
│   ├── success/page.tsx                     # Payment success page
│   └── _components/
│       └── registration-payment-form.tsx    # Payment form component
└── components/commerce/
    ├── payment-form.tsx                     # Reusable Stripe payment form
    └── purchase-summary.tsx                 # Fee breakdown display

docs/features/
└── commerce-implementation-plan.md          # This document
```

### Modified Files (Phase 1)

```
src/
├── db/
│   ├── schema.ts                            # Export commerce tables
│   └── schemas/
│       ├── competitions.ts                  # Add fee fields
│       └── teams.ts                         # Add Stripe Connect fields (prep)
├── lib/
│   └── stripe.ts                            # Verify singleton pattern
└── utils/
    └── commerce.ts                          # Commerce helper utilities

Root:
├── .env                                      # Add STRIPE_WEBHOOK_SECRET
├── wrangler.jsonc                           # Add webhook secret binding
└── package.json                             # Verify Stripe packages
```

---

## Success Criteria

### Phase 1 Completion Checklist

- [ ] **Database Schema**
  - [ ] `commerce_product` table created
  - [ ] `commerce_purchase` table created
  - [ ] `commerce_platform_fee` table created
  - [ ] Fee fields added to `competitions` table
  - [ ] Migration applied to dev and prod databases

- [ ] **Fee Calculation**
  - [ ] Fee calculator function implemented and tested
  - [ ] Default fees seeded (2.5% + $2, 2.9% + $0.30)
  - [ ] Variable fees per competition supported
  - [ ] Both fee scenarios working (organizer absorbs vs customer pays Stripe fees)

- [ ] **Payment Flow**
  - [ ] `createCompetitionPurchaseAction` implemented
  - [ ] Stripe PaymentIntent creation working
  - [ ] Frontend payment form integrated
  - [ ] Payment success redirects correctly

- [ ] **Webhook Handling**
  - [ ] Webhook endpoint created at `/api/webhooks/stripe`
  - [ ] Signature verification working
  - [ ] `payment_intent.succeeded` handler implemented
  - [ ] `payment_intent.payment_failed` handler implemented
  - [ ] Purchase status updates correctly

- [ ] **Registration Creation**
  - [ ] Registration auto-created on payment success
  - [ ] `commercePurchaseId` linked correctly
  - [ ] `isPaid` and `paidAt` fields populated

- [ ] **Testing**
  - [ ] Local webhook testing with Stripe CLI successful
  - [ ] Test card payments working (success/failure cases)
  - [ ] Fee calculations verified for multiple amounts
  - [ ] Both fee scenarios tested (organizer absorbs vs customer pays)
  - [ ] Organizer receives correct net amount in both scenarios
  - [ ] End-to-end flow tested from registration to confirmation

- [ ] **Documentation**
  - [ ] Implementation plan documented (this file)
  - [ ] Code comments added to complex logic
  - [ ] README updated with new commerce setup steps

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

**Document Version**: 1.0
**Last Updated**: 2025-01-24
**Next Review**: After Phase 1 completion
