# Commerce Implementation Plan Review

**Reviewed**: 2025-01-24
**Status**: Review Complete
**Document**: `docs/features/commerce-implementation-plan.md`

---

## Executive Summary

The commerce implementation plan is **well-structured** with clear phases and comprehensive documentation. However, several issues need addressing before implementation:

| Category | Rating | Summary |
|----------|--------|---------|
| **Fee Calculations** | ⚠️ Needs Fix | Math errors in "pass to customer" scenario |
| **Schema Design** | ✅ Good | Aligns with existing patterns, minor improvements |
| **Code Patterns** | ⚠️ Needs Fix | Doesn't follow existing action patterns (missing zsa) |
| **Security** | ⚠️ Needs Attention | Webhook idempotency, race conditions |
| **Maintainability** | ✅ Good | Clear separation, extensible design |

---

## Critical Issues (Must Fix)

### 1. Fee Calculation Error in "Pass Stripe Fees to Customer" Scenario

**Location**: Section 1.2 Fee Calculation System

**Problem**: When passing Stripe fees to customer, the Stripe fee calculation is based on the subtotal, but Stripe actually charges fees on the TOTAL charged (including Stripe fees). This creates a circular dependency.

**Current (Incorrect)**:
```typescript
// Stripe fee calculated on subtotal, but Stripe charges on the TOTAL
const stripeFeeCents =
  Math.round(subtotalCents * (config.stripePercentageBasisPoints / 10000)) +
  config.stripeFixedCents
```

**Correct Formula**: To ensure organizer receives exactly the registration fee, we need to solve for the total charge where Stripe's fee is calculated on that total:

```
totalCharge = subtotal + stripeFee
stripeFee = (totalCharge × 2.9%) + $0.30

Solving for totalCharge:
totalCharge = (subtotal + $0.30) / (1 - 0.029)
```

**Corrected Implementation**:
```typescript
if (config.passStripeFeesToCustomer) {
  // Use algebraic solution to ensure organizer gets exact registration fee
  // totalCharge = (subtotal + fixedFee) / (1 - percentageFee)
  const totalChargeCents = Math.round(
    (subtotalCents + config.stripeFixedCents) / 
    (1 - config.stripePercentageBasisPoints / 10000)
  )
  const stripeFeeCents = totalChargeCents - subtotalCents
  const organizerNetCents = registrationFeeCents
  
  return {
    registrationFeeCents,
    platformFeeCents,
    stripeFeeCents,
    totalChargeCents,
    organizerNetCents,
    passedToCustomer: true
  }
}
```

**Verification** (for $50 registration):
- Registration: $50.00
- Platform fee: $3.25
- Subtotal: $53.25
- Correct total: ($53.25 + $0.30) / (1 - 0.029) = $55.14
- Stripe fee on $55.14: ($55.14 × 0.029) + $0.30 = $1.89
- Net received: $55.14 - $1.89 = $53.25 ✓ (exactly subtotal)
- Organizer gets: $53.25 - $3.25 = $50.00 ✓

---

### 2. Server Action Pattern Mismatch

**Location**: Section 1.3 Server Actions

**Problem**: The plan uses `createServerAction()` without input validation via zsa, but existing actions in the codebase (e.g., `credits.action.ts`) use plain async functions with manual validation.

**Current Pattern in Codebase** (`credits.action.ts`):
```typescript
"use server"

export async function createPaymentIntent({ packageId }: CreatePaymentIntentInput) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    // ... implementation
  }, RATE_LIMITS.PURCHASE)
}
```

**Plan's Pattern**:
```typescript
export const createCompetitionPurchaseAction = createServerAction()
  .input(createCompetitionPurchaseSchema)
  .handler(async ({ input }) => {
    // ...
  })
```

**Recommendation**: Match the existing pattern for consistency:

```typescript
"use server"

import { z } from 'zod'
import { requireVerifiedEmail } from '@/utils/auth'
import { withRateLimit, RATE_LIMITS } from '@/utils/with-rate-limit'

const createCompetitionPurchaseSchema = z.object({
  competitionId: z.string(),
  divisionId: z.string(),
  registrationFeeCents: z.number().int().positive()
})

type CreateCompetitionPurchaseInput = z.infer<typeof createCompetitionPurchaseSchema>

export async function createCompetitionPurchase(input: CreateCompetitionPurchaseInput) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error('Unauthorized')
    
    // Validate input
    const parsed = createCompetitionPurchaseSchema.safeParse(input)
    if (!parsed.success) throw new Error('Invalid input')
    
    // ... rest of implementation
  }, RATE_LIMITS.PURCHASE)
}
```

---

### 3. Missing Webhook Idempotency

**Location**: Section 1.3 Webhook Handler

**Problem**: Stripe can deliver webhooks multiple times. The current handler would create duplicate registrations.

**Current (Missing idempotency)**:
```typescript
async function handlePaymentSuccess(paymentIntent: any) {
  const purchaseId = paymentIntent.metadata.purchaseId
  
  // Update purchase status - could be called multiple times
  const purchase = await db.update(commercePurchaseTable)
    .set({ status: 'COMPLETED', /* ... */ })
    // ...
  
  // Creates duplicate registrations if webhook fires twice!
  await db.insert(competitionRegistrationsTable).values({ /* ... */ })
}
```

**Fix**: Add idempotency check:

```typescript
async function handlePaymentSuccess(paymentIntent: any) {
  const purchaseId = paymentIntent.metadata.purchaseId
  
  // IDEMPOTENCY CHECK: Fetch current purchase status
  const existingPurchase = await db.query.commercePurchaseTable.findFirst({
    where: eq(commercePurchaseTable.id, purchaseId)
  })
  
  // Already processed - skip
  if (existingPurchase?.status === 'COMPLETED') {
    console.log(`INFO: [Webhook] Purchase ${purchaseId} already completed, skipping`)
    return
  }
  
  // ... proceed with update and registration creation
}
```

---

## High Priority Improvements

### 4. Missing Common Columns and ID Generators

**Location**: Section 1.1 Database Schema

**Problem**: Schema doesn't use `commonColumns` pattern or proper ID generators from `common.ts`.

**Fix**: Add to `src/db/schemas/common.ts`:
```typescript
export const createCommerceProductId = () => `cprod_${createId()}`
export const createCommercePurchaseId = () => `cpur_${createId()}`
export const createCommercePlatformFeeId = () => `cfee_${createId()}`
```

**Updated Schema Pattern**:
```typescript
export const commerceProductTable = sqliteTable('commerce_product', {
  ...commonColumns,  // Adds createdAt, updatedAt, updateCounter
  id: text()
    .primaryKey()
    .$defaultFn(() => createCommerceProductId())
    .notNull(),
  // ... rest of fields
})
```

---

### 5. Missing Relations Definition

**Location**: Section 1.1 Database Schema

**Problem**: No Drizzle relations defined for the new commerce tables.

**Add**:
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

---

### 6. Missing `divisionId` Storage

**Location**: Section 1.3 Server Actions

**Problem**: The action stores `divisionId` in metadata JSON, but it should also be stored as a proper column for queries.

**Current**:
```typescript
metadata: { competitionId: input.competitionId, divisionId: input.divisionId }
```

**Recommendation**: Add `divisionId` as a proper column in `commerce_purchase`:
```typescript
{
  // ... existing fields
  divisionId: text(), // For competition registrations
}
```

This enables efficient queries like "find all purchases for division X".

---

### 7. Missing Rate Limiting on Webhook Endpoint

**Location**: Section 1.3 Webhook Handler

**Problem**: Webhook endpoint has no rate limiting, making it vulnerable to DoS.

**Fix**: Add rate limiting (but note: be careful not to reject legitimate Stripe webhooks):

```typescript
export async function POST(request: NextRequest) {
  // Add basic DDoS protection - Stripe sends max ~10 webhooks/second per event type
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  
  // Consider using Cloudflare rate limiting instead of app-level
  // Or implement a simple in-memory rate limiter
  
  // ... rest of handler
}
```

**Better approach**: Configure rate limiting at Cloudflare Workers level via `wrangler.jsonc`.

---

## Medium Priority Improvements

### 8. Product Deduplication Issue

**Location**: Section 1.3 Server Actions

**Problem**: Current implementation creates a new product record for every purchase attempt:

```typescript
// Creates a NEW product every time - wasteful
const product = await db.insert(commerceProductTable).values({
  name: `Competition Registration - ${competition.name}`,
  // ...
}).returning().get()
```

**Fix**: Use upsert or find-first pattern:

```typescript
// First check if product exists
let product = await db.query.commerceProductTable.findFirst({
  where: and(
    eq(commerceProductTable.type, 'COMPETITION_REGISTRATION'),
    eq(commerceProductTable.resourceId, input.competitionId)
  )
})

if (!product) {
  product = await db.insert(commerceProductTable).values({
    name: `Competition Registration - ${competition.name}`,
    type: 'COMPETITION_REGISTRATION',
    resourceId: input.competitionId,
    priceCents: input.registrationFeeCents,
  }).returning().get()
}
```

---

### 9. Missing Stripe Signature Verification Error Handling

**Location**: Section 1.3 Webhook Handler

**Problem**: Generic error handling doesn't distinguish signature failures from processing errors.

**Fix**: Separate error types:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('ERROR: [Webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    // Signature verification failed - likely invalid webhook
    console.error('ERROR: [Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    // Process the verified event
    await processEvent(event)
    return NextResponse.json({ received: true })
  } catch (err) {
    // Processing error - Stripe should retry
    console.error('ERROR: [Webhook] Processing failed:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
```

---

### 10. Frontend Missing Proper Error Handling

**Location**: Section 1.4 Frontend Integration

**Problem**: Error handling just logs to console:

```typescript
if (error) {
  console.error(error)
  setIsProcessing(false)
}
```

**Fix**: Display user-friendly errors:

```typescript
const [error, setError] = useState<string | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!stripe || !elements) return
  
  setError(null)
  setIsProcessing(true)

  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/compete/${eventSlug}/register/success`
    }
  })

  if (error) {
    // Map Stripe error types to user-friendly messages
    const message = error.type === 'card_error' 
      ? error.message 
      : 'An unexpected error occurred. Please try again.'
    setError(message)
    setIsProcessing(false)
  }
}

return (
  <form onSubmit={handleSubmit}>
    <PaymentElement />
    {error && (
      <Alert variant="destructive" className="mt-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )}
    <Button type="submit" disabled={!stripe || isProcessing} className="mt-4">
      {isProcessing ? 'Processing...' : 'Pay Now'}
    </Button>
  </form>
)
```

---

### 11. Missing TypeScript Types for Webhook Payload

**Location**: Section 1.3 Webhook Handler

**Problem**: Uses `any` type for payment intent:

```typescript
async function handlePaymentSuccess(paymentIntent: any) {
```

**Fix**: Use Stripe types:

```typescript
import type Stripe from 'stripe'

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const purchaseId = paymentIntent.metadata.purchaseId
  // TypeScript now knows the shape
}
```

---

## Low Priority / Nice to Have

### 12. Consider Storing Fee Configuration Snapshot

**Issue**: If fee configuration changes after a purchase is created but before payment completes, the stored fees won't match actual fees charged.

**Recommendation**: Store the fee configuration snapshot in the purchase record:

```typescript
{
  // ... existing fields
  feeConfigSnapshot: text({ mode: 'json' }).$type<FeeConfiguration>(),
}
```

---

### 13. Missing Index on `stripePaymentIntentId`

**Issue**: Webhook handler looks up purchases by `stripePaymentIntentId`, but no index exists.

**Fix**: Add index in schema:

```typescript
(table) => [
  index('commerce_purchase_stripe_payment_intent_idx').on(table.stripePaymentIntentId),
  // ... other indexes
]
```

---

### 14. Frontend Template Literal Issue

**Location**: Section 1.4 Frontend Integration

**Problem**: Return URL uses template literal with `[eventSlug]` instead of actual slug:

```typescript
return_url: `${window.location.origin}/compete/[eventSlug]/register/success`
```

**Fix**: Use proper prop interpolation:

```typescript
// In parent component, pass eventSlug as prop
<PaymentForm eventSlug={eventSlug} />

// In PaymentForm
return_url: `${window.location.origin}/compete/${eventSlug}/register/success`
```

---

### 15. Consider Adding Cancellation Status

**Issue**: Schema only has `PENDING | COMPLETED | FAILED | REFUNDED` but no `CANCELLED` status for abandoned purchases.

**Recommendation**: Add `CANCELLED` status and implement cleanup job for stale pending purchases (e.g., after 1 hour).

---

## Security Considerations

### 16. Validate Competition is Open for Registration

**Issue**: No check that competition is actually accepting registrations:

```typescript
const competition = await db.query.competitionsTable.findFirst({
  where: (table, { eq }) => eq(table.id, input.competitionId)
})
if (!competition) throw new Error('Competition not found')
// Missing: Check registration dates, capacity, etc.
```

**Add**:
```typescript
// Check registration is open
const now = new Date()
if (competition.registrationOpenDate && now < competition.registrationOpenDate) {
  throw new Error('Registration not yet open')
}
if (competition.registrationCloseDate && now > competition.registrationCloseDate) {
  throw new Error('Registration closed')
}

// Check capacity
const registrationCount = await db.select({ count: sql`count(*)` })
  .from(competitionRegistrationsTable)
  .where(eq(competitionRegistrationsTable.competitionId, input.competitionId))

if (competition.maxParticipants && registrationCount >= competition.maxParticipants) {
  throw new Error('Competition is full')
}
```

---

### 17. Validate Division Belongs to Competition

**Issue**: No validation that the selected division actually belongs to the competition.

**Add**:
```typescript
const division = await db.query.competitionDivisionsTable.findFirst({
  where: and(
    eq(competitionDivisionsTable.id, input.divisionId),
    eq(competitionDivisionsTable.competitionId, input.competitionId)
  )
})
if (!division) throw new Error('Invalid division')
```

---

### 18. Prevent Duplicate Registrations

**Issue**: User could create multiple registrations for same competition.

**Add check**:
```typescript
const existingRegistration = await db.query.competitionRegistrationsTable.findFirst({
  where: and(
    eq(competitionRegistrationsTable.competitionId, input.competitionId),
    eq(competitionRegistrationsTable.userId, user.id),
    // Include non-cancelled statuses
    inArray(competitionRegistrationsTable.status, ['CONFIRMED', 'PENDING'])
  )
})
if (existingRegistration) {
  throw new Error('Already registered for this competition')
}
```

---

## Testing Recommendations

### Additional Test Cases to Add

1. **Fee calculation edge cases**:
   - $0 registration fee (if allowed)
   - Very small amounts (e.g., $1)
   - Large amounts (e.g., $1000+)
   - Rounding edge cases

2. **Webhook idempotency**:
   - Same webhook delivered twice
   - Out-of-order webhook delivery

3. **Race conditions**:
   - Two users register for last spot
   - Same user submits twice rapidly

4. **Error scenarios**:
   - Competition doesn't exist
   - Division doesn't exist
   - Competition is closed
   - Payment fails after purchase created

---

## Summary Checklist

### Before Phase 1 Implementation

- [ ] Fix fee calculation formula for "pass to customer" scenario
- [ ] Match existing server action patterns (plain functions, withRateLimit)
- [ ] Add webhook idempotency checks
- [ ] Add common columns and ID generators to schema
- [ ] Add Drizzle relations for commerce tables
- [ ] Add index on `stripePaymentIntentId`
- [ ] Implement product deduplication
- [ ] Add proper TypeScript types (no `any`)
- [ ] Fix frontend error handling
- [ ] Fix return URL template literal
- [ ] Add competition/division validation
- [ ] Add duplicate registration prevention
- [ ] Add rate limiting strategy

### Code Review Focus Areas

1. Fee calculation accuracy
2. Webhook idempotency
3. Race condition handling
4. TypeScript types (avoid `any`)
5. Error handling and user feedback
6. Security validations

---

## Conclusion

The plan is comprehensive and well-documented. The phased approach is sensible, and the architecture aligns with the existing codebase patterns (with noted corrections). 

**Key blockers** before implementation:
1. Fix fee calculation math (Critical)
2. Add webhook idempotency (Critical)
3. Align with existing action patterns (High)

After addressing these issues, the plan is ready for implementation.

---

**Document Version**: 1.0
**Reviewer**: Engineering Team
**Next Steps**: Update `commerce-implementation-plan.md` with fixes, then begin implementation

