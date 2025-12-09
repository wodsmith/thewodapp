import { describe, expect, it } from "vitest"
import {
	aggregateValues,
	aggregateWithSummary,
	getDefaultScoreType,
} from "@/lib/scoring"

describe("aggregateValues", () => {
	const values = [100, 150, 125]

	it("should aggregate with max", () => {
		expect(aggregateValues(values, "max")).toBe(150)
	})

	it("should aggregate with min", () => {
		expect(aggregateValues(values, "min")).toBe(100)
	})

	it("should aggregate with sum", () => {
		expect(aggregateValues(values, "sum")).toBe(375)
	})

	it("should aggregate with average", () => {
		expect(aggregateValues(values, "average")).toBe(125)
	})

	it("should aggregate with first", () => {
		expect(aggregateValues(values, "first")).toBe(100)
	})

	it("should aggregate with last", () => {
		expect(aggregateValues(values, "last")).toBe(125)
	})

	it("should return null for empty array", () => {
		expect(aggregateValues([], "max")).toBeNull()
		expect(aggregateValues([], "min")).toBeNull()
	})

	it("should handle single value", () => {
		expect(aggregateValues([100], "max")).toBe(100)
		expect(aggregateValues([100], "min")).toBe(100)
		expect(aggregateValues([100], "sum")).toBe(100)
		expect(aggregateValues([100], "average")).toBe(100)
	})

	it("should round average to integer", () => {
		expect(aggregateValues([100, 101], "average")).toBe(101) // Rounds 100.5
	})
})

describe("aggregateWithSummary", () => {
	it("should return aggregated value with summary", () => {
		const result = aggregateWithSummary([100, 150, 125], "max")
		expect(result).toEqual({
			aggregated: 150,
			operation: "max",
			count: 3,
		})
	})

	it("should handle empty array", () => {
		const result = aggregateWithSummary([], "max")
		expect(result).toEqual({
			aggregated: null,
			operation: "max",
			count: 0,
		})
	})
})

describe("getDefaultScoreType", () => {
	it("should return min for time-based schemes", () => {
		expect(getDefaultScoreType("time")).toBe("min")
		expect(getDefaultScoreType("time-with-cap")).toBe("min")
	})

	it("should return max for higher-is-better schemes", () => {
		expect(getDefaultScoreType("rounds-reps")).toBe("max")
		expect(getDefaultScoreType("reps")).toBe("max")
		expect(getDefaultScoreType("load")).toBe("max")
		expect(getDefaultScoreType("calories")).toBe("max")
		expect(getDefaultScoreType("meters")).toBe("max")
		expect(getDefaultScoreType("feet")).toBe("max")
		expect(getDefaultScoreType("points")).toBe("max")
	})

	it("should return first for pass-fail", () => {
		expect(getDefaultScoreType("pass-fail")).toBe("first")
	})
})
