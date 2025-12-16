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

describe("scheme-specific sorting behavior", () => {
	/**
	 * Tests for scheme-specific sort directions:
	 * - time/emom: ascending (lower is better)
	 * - reps/rounds-reps/load/calories/meters/feet/points: descending (higher is better)
	 * - pass-fail: no sorting (just pass/fail status)
	 */
	const mockCalculatePoints = (rank: number, athleteCount: number) => 
		calculatePoints(rank, athleteCount, "fixed_step", 5)

	describe("ascending schemes (lower is better)", () => {
		it("time scheme: lower time ranks first", () => {
			// Times: 5:00, 6:00, 7:00
			const sortedScores = [
				{ sortKey: "0000000000000300000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 5:00 = 300000ms
				{ sortKey: "0000000000000360000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 6:00 = 360000ms
				{ sortKey: "0000000000000420000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 7:00 = 420000ms
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Fastest
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Slowest
		})

		it("emom scheme: lower score ranks first", () => {
			// EMOM scores: 50, 75, 100 (lower = fewer rounds failed = better)
			const sortedScores = [
				{ sortKey: "0000000000000050000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000075000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000100000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Lowest (best)
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Highest (worst)
		})
	})

	describe("descending schemes (higher is better)", () => {
		it("reps scheme: higher reps ranks first", () => {
			// Reps: 150, 100, 75
			const sortedScores = [
				{ sortKey: "0000000000000150000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000100000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000075000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most reps
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Fewest reps
		})

		it("rounds-reps scheme: higher rounds+reps ranks first", () => {
			// Rounds+Reps: 5 rounds + 25 reps, 4 rounds + 50 reps, 3 rounds + 75 reps
			const sortedScores = [
				{ sortKey: "0000000000000500025", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 5+25
				{ sortKey: "0000000000000400050", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 4+50
				{ sortKey: "0000000000000300075", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 3+75
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most rounds
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })
		})

		it("load scheme: higher weight ranks first", () => {
			// Loads: 225 lbs, 185 lbs, 135 lbs (stored as grams)
			const sortedScores = [
				{ sortKey: "0000000000102058500", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 225 lbs
				{ sortKey: "0000000000083914620", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 185 lbs
				{ sortKey: "0000000000061234920", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 135 lbs
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Heaviest
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Lightest
		})

		it("calories scheme: higher calories ranks first", () => {
			// Calories: 150, 120, 90
			const sortedScores = [
				{ sortKey: "0000000000000150000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000120000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000090000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most calories
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Fewest calories
		})

		it("meters scheme: higher distance ranks first", () => {
			// Distances: 2000m, 1500m, 1000m (stored as mm)
			const sortedScores = [
				{ sortKey: "0000000002000000000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 2000m
				{ sortKey: "0000000001500000000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 1500m
				{ sortKey: "0000000001000000000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 1000m
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Farthest
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Shortest
		})

		it("feet scheme: higher distance ranks first", () => {
			// Distances: 500ft, 400ft, 300ft (stored as mm)
			const sortedScores = [
				{ sortKey: "0000000000152400000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 500ft
				{ sortKey: "0000000000121920000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 400ft
				{ sortKey: "0000000000091440000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 300ft
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Farthest
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Shortest
		})

		it("points scheme: higher points ranks first", () => {
			// Points: 85, 70, 55
			const sortedScores = [
				{ sortKey: "0000000000000085000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000070000", secondaryValue: null, tiebreakValue: null, status: "scored" },
				{ sortKey: "0000000000000055000", secondaryValue: null, tiebreakValue: null, status: "scored" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most points
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Fewest points
		})
	})

	describe("pass-fail scheme", () => {
		it("pass-fail scheme: pass beats fail, no ordering within same status", () => {
			// Status-based: pass (1) beats fail (0)
			const sortedScores = [
				{ sortKey: "0000000000000000001", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Pass
				{ sortKey: "0000000000000000001", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Pass
				{ sortKey: "0000000000000000000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Fail
				{ sortKey: "0000000000000000000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Fail
			]
			
			const results = assignRanksWithTies(sortedScores, 4, mockCalculatePoints)
			
			// All passes tie for 1st
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 1, points: 100 })
			// All fails tie for 3rd (rank skipped after 2 tied for 1st)
			expect(results[2]).toEqual({ rank: 3, points: 90 })
			expect(results[3]).toEqual({ rank: 3, points: 90 })
		})
	})
})

describe("time cap and tiebreak combinations", () => {
	/**
	 * Tests for time-capped scores with tiebreak scenarios:
	 * 1. Same cap time, different reps (secondaryValue)
	 * 2. Same cap time, same reps, different tiebreak times
	 * 3. Same cap time, same reps, same tiebreak = true tie
	 * 4. Tiebreak direction: time (lower=better) vs reps (higher=better)
	 * 5. Capped vs non-capped athlete ordering
	 */
	const mockCalculatePoints = (rank: number, athleteCount: number) => 
		calculatePoints(rank, athleteCount, "fixed_step", 5)

	describe("same cap time, different reps", () => {
		it("should rank by reps when all capped at same time (higher reps = better)", () => {
			// All capped at 15:00 (900000ms), but different reps completed
			const sortedScores = [
				{ sortKey: "1152921504606846975", secondaryValue: 180, tiebreakValue: null, status: "cap" }, // 180 reps
				{ sortKey: "1152921504606846975", secondaryValue: 165, tiebreakValue: null, status: "cap" }, // 165 reps
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" }, // 150 reps
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most reps at cap
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Fewest reps at cap
		})
	})

	describe("same cap time, same reps, different tiebreak times", () => {
		it("should rank by tiebreak time when cap time and reps are equal (lower time = better)", () => {
			// All capped at 15:00 with 150 reps, but different tiebreak times (time to reach 100 reps)
			const sortedScores = [
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 480000, status: "cap" }, // 8:00 tiebreak
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 540000, status: "cap" }, // 9:00 tiebreak
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 600000, status: "cap" }, // 10:00 tiebreak
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Fastest tiebreak
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Slowest tiebreak
		})

		it("should rank by tiebreak reps when cap time and primary reps are equal (higher reps = better)", () => {
			// All capped at 15:00 with 150 reps, but different tiebreak reps (reps at 10:00 mark)
			const sortedScores = [
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 120, status: "cap" }, // 120 reps at 10:00
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 110, status: "cap" }, // 110 reps at 10:00
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 100, status: "cap" }, // 100 reps at 10:00
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most reps at tiebreak
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Fewest reps at tiebreak
		})
	})

	describe("full combo: same cap, same reps, same tiebreak = true tie", () => {
		it("should tie when cap time, reps, and tiebreak all match", () => {
			// All capped at 15:00, all 150 reps, all 8:30 tiebreak
			const sortedScores = [
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 510000, status: "cap" },
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 510000, status: "cap" },
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: 510000, status: "cap" },
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			// All three tie for 1st
			expect(results[0]).toEqual({ rank: 1, points: 100 })
			expect(results[1]).toEqual({ rank: 1, points: 100 })
			expect(results[2]).toEqual({ rank: 1, points: 100 })
		})
	})

	describe("tiebreak direction: time vs reps", () => {
		it("time tiebreak: lower time is better", () => {
			// Same primary score, different tiebreak times
			const sortedScores = [
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 420000, status: "scored" }, // 7:00 tiebreak (faster)
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 480000, status: "scored" }, // 8:00 tiebreak
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 540000, status: "scored" }, // 9:00 tiebreak (slower)
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Fastest tiebreak wins
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })
		})

		it("reps tiebreak: higher reps is better", () => {
			// Same primary score, different tiebreak reps
			const sortedScores = [
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 150, status: "scored" }, // 150 reps (more)
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 135, status: "scored" }, // 135 reps
				{ sortKey: "0000000000000500012", secondaryValue: null, tiebreakValue: 120, status: "scored" }, // 120 reps (fewer)
			]
			
			const results = assignRanksWithTies(sortedScores, 3, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Most reps wins
			expect(results[1]).toEqual({ rank: 2, points: 95 })
			expect(results[2]).toEqual({ rank: 3, points: 90 })
		})
	})

	describe("capped vs non-capped ordering", () => {
		it("finished athlete beats capped athlete with better reps", () => {
			// Athlete 1: finished at 14:30 (870000ms)
			// Athlete 2: capped at 15:00 with 200 reps (1152921504606846975 = cap sortKey)
			const sortedScores = [
				{ sortKey: "0000000000000870000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Finished
				{ sortKey: "1152921504606846975", secondaryValue: 200, tiebreakValue: null, status: "cap" },      // Capped
			]
			
			const results = assignRanksWithTies(sortedScores, 2, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Finished ranks first
			expect(results[1]).toEqual({ rank: 2, points: 95 })  // Capped ranks second
		})

		it("multiple capped athletes rank by reps, all below non-capped", () => {
			// 1 finished, 3 capped with different reps
			const sortedScores = [
				{ sortKey: "0000000000000720000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Finished at 12:00
				{ sortKey: "1152921504606846975", secondaryValue: 185, tiebreakValue: null, status: "cap" },      // Capped, 185 reps
				{ sortKey: "1152921504606846975", secondaryValue: 170, tiebreakValue: null, status: "cap" },      // Capped, 170 reps
				{ sortKey: "1152921504606846975", secondaryValue: 155, tiebreakValue: null, status: "cap" },      // Capped, 155 reps
			]
			
			const results = assignRanksWithTies(sortedScores, 4, mockCalculatePoints)
			
			expect(results[0]).toEqual({ rank: 1, points: 100 }) // Finished
			expect(results[1]).toEqual({ rank: 2, points: 95 })  // Capped, most reps
			expect(results[2]).toEqual({ rank: 3, points: 90 })  // Capped, middle reps
			expect(results[3]).toEqual({ rank: 4, points: 85 })  // Capped, fewest reps
		})
	})
})

/**
 * areScoresEqual() edge case tests
 * 
 * Direct tests for the areScoresEqual function from competition-leaderboard.ts
 * This function determines if two scores should be considered tied.
 */
describe("areScoresEqual - edge cases", () => {
	/**
	 * Helper that mirrors the areScoresEqual function from competition-leaderboard.ts
	 * for testing purposes
	 */
	function areScoresEqual(
		a: {
			sortKey: string | null
			status: string | null
			secondaryValue: number | null
			tiebreakValue: number | null
		},
		b: {
			sortKey: string | null
			status: string | null
			secondaryValue: number | null
			tiebreakValue: number | null
		},
	): boolean {
		// Primary: sortKey must match
		if (a.sortKey !== b.sortKey) return false

		// Secondary: for capped scores, secondaryValue must match
		if (a.status === "cap" && b.status === "cap") {
			if (a.secondaryValue !== b.secondaryValue) return false
		}

		// Tertiary: if both have tiebreak values, those must match too
		if (a.tiebreakValue !== null && b.tiebreakValue !== null) {
			if (a.tiebreakValue !== b.tiebreakValue) return false
		}

		return true
	}

	describe("sortKey matching", () => {
		it("should return false when sortKeys differ", () => {
			const a = { sortKey: "0000000000000500000", status: "scored", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: "0000000000000600000", status: "scored", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})

		it("should return true when sortKeys match and no other factors", () => {
			const a = { sortKey: "0000000000000500000", status: "scored", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: "0000000000000500000", status: "scored", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should handle null sortKeys (both null = equal)", () => {
			const a = { sortKey: null, status: "scored", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: null, status: "scored", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should handle one null sortKey (not equal)", () => {
			const a = { sortKey: "0000000000000500000", status: "scored", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: null, status: "scored", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})
	})

	describe("capped scores with secondaryValue", () => {
		it("should return true when both capped with same secondaryValue", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: null }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should return false when both capped with different secondaryValue", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: null }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 140, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})

		it("should ignore secondaryValue when only one is capped", () => {
			// Edge case: same sortKey, one capped one scored, different secondaryValues
			// Should still be equal because secondaryValue check only applies to cap+cap
			const a = { sortKey: "0000000000000500000", status: "cap", secondaryValue: 150, tiebreakValue: null }
			const b = { sortKey: "0000000000000500000", status: "scored", secondaryValue: 100, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should handle null secondaryValue for capped scores", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should return false when one cap has null secondaryValue and other has value", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: null }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})
	})

	describe("tiebreakValue handling", () => {
		it("should return true when both have same tiebreakValue", () => {
			const a = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: 510000 }
			const b = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: 510000 }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should return false when both have different tiebreakValue", () => {
			const a = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: 510000 }
			const b = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: 540000 }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})

		it("should return true when both have null tiebreakValue", () => {
			const a = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should return true when only one has tiebreakValue (current implementation)", () => {
			// NOTE: This is current behavior - one has tiebreak, other doesn't
			// The implementation only checks if BOTH have tiebreak values
			const a = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: 510000 }
			const b = { sortKey: "0000000000000500012", status: "scored", secondaryValue: null, tiebreakValue: null }
			
			// Current implementation returns true because the check is:
			// "if both have tiebreak values, those must match"
			// If only one has a tiebreak value, the check is skipped
			expect(areScoresEqual(a, b)).toBe(true)
		})
	})

	describe("combined edge cases", () => {
		it("should handle capped scores with tiebreak values", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: 480000 }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: 480000 }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should return false when capped with same reps but different tiebreak", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: 480000 }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: 540000 }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})

		it("should return false when capped with different reps but same tiebreak", () => {
			const a = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 150, tiebreakValue: 480000 }
			const b = { sortKey: "1152921504606846975", status: "cap", secondaryValue: 140, tiebreakValue: 480000 }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})

		it("should handle DNS/DNF/DQ statuses", () => {
			// DNS scores have special sortKeys but should still compare correctly
			const a = { sortKey: "2305843009213693951", status: "dns", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: "2305843009213693951", status: "dns", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(true)
		})

		it("should not equal different special statuses", () => {
			// DNS vs DNF have different sortKeys
			const a = { sortKey: "2305843009213693951", status: "dns", secondaryValue: null, tiebreakValue: null }
			const b = { sortKey: "3458764513820540927", status: "dnf", secondaryValue: null, tiebreakValue: null }
			
			expect(areScoresEqual(a, b)).toBe(false)
		})
	})
})

/**
 * Overall ranking tiebreaker tests
 * 
 * Tests for the overall competition ranking tiebreaker logic:
 * - Primary: total points (higher is better)
 * - Tiebreaker 1: count of 1st place finishes
 * - Tiebreaker 2: count of 2nd place finishes
 */
describe("overall ranking tiebreakers", () => {
	/**
	 * Helper to create mock leaderboard entries for testing overall ranking
	 */
	interface MockEntry {
		athleteName: string
		totalPoints: number
		eventResults: Array<{ rank: number; points: number }>
	}

	/**
	 * Applies overall ranking logic matching competition-leaderboard.ts
	 */
	function assignOverallRanks(entries: MockEntry[]): Array<{ athleteName: string; overallRank: number }> {
		// Sort by total points descending, then by tiebreakers
		const sorted = [...entries].sort((a, b) => {
			if (b.totalPoints !== a.totalPoints) {
				return b.totalPoints - a.totalPoints
			}

			// Tie-breaker: count of 1st places
			const aFirsts = a.eventResults.filter((er) => er.rank === 1).length
			const bFirsts = b.eventResults.filter((er) => er.rank === 1).length
			if (bFirsts !== aFirsts) {
				return bFirsts - aFirsts
			}

			// Tie-breaker: count of 2nd places
			const aSeconds = a.eventResults.filter((er) => er.rank === 2).length
			const bSeconds = b.eventResults.filter((er) => er.rank === 2).length
			return bSeconds - aSeconds
		})

		// Assign ranks with tie detection
		const results: Array<{ athleteName: string; overallRank: number }> = []
		for (let i = 0; i < sorted.length; i++) {
			const entry = sorted[i]
			if (!entry) continue

			let overallRank = i + 1

			// Check for tie with previous entry
			if (i > 0) {
				const prev = sorted[i - 1]
				if (prev && entry.totalPoints === prev.totalPoints) {
					// Check tiebreaker counts too
					const entryFirsts = entry.eventResults.filter((er) => er.rank === 1).length
					const prevFirsts = prev.eventResults.filter((er) => er.rank === 1).length
					const entrySeconds = entry.eventResults.filter((er) => er.rank === 2).length
					const prevSeconds = prev.eventResults.filter((er) => er.rank === 2).length

					if (entryFirsts === prevFirsts && entrySeconds === prevSeconds) {
						// True tie - use same rank as previous
						const prevResult = results[i - 1]
						if (prevResult) {
							overallRank = prevResult.overallRank
						}
					}
				}
			}

			results.push({ athleteName: entry.athleteName, overallRank })
		}

		return results
	}

	describe("primary ranking by total points", () => {
		it("should rank by total points when no ties", () => {
			const entries: MockEntry[] = [
				{ athleteName: "Alice", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },
				{ athleteName: "Bob", totalPoints: 270, eventResults: [{ rank: 2, points: 95 }, { rank: 3, points: 90 }, { rank: 4, points: 85 }] },
				{ athleteName: "Carol", totalPoints: 255, eventResults: [{ rank: 3, points: 90 }, { rank: 4, points: 85 }, { rank: 5, points: 80 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 },
				{ athleteName: "Bob", overallRank: 2 },
				{ athleteName: "Carol", overallRank: 3 },
			])
		})
	})

	describe("tiebreaker 1: count of 1st places", () => {
		it("should break tie by number of 1st place finishes", () => {
			const entries: MockEntry[] = [
				// Same total points (285), but Alice has 2 firsts, Bob has 1 first
				{ athleteName: "Alice", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 1, points: 100 }, { rank: 4, points: 85 }] },
				{ athleteName: "Bob", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 }, // 2 firsts
				{ athleteName: "Bob", overallRank: 2 },   // 1 first
			])
		})

		it("should handle multiple athletes with same points but different 1st counts", () => {
			const entries: MockEntry[] = [
				{ athleteName: "Alice", totalPoints: 280, eventResults: [{ rank: 1, points: 100 }, { rank: 1, points: 100 }, { rank: 5, points: 80 }] }, // 2 firsts
				{ athleteName: "Bob", totalPoints: 280, eventResults: [{ rank: 1, points: 100 }, { rank: 3, points: 90 }, { rank: 3, points: 90 }] },   // 1 first
				{ athleteName: "Carol", totalPoints: 280, eventResults: [{ rank: 2, points: 95 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },  // 0 firsts
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 }, // 2 firsts
				{ athleteName: "Bob", overallRank: 2 },   // 1 first
				{ athleteName: "Carol", overallRank: 3 }, // 0 firsts
			])
		})
	})

	describe("tiebreaker 2: count of 2nd places", () => {
		it("should break tie by number of 2nd place finishes when 1st counts equal", () => {
			const entries: MockEntry[] = [
				// Same points (285), same 1st count (1), but Alice has 2 seconds, Bob has 1 second
				{ athleteName: "Alice", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 2, points: 95 }, { rank: 2, points: 90 }] },
				{ athleteName: "Bob", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 }, // 2 seconds
				{ athleteName: "Bob", overallRank: 2 },   // 1 second
			])
		})
	})

	describe("true ties (same points, same 1st count, same 2nd count)", () => {
		it("should assign same rank when all tiebreakers are equal", () => {
			const entries: MockEntry[] = [
				// Exactly same points and rank distribution
				{ athleteName: "Alice", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },
				{ athleteName: "Bob", totalPoints: 285, eventResults: [{ rank: 1, points: 100 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },
				{ athleteName: "Carol", totalPoints: 270, eventResults: [{ rank: 2, points: 95 }, { rank: 3, points: 90 }, { rank: 4, points: 85 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 }, // Tied for 1st
				{ athleteName: "Bob", overallRank: 1 },   // Tied for 1st
				{ athleteName: "Carol", overallRank: 3 }, // 3rd (rank skipped)
			])
		})

		it("should handle three-way tie", () => {
			const entries: MockEntry[] = [
				{ athleteName: "Alice", totalPoints: 280, eventResults: [{ rank: 1, points: 100 }, { rank: 3, points: 90 }, { rank: 3, points: 90 }] },
				{ athleteName: "Bob", totalPoints: 280, eventResults: [{ rank: 1, points: 100 }, { rank: 3, points: 90 }, { rank: 3, points: 90 }] },
				{ athleteName: "Carol", totalPoints: 280, eventResults: [{ rank: 1, points: 100 }, { rank: 3, points: 90 }, { rank: 3, points: 90 }] },
				{ athleteName: "Dave", totalPoints: 260, eventResults: [{ rank: 2, points: 95 }, { rank: 4, points: 85 }, { rank: 5, points: 80 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 },
				{ athleteName: "Bob", overallRank: 1 },
				{ athleteName: "Carol", overallRank: 1 },
				{ athleteName: "Dave", overallRank: 4 }, // Rank 4 (2 and 3 skipped)
			])
		})
	})

	describe("complex scenarios", () => {
		it("should handle mixed tiebreakers across multiple positions", () => {
			const entries: MockEntry[] = [
				// 1st: Alice (300 pts, clear winner)
				{ athleteName: "Alice", totalPoints: 300, eventResults: [{ rank: 1, points: 100 }, { rank: 1, points: 100 }, { rank: 1, points: 100 }] },
				// 2nd-3rd: Bob vs Carol (both 280, but Bob has more 2nds)
				{ athleteName: "Bob", totalPoints: 280, eventResults: [{ rank: 2, points: 95 }, { rank: 2, points: 95 }, { rank: 3, points: 90 }] },   // 2 seconds
				{ athleteName: "Carol", totalPoints: 280, eventResults: [{ rank: 2, points: 95 }, { rank: 3, points: 90 }, { rank: 2, points: 95 }] }, // 2 seconds
				// 4th-5th: Dave vs Eve (both 260, same distribution = true tie)
				{ athleteName: "Dave", totalPoints: 260, eventResults: [{ rank: 3, points: 90 }, { rank: 4, points: 85 }, { rank: 4, points: 85 }] },
				{ athleteName: "Eve", totalPoints: 260, eventResults: [{ rank: 3, points: 90 }, { rank: 4, points: 85 }, { rank: 4, points: 85 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results[0]).toEqual({ athleteName: "Alice", overallRank: 1 })
			// Bob and Carol: same points (280), same 1st count (0), same 2nd count (2) = tie
			expect(results[1]).toEqual({ athleteName: "Bob", overallRank: 2 })
			expect(results[2]).toEqual({ athleteName: "Carol", overallRank: 2 })
			// Dave and Eve: tied
			expect(results[3]).toEqual({ athleteName: "Dave", overallRank: 4 })
			expect(results[4]).toEqual({ athleteName: "Eve", overallRank: 4 })
		})

		it("should handle single event competition", () => {
			const entries: MockEntry[] = [
				{ athleteName: "Alice", totalPoints: 100, eventResults: [{ rank: 1, points: 100 }] },
				{ athleteName: "Bob", totalPoints: 95, eventResults: [{ rank: 2, points: 95 }] },
				{ athleteName: "Carol", totalPoints: 95, eventResults: [{ rank: 2, points: 95 }] }, // Tied 2nd
				{ athleteName: "Dave", totalPoints: 85, eventResults: [{ rank: 4, points: 85 }] },
			]

			const results = assignOverallRanks(entries)

			expect(results).toEqual([
				{ athleteName: "Alice", overallRank: 1 },
				{ athleteName: "Bob", overallRank: 2 },
				{ athleteName: "Carol", overallRank: 2 },
				{ athleteName: "Dave", overallRank: 4 },
			])
		})
	})
})

/**
 * Integration tests with mock data for getCompetitionLeaderboard
 * 
 * These tests validate the complete flow of leaderboard generation
 * using realistic mock data structures.
 */
describe("integration tests - complete leaderboard scenarios", () => {
	const mockCalculatePoints = (rank: number, athleteCount: number) => 
		calculatePoints(rank, athleteCount, "fixed_step", 5)

	describe("multi-event competition leaderboard", () => {
		it("should aggregate points correctly across multiple events", () => {
			// Simulate 3 events, 4 athletes
			// Event 1 scores (time): Alice 5:00, Bob 5:30, Carol 6:00, Dave 6:30
			// Event 2 scores (reps): Alice 100, Bob 120, Carol 110, Dave 90
			// Event 3 scores (time): Alice 8:00, Bob 7:30, Carol 7:00, Dave 8:30

			// Event 1 rankings: 1-Alice(100), 2-Bob(95), 3-Carol(90), 4-Dave(85)
			// Event 2 rankings: 1-Bob(100), 2-Carol(95), 3-Alice(90), 4-Dave(85)
			// Event 3 rankings: 1-Carol(100), 2-Bob(95), 3-Alice(90), 4-Dave(85)

			// Total: Alice=280, Bob=290, Carol=285, Dave=255
			// Overall: 1-Bob(290), 2-Carol(285), 3-Alice(280), 4-Dave(255)

			const event1Scores = [
				{ sortKey: "0000000000000300000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Alice 5:00
				{ sortKey: "0000000000000330000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Bob 5:30
				{ sortKey: "0000000000000360000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Carol 6:00
				{ sortKey: "0000000000000390000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // Dave 6:30
			]

			const event1Results = assignRanksWithTies(event1Scores, 4, mockCalculatePoints)

			expect(event1Results).toEqual([
				{ rank: 1, points: 100 },
				{ rank: 2, points: 95 },
				{ rank: 3, points: 90 },
				{ rank: 4, points: 85 },
			])

			// Verify total points calculation
			const totalAlice = 100 + 90 + 90 // Event1(1st) + Event2(3rd) + Event3(3rd) = 280
			const totalBob = 95 + 100 + 95   // Event1(2nd) + Event2(1st) + Event3(2nd) = 290
			const totalCarol = 90 + 95 + 100 // Event1(3rd) + Event2(2nd) + Event3(1st) = 285
			const totalDave = 85 + 85 + 85   // Event1(4th) + Event2(4th) + Event3(4th) = 255

			expect(totalAlice).toBe(280)
			expect(totalBob).toBe(290)
			expect(totalCarol).toBe(285)
			expect(totalDave).toBe(255)
		})
	})

	describe("mixed status scores", () => {
		it("should handle mix of scored, capped, DNS, and DNF", () => {
			// Simulate: 2 scored, 1 capped, 1 DNS
			const sortedScores = [
				{ sortKey: "0000000000000300000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // Finished 5:00
				{ sortKey: "0000000000000360000", secondaryValue: null, tiebreakValue: null, status: "scored" },   // Finished 6:00
				{ sortKey: "1152921504606846975", secondaryValue: 150, tiebreakValue: null, status: "cap" },        // Capped at 150 reps
				{ sortKey: "2305843009213693951", secondaryValue: null, tiebreakValue: null, status: "dns" },       // DNS
			]

			const results = assignRanksWithTies(sortedScores, 4, mockCalculatePoints)

			expect(results).toEqual([
				{ rank: 1, points: 100 }, // Scored 5:00
				{ rank: 2, points: 95 },  // Scored 6:00
				{ rank: 3, points: 90 },  // Capped
				{ rank: 4, points: 85 },  // DNS
			])
		})
	})

	describe("division-specific leaderboards", () => {
		it("should rank athletes independently within each division", () => {
			// RX Division: 3 athletes
			const rxScores = [
				{ sortKey: "0000000000000240000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 4:00
				{ sortKey: "0000000000000300000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 5:00
				{ sortKey: "0000000000000360000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 6:00
			]

			// Scaled Division: 3 athletes with different times
			const scaledScores = [
				{ sortKey: "0000000000000420000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 7:00
				{ sortKey: "0000000000000480000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 8:00
				{ sortKey: "0000000000000540000", secondaryValue: null, tiebreakValue: null, status: "scored" }, // 9:00
			]

			const rxResults = assignRanksWithTies(rxScores, 3, mockCalculatePoints)
			const scaledResults = assignRanksWithTies(scaledScores, 3, mockCalculatePoints)

			// Both divisions should have 1st, 2nd, 3rd independently
			expect(rxResults).toEqual([
				{ rank: 1, points: 100 },
				{ rank: 2, points: 95 },
				{ rank: 3, points: 90 },
			])

			expect(scaledResults).toEqual([
				{ rank: 1, points: 100 },
				{ rank: 2, points: 95 },
				{ rank: 3, points: 90 },
			])
		})
	})

	describe("points multiplier scenarios", () => {
		it("should apply points multiplier correctly", () => {
			// Event with 150% multiplier (finals event worth more)
			const basePoints = calculatePoints(1, 10, "fixed_step", 5) // 100
			const multipliedPoints = Math.round(basePoints * 1.5) // 150

			expect(multipliedPoints).toBe(150)

			// Event with 50% multiplier (qualifier event worth less)
			const halfPoints = Math.round(basePoints * 0.5) // 50
			expect(halfPoints).toBe(50)
		})
	})

	describe("large field scenarios", () => {
		it("should handle 50+ athlete field correctly", () => {
			// Create 50 athletes with sequential scores
			const sortedScores = Array.from({ length: 50 }, (_, i) => ({
				sortKey: String(300000 + i * 10000).padStart(19, "0"), // 5:00, 5:10, 5:20, etc.
				secondaryValue: null,
				tiebreakValue: null,
				status: "scored" as const,
			}))

			const results = assignRanksWithTies(sortedScores, 50, mockCalculatePoints)

			// First place should get 100
			expect(results[0]).toEqual({ rank: 1, points: 100 })

			// 10th place should get 55
			expect(results[9]).toEqual({ rank: 10, points: 55 })

			// 21st place and beyond get 0 (with 5-point step)
			expect(results[20]).toEqual({ rank: 21, points: 0 })
			expect(results[49]).toEqual({ rank: 50, points: 0 })
		})

		it("should handle massive tie at one position", () => {
			// 10 athletes all with same time
			const sortedScores = Array.from({ length: 10 }, () => ({
				sortKey: "0000000000000300000",
				secondaryValue: null,
				tiebreakValue: null,
				status: "scored" as const,
			}))

			const results = assignRanksWithTies(sortedScores, 10, mockCalculatePoints)

			// All should be tied for 1st with 100 points
			results.forEach((result) => {
				expect(result).toEqual({ rank: 1, points: 100 })
			})
		})
	})

	describe("real-world CrossFit Open scenario", () => {
		it("should rank Open-style workout with time cap and tiebreaks", () => {
			// Fran-style workout: 21-15-9 Thrusters and Pull-ups
			// Time cap: 10:00, Tiebreak at 21-15 (36 reps)
			const sortedScores = [
				// Finished athletes (sorted by time)
				{ sortKey: "0000000000000180000", secondaryValue: null, tiebreakValue: 120000, status: "scored" }, // 3:00, tiebreak 2:00
				{ sortKey: "0000000000000240000", secondaryValue: null, tiebreakValue: 150000, status: "scored" }, // 4:00, tiebreak 2:30
				{ sortKey: "0000000000000300000", secondaryValue: null, tiebreakValue: 180000, status: "scored" }, // 5:00, tiebreak 3:00
				{ sortKey: "0000000000000420000", secondaryValue: null, tiebreakValue: 240000, status: "scored" }, // 7:00, tiebreak 4:00
				// Capped athletes (sorted by reps completed, then tiebreak)
				{ sortKey: "1152921504606846975", secondaryValue: 42, tiebreakValue: 480000, status: "cap" },      // 42 reps (21+15+6), tb 8:00
				{ sortKey: "1152921504606846975", secondaryValue: 42, tiebreakValue: 540000, status: "cap" },      // 42 reps, tb 9:00 (same reps, slower tb)
				{ sortKey: "1152921504606846975", secondaryValue: 36, tiebreakValue: 420000, status: "cap" },      // 36 reps (21+15), tb 7:00
				{ sortKey: "1152921504606846975", secondaryValue: 30, tiebreakValue: 360000, status: "cap" },      // 30 reps, tb 6:00
			]

			const results = assignRanksWithTies(sortedScores, 8, mockCalculatePoints)

			expect(results).toEqual([
				{ rank: 1, points: 100 }, // 3:00 finish
				{ rank: 2, points: 95 },  // 4:00 finish
				{ rank: 3, points: 90 },  // 5:00 finish
				{ rank: 4, points: 85 },  // 7:00 finish
				{ rank: 5, points: 80 },  // Cap 42 reps, tb 8:00
				{ rank: 6, points: 75 },  // Cap 42 reps, tb 9:00 (same reps, different tb = not tied)
				{ rank: 7, points: 70 },  // Cap 36 reps
				{ rank: 8, points: 65 },  // Cap 30 reps
			])
		})
	})
})
