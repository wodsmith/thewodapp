# Testing & Success Criteria

## Local Webhook Testing

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

## Test Cards (Stripe Test Mode)

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires authentication: 4000 0025 0000 3155
```

---

## Test Checklist

### Free Competition Flow

- [ ] Free competition ($0 fee) → registration created directly
- [ ] Free competition → paymentStatus = 'FREE'
- [ ] Free competition → no Stripe interaction

### Paid Competition Flow

- [ ] Paid competition → PaymentIntent created
- [ ] Payment success webhook → Purchase marked COMPLETED
- [ ] Payment success webhook → Registration created via `registerForCompetition()`
- [ ] Payment success webhook → paymentStatus = 'PAID'
- [ ] Payment failed → Purchase marked FAILED
- [ ] Webhook signature verification works

### Team Registration

- [ ] Team registration → team data stored in purchase metadata
- [ ] Team registration → webhook creates athlete team and invites teammates
- [ ] Captain pays for entire team

### Fee Calculations

- [ ] Fee calculations accurate for various amounts
- [ ] "Organizer absorbs" fees calculate correctly
- [ ] "Pass to customer" fees calculate correctly (algebraic formula)
- [ ] Fee breakdown displays correctly in UI

### Admin Fee Configuration

- [ ] Organizer can set default registration fee
- [ ] Organizer can set per-division fee overrides
- [ ] Organizer can toggle "pass fees to customer"
- [ ] Fee preview shows accurate athlete totals
- [ ] Permission check prevents unauthorized access

### Edge Cases

- [ ] User already registered → error before payment
- [ ] Registration window closed → error before payment
- [ ] Duplicate webhook delivery → idempotent (no duplicate registration)
- [ ] Resume abandoned payment → existing PaymentIntent returned
- [ ] Per-division pricing displays correctly when switching divisions

---

## Phase 1 Completion Checklist

### Database Schema

- [ ] `commerce_product` table created with unique index on (type, resourceId)
- [ ] `commerce_purchase` table created with proper indexes
- [ ] ID generators added to `common.ts` (`createCommerceProductId`, `createCommercePurchaseId`)
- [ ] Drizzle relations defined for commerce tables
- [ ] Fee fields added to `competitions` table (`registrationFeeCents`, `platformFeePercentage`, `passStripeFeesToCustomer`)
- [ ] Payment fields added to `competition_registrations` table (`commercePurchaseId`, `paymentStatus`, `paidAt`)
- [ ] Migration applied to dev and prod databases

### Fee Calculation

- [ ] Fee calculator function implemented with `PLATFORM_DEFAULTS` export
- [ ] Algebraic formula for "pass to customer" scenario verified
- [ ] Both fee scenarios working (organizer absorbs vs customer pays)
- [ ] Unit tests for various amounts and edge cases

### Payment Flow

- [ ] `initiateRegistrationPayment` action implemented
- [ ] Free competitions ($0) skip payment and create registration directly
- [ ] Paid competitions create purchase + PaymentIntent
- [ ] Existing pending purchase is resumed (idempotent)
- [ ] Frontend payment step integrated into existing RegistrationForm

### Webhook Handling

- [ ] Webhook endpoint at `/api/webhooks/stripe`
- [ ] Separate signature verification vs processing error handling
- [ ] Proper TypeScript types (no `any`)
- [ ] Idempotency checks at purchase AND registration level
- [ ] Uses `registerForCompetition()` for full registration logic
- [ ] Team registration data passed through from purchase metadata

### Registration Integration

- [ ] Existing `registerForCompetition()` reused (team membership, athlete team, invites)
- [ ] `paymentStatus` field set correctly ('FREE', 'PENDING_PAYMENT', 'PAID')
- [ ] `commercePurchaseId` linked correctly
- [ ] Sessions updated after registration

### Organizer Fee Configuration

- [ ] Registration settings page at `/compete/organizer/[slug]/settings/registration`
- [ ] Default fee configuration works
- [ ] Per-division fee overrides work
- [ ] "Pass fees to customer" toggle works
- [ ] Fee preview shows accurate totals
- [ ] Permission check prevents unauthorized access

### Testing

- [ ] Free competition flow tested
- [ ] Paid competition flow tested (individual and team)
- [ ] Per-division pricing tested
- [ ] Duplicate webhook delivery handled (idempotent)
- [ ] Resume abandoned payment tested
- [ ] Local webhook testing with Stripe CLI successful

### Documentation

- [ ] Implementation plan documented
- [ ] Code comments added to complex logic
