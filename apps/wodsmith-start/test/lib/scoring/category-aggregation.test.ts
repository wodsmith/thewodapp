import { describe, expect, it } from "vitest"
import { aggregateBenchmarkScores } from "@/lib/scoring/category-aggregation"

describe("aggregateBenchmarkScores", () => {
	it("computes category scores and Overall/100 as weighted means without a second rescale", () => {
		const allSeven = aggregateBenchmarkScores({
			categories: [
				{ key: "STR", label: "Strength", testCount: 1, weight: 1 },
				{ key: "ENG", label: "Engine", testCount: 1, weight: 1 },
			],
			eventTiers: [
				{ eventId: "strict-press", categoryKey: "STR", tier: 7 },
				{ eventId: "mile-run", categoryKey: "ENG", tier: 7 },
			],
			maxTier: 10,
			scoreMax: 100,
		})

		expect(allSeven.categories.map((category) => category.score)).toEqual([70, 70])
		expect(allSeven.overallScore).toBe(70)

		const weighted = aggregateBenchmarkScores({
			categories: [
				{ key: "STR", label: "Strength", testCount: 2, weight: 3 },
				{ key: "ENG", label: "Engine", testCount: 1, weight: 1 },
			],
			eventTiers: [
				{ eventId: "strict-press", categoryKey: "STR", tier: 10 },
				{
					eventId: "weighted-c2b",
					categoryKey: "STR",
					tier: 10,
					includedInScoring: false,
				},
				{ eventId: "mile-run", categoryKey: "ENG", tier: 0 },
			],
			maxTier: 10,
			scoreMax: 100,
		})

		expect(weighted.categories.find((category) => category.key === "STR")?.score).toBe(50)
		expect(weighted.categories.find((category) => category.key === "ENG")?.score).toBe(0)
		expect(weighted.overallScore).toBe(37.5)
	})
})
