import { describe, expect, it } from "vitest"
import type { FeeConfiguration } from "@/server/commerce/fee-calculator"
import {
  buildAddonFeeConfig,
  getAddonUnitBreakdown,
  multiplyFeeBreakdown,
} from "@/server/commerce/addons"
import { calculateCompetitionFees } from "@/server/commerce/utils"

const baseConfig: FeeConfiguration = {
  platformPercentageBasisPoints: 400, // 4.0%
  platformFixedCents: 200, // $2.00
  stripePercentageBasisPoints: 290,
  stripeFixedCents: 30,
  passStripeFeesToCustomer: false,
  passPlatformFeesToCustomer: true,
}

describe("buildAddonFeeConfig", () => {
  it("drops only the fixed platform fee", () => {
    const config = buildAddonFeeConfig(baseConfig)
    expect(config.platformFixedCents).toBe(0)
    expect(config.platformPercentageBasisPoints).toBe(400)
    expect(config.stripePercentageBasisPoints).toBe(290)
    expect(config.passPlatformFeesToCustomer).toBe(true)
  })
})

describe("getAddonUnitBreakdown", () => {
  it("charges the percentage platform fee without the $2 fixed fee", () => {
    // $25 tee at 4%: platform fee = $1.00 (no fixed), customer pays $26.00
    const breakdown = getAddonUnitBreakdown(2500, baseConfig)
    expect(breakdown.platformFeeCents).toBe(100)
    expect(breakdown.totalChargeCents).toBe(2600)
    expect(breakdown.organizerNetCents).toBe(
      calculateCompetitionFees(2500, { ...baseConfig, platformFixedCents: 0 })
        .organizerNetCents,
    )
  })

  it("follows the competition's stripe pass-through setting", () => {
    const withStripe = getAddonUnitBreakdown(2500, {
      ...baseConfig,
      passStripeFeesToCustomer: true,
    })
    // Total must cover Stripe's cut of the total (gross-up math)
    expect(withStripe.totalChargeCents).toBeGreaterThan(2600)
    expect(withStripe.stripeFeesPassedToCustomer).toBe(true)
  })
})

describe("multiplyFeeBreakdown", () => {
  it("scales every cents field with zero rounding drift", () => {
    const unit = getAddonUnitBreakdown(2500, baseConfig)
    const line = multiplyFeeBreakdown(unit, 3)
    expect(line.totalChargeCents).toBe(unit.totalChargeCents * 3)
    expect(line.platformFeeCents).toBe(unit.platformFeeCents * 3)
    expect(line.stripeFeeCents).toBe(unit.stripeFeeCents * 3)
    expect(line.organizerNetCents).toBe(unit.organizerNetCents * 3)
    expect(line.registrationFeeCents).toBe(unit.registrationFeeCents * 3)
    // Flags untouched
    expect(line.platformFeesPassedToCustomer).toBe(
      unit.platformFeesPassedToCustomer,
    )
  })

  it("is identity for quantity 1", () => {
    const unit = getAddonUnitBreakdown(2500, baseConfig)
    expect(multiplyFeeBreakdown(unit, 1)).toEqual(unit)
  })
})
