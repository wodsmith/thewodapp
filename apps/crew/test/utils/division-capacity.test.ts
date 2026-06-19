import { describe, expect, it } from "vitest"
import { calculateDivisionCapacity } from "@/utils/division-capacity"

describe("calculateDivisionCapacity", () => {
	describe("numeric coercion (prevents string concatenation bug)", () => {
		it("handles registrationCount as string from SQL", () => {
			const result = calculateDivisionCapacity({
				registrationCount: "31" as unknown as number,
				pendingCount: 0,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			// Bug: "31" + 0 = "310" (string concat) → isFull = true
			// Fix: Number("31") + 0 = 31 → isFull = false
			expect(result.totalOccupied).toBe(31)
			expect(result.spotsAvailable).toBe(29)
			expect(result.isFull).toBe(false)
		})

		it("handles pendingCount as string from SQL", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 31,
				pendingCount: "5" as unknown as number,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.totalOccupied).toBe(36)
			expect(result.spotsAvailable).toBe(24)
			expect(result.isFull).toBe(false)
		})

		it("handles both counts as strings from SQL", () => {
			const result = calculateDivisionCapacity({
				registrationCount: "37" as unknown as number,
				pendingCount: "3" as unknown as number,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.totalOccupied).toBe(40)
			expect(result.spotsAvailable).toBe(20)
			expect(result.isFull).toBe(false)
		})
	})

	describe("capacity with division-level max", () => {
		it("not full when under capacity", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 10,
				pendingCount: 5,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.effectiveMax).toBe(60)
			expect(result.totalOccupied).toBe(15)
			expect(result.spotsAvailable).toBe(45)
			expect(result.isFull).toBe(false)
		})

		it("full when at capacity", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 55,
				pendingCount: 5,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.isFull).toBe(true)
			expect(result.spotsAvailable).toBe(0)
		})

		it("full when over capacity", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 58,
				pendingCount: 5,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.isFull).toBe(true)
			expect(result.spotsAvailable).toBe(-3)
		})
	})

	describe("capacity with competition default max", () => {
		it("uses competition default when no division max set", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 10,
				pendingCount: 0,
				divisionMaxSpots: null,
				competitionDefaultMax: 50,
			})

			expect(result.effectiveMax).toBe(50)
			expect(result.spotsAvailable).toBe(40)
			expect(result.isFull).toBe(false)
		})

		it("division max overrides competition default", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 45,
				pendingCount: 0,
				divisionMaxSpots: 40,
				competitionDefaultMax: 50,
			})

			expect(result.effectiveMax).toBe(40)
			expect(result.isFull).toBe(true)
		})
	})

	describe("unlimited capacity", () => {
		it("never full when both maxes are null", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 1000,
				pendingCount: 500,
				divisionMaxSpots: null,
				competitionDefaultMax: null,
			})

			expect(result.effectiveMax).toBeNull()
			expect(result.spotsAvailable).toBeNull()
			expect(result.isFull).toBe(false)
		})

		it("never full when both maxes are undefined", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 100,
				pendingCount: 0,
				divisionMaxSpots: undefined,
				competitionDefaultMax: undefined,
			})

			expect(result.effectiveMax).toBeNull()
			expect(result.isFull).toBe(false)
		})
	})

	describe("pending purchases count toward capacity", () => {
		it("pending purchases can fill remaining spots", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 55,
				pendingCount: 5,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.totalOccupied).toBe(60)
			expect(result.isFull).toBe(true)
		})

		it("zero pending does not affect capacity", () => {
			const result = calculateDivisionCapacity({
				registrationCount: 55,
				pendingCount: 0,
				divisionMaxSpots: 60,
				competitionDefaultMax: null,
			})

			expect(result.totalOccupied).toBe(55)
			expect(result.isFull).toBe(false)
		})
	})
})
