import { describe, it, expect } from "vitest"
import {
	formatScore,
	calculateAggregatedScore,
	getDefaultScoreType,
	formatScoreFromSets,
} from "@/utils/score-formatting"
import type { Set as DBSet } from "@/db/schema"

describe("score-formatting", () => {
	describe("formatScore", () => {
		it("returns N/A for null score", () => {
			expect(formatScore(null, "time")).toBe("N/A")
			expect(formatScore(null, "load")).toBe("N/A")
			expect(formatScore(null, "reps")).toBe("N/A")
		})

		describe("time scheme", () => {
			it("formats time in MM:SS format", () => {
				expect(formatScore(90, "time")).toBe("1:30")
				expect(formatScore(125, "time")).toBe("2:05")
				expect(formatScore(0, "time")).toBe("0:00")
				expect(formatScore(3661, "time")).toBe("61:01")
			})
		})

		describe("emom scheme", () => {
			it("formats time in MM:SS format", () => {
				expect(formatScore(120, "emom")).toBe("2:00")
				expect(formatScore(45, "emom")).toBe("0:45")
			})
		})

		describe("time-with-cap scheme", () => {
			it("formats finished time in MM:SS format", () => {
				expect(formatScore(180, "time-with-cap", false)).toBe("3:00")
				expect(formatScore(90, "time-with-cap", false)).toBe("1:30")
			})

			it("formats capped result as reps", () => {
				expect(formatScore(50, "time-with-cap", true)).toBe("50 reps (capped)")
				expect(formatScore(123, "time-with-cap", true)).toBe("123 reps (capped)")
			})
		})

		describe("reps scheme", () => {
			it("formats reps as string number", () => {
				expect(formatScore(100, "reps")).toBe("100")
				expect(formatScore(50, "reps")).toBe("50")
			})
		})

		describe("rounds-reps scheme", () => {
			it("formats whole rounds", () => {
				expect(formatScore(5, "rounds-reps")).toBe("5")
				expect(formatScore(10, "rounds-reps")).toBe("10")
			})

			it("formats rounds with reps", () => {
				// 5.5 represents 5 rounds + 50 reps (0.5 * 100)
				expect(formatScore(5.5, "rounds-reps")).toBe("5+50")
				// 3.25 represents 3 rounds + 25 reps
				expect(formatScore(3.25, "rounds-reps")).toBe("3+25")
			})
		})

		describe("load scheme", () => {
			it("formats load with lbs suffix", () => {
				expect(formatScore(275, "load")).toBe("275 lbs")
				expect(formatScore(135, "load")).toBe("135 lbs")
				expect(formatScore(0, "load")).toBe("0 lbs")
			})
		})

		describe("calories scheme", () => {
			it("formats calories as string number", () => {
				expect(formatScore(50, "calories")).toBe("50")
				expect(formatScore(100, "calories")).toBe("100")
			})
		})

		describe("meters scheme", () => {
			it("formats meters with m suffix", () => {
				expect(formatScore(1000, "meters")).toBe("1000m")
				expect(formatScore(500, "meters")).toBe("500m")
			})
		})

		describe("feet scheme", () => {
			it("formats feet with ft suffix", () => {
				expect(formatScore(100, "feet")).toBe("100ft")
				expect(formatScore(50, "feet")).toBe("50ft")
			})
		})

		describe("points scheme", () => {
			it("formats points as string number", () => {
				expect(formatScore(85, "points")).toBe("85")
				expect(formatScore(100, "points")).toBe("100")
			})
		})

		describe("pass-fail scheme", () => {
			it("formats passes with passes suffix", () => {
				expect(formatScore(3, "pass-fail")).toBe("3 passes")
				expect(formatScore(5, "pass-fail")).toBe("5 passes")
			})
		})

		describe("unknown scheme", () => {
			it("formats as string number", () => {
				expect(formatScore(42, "unknown-scheme")).toBe("42")
			})
		})
	})

	describe("calculateAggregatedScore", () => {
		const createSet = (overrides: Partial<Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance">> = {}): Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance"> => ({
			reps: null,
			weight: null,
			time: null,
			score: null,
			distance: null,
			...overrides,
		})

		it("returns [null, false] for empty sets", () => {
			expect(calculateAggregatedScore([], "time", null)).toEqual([null, false])
		})

		describe("time scheme", () => {
			it("uses min by default (fastest time wins)", () => {
				const sets = [
					createSet({ time: 120 }),
					createSet({ time: 90 }),
					createSet({ time: 150 }),
				]
				expect(calculateAggregatedScore(sets, "time", null)).toEqual([90, false])
			})

			it("respects explicit scoreType", () => {
				const sets = [
					createSet({ time: 120 }),
					createSet({ time: 90 }),
				]
				expect(calculateAggregatedScore(sets, "time", "max")).toEqual([120, false])
				expect(calculateAggregatedScore(sets, "time", "sum")).toEqual([210, false])
			})
		})

		describe("time-with-cap scheme", () => {
			it("detects finished result (has time, no reps)", () => {
				const sets = [createSet({ time: 180 })]
				expect(calculateAggregatedScore(sets, "time-with-cap", null)).toEqual([180, false])
			})

			it("detects capped result (has reps, no time)", () => {
				const sets = [createSet({ reps: 50 })]
				expect(calculateAggregatedScore(sets, "time-with-cap", null)).toEqual([50, true])
			})

			it("uses max for time-capped (higher reps is better)", () => {
				const sets = [
					createSet({ reps: 50 }),
					createSet({ reps: 75 }),
					createSet({ reps: 60 }),
				]
				expect(calculateAggregatedScore(sets, "time-with-cap", null)).toEqual([75, true])
			})
		})

		describe("load scheme", () => {
			it("uses max by default (higher weight wins)", () => {
				const sets = [
					createSet({ weight: 135 }),
					createSet({ weight: 185 }),
					createSet({ weight: 225 }),
					createSet({ weight: 275 }),
					createSet({ weight: 225 }),
				]
				expect(calculateAggregatedScore(sets, "load", null)).toEqual([275, false])
			})

			it("respects explicit scoreType", () => {
				const sets = [
					createSet({ weight: 135 }),
					createSet({ weight: 185 }),
					createSet({ weight: 225 }),
				]
				expect(calculateAggregatedScore(sets, "load", "sum")).toEqual([545, false])
				expect(calculateAggregatedScore(sets, "load", "first")).toEqual([135, false])
				expect(calculateAggregatedScore(sets, "load", "last")).toEqual([225, false])
			})
		})

		describe("reps scheme", () => {
			it("uses max by default", () => {
				const sets = [
					createSet({ reps: 10 }),
					createSet({ reps: 15 }),
					createSet({ reps: 12 }),
				]
				expect(calculateAggregatedScore(sets, "reps", null)).toEqual([15, false])
			})

			it("falls back to score field if reps is null", () => {
				const sets = [
					createSet({ score: 10 }),
					createSet({ score: 15 }),
				]
				expect(calculateAggregatedScore(sets, "reps", null)).toEqual([15, false])
			})
		})

		describe("rounds-reps scheme", () => {
			it("uses max by default", () => {
				const sets = [
					createSet({ reps: 100 }),
					createSet({ reps: 150 }),
				]
				expect(calculateAggregatedScore(sets, "rounds-reps", null)).toEqual([150, false])
			})
		})

		describe("calories scheme", () => {
			it("uses score field with max by default", () => {
				const sets = [
					createSet({ score: 50 }),
					createSet({ score: 75 }),
				]
				expect(calculateAggregatedScore(sets, "calories", null)).toEqual([75, false])
			})

			it("falls back to reps field", () => {
				const sets = [
					createSet({ reps: 50 }),
					createSet({ reps: 75 }),
				]
				expect(calculateAggregatedScore(sets, "calories", null)).toEqual([75, false])
			})
		})

		describe("meters scheme", () => {
			it("uses score field with max by default", () => {
				const sets = [
					createSet({ score: 1000 }),
					createSet({ score: 1500 }),
				]
				expect(calculateAggregatedScore(sets, "meters", null)).toEqual([1500, false])
			})

			it("falls back to distance field", () => {
				const sets = [
					createSet({ distance: 1000 }),
					createSet({ distance: 1500 }),
				]
				expect(calculateAggregatedScore(sets, "meters", null)).toEqual([1500, false])
			})
		})

		describe("feet scheme", () => {
			it("uses score field with max by default", () => {
				const sets = [
					createSet({ score: 100 }),
					createSet({ score: 150 }),
				]
				expect(calculateAggregatedScore(sets, "feet", null)).toEqual([150, false])
			})
		})

		describe("points scheme", () => {
			it("uses score field with max by default", () => {
				const sets = [
					createSet({ score: 85 }),
					createSet({ score: 92 }),
				]
				expect(calculateAggregatedScore(sets, "points", null)).toEqual([92, false])
			})
		})

		describe("pass-fail scheme", () => {
			it("uses first by default", () => {
				const sets = [
					createSet({ score: 1 }), // pass
					createSet({ score: 0 }), // fail
					createSet({ score: 1 }), // pass
				]
				expect(calculateAggregatedScore(sets, "pass-fail", null)).toEqual([1, false])
			})
		})

		describe("emom scheme", () => {
			it("uses max by default", () => {
				const sets = [
					createSet({ time: 30 }),
					createSet({ time: 45 }),
					createSet({ time: 40 }),
				]
				expect(calculateAggregatedScore(sets, "emom", null)).toEqual([45, false])
			})
		})

		describe("scoreType variations", () => {
			const sets = [
				createSet({ weight: 100 }),
				createSet({ weight: 150 }),
				createSet({ weight: 125 }),
			]

			it("applies min scoreType", () => {
				expect(calculateAggregatedScore(sets, "load", "min")).toEqual([100, false])
			})

			it("applies max scoreType", () => {
				expect(calculateAggregatedScore(sets, "load", "max")).toEqual([150, false])
			})

			it("applies sum scoreType", () => {
				expect(calculateAggregatedScore(sets, "load", "sum")).toEqual([375, false])
			})

			it("applies average scoreType", () => {
				expect(calculateAggregatedScore(sets, "load", "average")).toEqual([125, false])
			})

			it("applies first scoreType", () => {
				expect(calculateAggregatedScore(sets, "load", "first")).toEqual([100, false])
			})

			it("applies last scoreType", () => {
				expect(calculateAggregatedScore(sets, "load", "last")).toEqual([125, false])
			})
		})

		describe("edge cases", () => {
			it("handles sets with null values", () => {
				const sets = [
					createSet({ weight: 135 }),
					createSet({ weight: null }),
					createSet({ weight: 185 }),
				]
				expect(calculateAggregatedScore(sets, "load", null)).toEqual([185, false])
			})

			it("returns [null, false] when all values are null", () => {
				const sets = [
					createSet({ weight: null }),
					createSet({ weight: null }),
				]
				expect(calculateAggregatedScore(sets, "load", null)).toEqual([null, false])
			})

			it("returns [null, false] for unknown scheme", () => {
				const sets = [createSet({ weight: 100 })]
				expect(calculateAggregatedScore(sets, "unknown-scheme", null)).toEqual([null, false])
			})
		})
	})

	describe("getDefaultScoreType", () => {
		it("returns correct defaults for all schemes", () => {
			expect(getDefaultScoreType("time")).toBe("min")
			expect(getDefaultScoreType("time-with-cap")).toBe("min")
			expect(getDefaultScoreType("pass-fail")).toBe("first")
			expect(getDefaultScoreType("rounds-reps")).toBe("max")
			expect(getDefaultScoreType("reps")).toBe("max")
			expect(getDefaultScoreType("emom")).toBe("max")
			expect(getDefaultScoreType("load")).toBe("max")
			expect(getDefaultScoreType("calories")).toBe("max")
			expect(getDefaultScoreType("meters")).toBe("max")
			expect(getDefaultScoreType("feet")).toBe("max")
			expect(getDefaultScoreType("points")).toBe("max")
		})

		it("returns max for unknown schemes", () => {
			expect(getDefaultScoreType("unknown-scheme")).toBe("max")
		})
	})

	describe("formatScoreFromSets", () => {
		const createSet = (overrides: Partial<Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance">> = {}): Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance"> => ({
			reps: null,
			weight: null,
			time: null,
			score: null,
			distance: null,
			...overrides,
		})

		it("combines calculation and formatting for load scheme", () => {
			const sets = [
				createSet({ weight: 135 }),
				createSet({ weight: 185 }),
				createSet({ weight: 275 }),
			]
			expect(formatScoreFromSets(sets, "load", null)).toBe("275 lbs")
		})

		it("combines calculation and formatting for time scheme", () => {
			const sets = [
				createSet({ time: 120 }),
				createSet({ time: 90 }),
				createSet({ time: 150 }),
			]
			expect(formatScoreFromSets(sets, "time", null)).toBe("1:30")
		})

		it("combines calculation and formatting for reps scheme", () => {
			const sets = [
				createSet({ reps: 10 }),
				createSet({ reps: 15 }),
				createSet({ reps: 12 }),
			]
			expect(formatScoreFromSets(sets, "reps", null)).toBe("15")
		})

		it("returns N/A for empty sets", () => {
			expect(formatScoreFromSets([], "load", null)).toBe("N/A")
		})

		it("handles time-capped results correctly", () => {
			const sets = [createSet({ reps: 75 })]
			expect(formatScoreFromSets(sets, "time-with-cap", null)).toBe("75 reps (capped)")
		})

		it("handles finished time-with-cap results correctly", () => {
			const sets = [createSet({ time: 180 })]
			expect(formatScoreFromSets(sets, "time-with-cap", null)).toBe("3:00")
		})
	})
})
