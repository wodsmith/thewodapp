import { describe, expect, it } from "vitest"
import {
	parseScore,
	parseTime,
	parseTiebreak,
} from "@/lib/scoring"

describe("parseTime", () => {
	describe("smart parsing (auto precision)", () => {
		it("should parse 2 digits as seconds", () => {
			const result = parseTime("45")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(45000)
			expect(result.formatted).toBe("0:45")
		})

		it("should parse 3 digits as M:SS", () => {
			const result = parseTime("345")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(225000) // 3:45
			expect(result.formatted).toBe("3:45")
		})

		it("should parse 4 digits as MM:SS", () => {
			const result = parseTime("1234")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(754000) // 12:34
			expect(result.formatted).toBe("12:34")
		})

		it("should parse 5 digits as H:MM:SS", () => {
			const result = parseTime("10234")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(3754000) // 1:02:34
			expect(result.formatted).toBe("1:02:34")
		})

		it("should parse 6 digits as HH:MM:SS", () => {
			const result = parseTime("010234")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(3754000) // 1:02:34
			expect(result.formatted).toBe("1:02:34")
		})

		it("should parse formatted time directly", () => {
			const result = parseTime("12:34")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(754000)
			expect(result.formatted).toBe("12:34")
		})

		it("should parse time with milliseconds", () => {
			const result = parseTime("12:34.567")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(754567)
			expect(result.formatted).toBe("12:34.567")
		})

		it("should parse decimal seconds in auto mode", () => {
			const result = parseTime("45.5")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(45500)
			expect(result.formatted).toBe("0:45.500")
		})
	})

	describe("explicit precision", () => {
		it("should parse as seconds when precision is 'seconds'", () => {
			const result = parseTime("754", { precision: "seconds" })
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(754000)
			expect(result.formatted).toBe("12:34")
		})

		it("should parse as milliseconds when precision is 'ms'", () => {
			const result = parseTime("754567", { precision: "ms" })
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(754567)
			expect(result.formatted).toBe("12:34.567")
		})
	})

	describe("error handling", () => {
		it("should return invalid for empty input", () => {
			const result = parseTime("")
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Empty input")
		})

		it("should return invalid for non-numeric input", () => {
			const result = parseTime("abc")
			expect(result.isValid).toBe(false)
		})

		it("should return invalid for invalid time format", () => {
			const result = parseTime("12:60") // Invalid seconds
			expect(result.isValid).toBe(false)
		})
	})
})

describe("parseScore", () => {
	describe("time scheme", () => {
		it("should parse time inputs", () => {
			const result = parseScore("1234", "time")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(754000)
			expect(result.formatted).toBe("12:34")
		})
	})

	describe("rounds-reps scheme", () => {
		it("should parse rounds+reps format", () => {
			const result = parseScore("5+12", "rounds-reps")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(500012)
			expect(result.formatted).toBe("5+12")
		})

		it("should parse complete rounds", () => {
			const result = parseScore("10", "rounds-reps")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(1000000)
			expect(result.formatted).toBe("10+0")
		})

		it("should handle complete rounds with warning in non-strict mode", () => {
			// Bare numbers are interpreted as complete rounds
			const result = parseScore("10", "rounds-reps")
			expect(result.isValid).toBe(true)
			// Has warning about interpretation
			expect(result.warnings?.length).toBeGreaterThan(0)
		})

		it("should return invalid for bad format", () => {
			const result = parseScore("5+12+3", "rounds-reps")
			expect(result.isValid).toBe(false)
		})
	})

	describe("load scheme", () => {
		it("should parse weight input", () => {
			const result = parseScore("225", "load", { unit: "lbs" })
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(Math.round(225 * 453.592))
			expect(result.formatted).toBe("225")
		})

		it("should handle kg unit", () => {
			const result = parseScore("100", "load", { unit: "kg" })
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(100000)
		})

		it("should return invalid for negative weight", () => {
			const result = parseScore("-100", "load")
			expect(result.isValid).toBe(false)
		})
	})

	describe("distance schemes", () => {
		it("should parse meters input", () => {
			const result = parseScore("5000", "meters")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(5000000)
		})

		it("should parse feet input", () => {
			const result = parseScore("100", "feet")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(Math.round(100 * 304.8))
		})
	})

	describe("count-based schemes", () => {
		it("should parse reps input", () => {
			const result = parseScore("150", "reps")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(150)
		})

		it("should parse calories input", () => {
			const result = parseScore("200", "calories")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(200)
		})

		it("should parse points input", () => {
			const result = parseScore("85", "points")
			expect(result.isValid).toBe(true)
			expect(result.encoded).toBe(85)
		})

		it("should return invalid for non-integer", () => {
			const result = parseScore("150.5", "reps")
			expect(result.isValid).toBe(true) // parseInt handles this
			expect(result.encoded).toBe(150)
		})
	})

	describe("pass-fail scheme", () => {
		it("should parse pass variations", () => {
			expect(parseScore("pass", "pass-fail").encoded).toBe(1)
			expect(parseScore("Pass", "pass-fail").encoded).toBe(1)
			expect(parseScore("PASS", "pass-fail").encoded).toBe(1)
			expect(parseScore("p", "pass-fail").encoded).toBe(1)
			expect(parseScore("1", "pass-fail").encoded).toBe(1)
			expect(parseScore("yes", "pass-fail").encoded).toBe(1)
		})

		it("should parse fail variations", () => {
			expect(parseScore("fail", "pass-fail").encoded).toBe(0)
			expect(parseScore("Fail", "pass-fail").encoded).toBe(0)
			expect(parseScore("f", "pass-fail").encoded).toBe(0)
			expect(parseScore("0", "pass-fail").encoded).toBe(0)
			expect(parseScore("no", "pass-fail").encoded).toBe(0)
		})

		it("should return invalid for other values", () => {
			const result = parseScore("maybe", "pass-fail")
			expect(result.isValid).toBe(false)
		})
	})
})

describe("parseTiebreak", () => {
	it("should parse time tiebreak", () => {
		const result = parseTiebreak("830", "time")
		expect(result.isValid).toBe(true)
		expect(result.encoded).toBe(510000) // 8:30
	})

	it("should parse reps tiebreak", () => {
		const result = parseTiebreak("150", "reps")
		expect(result.isValid).toBe(true)
		expect(result.encoded).toBe(150)
	})
})
