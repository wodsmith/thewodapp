/**
 * Sort Key Tests
 *
 * Tests for sort key computation including secondary_value handling
 * for capped scores and tiebreak values.
 */

import { describe, expect, it } from "vitest"
import { computeSortKey, sortKeyToString } from "@/lib/scoring/sort/sort-key"
import type { Score } from "@/lib/scoring"

describe("computeSortKey", () => {
	describe("basic sorting", () => {
		it("should produce lower sort key for faster time (scored)", () => {
			const fast: Pick<Score, "value" | "status" | "scheme" | "scoreType"> = {
				scheme: "time",
				scoreType: "min",
				value: 510000, // 8:30
				status: "scored",
			}
			const slow: Pick<Score, "value" | "status" | "scheme" | "scoreType"> = {
				scheme: "time",
				scoreType: "min",
				value: 720000, // 12:00
				status: "scored",
			}

			const keyFast = computeSortKey(fast)
			const keySlow = computeSortKey(slow)

			expect(keyFast).toBeLessThan(keySlow)
		})

		it("should produce lower sort key for scored vs capped", () => {
			const scored: Pick<Score, "value" | "status" | "scheme" | "scoreType"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 899000, // Just under cap
				status: "scored",
			}
			const capped: Pick<Score, "value" | "status" | "scheme" | "scoreType"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 600000, // Time cap value
				status: "cap",
			}

			const keyScored = computeSortKey(scored)
			const keyCapped = computeSortKey(capped)

			expect(keyScored).toBeLessThan(keyCapped)
		})
	})

	describe("capped scores with secondary_value (reps at cap)", () => {
		it("should produce different sort keys for capped scores with different secondary_value", () => {
			// Sarah: Capped with 99 reps
			const sarah: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "timeCap"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 600000, // Time cap
				status: "cap",
				timeCap: {
					ms: 600000,
					secondaryValue: 99,
				},
			}
			// John: Capped with 100 reps (should rank higher)
			const john: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "timeCap"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 600000, // Same time cap
				status: "cap",
				timeCap: {
					ms: 600000,
					secondaryValue: 100,
				},
			}

			const keySarah = computeSortKey(sarah)
			const keyJohn = computeSortKey(john)

			// John has more reps, should have lower (better) sort key
			expect(keyJohn).toBeLessThan(keySarah)
		})

		it("should sort multiple capped athletes correctly by reps", () => {
			const athletes = [
				{ reps: 50, name: "worst" },
				{ reps: 150, name: "best" },
				{ reps: 100, name: "middle" },
			].map(({ reps, name }) => ({
				name,
				score: {
					scheme: "time-with-cap" as const,
					scoreType: "min" as const,
					value: 600000,
					status: "cap" as const,
					timeCap: { ms: 600000, secondaryValue: reps },
				},
			}))

			const sorted = athletes.sort((a, b) => {
				const keyA = computeSortKey(a.score)
				const keyB = computeSortKey(b.score)
				return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
			})

			// Higher reps should sort first
			expect(sorted[0].name).toBe("best") // 150 reps
			expect(sorted[1].name).toBe("middle") // 100 reps
			expect(sorted[2].name).toBe("worst") // 50 reps
		})

		it("should rank finished athletes before capped athletes regardless of reps", () => {
			// Finished slow
			const finished: Pick<Score, "value" | "status" | "scheme" | "scoreType"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 599000, // Just under cap
				status: "scored",
			}
			// Capped with many reps
			const capped: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "timeCap"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 600000,
				status: "cap",
				timeCap: {
					ms: 600000,
					secondaryValue: 999, // Many reps
				},
			}

			const keyFinished = computeSortKey(finished)
			const keyCapped = computeSortKey(capped)

			// Finished should always beat capped
			expect(keyFinished).toBeLessThan(keyCapped)
		})
	})

	describe("tiebreak values", () => {
		it("should produce different sort keys for same score with different tiebreaks", () => {
			// Same time, different tiebreaks
			const fastTiebreak: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "tiebreak"> = {
				scheme: "time",
				scoreType: "min",
				value: 510000, // 8:30
				status: "scored",
				tiebreak: {
					scheme: "time",
					value: 165000, // 2:45 tiebreak
				},
			}
			const slowTiebreak: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "tiebreak"> = {
				scheme: "time",
				scoreType: "min",
				value: 510000, // Same 8:30
				status: "scored",
				tiebreak: {
					scheme: "time",
					value: 180000, // 3:00 tiebreak
				},
			}

			const keyFast = computeSortKey(fastTiebreak)
			const keySlow = computeSortKey(slowTiebreak)

			// Faster tiebreak should have lower sort key
			expect(keyFast).toBeLessThan(keySlow)
		})

		it("should sort capped athletes with same reps by tiebreak", () => {
			// Mike: Capped, 40 reps, 3:00 tiebreak
			const mike: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "timeCap" | "tiebreak"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 600000,
				status: "cap",
				timeCap: {
					ms: 600000,
					secondaryValue: 40,
				},
				tiebreak: {
					scheme: "time",
					value: 180000, // 3:00
				},
			}
			// John: Capped, 40 reps, 3:30 tiebreak
			const john: Pick<Score, "value" | "status" | "scheme" | "scoreType" | "timeCap" | "tiebreak"> = {
				scheme: "time-with-cap",
				scoreType: "min",
				value: 600000,
				status: "cap",
				timeCap: {
					ms: 600000,
					secondaryValue: 40, // Same reps
				},
				tiebreak: {
					scheme: "time",
					value: 210000, // 3:30
				},
			}

			const keyMike = computeSortKey(mike)
			const keyJohn = computeSortKey(john)

			// Mike has faster tiebreak, should rank higher
			expect(keyMike).toBeLessThan(keyJohn)
		})
	})

	describe("sortKeyToString", () => {
		it("should produce string that sorts correctly", () => {
			const keys = [
				computeSortKey({ scheme: "time", scoreType: "min", value: 720000, status: "scored" }),
				computeSortKey({ scheme: "time", scoreType: "min", value: 510000, status: "scored" }),
				computeSortKey({ scheme: "time", scoreType: "min", value: 600000, status: "scored" }),
			]

			const strings = keys.map(sortKeyToString)
			const sorted = [...strings].sort()

			// String sort should match numeric order
			expect(sorted[0]).toBe(strings[1]) // 510000 first
			expect(sorted[1]).toBe(strings[2]) // 600000 second
			expect(sorted[2]).toBe(strings[0]) // 720000 last
		})
	})
})
