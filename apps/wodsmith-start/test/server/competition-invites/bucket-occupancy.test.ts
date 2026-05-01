import { beforeEach, describe, expect, it, vi } from "vitest"

// Two-row select-result queue. The bucket count helper fires two reads
// in parallel (accepted-paid invites + pending invite-driven purchases);
// the queue maps 1:1 to those reads in dispatch order.
const selectQueue: unknown[][] = []

function makeChain(): unknown {
	const chain: Record<string, unknown> = {}
	const noop = () => chain
	for (const m of ["from", "where", "innerJoin"]) {
		chain[m] = vi.fn(noop)
	}
	chain.then = (resolve: (value: unknown) => void) => {
		const next = selectQueue.shift() ?? []
		resolve(next)
		return Promise.resolve(next)
	}
	return chain
}

const fakeDb = {
	select: vi.fn(() => makeChain()),
}

vi.mock("@/db", () => ({
	getDb: vi.fn(() => fakeDb),
}))

vi.mock("cloudflare:workers", () => ({
	env: { APP_URL: "https://test.wodsmith.com" },
}))

import { getOccupiedCountForBucket } from "@/server/competition-invites/claim"

beforeEach(() => {
	selectQueue.length = 0
	fakeDb.select.mockClear()
})

// @lat: [[competition-invites#Claim resolution]]
describe("getOccupiedCountForBucket", () => {
	// Mirrors the regular division-capacity pattern: a slot in the
	// (sourceId, championshipDivisionId) bucket is occupied when an
	// invite is accepted_paid OR an athlete is mid-Stripe-checkout for
	// an invite-driven purchase. Two athletes claiming the last spot
	// must both see the in-flight hold so the second one bounces at
	// claim load instead of paying-then-refunding.
	it("sums accepted_paid invites and in-flight pending purchases in the bucket", async () => {
		// Read 1: accepted_paid invites count.
		selectQueue.push([{ count: 3 }])
		// Read 2: pending invite-driven purchases count (held spots).
		selectQueue.push([{ count: 2 }])

		const total = await getOccupiedCountForBucket({
			sourceId: "cisrc_1",
			championshipCompetitionId: "comp_champ",
			championshipDivisionId: "div_rxm",
		})

		expect(total).toBe(5)
		expect(fakeDb.select).toHaveBeenCalledTimes(2)
	})

	it("coerces string COUNT(*) values from the PlanetScale driver to numbers", async () => {
		// PlanetScale returns COUNT(*) as a string in some shapes. The
		// previous helper already used Number() — pin that the new helper
		// keeps doing so for both component reads.
		selectQueue.push([{ count: "4" }])
		selectQueue.push([{ count: "1" }])

		const total = await getOccupiedCountForBucket({
			sourceId: "cisrc_1",
			championshipCompetitionId: "comp_champ",
			championshipDivisionId: "div_rxm",
		})

		expect(total).toBe(5)
	})

	it("returns 0 when neither accepted nor pending rows exist for the bucket", async () => {
		selectQueue.push([{ count: 0 }])
		selectQueue.push([{ count: 0 }])

		const total = await getOccupiedCountForBucket({
			sourceId: "cisrc_empty",
			championshipCompetitionId: "comp_champ",
			championshipDivisionId: "div_rxm",
		})

		expect(total).toBe(0)
	})

	// The exclude trick is what makes the webhook re-check work: the
	// current purchase is still PENDING when the workflow probes the
	// bucket, so the count must subtract it. Same `id != $purchaseId`
	// pattern the regular division-capacity webhook uses.
	it("accepts excludePurchaseId so the webhook can omit its own purchase row", async () => {
		selectQueue.push([{ count: 1 }])
		selectQueue.push([{ count: 0 }])

		const total = await getOccupiedCountForBucket({
			sourceId: "cisrc_1",
			championshipCompetitionId: "comp_champ",
			championshipDivisionId: "div_rxm",
			excludePurchaseId: "cmp_self",
		})

		expect(total).toBe(1)
	})
})
