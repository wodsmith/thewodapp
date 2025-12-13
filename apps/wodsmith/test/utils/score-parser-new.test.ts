import { describe, expect, it } from "vitest"
import {
	parseScore,
	parseTieBreakScore,
} from "@/utils/score-parser-new"

describe("parseScore time cap validation", () => {
	describe("CAP input handling", () => {
		it("should accept CAP for time-with-cap scheme", () => {
			const result = parseScore("CAP", "time-with-cap", 600) // 10:00 cap
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
			expect(result.rawValue).toBe(600_000) // Time cap in milliseconds
			expect(result.formatted).toBe("CAP (10:00)")
		})

		it("should accept lowercase cap", () => {
			const result = parseScore("cap", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
			expect(result.rawValue).toBe(600_000) // milliseconds
		})

		it("should accept 'c' shorthand for CAP", () => {
			const result = parseScore("c", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
		})

		it("should return CAP without formatted time if no timeCap provided", () => {
			const result = parseScore("cap", "time-with-cap", undefined)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
			expect(result.rawValue).toBe(null)
			expect(result.formatted).toBe("CAP")
		})

		it("should reject CAP for non-time schemes", () => {
			const result = parseScore("CAP", "reps", undefined)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("CAP is only valid for timed workouts")
		})

		it("should accept CAP for regular time scheme", () => {
			const result = parseScore("cap", "time", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
		})

		it("should indicate tiebreak is needed when tiebreakScheme is set", () => {
			const result = parseScore("cap", "time-with-cap", 600, "reps")
			expect(result.isValid).toBe(true)
			expect(result.needsTieBreak).toBe(true)
		})
	})

	describe("time exceeds cap validation", () => {
		it("should reject time score that exceeds cap", () => {
			// 10:00 cap (600 seconds), user enters 10:30 (630 seconds)
			const result = parseScore("10:30", "time-with-cap", 600)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Time cannot exceed cap of 10:00")
		})

		it("should reject time score that significantly exceeds cap", () => {
			// 15:00 cap (900 seconds), user enters 20:00 (1200 seconds)
			const result = parseScore("20:00", "time-with-cap", 900)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Time cannot exceed cap of 15:00")
		})

		it("should accept time score under cap", () => {
			// 15:00 cap (900 seconds), user enters 754 seconds (12:34)
			const result = parseScore("754", "time-with-cap", 900)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(754_000) // milliseconds
		})

		it("should accept time score under cap with colon format", () => {
			// 15:00 cap (900 seconds), user enters 12:34 (754 seconds)
			const result = parseScore("12:34", "time-with-cap", 900)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(754_000) // milliseconds
		})
	})

	describe("time equals cap (auto-CAP)", () => {
		it("should treat time equal to cap as CAP (seconds input)", () => {
			// 10:00 cap (600 seconds), user enters exactly 600 seconds
			const result = parseScore("600", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
			expect(result.rawValue).toBe(600_000) // milliseconds
			expect(result.formatted).toBe("CAP (10:00)")
		})

		it("should treat formatted time equal to cap as CAP", () => {
			const result = parseScore("10:00", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
		})
	})

	describe("regular time scheme (no cap validation)", () => {
		it("should accept any time for regular time scheme without cap (seconds input)", () => {
			// Plain number is interpreted as seconds: 2000 seconds = 33:20
			const result = parseScore("2000", "time", undefined)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(2_000_000) // 2000 seconds in milliseconds
		})

		it("should accept formatted time for regular time scheme", () => {
			const result = parseScore("20:00", "time", undefined)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(1_200_000) // 20:00 = 1200 seconds in milliseconds
		})

		it("should not validate against cap for regular time scheme", () => {
			// Even if timeCap is passed, regular time scheme doesn't validate
			const result = parseScore("2000", "time", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
		})
	})

	describe("special statuses", () => {
		it("should handle DNS", () => {
			const result = parseScore("dns", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("dns")
			expect(result.formatted).toBe("DNS")
			expect(result.rawValue).toBe(null)
		})

		it("should handle DNF", () => {
			const result = parseScore("dnf", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("dnf")
			expect(result.formatted).toBe("DNF")
			expect(result.rawValue).toBe(null)
		})
	})

	describe("edge cases", () => {
		it("should handle empty input", () => {
			const result = parseScore("", "time-with-cap", 600)
			expect(result.isValid).toBe(false)
			expect(result.rawValue).toBe(null)
		})

		it("should handle whitespace-only input", () => {
			const result = parseScore("   ", "time-with-cap", 600)
			expect(result.isValid).toBe(false)
		})

		it("should handle time cap of 0 (edge case)", () => {
			// A time cap of 0 doesn't make practical sense, treated as no cap
			const result = parseScore("cap", "time-with-cap", 0)
			expect(result.isValid).toBe(true)
			expect(result.rawValue).toBe(null) // 0 is treated as "no cap"
			expect(result.formatted).toBe("CAP")
		})

		it("should accept time just under cap", () => {
			// 10:00 cap (600 seconds), user enters 599 seconds (9:59)
			const result = parseScore("599", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(599_000) // milliseconds
		})

		it("should accept time just under cap with colon format", () => {
			// 10:00 cap (600 seconds), user enters 9:59 (599 seconds)
			const result = parseScore("9:59", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(599_000) // milliseconds
		})

		it("should accept time 1 second over cap as invalid", () => {
			// 10:00 cap (600 seconds), user enters 601 seconds (10:01)
			const result = parseScore("601", "time-with-cap", 600)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Time cannot exceed cap of 10:00")
		})
	})
})

describe("parseTieBreakScore", () => {
	it("should parse time tiebreak (plain number as seconds)", () => {
		// Plain number is interpreted as seconds
		const result = parseTieBreakScore("90", "time")
		expect(result.isValid).toBe(true)
		expect(result.rawValue).toBe(90_000) // 90 seconds in milliseconds
		expect(result.formatted).toBe("1:30")
	})

	it("should parse time tiebreak with colon format", () => {
		const result = parseTieBreakScore("8:30", "time")
		expect(result.isValid).toBe(true)
		expect(result.rawValue).toBe(510_000) // 8:30 = 510 seconds in milliseconds
	})

	it("should parse reps tiebreak", () => {
		const result = parseTieBreakScore("150", "reps")
		expect(result.isValid).toBe(true)
		expect(result.rawValue).toBe(150)
	})

	it("should handle empty input", () => {
		const result = parseTieBreakScore("", "time")
		expect(result.isValid).toBe(false)
	})
})

describe("parseScore load scheme", () => {
	it("should parse load score", () => {
		const result = parseScore("225", "load")
		expect(result.isValid).toBe(true)
		expect(result.formatted).toBe("225")
		// 225 lbs in grams (225 * 453.592)
		expect(result.rawValue).toBe(Math.round(225 * 453.592))
	})

	it("should parse fractional load score", () => {
		const result = parseScore("225.5", "load")
		expect(result.isValid).toBe(true)
		// 225.5 lbs in grams
		expect(result.rawValue).toBe(Math.round(225.5 * 453.592))
	})
})

describe("parseScore reps scheme", () => {
	it("should parse reps score", () => {
		const result = parseScore("150", "reps")
		expect(result.isValid).toBe(true)
		expect(result.rawValue).toBe(150)
		expect(result.formatted).toBe("150")
	})
})

describe("parseScore rounds-reps scheme", () => {
	it("should parse rounds+reps format", () => {
		const result = parseScore("5+12", "rounds-reps")
		expect(result.isValid).toBe(true)
		// 5 rounds + 12 reps = 5 * 100000 + 12 = 500012
		expect(result.rawValue).toBe(500012)
	})

	it("should parse plain rounds (complete rounds)", () => {
		const result = parseScore("5", "rounds-reps")
		expect(result.isValid).toBe(true)
		// 5 rounds + 0 reps = 5 * 100000 = 500000
		expect(result.rawValue).toBe(500000)
	})
})
