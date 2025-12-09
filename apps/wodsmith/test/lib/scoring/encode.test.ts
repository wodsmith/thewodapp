import { describe, expect, it } from "vitest"
import {
	encodeScore,
	encodeTime,
	encodeTimeFromSeconds,
	encodeRoundsReps,
	encodeRoundsRepsFromParts,
	encodeLoad,
	encodeLoadFromNumber,
	encodeDistance,
	encodeDistanceFromNumber,
	encodeRounds,
	extractRoundsReps,
} from "@/lib/scoring"

describe("encodeTime", () => {
	it("should encode MM:SS format", () => {
		expect(encodeTime("12:34")).toBe(754000)
		expect(encodeTime("0:45")).toBe(45000)
		expect(encodeTime("1:00")).toBe(60000)
	})

	it("should encode MM:SS.fff format with milliseconds", () => {
		expect(encodeTime("12:34.567")).toBe(754567)
		expect(encodeTime("12:34.5")).toBe(754500)
		expect(encodeTime("12:34.56")).toBe(754560)
	})

	it("should encode HH:MM:SS format", () => {
		expect(encodeTime("1:02:34")).toBe(3754000)
		expect(encodeTime("1:00:00")).toBe(3600000)
		expect(encodeTime("2:30:00")).toBe(9000000)
	})

	it("should encode HH:MM:SS.fff format", () => {
		expect(encodeTime("1:02:34.567")).toBe(3754567)
	})

	it("should handle raw seconds (no colon)", () => {
		expect(encodeTime("90")).toBe(90000)
		expect(encodeTime("754")).toBe(754000)
	})

	it("should handle minutes >= 60 without hours", () => {
		expect(encodeTime("120:30")).toBe(7230000) // 120 min 30 sec
	})

	it("should return null for invalid input", () => {
		expect(encodeTime("")).toBeNull()
		expect(encodeTime("abc")).toBeNull()
		expect(encodeTime("12:60")).toBeNull() // Invalid seconds
		expect(encodeTime("1:2:3:4")).toBeNull() // Too many parts
	})
})

describe("encodeTimeFromSeconds", () => {
	it("should convert seconds to milliseconds", () => {
		expect(encodeTimeFromSeconds(754)).toBe(754000)
		expect(encodeTimeFromSeconds(754.567)).toBe(754567)
		expect(encodeTimeFromSeconds(0)).toBe(0)
	})
})

describe("encodeRoundsReps", () => {
	it("should encode rounds+reps format", () => {
		expect(encodeRoundsReps("5+12")).toBe(500012)
		expect(encodeRoundsReps("10+0")).toBe(1000000)
		expect(encodeRoundsReps("0+45")).toBe(45)
	})

	it("should encode complete rounds (no +)", () => {
		expect(encodeRoundsReps("5")).toBe(500000)
		expect(encodeRoundsReps("10")).toBe(1000000)
	})

	it("should handle whitespace", () => {
		expect(encodeRoundsReps(" 5 + 12 ")).toBe(500012)
	})

	it("should return null for invalid input", () => {
		expect(encodeRoundsReps("")).toBeNull()
		expect(encodeRoundsReps("abc")).toBeNull()
		expect(encodeRoundsReps("-5+12")).toBeNull()
		expect(encodeRoundsReps("5+-12")).toBeNull()
	})
})

describe("encodeRoundsRepsFromParts", () => {
	it("should encode from numeric parts", () => {
		expect(encodeRoundsRepsFromParts(5, 12)).toBe(500012)
		expect(encodeRoundsRepsFromParts(10, 0)).toBe(1000000)
		expect(encodeRoundsRepsFromParts(0, 45)).toBe(45)
	})

	it("should return null for invalid parts", () => {
		expect(encodeRoundsRepsFromParts(-1, 12)).toBeNull()
		expect(encodeRoundsRepsFromParts(5, -1)).toBeNull()
	})
})

describe("extractRoundsReps", () => {
	it("should extract rounds and reps from encoded value", () => {
		expect(extractRoundsReps(500012)).toEqual({ rounds: 5, reps: 12 })
		expect(extractRoundsReps(1000000)).toEqual({ rounds: 10, reps: 0 })
		expect(extractRoundsReps(45)).toEqual({ rounds: 0, reps: 45 })
	})
})

describe("encodeLoad", () => {
	it("should encode lbs to grams", () => {
		const encoded = encodeLoad("225", "lbs")
		expect(encoded).toBe(Math.round(225 * 453.592))
	})

	it("should encode kg to grams", () => {
		const encoded = encodeLoad("100", "kg")
		expect(encoded).toBe(100000)
	})

	it("should handle decimal weights", () => {
		const encoded = encodeLoad("225.5", "lbs")
		expect(encoded).toBe(Math.round(225.5 * 453.592))
	})

	it("should return null for invalid input", () => {
		expect(encodeLoad("", "lbs")).toBeNull()
		expect(encodeLoad("abc", "lbs")).toBeNull()
		expect(encodeLoad("-100", "lbs")).toBeNull()
	})
})

describe("encodeLoadFromNumber", () => {
	it("should encode numeric weight", () => {
		expect(encodeLoadFromNumber(225, "lbs")).toBe(Math.round(225 * 453.592))
		expect(encodeLoadFromNumber(100, "kg")).toBe(100000)
	})
})

describe("encodeDistance", () => {
	it("should encode meters to millimeters", () => {
		expect(encodeDistance("5000", "m")).toBe(5000000)
		expect(encodeDistance("1", "m")).toBe(1000)
	})

	it("should encode kilometers to millimeters", () => {
		expect(encodeDistance("5", "km")).toBe(5000000)
	})

	it("should encode feet to millimeters", () => {
		expect(encodeDistance("100", "ft")).toBe(Math.round(100 * 304.8))
	})

	it("should encode miles to millimeters", () => {
		expect(encodeDistance("1", "mi")).toBe(1609344)
	})

	it("should return null for invalid input", () => {
		expect(encodeDistance("", "m")).toBeNull()
		expect(encodeDistance("abc", "m")).toBeNull()
		expect(encodeDistance("-100", "m")).toBeNull()
	})
})

describe("encodeScore", () => {
	it("should encode time-based scores", () => {
		expect(encodeScore("12:34", "time")).toBe(754000)
		expect(encodeScore("12:34.567", "time-with-cap")).toBe(754567)
		expect(encodeScore("5:00", "emom")).toBe(300000)
	})

	it("should encode rounds-reps scores", () => {
		expect(encodeScore("5+12", "rounds-reps")).toBe(500012)
	})

	it("should encode load scores", () => {
		expect(encodeScore("225", "load", { unit: "lbs" })).toBe(Math.round(225 * 453.592))
	})

	it("should encode distance scores", () => {
		expect(encodeScore("5000", "meters")).toBe(5000000)
		expect(encodeScore("100", "feet", { unit: "ft" })).toBe(Math.round(100 * 304.8))
	})

	it("should encode count-based scores", () => {
		expect(encodeScore("150", "reps")).toBe(150)
		expect(encodeScore("200", "calories")).toBe(200)
		expect(encodeScore("85", "points")).toBe(85)
	})

	it("should encode pass-fail scores", () => {
		expect(encodeScore("pass", "pass-fail")).toBe(1)
		expect(encodeScore("fail", "pass-fail")).toBe(0)
		expect(encodeScore("Pass", "pass-fail")).toBe(1)
		expect(encodeScore("FAIL", "pass-fail")).toBe(0)
	})
})

describe("encodeRounds", () => {
	it("should encode multiple rounds and aggregate with max", () => {
		const rounds = [
			{ raw: "225" },
			{ raw: "235" },
			{ raw: "245" },
		]
		const result = encodeRounds(rounds, "load", "max", { unit: "lbs" })

		expect(result.rounds).toHaveLength(3)
		expect(result.aggregated).toBe(Math.round(245 * 453.592))
	})

	it("should encode multiple rounds and aggregate with min", () => {
		const rounds = [
			{ raw: "5:00" },
			{ raw: "4:45" },
			{ raw: "5:10" },
		]
		const result = encodeRounds(rounds, "time", "min")

		expect(result.rounds).toHaveLength(3)
		expect(result.aggregated).toBe(285000) // 4:45
	})

	it("should encode multiple rounds and aggregate with sum", () => {
		const rounds = [
			{ raw: "100" },
			{ raw: "150" },
			{ raw: "125" },
		]
		const result = encodeRounds(rounds, "reps", "sum")

		expect(result.rounds).toEqual([100, 150, 125])
		expect(result.aggregated).toBe(375)
	})

	it("should handle round-specific units", () => {
		const rounds = [
			{ raw: "225", unit: "lbs" as const },
			{ raw: "100", unit: "kg" as const },
		]
		const result = encodeRounds(rounds, "load", "max")

		expect(result.rounds).toHaveLength(2)
		// 100kg = 100000g, 225lbs ≈ 102058g
		expect(result.aggregated).toBe(Math.round(225 * 453.592))
	})
})
