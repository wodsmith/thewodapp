## 1.3 Registration Payment Flow

### Architecture

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

### Server Actions

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

### Webhook Handler

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