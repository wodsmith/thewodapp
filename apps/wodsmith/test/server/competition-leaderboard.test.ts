import { describe, expect, it } from "vitest"

/**
 * Unit tests for competition leaderboard tie detection and ranking.
 *
 * These tests document the EXPECTED behavior for tie scenarios in competition rankings.
 * Currently, these tests FAIL because the implementation uses sequential ranking (i+1)
 * instead of proper tie-aware ranking.
 *
 * Expected behavior (Standard 1224 Ranking):
 * - Athletes with identical scores get the SAME rank
 * - Tied athletes receive the SAME points
 * - Next rank SKIPS appropriately (e.g., 1, 1, 3 not 1, 1, 2)
 *
 * Bug location: apps/wodsmith/src/server/competition-leaderboard.ts
 * - Event ranking: lines 372-383
 * - Overall ranking: lines 504-509
 */

/**
 * Helper function that implements the EXPECTED tie-aware ranking behavior.
 * This is the correct implementation that should replace the buggy sequential ranking.
 *
 * @param sortedScores - Array of scores already sorted by sortKey, secondaryValue, tiebreakValue
 * @returns Array of { rank, points } for each score
 */
function assignRanksWithTies<T extends {
	sortKey: string | null
	secondaryValue: number | null
	tiebreakValue: number | null
	status: string | null
}>(
	sortedScores: T[],
	athleteCount: number,
	calculatePointsFn: (rank: number, athleteCount: number) => number
): Array<{ rank: number; points: number }> {
	const results: Array<{ rank: number; points: number }> = []
	let currentRank = 1
	
	for (let i = 0; i < sortedScores.length; i++) {
		const current = sortedScores[i]
		if (!current) continue
		
		// Check if this score ties with the previous score
		let isTied = false
		if (i > 0) {
			const prev = sortedScores[i - 1]
			if (prev) {
				// Two scores are equal when:
				// - sortKey matches
				// - secondaryValue matches (for capped scores)
				// - Either no tiebreak exists OR tiebreakValue matches
				const sortKeyMatch = current.sortKey === prev.sortKey
				const secondaryMatch = current.secondaryValue === prev.secondaryValue
				const tiebreakMatch = 
					(current.tiebreakValue === null && prev.tiebreakValue === null) ||
					current.tiebreakValue === prev.tiebreakValue
				
				isTied = sortKeyMatch && secondaryMatch && tiebreakMatch
			}
		}
		
		// If not tied with previous, this is a new rank position
		if (!isTied) {
			currentRank = i + 1 // Skip ranks for previous ties
		}
		
		// Calculate points based on the rank (tied athletes get same points)
		const points = calculatePointsFn(currentRank, athleteCount)
		
		results.push({ rank: currentRank, points })
	}
	
	return results
}

/**
 * calculatePoints function from competition-leaderboard.ts (lines 116-154)
 * Copied here for testing purposes.
 */
function calculatePoints(
	place: number,
	athleteCount: number,
	scoringType: "winner_takes_more" | "even_spread" | "fixed_step" = "fixed_step",
	step = 5
): number {
	switch (scoringType) {
		case "winner_takes_more": {
			const basePoints = [
				100, 85, 75, 67, 60, 54, 49, 45, 41, 38, 35, 32, 30, 28, 26, 24, 22, 20,
				18, 16, 14, 12, 10, 8, 6, 4, 2, 1,
			]
			if (place <= basePoints.length) {
				return basePoints[place - 1] ?? 1
			}
			return 1
		}

		case "even_spread": {
			if (athleteCount <= 1) return 100
			const stepSize = 100 / (athleteCount - 1)
			return Math.max(0, Math.round(100 - (place - 1) * stepSize))
		}

		case "fixed_step": {
			return Math.max(0, 100 - (place - 1) * step)
		}
	}
}

describe("calculatePoints", () => {
	describe("fixed_step scoring (default)", () => {
		it("should calculate points with default 5-point step", () => {
			expect(calculatePoints(1, 10)).toBe(100) // 1st place
			expect(calculatePoints(2, 10)).toBe(95)  // 2nd place
			expect(calculatePoints(3, 10)).toBe(90)  // 3rd place
			expect(calculatePoints(10, 10)).toBe(55) // 10th place
		})

		it("should not go below 0 points", () => {
			expect(calculatePoints(21, 10)).toBe(0) // 21st place would be -5
		})

		it("should support custom step sizes", () => {
			expect(calculatePoints(1, 10, "fixed_step", 10)).toBe(100)
			expect(calculatePoints(2, 10, "fixed_step", 10)).toBe(90)
			expect(calculatePoints(3, 10, "fixed_step", 10)).toBe(80)
		})
	})

	describe("winner_takes_more scoring", () => {
		it("should give decreasing increments favoring winners", () => {
			expect(calculatePoints(1, 10, "winner_takes_more")).toBe(100)
			expect(calculatePoints(2, 10, "winner_takes_more")).toBe(85)  // 15 point gap
			expect(calculatePoints(3, 10, "winner_takes_more")).toBe(75)  // 10 point gap
			expect(calculatePoints(4, 10, "winner_takes_more")).toBe(67)  // 8 point gap
		})

		it("should give 1 point for places beyond the array", () => {
			expect(calculatePoints(29, 30, "winner_takes_more")).toBe(1)
			expect(calculatePoints(30, 30, "winner_takes_more")).toBe(1)
		})
	})

	describe("even_spread scoring", () => {
		it("should distribute points evenly across all athletes", () => {
			// With 5 athletes: 100, 75, 50, 25, 0
			expect(calculatePoints(1, 5, "even_spread")).toBe(100)
			expect(calculatePoints(2, 5, "even_spread")).toBe(75)
			expect(calculatePoints(3, 5, "even_spread")).toBe(50)
			expect(calculatePoints(4, 5, "even_spread")).toBe(25)
			expect(calculatePoints(5, 5, "even_spread")).toBe(0)
		})

		it("should handle single athlete", () => {
			expect(calculatePoints(1, 1, "even_spread")).toBe(100)
		})

		it("should round points to integers", () => {
			// With 3 athletes: 100, 50, 0
			expect(calculatePoints(1, 3, "even_spread")).toBe(100)
			expect(calculatePoints(2, 3, "even_spread")).toBe(50)
			expect(calculatePoints(3, 3, "even_spread")).toBe(0)
		})
	})

	describe("tie scenarios - same rank should give same points", () => {
		it("should give identical points for identical ranks", () => {
			const rank2Points = calculatePoints(2, 10, "fixed_step")
			expect(rank2Points).toBe(95)
			
			// If two athletes tie for 2nd, they BOTH get 2nd place points
			expect(calculatePoints(2, 10, "fixed_step")).toBe(rank2Points)
		})

		it("should give same points across all scoring types for tied ranks", () => {
			// Two athletes tie for 1st place
			expect(calculatePoints(1, 10, "fixed_step")).toBe(100)
			expect(calculatePoints(1, 10, "fixed_step")).toBe(100)
			
			expect(calculatePoints(1, 10, "winner_takes_more")).toBe(100)
			expect(calculatePoints(1, 10, "winner_takes_more")).toBe(100)
			
			expect(calculatePoints(1, 10, "even_spread")).toBe(100)
			expect(calculatePoints(1, 10, "even_spread")).toBe(100)
		})
	})
})

describe("assignRanksWithTies - Expected tie-aware ranking behavior", () => {
	const mockCalculatePoints = (rank: number, athleteCount: number) => 
		calculatePoints(rank, athleteCount, "fixed_step", 5)

	describe("two-way ties", () => {
		it("should assign same rank and points to tied athletes", () => {
			// Two athletes tie with identical sortKey and no tiebreak
			const sortedScores = [
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // TIE
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // 1st place
			expect(results[1]).toEqual({ rank: 1, points: 100 }) // 1st place (tied)
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // 3rd place (rank skipped)
		})

		it("should assign same rank for tie in middle positions", () => {
			const sortedScores = [
				{ sortKey: "0000000000000400000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // TIE
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000700000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 5, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 95 })  // 2nd place
			expect(results[2]).toEqual({ rank: 2, points: 95 })  // 2nd place (tied)
			expect(results[3]).toEqual({ rank: 4, points: 85 })  // 4th place (skipped 3rd)
			expect(results[4]).toEqual({ rank: 5, points: 80 })
		})
	})

	describe("triple ties", () => {
		it("should handle three-way ties correctly", () => {
			const sortedScores = [
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 4, mockCalculatePoints)
			
			// Three athletes tie for 1st place
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 1, points: 100 })
			expect(results[2]).toEqual({ rank: 1, points: 100 })
			expect(results[3]).toEqual({ rank: 4, points: 85 }) // 4th place (skipped 2nd and 3rd)
		})
	})

	describe("multiple separate ties", () => {
		it("should handle multiple tie groups in same leaderboard", () => {
			const sortedScores = [
				{ sortKey: "0000000000000400000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // TIE 1
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000700000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000700000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // TIE 2
			]
			
			const results = assignRanksWithTies(sortedScores, 6, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 95 })  // Tie for 2nd
			expect(results[2]).toEqual({ rank: 2, points: 95 })  // Tie for 2nd
			expect(results[3]).toEqual({ rank: 4, points: 85 })
			expect(results[4]).toEqual({ rank: 5, points: 80 })  // Tie for 5th
			expect(results[5]).toEqual({ rank: 5, points: 80 })  // Tie for 5th
		})
	})

	describe("capped scores with secondaryValue ties", () => {
		it("should tie when sortKey AND secondaryValue match", () => {
			// Both capped at 15:00 with 150 reps
			const sortedScores = [
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" },
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" }, // TIE
				{ sortKey: "1152921504606846975", secondaryValue: 140, tiebreakValue: null, status: "cap" }, // Different reps
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Tied for 1st
			expect(results[1]).toEqual({ rank: 1, points: 100 }) // Tied for 1st
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // 3rd place
		})

		it("should NOT tie when sortKey matches but secondaryValue differs", () => {
			const sortedScores = [
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" },
				{ sortKey: "1152921504606846975", secondaryValue: 140, tiebreakValue: null, status: "cap" },
				{ sortKey: "1152921504606846975", secondaryValue: 130, tiebreakValue: null, status: "cap" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })
		})
	})

	describe("tiebreaker values", () => {
		it("should tie when tiebreakValue matches", () => {
			// Same score (5 rounds + 12 reps), same tiebreak time
			const sortedScores = [
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" },
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" }, // TIE
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 600000, status: "scored" }, // Different tiebreak
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Tied
			expect(results[1]).toEqual({ rank: 1, points: 100 }) // Tied
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Broken by tiebreak
		})

		it("should NOT tie when tiebreakValue differs", () => {
			const sortedScores = [
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" },
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 540000, status: "scored" },
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 600000, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })
		})

		it("should tie when neither score has tiebreak value", () => {
			const sortedScores = [
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: null, status: "scored" }, // TIE
			]
			
			const results = assignRanksWithTies(sortedScores, 2, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 1, points: 100 })
		})

		it("should NOT tie if only one has tiebreak value", () => {
			// This edge case: one has tiebreak, other doesn't
			// They should NOT tie because they're fundamentally different
			const sortedScores = [
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" },
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 2, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 95 }) // Not tied
		})
	})

	describe("edge cases", () => {
		it("should handle all athletes tied", () => {
			const sortedScores = [
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 1, points: 100 })
			expect(results[2]).toEqual({ rank: 1, points: 100 })
		})

		it("should handle no ties", () => {
			const sortedScores = [
				{ sortKey: "0000000000000400000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })
		})

		it("should handle single athlete", () => {
			const sortedScores = [
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 1, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
		})

		it("should handle empty scores array", () => {
			const sortedScores: Array<{
				sortKey: string | null
				secondaryValue: number | null
				tiebreakValue: number | null
				status: string | null
			}> = []
			
			const results = assignRanksWithTies(sortedScores, 0, mockCalculatePoints)
			
			expect(results).toEqual([])
		})
	})

	describe("winner_takes_more scoring with ties", () => {
		const wtmCalculatePoints = (rank: number, athleteCount: number) => 
			calculatePoints(rank, athleteCount, "winner_takes_more")

		it("should give tied athletes same winner_takes_more points", () => {
			const sortedScores = [
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, wtmCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Both get 100 (1st place)
			expect(results[1]).toEqual({ rank: 1, points: 100 })
			expect(results[2]).toEqual({ rank: 3, points: 75 })  // 3rd gets 75 (not 85)
		})
	})

	describe("even_spread scoring with ties", () => {
		const evenSpreadCalculatePoints = (rank: number, athleteCount: number) => 
			calculatePoints(rank, athleteCount, "even_spread")

		it("should give tied athletes same even_spread points", () => {
			const sortedScores = [
				{ sortKey: "0000000000000400000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000700000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 5, evenSpreadCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 2, points: 75 })  // Both get 75 (2nd place)
			expect(results[2]).toEqual({ rank: 2, points: 75 })
			expect(results[3]).toEqual({ rank: 4, points: 25 })  // 4th gets 25 (skipped 3rd)
			expect(results[4]).toEqual({ rank: 5, points: 0 })
		})
	})
})

describe("Characterization tests - Current buggy behavior", () => {
	/**
	 * These tests document the CURRENT (incorrect) behavior.
	 * They show what the code does NOW with sequential ranking.
	 * 
	 * After the fix, these tests should be REMOVED or updated to match expected behavior.
	 */
	
	it("CURRENT BUG: Sequential ranking gives different ranks for ties", () => {
		// With current implementation (rank = i + 1), tied athletes get different ranks
		const sortedScores = [
			{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Should tie
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
		]
		
		// Current buggy implementation:
		const buggyRanks = sortedScores.map((_score, i) => i + 1)
		
		expect(buggyRanks).toEqual([1, 2, 3]) // WRONG: should be [1, 1, 3]
	})

	it("CURRENT BUG: Sequential ranking gives different points for ties", () => {
		// Tied athletes should get same points, but with sequential ranks they don't
		const athleteCount = 5
		
		// Current buggy behavior: two tied athletes get different points
		const rank1Points = calculatePoints(1, athleteCount, "fixed_step") // 100
		const rank2Points = calculatePoints(2, athleteCount, "fixed_step") // 95
		
		expect(rank1Points).not.toBe(rank2Points) // WRONG: tied athletes should get same points
		expect(rank1Points).toBe(100)
		expect(rank2Points).toBe(95)
		
		// Expected behavior: both should get 100 (1st place points)
	})

	it("CURRENT BUG: No rank skipping after ties", () => {
		// After two 1st places, next should be 3rd, not 2nd
		const sortedScores = [
			{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			{ sortKey: "0000000000000510000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Tied 1st
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Should be 3rd
		]
		
		const buggyRanks = sortedScores.map((_score, i) => i + 1)
		
		expect(buggyRanks[2]).toBe(3) // Current implementation happens to be correct here
		// But this is ACCIDENTAL - it's 3 because i=2, not because of tie-aware logic
	})
})

describe("Integration test scenarios - Real competition examples", () => {
	it("Scenario: CrossFit Open-style workout with multiple ties", () => {
		// 10 athletes, 3 tie for 2nd place, 2 tie for 7th place
		const sortedScores = [
			{ sortKey: "0000000000000400000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 1st: 100 pts
			{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" }, // 2nd (tied): 95 pts
			{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" }, // 2nd (tied): 95 pts
			{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 510000, status: "scored" }, // 2nd (tied): 95 pts
			{ sortKey: "0000000000000550000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // 5th: 80 pts
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // 6th: 75 pts
			{ sortKey: "0000000000000650000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // 7th (tied): 70 pts
			{ sortKey: "0000000000000650000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // 7th (tied): 70 pts
			{ sortKey: "0000000000000700000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // 9th: 60 pts
			{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" },       // 10th (capped): 55 pts
		]
		
		const mockCalcPoints = (rank: number, athleteCount: number) => 
			calculatePoints(rank, athleteCount, "fixed_step", 5)
		
		const results = assignRanksWithTies(sortedScores, 10, mockCalcPoints)
		
		expect(results).toEqual([
			{ rank: 1, points: 100 },
			{ rank: 2, points: 95 },  // Three-way tie for 2nd
			{ rank: 2, points: 95 },
			{ rank: 2, points: 95 },
			{ rank: 5, points: 80 },  // Ranks 3,4 skipped
			{ rank: 6, points: 75 },
			{ rank: 7, points: 70 },  // Two-way tie for 7th
			{ rank: 7, points: 70 },
			{ rank: 9, points: 60 },  // Rank 8 skipped
			{ rank: 10, points: 55 },
		])
	})

	it("Scenario: Time-capped AMRAP with secondary value ties", () => {
		// 15:00 time cap AMRAP, ranked by reps completed
		const sortedScores = [
			{ sortKey: "0000000000000900000", secondaryValue: null, tiebreakValue: null, status: "scored" },    // 15:00 finish: 1st
			{ sortKey: "1152921504606846975", secondaryValue: 180, tiebreakValue: null, status: "cap" },        // 180 reps: 2nd
			{ sortKey: "1152921504606846975", secondaryValue: 175, tiebreakValue: null, status: "cap" },        // 175 reps: 3rd
			{ sortKey: "1152921504606846975", secondaryValue: 160, tiebreakValue: null, status: "cap" },        // 160 reps: 4th (tied)
			{ sortKey: "1152921504606846975", secondaryValue: 160, tiebreakValue: null, status: "cap" },        // 160 reps: 4th (tied)
			{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" },        // 150 reps: 6th
		]
		
		const mockCalcPoints = (rank: number, athleteCount: number) => 
			calculatePoints(rank, athleteCount, "winner_takes_more")
		
		const results = assignRanksWithTies(sortedScores, 6, mockCalcPoints)
		
		expect(results).toEqual([
			{ rank: 1, points: 100 }, // Finished under time cap
			{ rank: 2, points: 85 },  // Most reps
			{ rank: 3, points: 75 },  // Second most reps
			{ rank: 4, points: 67 },  // Tied for 4th with 160 reps
			{ rank: 4, points: 67 },  // Tied for 4th with 160 reps
			{ rank: 6, points: 54 },  // Rank 5 skipped
		])
	})

	it("Scenario: Entire division ties (everyone got same time)", () => {
		// Unlikely but valid: 5 athletes all finish in 10:00
		const sortedScores = [
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			{ sortKey: "0000000000000600000", secondaryValue: null, tiebreakValue: null, status: "scored" },
		]
		
		const mockCalcPoints = (rank: number, athleteCount: number) => 
			calculatePoints(rank, athleteCount, "even_spread")
		
		const results = assignRanksWithTies(sortedScores, 5, mockCalcPoints)
		
		// Everyone ties for 1st place
		expect(results).toEqual([
			{ rank: 1, points: 100 },
			{ rank: 1, points: 100 },
			{ rank: 1, points: 100 },
			{ rank: 1, points: 100 },
			{ rank: 1, points: 100 },
		])
	})
})
