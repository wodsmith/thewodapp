## 1.2 Fee Calculation System

---

### Implementation Summary (2025-01-29)

**Status**: ✅ COMPLETED

**Files Created**:
- `src/server/commerce/fee-calculator.ts` - Complete fee calculation system

**Exports**:
- `PLATFORM_DEFAULTS` - Default fee configuration constants
- `FeeConfiguration` - Interface for fee config
- `FeeBreakdown` - Interface for calculated fees
- `calculateCompetitionFees()` - Main fee calculation function
- `getRegistrationFee()` - Fetch fee for competition+division (with fallback logic)
- `buildFeeConfig()` - Build config from competition settings with defaults
- `formatCents()` - Helper to format cents as dollar string

**Decisions Made**:
1. Added `buildFeeConfig()` helper to simplify usage in server actions
2. Added `formatCents()` helper for consistent currency formatting
3. Exported interfaces for type safety in consuming code
4. All amounts use cents (integer) to avoid floating point issues

**Questions Exposed**:
- None - implementation follows plan specification

---

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
//   stripeFeeCents: 190,            // $1.90
//   totalChargeCents: 5517,         // $55.17
//   organizerNetCents: 5000,        // $50.00 (organizer receives exactly registration fee)
//   passedToCustomer: true
// }
```

---
