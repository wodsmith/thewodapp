import { describe, it, expect } from "vitest"
import {
	calculateEventPoints,
	DEFAULT_SCORING_CONFIG,
	DEFAULT_TRADITIONAL_CONFIG,
	DEFAULT_PSCORE_CONFIG,
	getScoringAlgorithmName,
	canHaveNegativeScores,
	type EventScoreInput,
} from "@/lib/scoring/algorithms"
import type { ScoringConfig } from "@/types/scoring"

describe("Scoring Factory", () => {
	describe("calculateEventPoints", () => {
		const baseScores: EventScoreInput[] = [
			{ userId: "a", value: 60000, status: "scored" },
			{ userId: "b", value: 65000, status: "scored" },
			{ userId: "c", value: 70000, status: "scored" },
			{ userId: "d", value: 75000, status: "scored" },
		]

		describe("Traditional algorithm", () => {
			const config: ScoringConfig = {
				algorithm: "traditional",
				traditional: { step: 5, firstPlacePoints: 100 },
				tiebreaker: { primary: "countback" },
				statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
			}

			it("calculates points for time-based event (ascending)", () => {
				const results = calculateEventPoints("e1", baseScores, "time", config)

				expect(results.get("a")).toEqual({ userId: "a", points: 100, rank: 1 })
				expect(results.get("b")).toEqual({ userId: "b", points: 95, rank: 2 })
				expect(results.get("c")).toEqual({ userId: "c", points: 90, rank: 3 })
				expect(results.get("d")).toEqual({ userId: "d", points: 85, rank: 4 })
			})

			it("calculates points for reps-based event (descending)", () => {
				const results = calculateEventPoints("e1", baseScores, "reps", config)

				// Higher reps = better, so order is reversed
				expect(results.get("d")).toEqual({ userId: "d", points: 100, rank: 1 })
				expect(results.get("c")).toEqual({ userId: "c", points: 95, rank: 2 })
				expect(results.get("b")).toEqual({ userId: "b", points: 90, rank: 3 })
				expect(results.get("a")).toEqual({ userId: "a", points: 85, rank: 4 })
			})

			it("handles ties correctly", () => {
				const tiedScores: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 60000, status: "scored" }, // Tied with a
					{ userId: "c", value: 70000, status: "scored" },
				]

				const results = calculateEventPoints("e1", tiedScores, "time", config)

				// Tied athletes get same rank and same points
				expect(results.get("a")).toEqual({ userId: "a", points: 100, rank: 1 })
				expect(results.get("b")).toEqual({ userId: "b", points: 100, rank: 1 })
				expect(results.get("c")).toEqual({ userId: "c", points: 90, rank: 3 }) // Rank 3, not 2
			})

			it("handles DNF as last place + 1", () => {
				const scoresWithDnf: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 65000, status: "scored" },
					{ userId: "c", value: 0, status: "dnf" },
				]

				const results = calculateEventPoints("e1", scoresWithDnf, "time", config)

				expect(results.get("a")).toEqual({ userId: "a", points: 100, rank: 1 })
				expect(results.get("b")).toEqual({ userId: "b", points: 95, rank: 2 })
				// DNF gets rank 3 (last active rank 2 + 1), points for 3rd place
				expect(results.get("c")).toEqual({ userId: "c", points: 90, rank: 3 })
			})

			it("handles DNS as zero points", () => {
				const scoresWithDns: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 0, status: "dns" },
				]

				const results = calculateEventPoints("e1", scoresWithDns, "time", config)

				expect(results.get("a")).toEqual({ userId: "a", points: 100, rank: 1 })
				expect(results.get("b")).toEqual({ userId: "b", points: 0, rank: 2 })
			})

			it("excludes withdrawn athletes", () => {
				const scoresWithWithdrawn: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 0, status: "withdrawn" },
				]

				const results = calculateEventPoints("e1", scoresWithWithdrawn, "time", config)

				expect(results.get("a")).toEqual({ userId: "a", points: 100, rank: 1 })
				expect(results.has("b")).toBe(false)
			})
		})

		describe("P-Score algorithm", () => {
			const config: ScoringConfig = {
				algorithm: "p_score",
				pScore: { allowNegatives: true, medianField: "top_half" },
				tiebreaker: { primary: "countback" },
				statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
			}

			it("calculates P-Score points for time-based event", () => {
				const results = calculateEventPoints("e1", baseScores, "time", config)

				// First place gets 100
				expect(results.get("a")?.points).toBe(100)
				expect(results.get("a")?.rank).toBe(1)

				// Verify P-Score characteristics
				expect(results.get("b")?.rank).toBe(2)
				expect(results.get("c")?.rank).toBe(3)
				expect(results.get("d")?.rank).toBe(4)
			})

			it("allows negative scores", () => {
				// Create a scenario where someone is way behind
				const spreadScores: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 65000, status: "scored" },
					{ userId: "c", value: 70000, status: "scored" },
					{ userId: "d", value: 200000, status: "scored" }, // Way behind
				]

				const results = calculateEventPoints("e1", spreadScores, "time", config)

				// Last place could have negative score
				expect(results.get("d")?.points).toBeLessThan(50)
			})

			it("clamps to zero when negatives not allowed", () => {
				const noNegativesConfig: ScoringConfig = {
					algorithm: "p_score",
					pScore: { allowNegatives: false, medianField: "top_half" },
					tiebreaker: { primary: "countback" },
					statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
				}

				const spreadScores: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 65000, status: "scored" },
					{ userId: "c", value: 70000, status: "scored" },
					{ userId: "d", value: 200000, status: "scored" },
				]

				const results = calculateEventPoints("e1", spreadScores, "time", noNegativesConfig)

				// Last place should be clamped to 0
				expect(results.get("d")?.points).toBeGreaterThanOrEqual(0)
			})
		})

		describe("Custom algorithm", () => {
			const config: ScoringConfig = {
				algorithm: "custom",
				customTable: {
					baseTemplate: "winner_takes_more",
					overrides: { "1": 150 }, // 1st place gets 150 instead of 100
				},
				tiebreaker: { primary: "countback" },
				statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
			}

			it("applies overrides to base template", () => {
				const results = calculateEventPoints("e1", baseScores, "time", config)

				// 1st place gets overridden 150
				expect(results.get("a")).toEqual({ userId: "a", points: 150, rank: 1 })
				// 2nd place gets winner_takes_more value (85)
				expect(results.get("b")).toEqual({ userId: "b", points: 85, rank: 2 })
			})

			it("uses traditional template when specified", () => {
				const traditionalCustomConfig: ScoringConfig = {
					algorithm: "custom",
					customTable: {
						baseTemplate: "traditional",
						overrides: { "2": 90 }, // 2nd place gets 90 instead of 95
					},
					traditional: { step: 5, firstPlacePoints: 100 },
					tiebreaker: { primary: "countback" },
					statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
				}

				const results = calculateEventPoints("e1", baseScores, "time", traditionalCustomConfig)

				expect(results.get("a")?.points).toBe(100) // 1st
				expect(results.get("b")?.points).toBe(90) // Overridden
				expect(results.get("c")?.points).toBe(90) // 3rd (step of 5)
			})
		})

		describe("Edge cases", () => {
			const config = DEFAULT_SCORING_CONFIG

			it("returns empty map for empty scores", () => {
				const results = calculateEventPoints("e1", [], "time", config)
				expect(results.size).toBe(0)
			})

			it("handles single athlete", () => {
				const singleScore: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
				]

				const results = calculateEventPoints("e1", singleScore, "time", config)

				expect(results.get("a")).toEqual({ userId: "a", points: 100, rank: 1 })
			})

			it("handles all DNF", () => {
				const allDnf: EventScoreInput[] = [
					{ userId: "a", value: 0, status: "dnf" },
					{ userId: "b", value: 0, status: "dnf" },
				]

				const results = calculateEventPoints("e1", allDnf, "time", config)

				// Both get last_place_plus_one points
				expect(results.get("a")?.points).toBe(100) // Rank 1 since no one scored
				expect(results.get("b")?.points).toBe(100)
			})

			it("handles capped athletes in time-with-cap scheme", () => {
				const cappedScores: EventScoreInput[] = [
					{ userId: "a", value: 60000, status: "scored" },
					{ userId: "b", value: 65000, status: "scored" },
					{ userId: "c", value: 120000, status: "cap" }, // Hit time cap
				]

				const results = calculateEventPoints("e1", cappedScores, "time-with-cap", config)

				// Capped athlete ranks last among active athletes
				expect(results.get("a")?.rank).toBe(1)
				expect(results.get("b")?.rank).toBe(2)
				expect(results.get("c")?.rank).toBe(3)
			})
		})
	})

	describe("Utility functions", () => {
		describe("getScoringAlgorithmName", () => {
			it("returns correct display names", () => {
				expect(getScoringAlgorithmName("traditional")).toBe("Traditional")
				expect(getScoringAlgorithmName("p_score")).toBe("P-Score")
				expect(getScoringAlgorithmName("custom")).toBe("Custom")
			})
		})

		describe("canHaveNegativeScores", () => {
			it("returns true for P-Score with negatives allowed", () => {
				const config: ScoringConfig = {
					algorithm: "p_score",
					pScore: { allowNegatives: true, medianField: "top_half" },
					tiebreaker: { primary: "countback" },
					statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
				}
				expect(canHaveNegativeScores(config)).toBe(true)
			})

			it("returns false for P-Score with negatives disabled", () => {
				const config: ScoringConfig = {
					algorithm: "p_score",
					pScore: { allowNegatives: false, medianField: "top_half" },
					tiebreaker: { primary: "countback" },
					statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
				}
				expect(canHaveNegativeScores(config)).toBe(false)
			})

			it("returns false for traditional algorithm", () => {
				const config: ScoringConfig = {
					algorithm: "traditional",
					traditional: { step: 5, firstPlacePoints: 100 },
					tiebreaker: { primary: "countback" },
					statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
				}
				expect(canHaveNegativeScores(config)).toBe(false)
			})

			it("returns false for custom algorithm", () => {
				const config: ScoringConfig = {
					algorithm: "custom",
					customTable: { baseTemplate: "traditional", overrides: {} },
					tiebreaker: { primary: "countback" },
					statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
				}
				expect(canHaveNegativeScores(config)).toBe(false)
			})
		})
	})

	describe("Default configs", () => {
		it("provides valid DEFAULT_SCORING_CONFIG", () => {
			expect(DEFAULT_SCORING_CONFIG.algorithm).toBe("traditional")
			expect(DEFAULT_SCORING_CONFIG.traditional).toBeDefined()
			expect(DEFAULT_SCORING_CONFIG.tiebreaker.primary).toBe("countback")
		})

		it("provides valid DEFAULT_TRADITIONAL_CONFIG", () => {
			expect(DEFAULT_TRADITIONAL_CONFIG.step).toBe(5)
			expect(DEFAULT_TRADITIONAL_CONFIG.firstPlacePoints).toBe(100)
		})

		it("provides valid DEFAULT_PSCORE_CONFIG", () => {
			expect(DEFAULT_PSCORE_CONFIG.allowNegatives).toBe(true)
			expect(DEFAULT_PSCORE_CONFIG.medianField).toBe("top_half")
		})
	})
})
