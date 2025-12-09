import { describe, expect, it } from "vitest"
import {
	decodeScore,
	decodeTime,
	decodeTimeToSeconds,
	decodeRoundsReps,
	decodeLoad,
	decodeDistance,
	decodeToNumber,
} from "@/lib/scoring"

describe("decodeTime", () => {
	it("should decode to MM:SS format", () => {
		expect(decodeTime(754000)).toBe("12:34")
		expect(decodeTime(45000)).toBe("0:45")
		expect(decodeTime(60000)).toBe("1:00")
	})

	it("should decode with milliseconds when non-zero", () => {
		expect(decodeTime(754567)).toBe("12:34.567")
		expect(decodeTime(754500)).toBe("12:34.500")
	})

	it("should decode to HH:MM:SS format when >= 60 minutes", () => {
		expect(decodeTime(3754000)).toBe("1:02:34")
		expect(decodeTime(3600000)).toBe("1:00:00")
	})

	it("should force milliseconds with alwaysShowMs option", () => {
		expect(decodeTime(754000, { alwaysShowMs: true })).toBe("12:34.000")
	})

	it("should force hours with alwaysShowHours option", () => {
		expect(decodeTime(754000, { alwaysShowHours: true })).toBe("0:12:34")
	})

	it("should handle zero", () => {
		expect(decodeTime(0)).toBe("0:00")
	})

	it("should handle negative values", () => {
		expect(decodeTime(-1000)).toBe("0:00")
	})
})

describe("decodeTimeToSeconds", () => {
	it("should convert milliseconds to seconds", () => {
		expect(decodeTimeToSeconds(754567)).toBe(754.567)
		expect(decodeTimeToSeconds(60000)).toBe(60)
	})
})

describe("decodeRoundsReps", () => {
	it("should decode to rounds+reps format", () => {
		expect(decodeRoundsReps(500012)).toBe("5+12")
		expect(decodeRoundsReps(1000000)).toBe("10+0")
		expect(decodeRoundsReps(45)).toBe("0+45")
	})

	it("should use compact format when enabled", () => {
		expect(decodeRoundsReps(1000000, { compact: true })).toBe("10")
		expect(decodeRoundsReps(500012, { compact: true })).toBe("5+12") // Still shows reps
	})
})

describe("decodeLoad", () => {
	it("should decode to lbs by default", () => {
		const encoded = Math.round(225 * 453.592)
		expect(decodeLoad(encoded)).toBe("225")
	})

	it("should decode to kg when specified", () => {
		expect(decodeLoad(100000, { unit: "kg" })).toBe("100")
	})

	it("should include unit when requested", () => {
		const encoded = Math.round(225 * 453.592)
		expect(decodeLoad(encoded, { includeUnit: true })).toBe("225 lbs")
		expect(decodeLoad(100000, { unit: "kg", includeUnit: true })).toBe("100 kg")
	})

	it("should handle decimal weights", () => {
		const encoded = Math.round(225.5 * 453.592)
		// Rounding to nearest pound, so 225.5 becomes 226
		const decoded = decodeLoad(encoded, { includeUnit: true })
		expect(decoded).toBe("226 lbs")
	})
})

describe("decodeDistance", () => {
	it("should decode to meters by default", () => {
		expect(decodeDistance(5000000)).toBe("5000")
	})

	it("should decode to km when specified", () => {
		expect(decodeDistance(5000000, { unit: "km" })).toBe("5")
	})

	it("should decode to feet when specified", () => {
		const encoded = Math.round(100 * 304.8)
		expect(decodeDistance(encoded, { unit: "ft" })).toBe("100")
	})

	it("should include unit when requested", () => {
		expect(decodeDistance(5000000, { includeUnit: true })).toBe("5000m")
		expect(decodeDistance(5000000, { unit: "km", includeUnit: true })).toBe("5km")
	})
})

describe("decodeScore", () => {
	it("should decode time-based scores", () => {
		expect(decodeScore(754000, "time")).toBe("12:34")
		expect(decodeScore(754567, "time")).toBe("12:34.567")
		expect(decodeScore(300000, "emom")).toBe("5:00")
	})

	it("should decode rounds-reps scores", () => {
		expect(decodeScore(500012, "rounds-reps")).toBe("5+12")
	})

	it("should decode load scores", () => {
		const encoded = Math.round(225 * 453.592)
		expect(decodeScore(encoded, "load", { weightUnit: "lbs" })).toBe("225")
	})

	it("should decode distance scores", () => {
		expect(decodeScore(5000000, "meters")).toBe("5000")
		expect(decodeScore(5000000, "meters", { includeUnit: true })).toBe("5000m")
	})

	it("should decode count-based scores", () => {
		expect(decodeScore(150, "reps")).toBe("150")
		expect(decodeScore(150, "reps", { includeUnit: true })).toBe("150 reps")
		expect(decodeScore(200, "calories", { includeUnit: true })).toBe("200 cal")
		expect(decodeScore(85, "points", { includeUnit: true })).toBe("85 pts")
	})

	it("should decode pass-fail scores", () => {
		expect(decodeScore(1, "pass-fail")).toBe("Pass")
		expect(decodeScore(0, "pass-fail")).toBe("Fail")
	})
})

describe("decodeToNumber", () => {
	it("should decode time to seconds", () => {
		expect(decodeToNumber(754567, "time")).toBe(754.567)
	})

	it("should decode load to unit value", () => {
		const encoded = Math.round(225 * 453.592)
		const decoded = decodeToNumber(encoded, "load", { weightUnit: "lbs" })
		expect(decoded).toBeCloseTo(225, 0)
	})

	it("should decode distance to unit value", () => {
		expect(decodeToNumber(5000000, "meters")).toBe(5000)
		expect(decodeToNumber(5000000, "meters", { distanceUnit: "km" })).toBe(5)
	})

	it("should pass through count values", () => {
		expect(decodeToNumber(150, "reps")).toBe(150)
	})
})
