import { describe, expect, it } from "vitest"
import {
	validateScoreInput,
	validateTime,
	validateRoundsReps,
	validateLoad,
	validateDistance,
	isOutlier,
} from "@/lib/scoring"

describe("validateScoreInput", () => {
	it("should validate valid time input", () => {
		const result = validateScoreInput({
			scheme: "time",
			value: "12:34",
			status: "scored",
		})
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it("should validate valid rounds-reps input", () => {
		const result = validateScoreInput({
			scheme: "rounds-reps",
			value: "5+12",
		})
		expect(result.isValid).toBe(true)
	})

	it("should reject missing scheme", () => {
		const result = validateScoreInput({
			scheme: "" as any,
			value: "12:34",
		})
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Scheme is required")
	})

	it("should reject missing value and rounds", () => {
		const result = validateScoreInput({
			scheme: "time",
		})
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Either value or rounds must be provided")
	})

	it("should validate multiple rounds", () => {
		const result = validateScoreInput({
			scheme: "load",
			rounds: [
				{ raw: "225" },
				{ raw: "235" },
			],
		})
		expect(result.isValid).toBe(true)
	})

	it("should report invalid rounds", () => {
		const result = validateScoreInput({
			scheme: "load",
			rounds: [
				{ raw: "225" },
				{ raw: "abc" },
			],
		})
		expect(result.isValid).toBe(false)
		expect(result.errors.some(e => e.includes("Round 2"))).toBe(true)
	})

	it("should validate tiebreak", () => {
		const result = validateScoreInput({
			scheme: "rounds-reps",
			value: "5+12",
			tiebreak: {
				raw: "830",
				scheme: "time",
			},
		})
		expect(result.isValid).toBe(true)
	})

	it("should reject tiebreak without scheme", () => {
		const result = validateScoreInput({
			scheme: "rounds-reps",
			value: "5+12",
			tiebreak: {
				raw: "830",
				scheme: "" as any,
			},
		})
		expect(result.isValid).toBe(false)
		expect(result.errors.some(e => e.includes("Tiebreak scheme"))).toBe(true)
	})

	it("should validate time cap", () => {
		const result = validateScoreInput({
			scheme: "time-with-cap",
			value: "12:34",
			timeCap: {
				ms: 900000,
			},
		})
		expect(result.isValid).toBe(true)
	})

	it("should reject invalid time cap", () => {
		const result = validateScoreInput({
			scheme: "time-with-cap",
			value: "12:34",
			timeCap: {
				ms: -1,
			},
		})
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Time cap must be positive")
	})

	it("should warn about capped result without secondary score", () => {
		const result = validateScoreInput({
			scheme: "time-with-cap",
			value: "15:00",
			status: "cap",
			timeCap: {
				ms: 900000,
			},
		})
		expect(result.isValid).toBe(true)
		expect(result.warnings.length).toBeGreaterThan(0)
	})

	it("should reject invalid status", () => {
		const result = validateScoreInput({
			scheme: "time",
			value: "12:34",
			status: "invalid" as any,
		})
		expect(result.isValid).toBe(false)
	})
})

describe("validateTime", () => {
	it("should validate positive time", () => {
		const result = validateTime(754000)
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it("should reject negative time", () => {
		const result = validateTime(-1000)
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Time cannot be negative")
	})

	it("should warn about very long time", () => {
		const result = validateTime(25 * 60 * 60 * 1000) // 25 hours
		expect(result.isValid).toBe(true)
		expect(result.warnings).toContain("Time exceeds 24 hours")
	})
})

describe("validateRoundsReps", () => {
	it("should validate valid rounds+reps", () => {
		const result = validateRoundsReps(500012)
		expect(result.isValid).toBe(true)
	})

	it("should reject negative value", () => {
		const result = validateRoundsReps(-1)
		expect(result.isValid).toBe(false)
	})

	it("should warn about high rounds", () => {
		const result = validateRoundsReps(1001 * 100000) // 1001 rounds
		expect(result.isValid).toBe(true)
		expect(result.warnings.some(w => w.includes("rounds"))).toBe(true)
	})

	it("should warn about high reps", () => {
		const result = validateRoundsReps(1001) // 1001 reps in partial round
		expect(result.isValid).toBe(true)
		expect(result.warnings.some(w => w.includes("reps"))).toBe(true)
	})
})

describe("validateLoad", () => {
	it("should validate reasonable weight", () => {
		const result = validateLoad(Math.round(225 * 453.592))
		expect(result.isValid).toBe(true)
	})

	it("should reject negative weight", () => {
		const result = validateLoad(-1)
		expect(result.isValid).toBe(false)
	})

	it("should warn about extreme weight", () => {
		const result = validateLoad(Math.round(2500 * 453.592)) // 2500 lbs
		expect(result.isValid).toBe(true)
		expect(result.warnings.some(w => w.includes("human limits"))).toBe(true)
	})
})

describe("validateDistance", () => {
	it("should validate reasonable distance", () => {
		const result = validateDistance(5000000) // 5km
		expect(result.isValid).toBe(true)
	})

	it("should reject negative distance", () => {
		const result = validateDistance(-1)
		expect(result.isValid).toBe(false)
	})

	it("should warn about extreme distance", () => {
		const result = validateDistance(50000000) // 50km
		expect(result.isValid).toBe(true)
		expect(result.warnings.some(w => w.includes("marathon"))).toBe(true)
	})
})

describe("isOutlier", () => {
	it("should not detect normal values as outliers", () => {
		const value = 100
		const others = [95, 105, 98, 102, 100]
		expect(isOutlier(value, others)).toBe(false)
	})

	it("should detect extreme values as outliers", () => {
		const value = 1000
		const others = [95, 105, 98, 102, 100]
		expect(isOutlier(value, others)).toBe(true)
	})

	it("should return false for small samples", () => {
		const value = 1000
		const others = [100, 105]
		expect(isOutlier(value, others)).toBe(false)
	})
})
