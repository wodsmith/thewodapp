import { describe, expect, it } from "vitest"
import { calculatePScore, type PScoreInput } from "@/lib/scoring/algorithms/p-score"

/**
 * P-Score Algorithm Tests
 * 
 * P-Score Formula:
 * - Timed (ascending): 100 – (X – Best) × (50 / (Median – Best))
 * - Reps/Load (descending): 100 – (Best – X) × (50 / (Best – Median))
 * - First place = 100, Median = 50
 * - Below median can be negative
 * - Median calculated from top half of field by default
 */

describe("calculatePScore", () => {
	describe("basic formula - timed event (ascending)", () => {
		it("should give first place 100 points", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" }, // Best: 5:00
					{ userId: "2", value: 360, status: "scored" }, // 6:00
					{ userId: "3", value: 420, status: "scored" }, // 7:00
					{ userId: "4", value: 480, status: "scored" }, // 8:00
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const first = results.find((r) => r.userId === "1")

			expect(first?.pScore).toBe(100)
			expect(first?.rank).toBe(1)
		})

		it("should give median performer 50 points (top half)", () => {
			// With 4 athletes, top half = 2 athletes
			// Median of top half = athlete 2's score (360)
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" }, // Best
					{ userId: "2", value: 360, status: "scored" }, // Median (top half)
					{ userId: "3", value: 420, status: "scored" },
					{ userId: "4", value: 480, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const median = results.find((r) => r.userId === "2")

			expect(median?.pScore).toBe(50)
		})

		it("should calculate scores between 50 and 100 correctly", () => {
			// With 6 athletes, top half = 3, median = boundary at index 2
			// Best: 300, Median: 360 (boundary athlete)
			// Formula: 100 – (X – Best) × (50 / (Median – Best))
			// Athlete at 330: 100 – (330 – 300) × (50 / (360 – 300))
			//                = 100 – 30 × (50 / 60) = 100 – 25 = 75
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 330, status: "scored" },
					{ userId: "3", value: 360, status: "scored" }, // Boundary = median
					{ userId: "4", value: 400, status: "scored" },
					{ userId: "5", value: 450, status: "scored" },
					{ userId: "6", value: 500, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const mid = results.find((r) => r.userId === "2")

			// With median at 360 (athlete 3), athlete 2 at 330 gets:
			// 100 - (330 - 300) * (50 / (360 - 300)) = 100 - 30 * (50/60) = 75
			expect(mid?.pScore).toBe(75)
		})

		it("should allow negative scores below median", () => {
			// Best: 300, Median: 360
			// Athlete at 480: 100 – (480 – 300) × (50 / (360 – 300))
			//                = 100 – 180 × (50 / 60) = 100 – 150 = -50
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 420, status: "scored" },
					{ userId: "4", value: 480, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const last = results.find((r) => r.userId === "4")

			expect(last?.pScore).toBe(-50)
		})

		it("should clamp to 0 when allowNegatives is false", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 420, status: "scored" },
					{ userId: "4", value: 480, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: false, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const last = results.find((r) => r.userId === "4")

			expect(last?.pScore).toBe(0)
		})
	})

	describe("descending events (reps/load)", () => {
		it("should give highest value first place with 100 points", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 200, status: "scored" }, // Best (most reps)
					{ userId: "2", value: 150, status: "scored" },
					{ userId: "3", value: 100, status: "scored" },
					{ userId: "4", value: 50, status: "scored" },
				],
				scheme: "reps",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const first = results.find((r) => r.userId === "1")

			expect(first?.pScore).toBe(100)
			expect(first?.rank).toBe(1)
		})

		it("should calculate descending formula correctly", () => {
			// With 6 athletes, top half = 3, boundary = index 2
			// Best: 200, Median: 160 (boundary athlete)
			// Formula: 100 – (Best – X) × (50 / (Best – Median))
			// Athlete at 180: 100 – (200 – 180) × (50 / (200 – 160))
			//                = 100 – 20 × (50 / 40) = 100 – 25 = 75
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 200, status: "scored" },
					{ userId: "2", value: 180, status: "scored" },
					{ userId: "3", value: 160, status: "scored" }, // Boundary = median
					{ userId: "4", value: 140, status: "scored" },
					{ userId: "5", value: 120, status: "scored" },
					{ userId: "6", value: 100, status: "scored" },
				],
				scheme: "reps",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const mid = results.find((r) => r.userId === "2")

			expect(mid?.pScore).toBe(75)
		})

		it("should handle load scheme (descending)", () => {
			// 6 athletes, top half = 3, boundary at index 2
			// Best: 100kg, Median: 80kg (boundary)
			// Athlete at 90kg: 100 - (100 - 90) * (50 / (100 - 80))
			//                 = 100 - 10 * (50/20) = 100 - 25 = 75
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 100000, status: "scored" }, // 100kg
					{ userId: "2", value: 90000, status: "scored" },  // 90kg
					{ userId: "3", value: 80000, status: "scored" },  // 80kg = median (boundary)
					{ userId: "4", value: 70000, status: "scored" },
					{ userId: "5", value: 60000, status: "scored" },
					{ userId: "6", value: 50000, status: "scored" },
				],
				scheme: "load",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			expect(results.find((r) => r.userId === "1")?.pScore).toBe(100)
			expect(results.find((r) => r.userId === "2")?.pScore).toBe(75)
		})
	})

	describe("median calculation options", () => {
		it("should use top half for median by default", () => {
			// 6 athletes, top half = 3, boundary athlete (index 2) defines median
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 330, status: "scored" },
					{ userId: "3", value: 360, status: "scored" }, // Boundary = median
					{ userId: "4", value: 400, status: "scored" },
					{ userId: "5", value: 450, status: "scored" },
					{ userId: "6", value: 500, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			// With median = 360 (boundary athlete), athlete 3 gets 50
			const medianAthlete = results.find((r) => r.userId === "3")
			expect(medianAthlete?.pScore).toBe(50)
		})

		it("should use all athletes for median when configured", () => {
			// 4 athletes, all field median = average of 2nd and 3rd
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 420, status: "scored" },
					{ userId: "4", value: 480, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "all" },
			}

			const results = calculatePScore(input)
			// Median of all: (360 + 420) / 2 = 390
			// First place still 100, but athlete 2's score changes
			const first = results.find((r) => r.userId === "1")
			expect(first?.pScore).toBe(100)
		})
	})

	describe("status handling", () => {
		it("should exclude dns from scoring", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 0, status: "dns" },
					{ userId: "4", value: 420, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const dns = results.find((r) => r.userId === "3")

			expect(dns?.pScore).toBe(0)
			expect(dns?.rank).toBe(4) // Last place
		})

		it("should handle dnf as last scored place", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 0, status: "dnf" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const dnf = results.find((r) => r.userId === "3")

			expect(dnf?.rank).toBe(3)
			// DNF gets worst P-score among active field
		})

		it("should handle cap status in time-with-cap scheme", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 500, status: "cap" }, // Capped
					{ userId: "4", value: 420, status: "scored" },
				],
				scheme: "time-with-cap",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const capped = results.find((r) => r.userId === "3")

			// Capped athlete ranks after all who finished
			expect(capped?.rank).toBeGreaterThan(3)
		})

		it("should exclude withdrawn from all calculations", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
					{ userId: "3", value: 0, status: "withdrawn" },
					{ userId: "4", value: 420, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const withdrawn = results.find((r) => r.userId === "3")

			expect(withdrawn?.pScore).toBe(0)
			// Withdrawn doesn't affect other calculations
		})
	})

	describe("edge cases", () => {
		it("should handle single athlete", () => {
			const input: PScoreInput = {
				scores: [{ userId: "1", value: 300, status: "scored" }],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			expect(results[0]?.pScore).toBe(100)
			expect(results[0]?.rank).toBe(1)
		})

		it("should handle two athletes", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			expect(results.find((r) => r.userId === "1")?.pScore).toBe(100)
			// With 2 athletes, top half = 1, so second athlete is below median
		})

		it("should handle tied scores", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 300, status: "scored" }, // Tied for first
					{ userId: "3", value: 360, status: "scored" },
					{ userId: "4", value: 420, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			// Both tied athletes get 100 points and rank 1
			expect(results.find((r) => r.userId === "1")?.pScore).toBe(100)
			expect(results.find((r) => r.userId === "2")?.pScore).toBe(100)
			expect(results.find((r) => r.userId === "1")?.rank).toBe(1)
			expect(results.find((r) => r.userId === "2")?.rank).toBe(1)
		})

		it("should handle all identical scores", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 300, status: "scored" },
					{ userId: "3", value: 300, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			// All get 100 when tied
			expect(results.every((r) => r.pScore === 100)).toBe(true)
			expect(results.every((r) => r.rank === 1)).toBe(true)
		})

		it("should handle empty scores array", () => {
			const input: PScoreInput = {
				scores: [],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			expect(results).toEqual([])
		})

		it("should handle points scheme (descending)", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 100, status: "scored" },
					{ userId: "2", value: 80, status: "scored" },
					{ userId: "3", value: 60, status: "scored" },
					{ userId: "4", value: 40, status: "scored" },
				],
				scheme: "points",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			expect(results.find((r) => r.userId === "1")?.pScore).toBe(100)
			expect(results.find((r) => r.userId === "1")?.rank).toBe(1)
		})
	})

	describe("results ordering", () => {
		it("should return results sorted by rank", () => {
			const input: PScoreInput = {
				scores: [
					{ userId: "4", value: 480, status: "scored" },
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "3", value: 420, status: "scored" },
					{ userId: "2", value: 360, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)

			expect(results[0]?.userId).toBe("1")
			expect(results[1]?.userId).toBe("2")
			expect(results[2]?.userId).toBe("3")
			expect(results[3]?.userId).toBe("4")
		})
	})

	describe("precision", () => {
		it("should round pScore to 2 decimal places", () => {
			// 6 athletes, top half = 3, boundary at index 2 = 360
			// Best: 300, Median: 360
			// Athlete at 340: 100 - (340 - 300) * (50 / (360 - 300))
			//                = 100 - 40 * (50/60) = 100 - 33.333... = 66.67
			const input: PScoreInput = {
				scores: [
					{ userId: "1", value: 300, status: "scored" },
					{ userId: "2", value: 340, status: "scored" },
					{ userId: "3", value: 360, status: "scored" }, // Boundary = median
					{ userId: "4", value: 400, status: "scored" },
					{ userId: "5", value: 450, status: "scored" },
					{ userId: "6", value: 500, status: "scored" },
				],
				scheme: "time",
				config: { allowNegatives: true, medianField: "top_half" },
			}

			const results = calculatePScore(input)
			const second = results.find((r) => r.userId === "2")

			// 100 - (340-300) * (50 / (360-300)) = 100 - 40 * (50/60) = 100 - 33.333... = 66.67
			expect(second?.pScore).toBeCloseTo(66.67, 2)
		})
	})
})
