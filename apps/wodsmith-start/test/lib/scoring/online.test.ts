import { describe, expect, it } from "vitest"
import { calculateOnlinePoints } from "@/lib/scoring/algorithms/online"
import {
	calculateEventPoints,
	type EventScoreInput,
} from "@/lib/scoring/algorithms"
import type { ScoringConfig } from "@/types/scoring"

describe("Online Scoring Algorithm", () => {
	describe("calculateOnlinePoints", () => {
		it("should award 1 point for 1st place", () => {
			expect(calculateOnlinePoints(1)).toBe(1)
		})

		it("should award 2 points for 2nd place", () => {
			expect(calculateOnlinePoints(2)).toBe(2)
		})

		it("should award 3 points for 3rd place", () => {
			expect(calculateOnlinePoints(3)).toBe(3)
		})

		it("should award points equal to place for any position", () => {
			expect(calculateOnlinePoints(10)).toBe(10)
			expect(calculateOnlinePoints(50)).toBe(50)
			expect(calculateOnlinePoints(100)).toBe(100)
		})

		it("should handle place 0 (invalid - returns 1)", () => {
			expect(calculateOnlinePoints(0)).toBe(1)
		})

		it("should handle negative places (returns 1)", () => {
			expect(calculateOnlinePoints(-1)).toBe(1)
			expect(calculateOnlinePoints(-10)).toBe(1)
		})
	})

	describe("calculateEventPoints with online algorithm", () => {
		const config: ScoringConfig = {
			algorithm: "online",
			tiebreaker: { primary: "countback" },
			statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
		}

		const baseScores: EventScoreInput[] = [
			{ userId: "a", value: 60000, status: "scored" },
			{ userId: "b", value: 65000, status: "scored" },
			{ userId: "c", value: 70000, status: "scored" },
			{ userId: "d", value: 75000, status: "scored" },
		]

		it("calculates points for time-based event (ascending)", () => {
			const results = calculateEventPoints("e1", baseScores, "time", config)

			// Lower time = better = lower points (1st gets 1 point)
			expect(results.get("a")).toEqual({ userId: "a", points: 1, rank: 1 })
			expect(results.get("b")).toEqual({ userId: "b", points: 2, rank: 2 })
			expect(results.get("c")).toEqual({ userId: "c", points: 3, rank: 3 })
			expect(results.get("d")).toEqual({ userId: "d", points: 4, rank: 4 })
		})

		it("calculates points for reps-based event (descending)", () => {
			const results = calculateEventPoints("e1", baseScores, "reps", config)

			// Higher reps = better, so order is reversed
			expect(results.get("d")).toEqual({ userId: "d", points: 1, rank: 1 })
			expect(results.get("c")).toEqual({ userId: "c", points: 2, rank: 2 })
			expect(results.get("b")).toEqual({ userId: "b", points: 3, rank: 3 })
			expect(results.get("a")).toEqual({ userId: "a", points: 4, rank: 4 })
		})

		it("handles ties correctly (same points for tied athletes)", () => {
			const tiedScores: EventScoreInput[] = [
				{ userId: "a", value: 60000, status: "scored" },
				{ userId: "b", value: 60000, status: "scored" }, // Tied with a
				{ userId: "c", value: 70000, status: "scored" },
			]

			const results = calculateEventPoints("e1", tiedScores, "time", config)

			// Tied athletes get same rank and same points
			expect(results.get("a")).toEqual({ userId: "a", points: 1, rank: 1 })
			expect(results.get("b")).toEqual({ userId: "b", points: 1, rank: 1 })
			// 3rd place gets rank 3 (skipping rank 2 due to tie)
			expect(results.get("c")).toEqual({ userId: "c", points: 3, rank: 3 })
		})

		it("handles DNF as last place + 1", () => {
			const scoresWithDnf: EventScoreInput[] = [
				{ userId: "a", value: 60000, status: "scored" },
				{ userId: "b", value: 65000, status: "scored" },
				{ userId: "c", value: 0, status: "dnf" },
			]

			const results = calculateEventPoints("e1", scoresWithDnf, "time", config)

			expect(results.get("a")).toEqual({ userId: "a", points: 1, rank: 1 })
			expect(results.get("b")).toEqual({ userId: "b", points: 2, rank: 2 })
			// DNF gets rank 3 (last active rank 2 + 1), points = 3
			expect(results.get("c")).toEqual({ userId: "c", points: 3, rank: 3 })
		})

		it("handles DNS with penalty points (total participants + 1)", () => {
			const scoresWithDns: EventScoreInput[] = [
				{ userId: "a", value: 60000, status: "scored" },
				{ userId: "b", value: 0, status: "dns" },
			]

			const results = calculateEventPoints("e1", scoresWithDns, "time", config)

			expect(results.get("a")).toEqual({ userId: "a", points: 1, rank: 1 })
			// DNS gets penalty: rank = total scores (2) + 1 = 3, points = rank = 3
			expect(results.get("b")).toEqual({ userId: "b", points: 3, rank: 3 })
		})

		it("excludes withdrawn athletes", () => {
			const scoresWithWithdrawn: EventScoreInput[] = [
				{ userId: "a", value: 60000, status: "scored" },
				{ userId: "b", value: 0, status: "withdrawn" },
			]

			const results = calculateEventPoints(
				"e1",
				scoresWithWithdrawn,
				"time",
				config,
			)

			expect(results.get("a")).toEqual({ userId: "a", points: 1, rank: 1 })
			expect(results.has("b")).toBe(false)
		})

		it("handles empty scores", () => {
			const results = calculateEventPoints("e1", [], "time", config)
			expect(results.size).toBe(0)
		})

		it("handles single athlete", () => {
			const singleScore: EventScoreInput[] = [
				{ userId: "a", value: 60000, status: "scored" },
			]

			const results = calculateEventPoints("e1", singleScore, "time", config)

			expect(results.get("a")).toEqual({ userId: "a", points: 1, rank: 1 })
		})

		it("handles capped athletes in time-with-cap scheme", () => {
			const cappedScores: EventScoreInput[] = [
				{ userId: "a", value: 60000, status: "scored" },
				{ userId: "b", value: 65000, status: "scored" },
				{ userId: "c", value: 120000, status: "cap" }, // Hit time cap
			]

			const results = calculateEventPoints(
				"e1",
				cappedScores,
				"time-with-cap",
				config,
			)

			// Capped athlete ranks last among active athletes
			expect(results.get("a")?.rank).toBe(1)
			expect(results.get("a")?.points).toBe(1)
			expect(results.get("b")?.rank).toBe(2)
			expect(results.get("b")?.points).toBe(2)
			expect(results.get("c")?.rank).toBe(3)
			expect(results.get("c")?.points).toBe(3)
		})

		it("works correctly for large fields", () => {
			// Simulate 100 athletes
			const largeField: EventScoreInput[] = Array.from(
				{ length: 100 },
				(_, i) => ({
					userId: `user-${i + 1}`,
					value: (i + 1) * 1000, // Increasing times
					status: "scored" as const,
				}),
			)

			const results = calculateEventPoints("e1", largeField, "time", config)

			// First place gets 1 point
			expect(results.get("user-1")?.points).toBe(1)
			expect(results.get("user-1")?.rank).toBe(1)

			// Last place gets 100 points
			expect(results.get("user-100")?.points).toBe(100)
			expect(results.get("user-100")?.rank).toBe(100)

			// Middle place (50th) gets 50 points
			expect(results.get("user-50")?.points).toBe(50)
			expect(results.get("user-50")?.rank).toBe(50)
		})
	})

	describe("online scoring - lowest total wins verification", () => {
		const config: ScoringConfig = {
			algorithm: "online",
			tiebreaker: { primary: "countback" },
			statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
		}

		it("athlete with consistent finishes has lower total than inconsistent athlete", () => {
			// Simulate results across 3 events
			const event1Scores: EventScoreInput[] = [
				{ userId: "consistent", value: 62000, status: "scored" }, // 2nd
				{ userId: "inconsistent", value: 60000, status: "scored" }, // 1st
			]
			const event2Scores: EventScoreInput[] = [
				{ userId: "consistent", value: 61000, status: "scored" }, // 2nd
				{ userId: "inconsistent", value: 60000, status: "scored" }, // 1st
			]
			const event3Scores: EventScoreInput[] = [
				{ userId: "consistent", value: 60000, status: "scored" }, // 1st
				{ userId: "inconsistent", value: 90000, status: "scored" }, // 2nd (bad event)
			]

			const e1Results = calculateEventPoints("e1", event1Scores, "time", config)
			const e2Results = calculateEventPoints("e2", event2Scores, "time", config)
			const e3Results = calculateEventPoints("e3", event3Scores, "time", config)

			// Calculate totals
			const consistentTotal =
				(e1Results.get("consistent")?.points ?? 0) +
				(e2Results.get("consistent")?.points ?? 0) +
				(e3Results.get("consistent")?.points ?? 0)

			const inconsistentTotal =
				(e1Results.get("inconsistent")?.points ?? 0) +
				(e2Results.get("inconsistent")?.points ?? 0) +
				(e3Results.get("inconsistent")?.points ?? 0)

			// Consistent: 2 + 2 + 1 = 5 points
			expect(consistentTotal).toBe(5)
			// Inconsistent: 1 + 1 + 2 = 4 points (wins despite bad 3rd event)
			expect(inconsistentTotal).toBe(4)
			// Lower is better, so inconsistent athlete wins
			expect(inconsistentTotal).toBeLessThan(consistentTotal)
		})
	})
})
