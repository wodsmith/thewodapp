import {describe, expect, it} from 'vitest'
import {
  buildFeeConfig,
  calculateCompetitionFees,
} from '@/server/commerce/utils'
import type {FeeBreakdown, FeeConfiguration} from '@/server/commerce/fee-calculator'

// ============================================================================
// Application Fee Formula (the core change)
// ============================================================================
//
// With Stripe destination charges:
// - Stripe fees are charged to the PLATFORM account (not connected account)
// - Connected account receives: totalCharge - applicationFee
// - Platform receives: applicationFee (minus Stripe fee)
//
// Formula: applicationFee = max(0, totalCharge - organizerNet)
//
// This ensures:
//   connectedAccountReceives = totalCharge - applicationFee = organizerNet ✓
//   platformNet = applicationFee - stripeFee = platformFee ✓
// ============================================================================

/**
 * Compute application fee for Stripe destination charges.
 * This mirrors the inline calculation in initiateRegistrationPaymentFn.
 */
function computeApplicationFee(breakdown: FeeBreakdown): number {
  return Math.max(0, breakdown.totalChargeCents - breakdown.organizerNetCents)
}

/**
 * OLD formula (before fix) for comparison in regression tests.
 * This incorrectly tried to account for Stripe fees on the connected account.
 */
function computeOldApplicationFee(breakdown: FeeBreakdown): number {
  const stripeRate = 0.029
  const stripeFixedCents = 30
  const connectedAccountReceives = Math.ceil(
    (breakdown.organizerNetCents + stripeFixedCents) / (1 - stripeRate),
  )
  return Math.max(0, breakdown.totalChargeCents - connectedAccountReceives)
}

// ============================================================================
// Helper to build configs for different fee models
// ============================================================================

const defaultConfig = (): FeeConfiguration =>
  buildFeeConfig({})

const customerPaysBothConfig = (): FeeConfiguration =>
  buildFeeConfig({passStripeFeesToCustomer: true, passPlatformFeesToCustomer: true})

const customerPaysStripeOnlyConfig = (): FeeConfiguration =>
  buildFeeConfig({passStripeFeesToCustomer: true, passPlatformFeesToCustomer: false})

const organizerAbsorbsBothConfig = (): FeeConfiguration =>
  buildFeeConfig({passStripeFeesToCustomer: false, passPlatformFeesToCustomer: false})

const foundingOrganizerConfig = (overrides?: Partial<{passStripe: boolean; passPlatform: boolean}>): FeeConfiguration =>
  buildFeeConfig(
    {
      passStripeFeesToCustomer: overrides?.passStripe ?? false,
      passPlatformFeesToCustomer: overrides?.passPlatform ?? true,
    },
    {organizerFeePercentage: 250, organizerFeeFixed: 200},
  )

// ============================================================================
// Tests
// ============================================================================

describe('Destination Charge Application Fee', () => {
  describe('core formula: applicationFee = totalCharge - organizerNet', () => {
    it('should compute applicationFee as totalCharge minus organizerNet', () => {
      const breakdown = calculateCompetitionFees(5000, defaultConfig())
      const appFee = computeApplicationFee(breakdown)

      expect(appFee).toBe(breakdown.totalChargeCents - breakdown.organizerNetCents)
    })

    it('should never be negative', () => {
      // Even with weird configs, floor at 0
      const breakdown: FeeBreakdown = {
        registrationFeeCents: 100,
        platformFeeCents: 0,
        stripeFeeCents: 0,
        totalChargeCents: 100,
        organizerNetCents: 200, // Hypothetical: organizer gets more than total
        stripeFeesPassedToCustomer: false,
        platformFeesPassedToCustomer: false,
      }
      expect(computeApplicationFee(breakdown)).toBe(0)
    })

    it('should be zero when organizer receives entire charge', () => {
      const breakdown: FeeBreakdown = {
        registrationFeeCents: 5000,
        platformFeeCents: 0,
        stripeFeeCents: 0,
        totalChargeCents: 5000,
        organizerNetCents: 5000,
        stripeFeesPassedToCustomer: false,
        platformFeesPassedToCustomer: false,
      }
      expect(computeApplicationFee(breakdown)).toBe(0)
    })
  })

  describe('destination charge invariants', () => {
    // The fundamental invariant: totalCharge = organizerNet + stripeFee + platformFee
    // Due to rounding, allow ±1 cent tolerance
    const testAmounts = [1000, 2500, 5000, 7500, 10000, 15000, 25000, 50000, 100000]

    const configs: Array<{name: string; config: FeeConfiguration}> = [
      {name: 'default (platform to customer, organizer absorbs stripe)', config: defaultConfig()},
      {name: 'customer pays both', config: customerPaysBothConfig()},
      {name: 'customer pays stripe only', config: customerPaysStripeOnlyConfig()},
      {name: 'organizer absorbs both', config: organizerAbsorbsBothConfig()},
      {name: 'founding organizer default', config: foundingOrganizerConfig()},
      {name: 'founding organizer, customer pays both', config: foundingOrganizerConfig({passStripe: true, passPlatform: true})},
    ]

    for (const {name, config} of configs) {
      describe(`[${name}]`, () => {
        for (const amount of testAmounts) {
          it(`$${(amount / 100).toFixed(2)} registration: totalCharge = organizerNet + stripeFee + platformFee (±1¢)`, () => {
            const b = calculateCompetitionFees(amount, config)
            const sum = b.organizerNetCents + b.stripeFeeCents + b.platformFeeCents

            // Allow ±1 cent for rounding
            expect(Math.abs(b.totalChargeCents - sum)).toBeLessThanOrEqual(1)
          })

          it(`$${(amount / 100).toFixed(2)} registration: connected account receives exactly organizerNet`, () => {
            const b = calculateCompetitionFees(amount, config)
            const appFee = computeApplicationFee(b)
            const connectedReceives = b.totalChargeCents - appFee

            expect(connectedReceives).toBe(b.organizerNetCents)
          })

          it(`$${(amount / 100).toFixed(2)} registration: platform net ≈ platformFee (±1¢)`, () => {
            const b = calculateCompetitionFees(amount, config)
            const appFee = computeApplicationFee(b)
            const platformNet = appFee - b.stripeFeeCents

            // Platform net after Stripe fee should equal platform fee (±1¢ rounding)
            expect(Math.abs(platformNet - b.platformFeeCents)).toBeLessThanOrEqual(1)
          })
        }
      })
    }
  })

  describe('regression: old formula overpaid organizers', () => {
    it('old formula gave connected account more than organizerNet (the bug)', () => {
      const b = calculateCompetitionFees(5000, defaultConfig())
      const oldAppFee = computeOldApplicationFee(b)
      const newAppFee = computeApplicationFee(b)

      // Old formula: lower application fee → organizer gets MORE than intended
      const oldConnectedReceives = b.totalChargeCents - oldAppFee
      const newConnectedReceives = b.totalChargeCents - newAppFee

      // New formula gives organizer exactly organizerNetCents
      expect(newConnectedReceives).toBe(b.organizerNetCents)

      // Old formula overpaid the organizer
      expect(oldConnectedReceives).toBeGreaterThan(b.organizerNetCents)
    })

    it('old formula underpaid the platform', () => {
      const b = calculateCompetitionFees(10000, defaultConfig())
      const oldAppFee = computeOldApplicationFee(b)
      const newAppFee = computeApplicationFee(b)

      // New formula: platform receives applicationFee - stripeFee = platformFee
      const newPlatformNet = newAppFee - b.stripeFeeCents
      // Old formula: platform received less
      const oldPlatformNet = oldAppFee - b.stripeFeeCents

      expect(newPlatformNet).toBeGreaterThan(oldPlatformNet)
      expect(Math.abs(newPlatformNet - b.platformFeeCents)).toBeLessThanOrEqual(1)
    })

    it('discrepancy grows with registration amount', () => {
      const amounts = [5000, 10000, 25000, 50000]
      const discrepancies: number[] = []

      for (const amount of amounts) {
        const b = calculateCompetitionFees(amount, defaultConfig())
        const oldAppFee = computeOldApplicationFee(b)
        const newAppFee = computeApplicationFee(b)
        discrepancies.push(newAppFee - oldAppFee)
      }

      // Each discrepancy should be positive (new charges more app fee)
      for (const d of discrepancies) {
        expect(d).toBeGreaterThan(0)
      }

      // Discrepancy should generally increase with amount
      for (let i = 1; i < discrepancies.length; i++) {
        expect(discrepancies[i]).toBeGreaterThanOrEqual(discrepancies[i - 1])
      }
    })
  })

  describe('exact dollar amounts for common registrations', () => {
    describe('default config: platform to customer, organizer absorbs stripe', () => {
      // Config: 4% + $2 platform, 2.9% + $0.30 stripe
      // Platform passed to customer, Stripe absorbed by organizer
      const config = defaultConfig()

      it('$50 registration', () => {
        const b = calculateCompetitionFees(5000, config)

        // Platform fee: 5000 * 0.04 + 200 = 400
        expect(b.platformFeeCents).toBe(400)
        // Total: 5000 + 400 = 5400
        expect(b.totalChargeCents).toBe(5400)
        // Stripe: round(5400 * 0.029) + 30 = round(156.6) + 30 = 157 + 30 = 187
        expect(b.stripeFeeCents).toBe(187)
        // Organizer net: 5400 - 187 - 400 = 4813
        expect(b.organizerNetCents).toBe(4813)

        // Application fee for destination charge
        const appFee = computeApplicationFee(b)
        expect(appFee).toBe(587) // 5400 - 4813
      })

      it('$75 registration', () => {
        const b = calculateCompetitionFees(7500, config)

        // Platform: 7500 * 0.04 + 200 = 500
        expect(b.platformFeeCents).toBe(500)
        // Total: 7500 + 500 = 8000
        expect(b.totalChargeCents).toBe(8000)
        // Stripe: round(8000 * 0.029) + 30 = round(232) + 30 = 262
        expect(b.stripeFeeCents).toBe(262)
        // Organizer: 8000 - 262 - 500 = 7238
        expect(b.organizerNetCents).toBe(7238)

        const appFee = computeApplicationFee(b)
        expect(appFee).toBe(762) // 8000 - 7238
      })

      it('$100 registration', () => {
        const b = calculateCompetitionFees(10000, config)

        expect(b.platformFeeCents).toBe(600)
        expect(b.totalChargeCents).toBe(10600)
        // Stripe: round(10600 * 0.029) + 30 = round(307.4) + 30 = 307 + 30 = 337
        expect(b.stripeFeeCents).toBe(337)
        // Organizer: 10600 - 337 - 600 = 9663
        expect(b.organizerNetCents).toBe(9663)

        const appFee = computeApplicationFee(b)
        // 10600 - 9663 = 937
        expect(appFee).toBe(937)
        expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
      })

      it('$150 registration', () => {
        const b = calculateCompetitionFees(15000, config)

        // Platform: 15000 * 0.04 + 200 = 800
        expect(b.platformFeeCents).toBe(800)
        // Total: 15000 + 800 = 15800
        expect(b.totalChargeCents).toBe(15800)

        const appFee = computeApplicationFee(b)
        const connectedReceives = b.totalChargeCents - appFee
        expect(connectedReceives).toBe(b.organizerNetCents)
      })
    })

    describe('customer pays both fees', () => {
      const config = customerPaysBothConfig()

      it('$50 registration - organizer gets full registration fee', () => {
        const b = calculateCompetitionFees(5000, config)

        // Platform: 5000 * 0.04 + 200 = 400
        expect(b.platformFeeCents).toBe(400)
        // Organizer gets full registration fee (customer pays both fees)
        expect(b.organizerNetCents).toBe(5000)

        // Subtotal: 5000 + 400 = 5400
        // Total: ceil((5400 + 30) / (1 - 0.029)) = ceil(5430 / 0.971) = ceil(5592.17) = 5593
        expect(b.totalChargeCents).toBe(5593)

        const appFee = computeApplicationFee(b)
        // 5593 - 5000 = 593
        expect(appFee).toBe(593)

        // Connected account gets exactly $50
        expect(b.totalChargeCents - appFee).toBe(5000)
      })

      it('$100 registration - organizer gets full $100', () => {
        const b = calculateCompetitionFees(10000, config)

        expect(b.organizerNetCents).toBe(10000)

        const appFee = computeApplicationFee(b)
        expect(b.totalChargeCents - appFee).toBe(10000)
      })
    })

    describe('organizer absorbs both fees', () => {
      const config = organizerAbsorbsBothConfig()

      it('$50 registration - customer pays only $50', () => {
        const b = calculateCompetitionFees(5000, config)

        // Customer pays only registration fee
        expect(b.totalChargeCents).toBe(5000)
        // Platform: 5000 * 0.04 + 200 = 400
        expect(b.platformFeeCents).toBe(400)
        // Stripe: round(5000 * 0.029) + 30 = round(145) + 30 = 175
        expect(b.stripeFeeCents).toBe(175)
        // Organizer: 5000 - 175 - 400 = 4425
        expect(b.organizerNetCents).toBe(4425)

        const appFee = computeApplicationFee(b)
        expect(appFee).toBe(575) // 5000 - 4425
        expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
      })

      it('$100 registration - customer pays only $100', () => {
        const b = calculateCompetitionFees(10000, config)

        expect(b.totalChargeCents).toBe(10000)

        const appFee = computeApplicationFee(b)
        expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
      })
    })

    describe('customer pays stripe only (platform absorbed)', () => {
      const config = customerPaysStripeOnlyConfig()

      it('$50 registration', () => {
        const b = calculateCompetitionFees(5000, config)

        // Platform absorbed, not added to customer charge
        // Subtotal: 5000 (no platform added)
        // Total: ceil((5000 + 30) / (1 - 0.029)) = ceil(5030 / 0.971) = ceil(5180.02) = 5181
        expect(b.totalChargeCents).toBe(5181)
        // Platform still calculated: 5000 * 0.04 + 200 = 400
        expect(b.platformFeeCents).toBe(400)
        // Organizer: 5000 - 400 = 4600 (registration minus absorbed platform fee)
        expect(b.organizerNetCents).toBe(4600)

        const appFee = computeApplicationFee(b)
        expect(b.totalChargeCents - appFee).toBe(4600)
      })
    })
  })

  // ===========================================================================
  // Fee Model Behavioral Tests: Who Pays What?
  // ===========================================================================
  //
  // 4 models × 2 dimensions:
  //   passPlatformFeesToCustomer: true/false
  //   passStripeFeesToCustomer: true/false
  //
  // Each test uses $75 registration (7500 cents) as a realistic price point
  // Platform fee at defaults: 7500 * 4% + $2.00 = $3.00 + $2.00 = $5.00 (500 cents)
  // ===========================================================================

  describe('fee model 1: default (platform → customer, stripe → organizer)', () => {
    // passPlatform: true, passStripe: false
    const config = defaultConfig()
    const reg = 7500

    it('customer charge includes registration + platform fee', () => {
      const b = calculateCompetitionFees(reg, config)

      // Customer pays: registration (7500) + platform (500) = 8000
      expect(b.totalChargeCents).toBe(reg + b.platformFeeCents)
      expect(b.totalChargeCents).toBe(8000)
    })

    it('customer does NOT pay Stripe fee (organizer absorbs it)', () => {
      const b = calculateCompetitionFees(reg, config)

      // Total = registration + platform (no Stripe added)
      expect(b.totalChargeCents).toBe(reg + b.platformFeeCents)
      // Stripe is deducted from what's collected, not added to charge
      expect(b.stripeFeesPassedToCustomer).toBe(false)
    })

    it('organizer receives registration minus Stripe fee (not full registration)', () => {
      const b = calculateCompetitionFees(reg, config)

      // Stripe eats into what organizer gets
      // netReceived = 8000 - 262 = 7738
      // organizerNet = 7738 - 500 (platform) = 7238
      expect(b.organizerNetCents).toBeLessThan(reg)
      expect(b.organizerNetCents).toBe(7238)
    })

    it('platform fee is visible to customer (shown on receipt)', () => {
      const b = calculateCompetitionFees(reg, config)
      expect(b.platformFeesPassedToCustomer).toBe(true)
    })

    it('platform gets exactly their fee despite Stripe eating from total', () => {
      const b = calculateCompetitionFees(reg, config)
      const appFee = computeApplicationFee(b)
      const platformNet = appFee - b.stripeFeeCents

      // Platform receives: appFee - stripeFee = 762 - 262 = 500 = platformFee ✓
      expect(platformNet).toBe(b.platformFeeCents)
    })
  })

  describe('fee model 2: customer pays both fees', () => {
    // passPlatform: true, passStripe: true
    const config = customerPaysBothConfig()
    const reg = 7500

    it('customer charge includes registration + platform + Stripe', () => {
      const b = calculateCompetitionFees(reg, config)

      // Total > registration + platform (Stripe is also added)
      expect(b.totalChargeCents).toBeGreaterThan(reg + b.platformFeeCents)
      expect(b.stripeFeesPassedToCustomer).toBe(true)
      expect(b.platformFeesPassedToCustomer).toBe(true)
    })

    it('organizer receives FULL registration fee (both fees covered by customer)', () => {
      const b = calculateCompetitionFees(reg, config)

      // This is the premium model: organizer gets exactly what they set
      expect(b.organizerNetCents).toBe(reg)
    })

    it('customer pays the most of any fee model', () => {
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())
      const defaultB = calculateCompetitionFees(reg, defaultConfig())
      const stripeOnlyB = calculateCompetitionFees(reg, customerPaysStripeOnlyConfig())
      const neitherB = calculateCompetitionFees(reg, organizerAbsorbsBothConfig())

      expect(bothB.totalChargeCents).toBeGreaterThan(defaultB.totalChargeCents)
      expect(bothB.totalChargeCents).toBeGreaterThan(stripeOnlyB.totalChargeCents)
      expect(bothB.totalChargeCents).toBeGreaterThan(neitherB.totalChargeCents)
    })

    it('Stripe fee is calculated on inflated total (circular solve)', () => {
      const b = calculateCompetitionFees(reg, config)

      // total = ceil((subtotal + 30) / (1 - 0.029))
      // subtotal = 7500 + 500 = 8000
      // total = ceil(8030 / 0.971) = ceil(8269.82) = 8270
      expect(b.totalChargeCents).toBe(8270)

      // Stripe on the total: round(8270 * 0.029) + 30 = round(239.83) + 30 = 240 + 30 = 270
      expect(b.stripeFeeCents).toBe(270)
    })

    it('destination charge: connected account gets full registration', () => {
      const b = calculateCompetitionFees(reg, config)
      const appFee = computeApplicationFee(b)

      // appFee = 8270 - 7500 = 770
      expect(appFee).toBe(770)
      expect(b.totalChargeCents - appFee).toBe(7500)
    })
  })

  describe('fee model 3: customer pays Stripe only (platform absorbed by organizer)', () => {
    // passPlatform: false, passStripe: true
    const config = customerPaysStripeOnlyConfig()
    const reg = 7500

    it('customer charge includes registration + Stripe but NOT platform', () => {
      const b = calculateCompetitionFees(reg, config)

      // Total > registration (Stripe added) but no platform
      expect(b.totalChargeCents).toBeGreaterThan(reg)
      expect(b.stripeFeesPassedToCustomer).toBe(true)
      expect(b.platformFeesPassedToCustomer).toBe(false)
    })

    it('platform fee is deducted from organizer, not charged to customer', () => {
      const b = calculateCompetitionFees(reg, config)

      // Organizer: registration - platform = 7500 - 500 = 7000
      expect(b.organizerNetCents).toBe(reg - b.platformFeeCents)
      expect(b.organizerNetCents).toBe(7000)
    })

    it('customer charge is lower than "customer pays both" model', () => {
      const stripeOnlyB = calculateCompetitionFees(reg, config)
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      expect(stripeOnlyB.totalChargeCents).toBeLessThan(bothB.totalChargeCents)
    })

    it('organizer gets less than "customer pays both" (absorbing platform)', () => {
      const stripeOnlyB = calculateCompetitionFees(reg, config)
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      expect(stripeOnlyB.organizerNetCents).toBeLessThan(bothB.organizerNetCents)
    })

    it('Stripe fee calculated on registration-only subtotal', () => {
      const b = calculateCompetitionFees(reg, config)

      // subtotal = 7500 (no platform added)
      // total = ceil((7500 + 30) / (1 - 0.029)) = ceil(7530 / 0.971) = ceil(7754.89) = 7755
      expect(b.totalChargeCents).toBe(7755)
    })
  })

  describe('fee model 4: organizer absorbs both fees', () => {
    // passPlatform: false, passStripe: false
    const config = organizerAbsorbsBothConfig()
    const reg = 7500

    it('customer pays ONLY registration fee (cleanest UX)', () => {
      const b = calculateCompetitionFees(reg, config)

      expect(b.totalChargeCents).toBe(reg)
      expect(b.stripeFeesPassedToCustomer).toBe(false)
      expect(b.platformFeesPassedToCustomer).toBe(false)
    })

    it('organizer receives least of any fee model', () => {
      const absorbB = calculateCompetitionFees(reg, config)
      const defaultB = calculateCompetitionFees(reg, defaultConfig())
      const stripeOnlyB = calculateCompetitionFees(reg, customerPaysStripeOnlyConfig())
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      expect(absorbB.organizerNetCents).toBeLessThan(defaultB.organizerNetCents)
      expect(absorbB.organizerNetCents).toBeLessThan(stripeOnlyB.organizerNetCents)
      expect(absorbB.organizerNetCents).toBeLessThan(bothB.organizerNetCents)
    })

    it('both Stripe AND platform come out of organizer revenue', () => {
      const b = calculateCompetitionFees(reg, config)

      // netReceived = total - stripe = 7500 - 248 = 7252
      // organizerNet = netReceived - platform = 7252 - 500 = 6752
      const expectedNet = b.totalChargeCents - b.stripeFeeCents - b.platformFeeCents
      expect(b.organizerNetCents).toBe(expectedNet)
    })

    it('customer pays the least of any fee model', () => {
      const absorbB = calculateCompetitionFees(reg, config)
      const defaultB = calculateCompetitionFees(reg, defaultConfig())
      const stripeOnlyB = calculateCompetitionFees(reg, customerPaysStripeOnlyConfig())
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      expect(absorbB.totalChargeCents).toBeLessThanOrEqual(defaultB.totalChargeCents)
      expect(absorbB.totalChargeCents).toBeLessThanOrEqual(stripeOnlyB.totalChargeCents)
      expect(absorbB.totalChargeCents).toBeLessThanOrEqual(bothB.totalChargeCents)
    })

    it('destination charge still works: organizer gets correct net', () => {
      const b = calculateCompetitionFees(reg, config)
      const appFee = computeApplicationFee(b)

      expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
    })
  })

  describe('fee model comparison at $75 registration', () => {
    const reg = 7500

    it('organizer net ordering: absorb-both < stripe-only < default < pays-both', () => {
      const absorbB = calculateCompetitionFees(reg, organizerAbsorbsBothConfig())
      const defaultB = calculateCompetitionFees(reg, defaultConfig())
      const stripeOnlyB = calculateCompetitionFees(reg, customerPaysStripeOnlyConfig())
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      // absorb-both: 6752 (absorbs Stripe + platform from revenue)
      // stripe-only: 7000 (absorbs platform, customer pays Stripe)
      // default:     7238 (customer pays platform, absorbs Stripe from larger total)
      // pays-both:   7500 (customer covers everything, organizer gets full fee)
      expect(absorbB.organizerNetCents).toBeLessThan(stripeOnlyB.organizerNetCents)
      expect(stripeOnlyB.organizerNetCents).toBeLessThan(defaultB.organizerNetCents)
      expect(defaultB.organizerNetCents).toBeLessThan(bothB.organizerNetCents)
    })

    it('customer charge ordering: absorb-both < stripe-only < default < pays-both', () => {
      const absorbB = calculateCompetitionFees(reg, organizerAbsorbsBothConfig())
      const defaultB = calculateCompetitionFees(reg, defaultConfig())
      const stripeOnlyB = calculateCompetitionFees(reg, customerPaysStripeOnlyConfig())
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      // absorb-both: customer pays only $75.00
      // stripe-only: customer pays $75 + Stripe (~$77.55)
      // default: customer pays $75 + platform ($80.00)
      // pays-both: customer pays $75 + platform + Stripe (~$82.70)
      expect(absorbB.totalChargeCents).toBeLessThan(stripeOnlyB.totalChargeCents)
      expect(stripeOnlyB.totalChargeCents).toBeLessThan(defaultB.totalChargeCents)
      expect(defaultB.totalChargeCents).toBeLessThan(bothB.totalChargeCents)
    })

    it('all models: sum of parts equals total (±1¢)', () => {
      const configs = [
        organizerAbsorbsBothConfig(),
        defaultConfig(),
        customerPaysStripeOnlyConfig(),
        customerPaysBothConfig(),
      ]

      for (const config of configs) {
        const b = calculateCompetitionFees(reg, config)
        const sum = b.organizerNetCents + b.stripeFeeCents + b.platformFeeCents
        expect(Math.abs(b.totalChargeCents - sum)).toBeLessThanOrEqual(1)
      }
    })

    it('platform fee is the same regardless of who pays it', () => {
      const configs = [
        organizerAbsorbsBothConfig(),
        defaultConfig(),
        customerPaysStripeOnlyConfig(),
        customerPaysBothConfig(),
      ]

      const platformFees = configs.map(c => calculateCompetitionFees(reg, c).platformFeeCents)

      // Platform fee calculation doesn't change based on who pays
      // All should be 7500 * 0.04 + 200 = 500
      for (const fee of platformFees) {
        expect(fee).toBe(500)
      }
    })

    it('Stripe fee varies because it depends on total charged', () => {
      const absorbB = calculateCompetitionFees(reg, organizerAbsorbsBothConfig())
      const bothB = calculateCompetitionFees(reg, customerPaysBothConfig())

      // Higher total = higher Stripe fee (percentage-based)
      expect(bothB.stripeFeeCents).toBeGreaterThan(absorbB.stripeFeeCents)
    })
  })

  describe('founding organizer rates', () => {
    it('founding organizer pays less platform fee than standard', () => {
      const standardBreakdown = calculateCompetitionFees(10000, defaultConfig())
      const foundingBreakdown = calculateCompetitionFees(10000, foundingOrganizerConfig())

      // Standard: 10000 * 0.04 + 200 = 600
      expect(standardBreakdown.platformFeeCents).toBe(600)
      // Founding: 10000 * 0.025 + 200 = 450
      expect(foundingBreakdown.platformFeeCents).toBe(450)

      // Founding organizer keeps more
      expect(foundingBreakdown.organizerNetCents).toBeGreaterThan(standardBreakdown.organizerNetCents)
    })

    it('founding organizer application fee is lower', () => {
      const standardB = calculateCompetitionFees(10000, defaultConfig())
      const foundingB = calculateCompetitionFees(10000, foundingOrganizerConfig())

      const standardAppFee = computeApplicationFee(standardB)
      const foundingAppFee = computeApplicationFee(foundingB)

      // Lower platform fee → lower application fee → organizer gets more
      expect(foundingAppFee).toBeLessThan(standardAppFee)
    })

    it('$75 founding organizer registration with exact values', () => {
      const b = calculateCompetitionFees(7500, foundingOrganizerConfig())

      // Platform: 7500 * 0.025 + 200 = 187.5 → round(187.5) + 200 = 188 + 200 = 388
      expect(b.platformFeeCents).toBe(388)
      // Total: 7500 + 388 = 7888
      expect(b.totalChargeCents).toBe(7888)

      const appFee = computeApplicationFee(b)
      expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
    })
  })

  describe('edge cases', () => {
    it('$1 registration (minimum realistic amount)', () => {
      const b = calculateCompetitionFees(100, defaultConfig())

      // Platform: round(100 * 0.04) + 200 = 4 + 200 = 204
      expect(b.platformFeeCents).toBe(204)
      expect(b.totalChargeCents).toBe(304) // 100 + 204

      const appFee = computeApplicationFee(b)
      expect(appFee).toBeGreaterThanOrEqual(0)
      expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
    })

    it('$500 registration (high amount)', () => {
      const b = calculateCompetitionFees(50000, defaultConfig())

      const appFee = computeApplicationFee(b)
      expect(appFee).toBeGreaterThan(0)
      expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)

      // Verify platform gets their fee
      const platformNet = appFee - b.stripeFeeCents
      expect(Math.abs(platformNet - b.platformFeeCents)).toBeLessThanOrEqual(1)
    })

    it('$1000 registration (very high amount)', () => {
      const b = calculateCompetitionFees(100000, defaultConfig())

      const appFee = computeApplicationFee(b)
      expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
    })

    it('all fee breakdowns have non-negative fees and valid application fee', () => {
      const amounts = [100, 500, 1000, 2500, 5000, 10000, 50000, 100000]
      const allConfigs = [
        defaultConfig(),
        customerPaysBothConfig(),
        customerPaysStripeOnlyConfig(),
        organizerAbsorbsBothConfig(),
        foundingOrganizerConfig(),
      ]

      for (const config of allConfigs) {
        for (const amount of amounts) {
          const b = calculateCompetitionFees(amount, config)

          expect(b.registrationFeeCents).toBeGreaterThanOrEqual(0)
          expect(b.platformFeeCents).toBeGreaterThanOrEqual(0)
          expect(b.stripeFeeCents).toBeGreaterThanOrEqual(0)

          // Note: organizerNetCents CAN be negative for very small amounts
          // when organizer absorbs both fees (fees exceed registration amount).
          // This is a valid business scenario - the organizer would lose money.

          const appFee = computeApplicationFee(b)
          expect(appFee).toBeGreaterThanOrEqual(0)
          // When organizerNet >= 0, appFee can't exceed totalCharge
          // When organizerNet < 0 (fees exceed revenue), appFee > totalCharge
          // is mathematically valid but wouldn't occur in real registrations
          if (b.organizerNetCents >= 0) {
            expect(appFee).toBeLessThanOrEqual(b.totalChargeCents)
          }
        }
      }
    })

    it('organizer net is positive for realistic registration amounts ($25+)', () => {
      // For amounts >= $25, organizer should always net positive across all configs
      const amounts = [2500, 5000, 10000, 50000, 100000]
      const allConfigs = [
        defaultConfig(),
        customerPaysBothConfig(),
        customerPaysStripeOnlyConfig(),
        organizerAbsorbsBothConfig(),
        foundingOrganizerConfig(),
      ]

      for (const config of allConfigs) {
        for (const amount of amounts) {
          const b = calculateCompetitionFees(amount, config)
          expect(b.organizerNetCents).toBeGreaterThan(0)
        }
      }
    })

    it('organizer net can go negative for tiny amounts when absorbing all fees', () => {
      // $1 registration with organizer absorbing both fees:
      // Platform: round(100 * 0.04) + 200 = 204
      // Total: 100 (only registration)
      // Stripe: round(100 * 0.029) + 30 = 33
      // Net received: 100 - 33 = 67
      // Organizer: 67 - 204 = -137 (fees exceed revenue!)
      const b = calculateCompetitionFees(100, organizerAbsorbsBothConfig())
      expect(b.organizerNetCents).toBeLessThan(0)

      // Application fee should still be valid (clamped to 0 at minimum)
      const appFee = computeApplicationFee(b)
      expect(appFee).toBeGreaterThanOrEqual(0)
    })

    it('organizer never receives more than total charge', () => {
      const amounts = [100, 1000, 5000, 10000, 50000]
      const allConfigs = [
        defaultConfig(),
        customerPaysBothConfig(),
        customerPaysStripeOnlyConfig(),
        organizerAbsorbsBothConfig(),
      ]

      for (const config of allConfigs) {
        for (const amount of amounts) {
          const b = calculateCompetitionFees(amount, config)
          expect(b.organizerNetCents).toBeLessThanOrEqual(b.totalChargeCents)
        }
      }
    })

    it('organizer never receives more than registration fee', () => {
      const amounts = [1000, 5000, 10000, 50000]
      const allConfigs = [
        defaultConfig(),
        customerPaysBothConfig(),
        customerPaysStripeOnlyConfig(),
        organizerAbsorbsBothConfig(),
      ]

      for (const config of allConfigs) {
        for (const amount of amounts) {
          const b = calculateCompetitionFees(amount, config)
          expect(b.organizerNetCents).toBeLessThanOrEqual(b.registrationFeeCents)
        }
      }
    })
  })

  describe('application fee components', () => {
    it('applicationFee = platformFee + stripeFee (±1¢ rounding)', () => {
      const amounts = [2500, 5000, 7500, 10000, 15000, 25000]
      const config = defaultConfig()

      for (const amount of amounts) {
        const b = calculateCompetitionFees(amount, config)
        const appFee = computeApplicationFee(b)

        // applicationFee should equal platformFee + stripeFee
        // because: appFee = totalCharge - organizerNet
        //          totalCharge = organizerNet + stripeFee + platformFee (±1¢)
        //          appFee = stripeFee + platformFee (±1¢)
        expect(Math.abs(appFee - (b.platformFeeCents + b.stripeFeeCents))).toBeLessThanOrEqual(1)
      }
    })

    it('applicationFee includes both platform and stripe fees when customer pays both', () => {
      const b = calculateCompetitionFees(5000, customerPaysBothConfig())
      const appFee = computeApplicationFee(b)

      // When customer pays both, appFee = totalCharge - registrationFee
      // Platform and Stripe are both in the app fee
      expect(appFee).toBe(b.totalChargeCents - b.organizerNetCents)
      expect(b.organizerNetCents).toBe(5000) // Gets full registration fee
    })
  })

  describe('Stripe minimum: $0.50 total charge', () => {
    // Stripe requires minimum charge of $0.50 (50 cents)
    // Our fee calc doesn't enforce this, but application fee should still be valid

    it('handles very small registration amounts gracefully', () => {
      const b = calculateCompetitionFees(50, defaultConfig())
      const appFee = computeApplicationFee(b)

      expect(appFee).toBeGreaterThanOrEqual(0)
      expect(b.totalChargeCents - appFee).toBe(b.organizerNetCents)
    })
  })
})
