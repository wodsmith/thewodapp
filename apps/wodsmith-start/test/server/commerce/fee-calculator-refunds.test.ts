/**
 * Tests for refund-aware revenue aggregation.
 *
 * The pure aggregation function is what powers the Organizer Revenue page.
 * Refunds are sourced from REFUND_INITIATED financial events (negative
 * amountCents) and rolled up per-division and at the competition level so the
 * page can show a "Refunds" column and adjust net revenue.
 */
import {describe, expect, it} from "vitest"
import {
	aggregateRevenueStats,
	type RevenueStatsInput,
} from "@/server/commerce/fee-calculator"

const purchase = (overrides: Partial<RevenueStatsInput["purchases"][number]>) => ({
	purchaseId: "p1",
	divisionId: "div-rx",
	totalCents: 10000,
	platformFeeCents: 600,
	stripeFeeCents: 320,
	organizerNetCents: 9080,
	...overrides,
})

describe("aggregateRevenueStats", () => {
	describe("with no refunds", () => {
		it("returns zero refund totals at the top level", () => {
			const stats = aggregateRevenueStats({
				purchases: [purchase({})],
				refundEvents: [],
				divisionLabels: new Map([["div-rx", "RX"]]),
				divisionFees: new Map([["div-rx", 10000]]),
				defaultFeeCents: 0,
			})

			expect(stats.totalRefundedCents).toBe(0)
		})

		it("returns zero refundedCents per division", () => {
			const stats = aggregateRevenueStats({
				purchases: [purchase({})],
				refundEvents: [],
				divisionLabels: new Map([["div-rx", "RX"]]),
				divisionFees: new Map([["div-rx", 10000]]),
				defaultFeeCents: 0,
			})

			expect(stats.byDivision[0]?.refundedCents).toBe(0)
		})
	})

	describe("with a single full refund", () => {
		// Two RX purchases (one fully refunded, one paid). Refund amount equals
		// the purchase total so "Net after refunds" should drop by exactly that
		// amount.
		const input: RevenueStatsInput = {
			purchases: [
				purchase({purchaseId: "p1", totalCents: 10000, organizerNetCents: 9080}),
				purchase({purchaseId: "p2", totalCents: 10000, organizerNetCents: 9080}),
			],
			refundEvents: [
				{purchaseId: "p1", amountCents: -10000}, // full refund
			],
			divisionLabels: new Map([["div-rx", "RX"]]),
			divisionFees: new Map([["div-rx", 10000]]),
			defaultFeeCents: 0,
		}

		it("sums refund amounts at the top level (absolute value)", () => {
			const stats = aggregateRevenueStats(input)
			expect(stats.totalRefundedCents).toBe(10000)
		})

		it("attributes the refund to the same division as the original purchase", () => {
			const stats = aggregateRevenueStats(input)
			const rx = stats.byDivision.find((d) => d.divisionId === "div-rx")
			expect(rx?.refundedCents).toBe(10000)
		})

		it("leaves organizerNetCents at the pre-refund value (refund subtraction is a UI concern)", () => {
			// The page subtracts refunds from net for the displayed "Net Revenue"
			// number — but the field itself stays semantically "what we collected
			// minus fees, before refunds" so it still reconciles with the
			// per-purchase organizerNetCents column on the purchases ledger.
			const stats = aggregateRevenueStats(input)
			expect(stats.totalOrganizerNetCents).toBe(18160)
			const rx = stats.byDivision.find((d) => d.divisionId === "div-rx")
			expect(rx?.organizerNetCents).toBe(18160)
		})
	})

	describe("with partial refunds across divisions", () => {
		// Two divisions: RX (one purchase, $50 partial refund) and Scaled (one
		// purchase, no refund). Each refund event MUST land in the correct
		// division bucket — refunds attributed to a different division would
		// silently distort the per-division totals.
		const input: RevenueStatsInput = {
			purchases: [
				purchase({
					purchaseId: "p-rx",
					divisionId: "div-rx",
					totalCents: 10000,
					organizerNetCents: 9080,
				}),
				purchase({
					purchaseId: "p-scaled",
					divisionId: "div-scaled",
					totalCents: 8000,
					platformFeeCents: 520,
					stripeFeeCents: 262,
					organizerNetCents: 7218,
				}),
			],
			refundEvents: [{purchaseId: "p-rx", amountCents: -5000}],
			divisionLabels: new Map([
				["div-rx", "RX"],
				["div-scaled", "Scaled"],
			]),
			divisionFees: new Map([
				["div-rx", 10000],
				["div-scaled", 8000],
			]),
			defaultFeeCents: 0,
		}

		it("attributes refunds only to the division that owns the purchase", () => {
			const stats = aggregateRevenueStats(input)
			const rx = stats.byDivision.find((d) => d.divisionId === "div-rx")
			const scaled = stats.byDivision.find((d) => d.divisionId === "div-scaled")
			expect(rx?.refundedCents).toBe(5000)
			expect(scaled?.refundedCents).toBe(0)
		})

		it("rolls all refund amounts up into totalRefundedCents", () => {
			const stats = aggregateRevenueStats(input)
			expect(stats.totalRefundedCents).toBe(5000)
		})
	})

	describe("with multiple partial refunds on the same purchase", () => {
		// $100 purchase with two partial refunds that together equal the total —
		// must sum to a single $100 refund attribution, not double-count.
		const input: RevenueStatsInput = {
			purchases: [
				purchase({
					purchaseId: "p-multi",
					divisionId: "div-rx",
					totalCents: 10000,
					organizerNetCents: 9080,
				}),
			],
			refundEvents: [
				{purchaseId: "p-multi", amountCents: -3000},
				{purchaseId: "p-multi", amountCents: -7000},
			],
			divisionLabels: new Map([["div-rx", "RX"]]),
			divisionFees: new Map([["div-rx", 10000]]),
			defaultFeeCents: 0,
		}

		it("sums multiple refund events on the same purchase", () => {
			const stats = aggregateRevenueStats(input)
			const rx = stats.byDivision.find((d) => d.divisionId === "div-rx")
			expect(rx?.refundedCents).toBe(10000)
			expect(stats.totalRefundedCents).toBe(10000)
		})
	})

	describe("with refund events for purchases not in the input", () => {
		// Defensive: if a refund event references a purchaseId that isn't in the
		// purchases list (e.g. from a soft-deleted/cancelled purchase), the
		// rollup should ignore it rather than crash or attribute it to "Unknown".
		const input: RevenueStatsInput = {
			purchases: [
				purchase({purchaseId: "p1", divisionId: "div-rx", totalCents: 10000}),
			],
			refundEvents: [
				{purchaseId: "p1", amountCents: -2000},
				{purchaseId: "p-orphan", amountCents: -9999},
			],
			divisionLabels: new Map([["div-rx", "RX"]]),
			divisionFees: new Map([["div-rx", 10000]]),
			defaultFeeCents: 0,
		}

		it("ignores refund events for unknown purchases", () => {
			const stats = aggregateRevenueStats(input)
			expect(stats.totalRefundedCents).toBe(2000)
			const rx = stats.byDivision.find((d) => d.divisionId === "div-rx")
			expect(rx?.refundedCents).toBe(2000)
		})
	})
})
