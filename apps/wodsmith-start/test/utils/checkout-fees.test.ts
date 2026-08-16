import { describe, expect, it } from "vitest"
import type { FeeConfiguration } from "@/server/commerce/fee-calculator"
import {
  allocateCents,
  calculateCheckoutFees,
} from "@/utils/checkout-fees"

const config: FeeConfiguration = {
  platformPercentageBasisPoints: 400,
  platformFixedCents: 200,
  stripePercentageBasisPoints: 290,
  stripeFixedCents: 30,
  passStripeFeesToCustomer: true,
  passPlatformFeesToCustomer: true,
}

describe("calculateCheckoutFees", () => {
  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#One transaction fee per checkout]]
  it("charges Stripe's fixed fee once for a registration and multiple merch units", () => {
    const result = calculateCheckoutFees(
      [
        { key: "registration", basePriceCents: 5_000 },
        { key: "shirts", basePriceCents: 5_000, platformFixedCents: 0 },
      ],
      config,
    )

    const subtotalBeforeStripe = 5_000 + 400 + 5_000 + 200
    const expectedTotal = Math.ceil((subtotalBeforeStripe + 30) / 0.971)
    expect(result.totalChargeCents).toBe(expectedTotal)
    expect(result.totalStripeFeeCents).toBe(
      expectedTotal - subtotalBeforeStripe,
    )
    expect(result.lines.reduce((sum, line) => sum + line.stripeFeeCents, 0)).toBe(
      result.totalStripeFeeCents,
    )
  })

  it("subtracts organizer-funded coupons before calculating transaction fees", () => {
    const result = calculateCheckoutFees(
      [
        {
          key: "registration",
          basePriceCents: 5_000,
          discountCents: 1_000,
        },
      ],
      { ...config, passStripeFeesToCustomer: false },
    )

    expect(result.totalChargeCents).toBe(4_400)
    expect(result.totalStripeFeeCents).toBe(Math.round(4_400 * 0.029) + 30)
    expect(result.lines[0].organizerNetCents).toBe(
      4_000 - result.totalStripeFeeCents,
    )
  })

  it("does not invent a fixed processing charge for a zero-dollar checkout", () => {
    const result = calculateCheckoutFees(
      [{ key: "free", basePriceCents: 0, platformFixedCents: 0 }],
      config,
    )

    expect(result.totalChargeCents).toBe(0)
    expect(result.totalStripeFeeCents).toBe(0)
    expect(result.lines[0].totalChargeCents).toBe(0)
  })
})

describe("allocateCents", () => {
  it("preserves the exact total with deterministic largest remainders", () => {
    expect(allocateCents(10, [1, 1, 1])).toEqual([4, 3, 3])
  })
})
