import { describe, expect, it } from "vitest"
import { calculateApplicationFeeCents } from "@/server/commerce/utils"

describe("calculateApplicationFeeCents", () => {
  it("returns charge minus organizer net when no discount applies", () => {
    expect(
      calculateApplicationFeeCents({
        totalChargeCents: 21630,
        totalOrganizerNetCents: 20000,
      }),
    ).toBe(1630)
  })

  it("ignores discounts smaller than the customer-paid amount", () => {
    // $200 reg + fees charged to customer, $50 coupon — fee unchanged
    expect(
      calculateApplicationFeeCents({
        totalChargeCents: 21630,
        totalOrganizerNetCents: 20000,
        discountCents: 5000,
      }),
    ).toBe(1630)
  })

  it("clamps to the post-discount charge when organizer absorbs fees and a near-100% coupon applies", () => {
    // Organizer absorbs fees: charge $200, net $184 (fee $16), coupon $190
    // → customer pays $10; Stripe would reject a $16 application fee.
    expect(
      calculateApplicationFeeCents({
        totalChargeCents: 20000,
        totalOrganizerNetCents: 18400,
        discountCents: 19000,
      }),
    ).toBe(1000)
  })

  it("clamps to the add-on charge for a 100% registration coupon plus merch", () => {
    // Registration fully discounted; customer pays only the $26 add-on.
    // Uncapped fee (reg $16 absorbed + addon $1) exceeds the charge? No —
    // here it doesn't, so the fee passes through untouched.
    expect(
      calculateApplicationFeeCents({
        totalChargeCents: 22600, // $200 reg + $26 addon
        totalOrganizerNetCents: 20900, // reg net $184 + addon net $25
        discountCents: 20000,
      }),
    ).toBe(1700)

    // With a small add-on the clamp binds: customer pays $5.20 total.
    expect(
      calculateApplicationFeeCents({
        totalChargeCents: 20520,
        totalOrganizerNetCents: 18900, // uncapped fee $16.20
        discountCents: 20000,
      }),
    ).toBe(520)
  })

  it("never returns a negative fee", () => {
    expect(
      calculateApplicationFeeCents({
        totalChargeCents: 1000,
        totalOrganizerNetCents: 1500,
        discountCents: 2000,
      }),
    ).toBe(0)
  })
})
