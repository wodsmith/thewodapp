import { describe, expect, it } from "vitest"
import {
	formatDateStringFull,
	formatDateStringRange,
	formatDateStringShort,
	isSameDateString,
} from "./date-utils"

describe("date-utils hybrid string/Date handling", () => {
	describe("formatDateStringFull", () => {
		it("should format a date string correctly", () => {
			expect(formatDateStringFull("2026-01-15")).toBe("Jan 15, 2026")
		})

		it("should format a Date object correctly", () => {
			const date = new Date(2026, 0, 15) // Jan 15, 2026
			expect(formatDateStringFull(date)).toBe("Jan 15, 2026")
		})

		it("should return empty string for null/undefined", () => {
			expect(formatDateStringFull(null)).toBe("")
			expect(formatDateStringFull(undefined)).toBe("")
		})
	})

	describe("formatDateStringShort", () => {
		it("should format a date string correctly", () => {
			expect(formatDateStringShort("2026-01-15")).toBe("Jan 15")
		})

		it("should format a Date object correctly", () => {
			const date = new Date(2026, 0, 15) // Jan 15, 2026
			expect(formatDateStringShort(date)).toBe("Jan 15")
		})
	})

	describe("formatDateStringRange", () => {
		it("should format a range of date strings", () => {
			expect(formatDateStringRange("2026-01-15", "2026-01-17")).toBe(
				"January 15-17, 2026",
			)
		})

		it("should format a range of Date objects", () => {
			const start = new Date(2026, 0, 15)
			const end = new Date(2026, 0, 17)
			expect(formatDateStringRange(start, end)).toBe("January 15-17, 2026")
		})

		it("should format a mix of string and Date", () => {
			const start = "2026-01-15"
			const end = new Date(2026, 0, 17)
			expect(formatDateStringRange(start, end)).toBe("January 15-17, 2026")
		})
	})

	describe("isSameDateString", () => {
		it("should compare two date strings", () => {
			expect(isSameDateString("2026-01-15", "2026-01-15")).toBe(true)
			expect(isSameDateString("2026-01-15", "2026-01-16")).toBe(false)
		})

		it("should compare string and Date", () => {
			const date = new Date(2026, 0, 15)
			expect(isSameDateString("2026-01-15", date)).toBe(true)
		})

		it("should compare two Date objects", () => {
			const d1 = new Date(2026, 0, 15)
			const d2 = new Date(2026, 0, 15)
			expect(isSameDateString(d1, d2)).toBe(true)
		})
	})
})
