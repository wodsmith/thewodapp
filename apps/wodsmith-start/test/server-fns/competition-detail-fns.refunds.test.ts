/**
 * Tests for refund-aware loader fields on getOrganizerRegistrationsFn.
 *
 * The loader returns a `refundsByPurchaseId` map so the athletes page can
 * render "Refunded" / "Partially refunded" badges. The pure rollup function
 * is extracted from the server fn for direct testing — the surrounding fetch
 * code is a thin passthrough.
 */
import {describe, expect, it} from "vitest"
import {computeRefundsByPurchase} from "@/server-fns/competition-detail-fns"

describe("computeRefundsByPurchase", () => {
	it("returns an empty map when there are no refund events", () => {
		const result = computeRefundsByPurchase(
			[],
			new Map([["p1", 10000]]),
		)
		expect(result).toEqual({})
	})

	it("sums refund event amounts per purchase as positive cents", () => {
		// Refund events store amountCents as negative (sign convention) but the
		// UI expects positive cents — the pure function must normalize.
		const result = computeRefundsByPurchase(
			[
				{purchaseId: "p1", amountCents: -3000},
				{purchaseId: "p1", amountCents: -2000},
			],
			new Map([["p1", 10000]]),
		)
		expect(result).toEqual({
			p1: {refundedCents: 5000, totalCents: 10000},
		})
	})

	it("attaches the purchase totalCents so the UI can detect full refunds", () => {
		// "Fully refunded" vs "Partially refunded" is decided client-side from
		// (refundedCents, totalCents) — verifying the totalCents passes through
		// pins the contract.
		const result = computeRefundsByPurchase(
			[{purchaseId: "p1", amountCents: -10000}],
			new Map([["p1", 10000]]),
		)
		expect(result.p1?.totalCents).toBe(10000)
	})

	it("ignores refund events for purchases not in the totals map", () => {
		// Defensive: an orphaned event from a deleted purchase should not crash
		// or insert a meaningless entry.
		const result = computeRefundsByPurchase(
			[
				{purchaseId: "p1", amountCents: -5000},
				{purchaseId: "p-orphan", amountCents: -9999},
			],
			new Map([["p1", 10000]]),
		)
		expect(result).toEqual({
			p1: {refundedCents: 5000, totalCents: 10000},
		})
		expect(result["p-orphan"]).toBeUndefined()
	})

	it("handles multiple purchases independently", () => {
		const result = computeRefundsByPurchase(
			[
				{purchaseId: "p1", amountCents: -2000},
				{purchaseId: "p2", amountCents: -5000},
				{purchaseId: "p2", amountCents: -3000},
			],
			new Map([
				["p1", 10000],
				["p2", 8000],
			]),
		)
		expect(result).toEqual({
			p1: {refundedCents: 2000, totalCents: 10000},
			p2: {refundedCents: 8000, totalCents: 8000},
		})
	})
})
