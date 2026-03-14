import { describe, expect, it } from "vitest"
import { calculateCompetitionCapacity } from "@/utils/competition-capacity"

describe("calculateCompetitionCapacity", () => {
	describe("numeric coercion (prevents string concatenation bug)", () => {
		it("handles registrationCount as string from SQL", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: "31" as unknown as number,
				pendingCount: 0,
				maxTotalRegistrations: 60,
			})

			expect(result.totalOccupied).toBe(31)
			expect(result.spotsAvailable).toBe(29)
			expect(result.isFull).toBe(false)
		})

		it("handles pendingCount as string from SQL", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 31,
				pendingCount: "5" as unknown as number,
				maxTotalRegistrations: 60,
			})

			expect(result.totalOccupied).toBe(36)
			expect(result.spotsAvailable).toBe(24)
			expect(result.isFull).toBe(false)
		})

		it("handles both counts as strings from SQL", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: "37" as unknown as number,
				pendingCount: "3" as unknown as number,
				maxTotalRegistrations: 60,
			})

			expect(result.totalOccupied).toBe(40)
			expect(result.spotsAvailable).toBe(20)
			expect(result.isFull).toBe(false)
		})
	})

	describe("capacity with total cap", () => {
		it("not full when under capacity", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 10,
				pendingCount: 5,
				maxTotalRegistrations: 60,
			})

			expect(result.effectiveMax).toBe(60)
			expect(result.totalOccupied).toBe(15)
			expect(result.spotsAvailable).toBe(45)
			expect(result.isFull).toBe(false)
		})

		it("full when at capacity", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 55,
				pendingCount: 5,
				maxTotalRegistrations: 60,
			})

			expect(result.isFull).toBe(true)
			expect(result.spotsAvailable).toBe(0)
		})

		it("full when over capacity", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 58,
				pendingCount: 5,
				maxTotalRegistrations: 60,
			})

			expect(result.isFull).toBe(true)
			expect(result.spotsAvailable).toBe(-3)
		})
	})

	describe("unlimited capacity", () => {
		it("never full when maxTotalRegistrations is null", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 1000,
				pendingCount: 500,
				maxTotalRegistrations: null,
			})

			expect(result.effectiveMax).toBeNull()
			expect(result.spotsAvailable).toBeNull()
			expect(result.isFull).toBe(false)
		})

		it("never full when maxTotalRegistrations is undefined", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 100,
				pendingCount: 0,
				maxTotalRegistrations: undefined,
			})

			expect(result.effectiveMax).toBeNull()
			expect(result.isFull).toBe(false)
		})
	})

	describe("pending purchases count toward capacity", () => {
		it("pending purchases can fill remaining spots", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 55,
				pendingCount: 5,
				maxTotalRegistrations: 60,
			})

			expect(result.totalOccupied).toBe(60)
			expect(result.isFull).toBe(true)
		})

		it("zero pending does not affect capacity", () => {
			const result = calculateCompetitionCapacity({
				registrationCount: 55,
				pendingCount: 0,
				maxTotalRegistrations: 60,
			})

			expect(result.totalOccupied).toBe(55)
			expect(result.isFull).toBe(false)
		})
	})
})
