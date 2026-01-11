import { describe, expect, it } from "vitest"
import {
	formatDateStringFull,
	formatDateStringShort,
	formatDateStringRange,
	isSameDateString,
	formatUTCDateFull,
	formatUTCDateShort,
	formatUTCDateRange,
	parseDateInputAsUTC,
	isSameUTCDay,
	getLocalDateKey,
} from "@/utils/date-utils"

describe("date-utils", () => {
	// ==========================================================================
	// String-based date utilities (YYYY-MM-DD format)
	// ==========================================================================

	describe("formatDateStringFull", () => {
		it("formats a YYYY-MM-DD string to full date format", () => {
			expect(formatDateStringFull("2024-01-15")).toBe("Jan 15, 2024")
			expect(formatDateStringFull("2024-12-25")).toBe("Dec 25, 2024")
			expect(formatDateStringFull("2025-04-11")).toBe("Apr 11, 2025")
		})

		it("handles all months correctly", () => {
			expect(formatDateStringFull("2024-01-01")).toBe("Jan 1, 2024")
			expect(formatDateStringFull("2024-02-01")).toBe("Feb 1, 2024")
			expect(formatDateStringFull("2024-03-01")).toBe("Mar 1, 2024")
			expect(formatDateStringFull("2024-04-01")).toBe("Apr 1, 2024")
			expect(formatDateStringFull("2024-05-01")).toBe("May 1, 2024")
			expect(formatDateStringFull("2024-06-01")).toBe("Jun 1, 2024")
			expect(formatDateStringFull("2024-07-01")).toBe("Jul 1, 2024")
			expect(formatDateStringFull("2024-08-01")).toBe("Aug 1, 2024")
			expect(formatDateStringFull("2024-09-01")).toBe("Sep 1, 2024")
			expect(formatDateStringFull("2024-10-01")).toBe("Oct 1, 2024")
			expect(formatDateStringFull("2024-11-01")).toBe("Nov 1, 2024")
			expect(formatDateStringFull("2024-12-01")).toBe("Dec 1, 2024")
		})

		it("returns empty string for null or undefined", () => {
			expect(formatDateStringFull(null)).toBe("")
			expect(formatDateStringFull(undefined)).toBe("")
		})

		it("returns empty string for invalid date format", () => {
			expect(formatDateStringFull("not-a-date")).toBe("")
			expect(formatDateStringFull("01/15/2024")).toBe("")
			expect(formatDateStringFull("2024-1-15")).toBe("") // Missing leading zeros
		})
	})

	describe("formatDateStringShort", () => {
		it("formats a YYYY-MM-DD string to short date format", () => {
			expect(formatDateStringShort("2024-01-15")).toBe("Jan 15")
			expect(formatDateStringShort("2024-12-25")).toBe("Dec 25")
			expect(formatDateStringShort("2025-04-11")).toBe("Apr 11")
		})

		it("returns empty string for null or undefined", () => {
			expect(formatDateStringShort(null)).toBe("")
			expect(formatDateStringShort(undefined)).toBe("")
		})

		it("returns empty string for invalid date format", () => {
			expect(formatDateStringShort("not-a-date")).toBe("")
			expect(formatDateStringShort("01/15/2024")).toBe("")
		})
	})

	describe("formatDateStringRange", () => {
		it("handles single-day events", () => {
			expect(formatDateStringRange("2024-01-15", "2024-01-15")).toBe(
				"January 15, 2024",
			)
		})

		it("handles multi-day events in same month", () => {
			expect(formatDateStringRange("2024-01-15", "2024-01-17")).toBe(
				"January 15-17, 2024",
			)
		})

		it("handles multi-day events across months in same year", () => {
			expect(formatDateStringRange("2024-01-30", "2024-02-02")).toBe(
				"January 30 - February 2, 2024",
			)
		})

		it("handles multi-day events across years", () => {
			expect(formatDateStringRange("2024-12-30", "2025-01-02")).toBe(
				"December 30, 2024 - January 2, 2025",
			)
		})

		it("returns empty string for invalid date formats", () => {
			expect(formatDateStringRange("not-a-date", "2024-01-15")).toBe("")
			expect(formatDateStringRange("2024-01-15", "not-a-date")).toBe("")
		})
	})

	describe("isSameDateString", () => {
		it("returns true for identical date strings", () => {
			expect(isSameDateString("2024-01-15", "2024-01-15")).toBe(true)
		})

		it("returns false for different date strings", () => {
			expect(isSameDateString("2024-01-15", "2024-01-16")).toBe(false)
		})

		it("returns false when either value is null or undefined", () => {
			expect(isSameDateString(null, "2024-01-15")).toBe(false)
			expect(isSameDateString("2024-01-15", null)).toBe(false)
			expect(isSameDateString(null, null)).toBe(false)
			expect(isSameDateString(undefined, "2024-01-15")).toBe(false)
			expect(isSameDateString("2024-01-15", undefined)).toBe(false)
		})
	})

	// ==========================================================================
	// UTC-based date utilities
	// ==========================================================================

	describe("formatUTCDateFull", () => {
		it("formats a Date object to full date format using UTC", () => {
			const date = new Date(Date.UTC(2024, 0, 15)) // Jan 15, 2024 UTC
			expect(formatUTCDateFull(date)).toBe("Jan 15, 2024")
		})

		it("handles numeric timestamps", () => {
			const timestamp = Date.UTC(2024, 11, 25) // Dec 25, 2024 UTC
			expect(formatUTCDateFull(timestamp)).toBe("Dec 25, 2024")
		})

		it("returns empty string for null or undefined", () => {
			expect(formatUTCDateFull(null)).toBe("")
			expect(formatUTCDateFull(undefined)).toBe("")
		})

		it("returns empty string for invalid dates", () => {
			expect(formatUTCDateFull(new Date("invalid"))).toBe("")
		})
	})

	describe("formatUTCDateShort", () => {
		it("formats a Date object to short date format using UTC", () => {
			const date = new Date(Date.UTC(2024, 0, 15)) // Jan 15, 2024 UTC
			expect(formatUTCDateShort(date)).toBe("Jan 15")
		})

		it("returns empty string for null or undefined", () => {
			expect(formatUTCDateShort(null)).toBe("")
			expect(formatUTCDateShort(undefined)).toBe("")
		})
	})

	describe("formatUTCDateRange", () => {
		it("handles single-day events", () => {
			const date = new Date(Date.UTC(2024, 0, 15))
			expect(formatUTCDateRange(date, date)).toBe("January 15, 2024")
		})

		it("handles multi-day events in same month", () => {
			const start = new Date(Date.UTC(2024, 0, 15))
			const end = new Date(Date.UTC(2024, 0, 17))
			expect(formatUTCDateRange(start, end)).toBe("January 15-17, 2024")
		})

		it("handles multi-day events across months", () => {
			const start = new Date(Date.UTC(2024, 0, 30))
			const end = new Date(Date.UTC(2024, 1, 2))
			expect(formatUTCDateRange(start, end)).toBe(
				"January 30 - February 2, 2024",
			)
		})

		it("handles multi-day events across years", () => {
			const start = new Date(Date.UTC(2024, 11, 30))
			const end = new Date(Date.UTC(2025, 0, 2))
			expect(formatUTCDateRange(start, end)).toBe(
				"December 30, 2024 - January 2, 2025",
			)
		})
	})

	describe("parseDateInputAsUTC", () => {
		it("parses YYYY-MM-DD string as UTC midnight", () => {
			const date = parseDateInputAsUTC("2024-01-15")
			expect(date.getUTCFullYear()).toBe(2024)
			expect(date.getUTCMonth()).toBe(0) // January
			expect(date.getUTCDate()).toBe(15)
			expect(date.getUTCHours()).toBe(0)
			expect(date.getUTCMinutes()).toBe(0)
		})

		it("handles end of year dates correctly", () => {
			const date = parseDateInputAsUTC("2024-12-31")
			expect(date.getUTCFullYear()).toBe(2024)
			expect(date.getUTCMonth()).toBe(11) // December
			expect(date.getUTCDate()).toBe(31)
		})
	})

	describe("isSameUTCDay", () => {
		it("returns true for same UTC day", () => {
			const date1 = new Date(Date.UTC(2024, 0, 15, 10, 30))
			const date2 = new Date(Date.UTC(2024, 0, 15, 22, 45))
			expect(isSameUTCDay(date1, date2)).toBe(true)
		})

		it("returns false for different UTC days", () => {
			const date1 = new Date(Date.UTC(2024, 0, 15))
			const date2 = new Date(Date.UTC(2024, 0, 16))
			expect(isSameUTCDay(date1, date2)).toBe(false)
		})

		it("handles timestamps", () => {
			const timestamp1 = Date.UTC(2024, 0, 15, 10, 30)
			const timestamp2 = Date.UTC(2024, 0, 15, 22, 45)
			expect(isSameUTCDay(timestamp1, timestamp2)).toBe(true)
		})

		it("returns false for null or undefined values", () => {
			const date = new Date(Date.UTC(2024, 0, 15))
			expect(isSameUTCDay(null, date)).toBe(false)
			expect(isSameUTCDay(date, null)).toBe(false)
			expect(isSameUTCDay(undefined, date)).toBe(false)
		})
	})

	describe("getLocalDateKey", () => {
		it("formats a date to YYYY-MM-DD in local timezone", () => {
			// Create a date object for a specific local date
			const date = new Date(2024, 0, 15) // Jan 15, 2024 local
			expect(getLocalDateKey(date)).toBe("2024-01-15")
		})

		it("handles string input", () => {
			// When passed a string, it will parse and format based on local time
			const key = getLocalDateKey("2024-01-15T12:00:00")
			// Result depends on local timezone, but format should be YYYY-MM-DD
			expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		})

		it("handles numeric timestamp", () => {
			const timestamp = new Date(2024, 5, 20).getTime() // Jun 20, 2024 local
			expect(getLocalDateKey(timestamp)).toBe("2024-06-20")
		})

		it("pads single-digit months and days", () => {
			const date = new Date(2024, 0, 5) // Jan 5, 2024
			expect(getLocalDateKey(date)).toBe("2024-01-05")
		})
	})

	// ==========================================================================
	// Timezone edge cases - the core problem this migration solves
	// ==========================================================================

	describe("timezone handling", () => {
		it("string-based formatting preserves the calendar date regardless of timezone", () => {
			// This is the key test - when we store "2024-04-11" as a string,
			// it should always display as April 11, regardless of timezone
			const dateStr = "2024-04-11"
			expect(formatDateStringFull(dateStr)).toBe("Apr 11, 2024")
			expect(formatDateStringShort(dateStr)).toBe("Apr 11")
		})

		it("UTC date formatting preserves calendar date for UTC midnight dates", () => {
			// If we store a date as UTC midnight, UTC methods should display it correctly
			const utcMidnight = new Date(Date.UTC(2024, 3, 11)) // April 11, 2024 UTC
			expect(formatUTCDateFull(utcMidnight)).toBe("Apr 11, 2024")
		})

		it("string comparison works correctly for YYYY-MM-DD dates", () => {
			// String comparison is valid because YYYY-MM-DD is lexicographically ordered
			expect("2024-01-15" < "2024-01-16").toBe(true)
			expect("2024-01-15" < "2024-02-01").toBe(true)
			expect("2024-12-31" < "2025-01-01").toBe(true)
			expect("2024-01-15" <= "2024-01-15").toBe(true)
		})
	})
})
