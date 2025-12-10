import { describe, expect, it } from "vitest"
import {
	calculateCompetitionFees,
	buildFeeConfig,
	formatCents,
	PLATFORM_DEFAULTS,
} from "@/server/commerce/utils"
import type { FeeConfiguration } from "@/server/commerce/fee-calculator"

/**
 * Default fee config for testing - matches platform defaults
 * Platform: 2.5% + $2.00, Stripe: 2.9% + $0.30
 */
const defaultConfig: FeeConfiguration = {
	platformPercentageBasisPoints: 250, // 2.5%
	platformFixedCents: 200, // $2.00
	stripePercentageBasisPoints: 290, // 2.9%
	stripeFixedCents: 30, // $0.30
	passStripeFeesToCustomer: true,
	passPlatformFeesToCustomer: true,
}

describe("calculateCompetitionFees", () => {
	describe("Model 1: Customer pays both fees (default)", () => {
		const config: FeeConfiguration = {
			...defaultConfig,
			passStripeFeesToCustomer: true,
			passPlatformFeesToCustomer: true,
		}

		it("calculates fees for $50 registration", () => {
			const result = calculateCompetitionFees(5000, config)

			// Platform fee: $50 * 2.5% + $2.00 = $3.25
			expect(result.platformFeeCents).toBe(325)
			// Subtotal before Stripe: $50 + $3.25 = $53.25
			// Stripe formula: total = (5325 + 30) / 0.971 = 5515.45 ≈ 5515
			expect(result.totalChargeCents).toBe(5515)
			// Stripe fee: 5517 * 2.9% + 30 = 189.99 + 30 ≈ 190 + 30 = 220
			// Note: Stripe fee on total is calculated to ensure we receive the subtotal
			expect(result.stripeFeeCents).toBeGreaterThan(0)
			// Organizer net = registration fee when platform passed to customer
			expect(result.organizerNetCents).toBe(5000)
			expect(result.registrationFeeCents).toBe(5000)
			expect(result.stripeFeesPassedToCustomer).toBe(true)
			expect(result.platformFeesPassedToCustomer).toBe(true)
		})

		it("calculates fees for $100 registration", () => {
			const result = calculateCompetitionFees(10000, config)

			// Platform: $100 * 2.5% + $2.00 = $4.50
			expect(result.platformFeeCents).toBe(450)
			// Organizer gets full registration fee
			expect(result.organizerNetCents).toBe(10000)
		})

		it("handles $0 registration (free)", () => {
			const result = calculateCompetitionFees(0, config)

			expect(result.registrationFeeCents).toBe(0)
			expect(result.platformFeeCents).toBe(200) // Fixed fee still applies
			expect(result.totalChargeCents).toBeGreaterThan(0) // Stripe covers fees on platform fee
			expect(result.organizerNetCents).toBe(0)
		})
	})

	describe("Model 2: Customer pays platform only, organizer absorbs Stripe", () => {
		const config: FeeConfiguration = {
			...defaultConfig,
			passStripeFeesToCustomer: false,
			passPlatformFeesToCustomer: true,
		}

		it("calculates fees for $50 registration", () => {
			const result = calculateCompetitionFees(5000, config)

			// Platform: $50 * 2.5% + $2 = $3.25
			expect(result.platformFeeCents).toBe(325)
			// Total = registration + platform = $53.25
			expect(result.totalChargeCents).toBe(5325)
			// Stripe fee deducted from total: 5325 * 2.9% + 30 = 154 + 30 = 184
			expect(result.stripeFeeCents).toBe(184)
			// Organizer net = total - Stripe - platform
			// 5325 - 184 - 325 = 4816
			expect(result.organizerNetCents).toBe(4816)
			expect(result.stripeFeesPassedToCustomer).toBe(false)
			expect(result.platformFeesPassedToCustomer).toBe(true)
		})

		it("organizer net is less than registration when absorbing Stripe fees", () => {
			const result = calculateCompetitionFees(5000, config)

			// Organizer absorbs Stripe fee, so net < registration
			expect(result.organizerNetCents).toBeLessThan(5000)
		})
	})

	describe("Model 3: Customer pays Stripe only, organizer absorbs platform", () => {
		const config: FeeConfiguration = {
			...defaultConfig,
			passStripeFeesToCustomer: true,
			passPlatformFeesToCustomer: false,
		}

		it("calculates fees for $50 registration", () => {
			const result = calculateCompetitionFees(5000, config)

			// Platform: $50 * 2.5% + $2 = $3.25 (not charged to customer)
			expect(result.platformFeeCents).toBe(325)
			// Subtotal = just registration = $50
			// Total with Stripe: (5000 + 30) / 0.971 = 5180.23 ≈ 5181
			expect(result.totalChargeCents).toBe(5181)
			// Organizer net = registration - platform fee
			expect(result.organizerNetCents).toBe(4675) // 5000 - 325
			expect(result.stripeFeesPassedToCustomer).toBe(true)
			expect(result.platformFeesPassedToCustomer).toBe(false)
		})

		it("customer charge is lower than model 1", () => {
			const model1Config = { ...config, passPlatformFeesToCustomer: true }
			const model3Result = calculateCompetitionFees(5000, config)
			const model1Result = calculateCompetitionFees(5000, model1Config)

			expect(model3Result.totalChargeCents).toBeLessThan(
				model1Result.totalChargeCents,
			)
		})
	})

	describe("Model 4: Organizer absorbs both fees", () => {
		const config: FeeConfiguration = {
			...defaultConfig,
			passStripeFeesToCustomer: false,
			passPlatformFeesToCustomer: false,
		}

		it("calculates fees for $50 registration", () => {
			const result = calculateCompetitionFees(5000, config)

			// Customer just pays registration
			expect(result.totalChargeCents).toBe(5000)
			// Platform: $50 * 2.5% + $2 = $3.25
			expect(result.platformFeeCents).toBe(325)
			// Stripe: $50 * 2.9% + $0.30 = $1.75
			expect(result.stripeFeeCents).toBe(175)
			// Organizer net = registration - Stripe - platform
			// 5000 - 175 - 325 = 4500
			expect(result.organizerNetCents).toBe(4500)
			expect(result.stripeFeesPassedToCustomer).toBe(false)
			expect(result.platformFeesPassedToCustomer).toBe(false)
		})

		it("total charge equals registration fee exactly", () => {
			const result = calculateCompetitionFees(7500, config)
			expect(result.totalChargeCents).toBe(7500)
		})

		it("organizer net is lowest of all models", () => {
			const model1 = calculateCompetitionFees(5000, {
				...config,
				passStripeFeesToCustomer: true,
				passPlatformFeesToCustomer: true,
			})
			const model4 = calculateCompetitionFees(5000, config)

			expect(model4.organizerNetCents).toBeLessThan(model1.organizerNetCents)
		})
	})

	describe("Fee calculation edge cases", () => {
		it("handles small registration amounts", () => {
			const result = calculateCompetitionFees(100, defaultConfig) // $1.00

			expect(result.registrationFeeCents).toBe(100)
			expect(result.platformFeeCents).toBe(203) // 100 * 2.5% + 200 = 2.5 + 200 = 202.5 ≈ 203
		})

		it("handles large registration amounts", () => {
			const result = calculateCompetitionFees(50000, defaultConfig) // $500

			// Platform: $500 * 2.5% + $2 = $14.50
			expect(result.platformFeeCents).toBe(1450)
			expect(result.organizerNetCents).toBe(50000)
		})

		it("rounds correctly for non-integer calculations", () => {
			// $33 registration fee causes non-integer platform percentage
			const result = calculateCompetitionFees(3300, defaultConfig)

			// Platform: 3300 * 2.5% + 200 = 82.5 + 200 = 282.5 ≈ 283
			expect(result.platformFeeCents).toBe(283)
			// All values should be integers
			expect(Number.isInteger(result.totalChargeCents)).toBe(true)
			expect(Number.isInteger(result.stripeFeeCents)).toBe(true)
			expect(Number.isInteger(result.organizerNetCents)).toBe(true)
		})

		it("uses custom platform fee percentages", () => {
			const customConfig: FeeConfiguration = {
				...defaultConfig,
				platformPercentageBasisPoints: 500, // 5%
				platformFixedCents: 100, // $1.00
			}
			const result = calculateCompetitionFees(5000, customConfig)

			// Platform: $50 * 5% + $1 = $3.50
			expect(result.platformFeeCents).toBe(350)
		})

		it("handles zero platform fee", () => {
			const zeroFeeConfig: FeeConfiguration = {
				...defaultConfig,
				platformPercentageBasisPoints: 0,
				platformFixedCents: 0,
			}
			const result = calculateCompetitionFees(5000, zeroFeeConfig)

			expect(result.platformFeeCents).toBe(0)
			expect(result.organizerNetCents).toBe(5000)
		})
	})

	describe("Stripe fee formula correctness", () => {
		it("ensures Stripe receives correct amount after fees", () => {
			const result = calculateCompetitionFees(5000, defaultConfig)

			// When passing Stripe fees to customer:
			// total = (subtotal + stripeFixed) / (1 - stripeRate)
			// After Stripe takes their cut, we should receive approximately subtotal
			const subtotal = 5000 + result.platformFeeCents
			const expectedTotal = Math.ceil((subtotal + 30) / 0.971)
			expect(result.totalChargeCents).toBe(expectedTotal)
		})
	})
})

describe("buildFeeConfig", () => {
	it("returns platform defaults when no overrides provided", () => {
		const config = buildFeeConfig({})

		expect(config.platformPercentageBasisPoints).toBe(
			PLATFORM_DEFAULTS.platformPercentageBasisPoints,
		)
		expect(config.platformFixedCents).toBe(PLATFORM_DEFAULTS.platformFixedCents)
		expect(config.stripePercentageBasisPoints).toBe(
			PLATFORM_DEFAULTS.stripePercentageBasisPoints,
		)
		expect(config.stripeFixedCents).toBe(PLATFORM_DEFAULTS.stripeFixedCents)
		expect(config.passStripeFeesToCustomer).toBe(false)
		expect(config.passPlatformFeesToCustomer).toBe(true)
	})

	it("uses custom platform percentage when provided", () => {
		const config = buildFeeConfig({ platformFeePercentage: 500 })
		expect(config.platformPercentageBasisPoints).toBe(500)
	})

	it("uses custom platform fixed fee when provided", () => {
		const config = buildFeeConfig({ platformFeeFixed: 300 })
		expect(config.platformFixedCents).toBe(300)
	})

	it("respects passStripeFeesToCustomer setting", () => {
		const config = buildFeeConfig({ passStripeFeesToCustomer: true })
		expect(config.passStripeFeesToCustomer).toBe(true)
	})

	it("respects passPlatformFeesToCustomer setting", () => {
		const config = buildFeeConfig({ passPlatformFeesToCustomer: false })
		expect(config.passPlatformFeesToCustomer).toBe(false)
	})

	it("handles null values as defaults", () => {
		const config = buildFeeConfig({
			platformFeePercentage: null,
			platformFeeFixed: null,
			passStripeFeesToCustomer: null,
			passPlatformFeesToCustomer: null,
		})

		expect(config.platformPercentageBasisPoints).toBe(
			PLATFORM_DEFAULTS.platformPercentageBasisPoints,
		)
		expect(config.platformFixedCents).toBe(PLATFORM_DEFAULTS.platformFixedCents)
		expect(config.passStripeFeesToCustomer).toBe(false)
		expect(config.passPlatformFeesToCustomer).toBe(true)
	})

	it("applies multiple overrides correctly", () => {
		const config = buildFeeConfig({
			platformFeePercentage: 300,
			platformFeeFixed: 150,
			passStripeFeesToCustomer: true,
			passPlatformFeesToCustomer: false,
		})

		expect(config.platformPercentageBasisPoints).toBe(300)
		expect(config.platformFixedCents).toBe(150)
		expect(config.passStripeFeesToCustomer).toBe(true)
		expect(config.passPlatformFeesToCustomer).toBe(false)
		// Stripe fees always use platform defaults
		expect(config.stripePercentageBasisPoints).toBe(290)
		expect(config.stripeFixedCents).toBe(30)
	})
})

describe("formatCents", () => {
	it("formats whole dollar amounts", () => {
		expect(formatCents(5000)).toBe("$50.00")
		expect(formatCents(10000)).toBe("$100.00")
		expect(formatCents(100)).toBe("$1.00")
	})

	it("formats amounts with cents", () => {
		expect(formatCents(5325)).toBe("$53.25")
		expect(formatCents(1099)).toBe("$10.99")
		expect(formatCents(50)).toBe("$0.50")
	})

	it("formats zero", () => {
		expect(formatCents(0)).toBe("$0.00")
	})

	it("formats large amounts", () => {
		expect(formatCents(100000)).toBe("$1000.00")
		expect(formatCents(999999)).toBe("$9999.99")
	})

	it("handles single cent", () => {
		expect(formatCents(1)).toBe("$0.01")
	})
})

describe("PLATFORM_DEFAULTS", () => {
	it("has expected default values", () => {
		expect(PLATFORM_DEFAULTS.platformPercentageBasisPoints).toBe(250) // 2.5%
		expect(PLATFORM_DEFAULTS.platformFixedCents).toBe(200) // $2.00
		expect(PLATFORM_DEFAULTS.stripePercentageBasisPoints).toBe(290) // 2.9%
		expect(PLATFORM_DEFAULTS.stripeFixedCents).toBe(30) // $0.30
	})
})

describe("Real-world scenarios", () => {
	it("$75 registration with default fees", () => {
		const config = buildFeeConfig({})
		// Default: customer pays platform, absorbs Stripe
		const result = calculateCompetitionFees(7500, config)

		// Platform: 7500 * 2.5% + 200 = 187.5 + 200 = 387.5 ≈ 388
		expect(result.platformFeeCents).toBe(388)
		// Total = registration + platform = 7888
		expect(result.totalChargeCents).toBe(7888)
		// Stripe: 7888 * 2.9% + 30 = 229 + 30 = 259
		expect(result.stripeFeeCents).toBe(259)
		// Net = 7888 - 259 - 388 = 7241
		expect(result.organizerNetCents).toBe(7241)
	})

	it("$125 registration with customer paying all fees", () => {
		const config = buildFeeConfig({
			passStripeFeesToCustomer: true,
			passPlatformFeesToCustomer: true,
		})
		const result = calculateCompetitionFees(12500, config)

		// Platform: 12500 * 2.5% + 200 = 312.5 + 200 = 512.5 ≈ 513
		expect(result.platformFeeCents).toBe(513)
		// Organizer receives full registration fee
		expect(result.organizerNetCents).toBe(12500)
		// Customer pays more than registration
		expect(result.totalChargeCents).toBeGreaterThan(12500 + 513)
	})

	it("budget-friendly $25 registration with organizer absorbing fees", () => {
		const config = buildFeeConfig({
			passStripeFeesToCustomer: false,
			passPlatformFeesToCustomer: false,
		})
		const result = calculateCompetitionFees(2500, config)

		// Customer pays exactly $25
		expect(result.totalChargeCents).toBe(2500)
		// Platform: 2500 * 2.5% + 200 = 62.5 + 200 = 262.5 ≈ 263
		expect(result.platformFeeCents).toBe(263)
		// Stripe: 2500 * 2.9% + 30 = 72.5 + 30 = 102.5 ≈ 103
		expect(result.stripeFeeCents).toBe(103)
		// Net: 2500 - 263 - 103 = 2134
		expect(result.organizerNetCents).toBe(2134)
	})
})
