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
			expect(result.rawValue).toBe(600) // Time cap in seconds
			expect(result.formatted).toBe("CAP (10:00)")
		})

		it("should accept lowercase cap", () => {
			const result = parseScore("cap", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
			expect(result.rawValue).toBe(600)
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
			const result = parseScore("1030", "time-with-cap", 600)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Time cannot exceed cap of 10:00")
		})

		it("should reject time score that significantly exceeds cap", () => {
			// 15:00 cap (900 seconds), user enters 20:00 (1200 seconds)
			const result = parseScore("2000", "time-with-cap", 900)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Time cannot exceed cap of 15:00")
		})

		it("should accept time score under cap", () => {
			// 15:00 cap (900 seconds), user enters 12:34 (754 seconds)
			const result = parseScore("1234", "time-with-cap", 900)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(754)
		})
	})

	describe("time equals cap (auto-CAP)", () => {
		it("should treat time equal to cap as CAP", () => {
			// 10:00 cap (600 seconds), user enters exactly 10:00
			const result = parseScore("1000", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
			expect(result.rawValue).toBe(600)
			expect(result.formatted).toBe("CAP (10:00)")
		})

		it("should treat formatted time equal to cap as CAP", () => {
			const result = parseScore("10:00", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("cap")
		})
	})

	describe("regular time scheme (no cap validation)", () => {
		it("should accept any time for regular time scheme without cap", () => {
			const result = parseScore("2000", "time", undefined)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(1200) // 20:00 = 1200 seconds
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
			// This shouldn't happen in practice, but let's ensure it doesn't crash
			const result = parseScore("cap", "time-with-cap", 0)
			expect(result.isValid).toBe(true)
			expect(result.rawValue).toBe(0)
		})

		it("should accept time just under cap", () => {
			// 10:00 cap (600 seconds), user enters 9:59 (599 seconds)
			const result = parseScore("959", "time-with-cap", 600)
			expect(result.isValid).toBe(true)
			expect(result.scoreStatus).toBe("scored")
			expect(result.rawValue).toBe(599)
		})

		it("should accept time 1 second over cap as invalid", () => {
			// 10:00 cap (600 seconds), user enters 10:01 (601 seconds)
			const result = parseScore("1001", "time-with-cap", 600)
			expect(result.isValid).toBe(false)
			expect(result.error).toBe("Time cannot exceed cap of 10:00")
		})
	})
})

describe("parseTieBreakScore", () => {
	it("should parse time tiebreak", () => {
		const result = parseTieBreakScore("830", "time")
		expect(result.isValid).toBe(true)
		expect(result.rawValue).toBe(510) // 8:30 = 510 seconds
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
