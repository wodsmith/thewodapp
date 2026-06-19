import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
	getEndOfDayInTimezone,
	getStartOfDayInTimezone,
	isDeadlinePassedInTimezone,
	hasDateStartedInTimezone,
	formatTimeInTimezone,
	formatDateTimeInTimezone,
	getTimezoneAbbreviation,
	parseTimeInTimezone,
	formatDateWithTimezone,
	getAllTimezones,
	getBrowserTimezone,
	resolveDisplayTimezone,
	COMMON_US_TIMEZONES,
	DEFAULT_TIMEZONE,
} from "@/utils/timezone-utils"

describe("timezone-utils", () => {
	// ==========================================================================
	// Constants
	// ==========================================================================

	describe("COMMON_US_TIMEZONES", () => {
		it("contains common US timezones", () => {
			const values = COMMON_US_TIMEZONES.map((tz) => tz.value)
			expect(values).toContain("America/New_York")
			expect(values).toContain("America/Chicago")
			expect(values).toContain("America/Denver")
			expect(values).toContain("America/Los_Angeles")
			expect(values).toContain("America/Phoenix")
			expect(values).toContain("Pacific/Honolulu")
		})

		it("has labels for each timezone", () => {
			for (const tz of COMMON_US_TIMEZONES) {
				expect(tz.label).toBeTruthy()
				expect(tz.value).toBeTruthy()
			}
		})
	})

	describe("DEFAULT_TIMEZONE", () => {
		it("is America/Denver", () => {
			expect(DEFAULT_TIMEZONE).toBe("America/Denver")
		})
	})

	// ==========================================================================
	// getAllTimezones
	// ==========================================================================

	describe("getAllTimezones", () => {
		it("returns an array of timezone strings", () => {
			const timezones = getAllTimezones()
			expect(Array.isArray(timezones)).toBe(true)
			expect(timezones.length).toBeGreaterThan(0)
		})

		it("includes common timezones", () => {
			const timezones = getAllTimezones()
			expect(timezones).toContain("America/New_York")
			expect(timezones).toContain("America/Los_Angeles")
			expect(timezones).toContain("UTC")
		})
	})

	// ==========================================================================
	// getEndOfDayInTimezone
	// ==========================================================================

	describe("getEndOfDayInTimezone", () => {
		it("returns end of day in Denver timezone (winter)", () => {
			// January 15, 2024 end of day in Denver (MST, UTC-7)
			// Should be January 16, 2024 06:59:59.999 UTC
			const result = getEndOfDayInTimezone("2024-01-15", "America/Denver")
			expect(result).not.toBeNull()
			expect(result!.getUTCDate()).toBe(16)
			expect(result!.getUTCHours()).toBe(6)
			expect(result!.getUTCMinutes()).toBe(59)
			expect(result!.getUTCSeconds()).toBe(59)
		})

		it("returns end of day in Denver timezone (summer - DST)", () => {
			// July 15, 2024 end of day in Denver (MDT, UTC-6)
			// Should be July 16, 2024 05:59:59.999 UTC
			const result = getEndOfDayInTimezone("2024-07-15", "America/Denver")
			expect(result).not.toBeNull()
			expect(result!.getUTCDate()).toBe(16)
			expect(result!.getUTCHours()).toBe(5)
			expect(result!.getUTCMinutes()).toBe(59)
		})

		it("returns end of day in New York timezone", () => {
			// January 15, 2024 end of day in New York (EST, UTC-5)
			// Should be January 16, 2024 04:59:59.999 UTC
			const result = getEndOfDayInTimezone("2024-01-15", "America/New_York")
			expect(result).not.toBeNull()
			expect(result!.getUTCDate()).toBe(16)
			expect(result!.getUTCHours()).toBe(4)
			expect(result!.getUTCMinutes()).toBe(59)
		})

		it("returns end of day in UTC", () => {
			const result = getEndOfDayInTimezone("2024-01-15", "UTC")
			expect(result).not.toBeNull()
			expect(result!.getUTCDate()).toBe(15)
			expect(result!.getUTCHours()).toBe(23)
			expect(result!.getUTCMinutes()).toBe(59)
			expect(result!.getUTCSeconds()).toBe(59)
		})

		it("returns null for invalid date string", () => {
			expect(getEndOfDayInTimezone("invalid", "America/Denver")).toBeNull()
			expect(getEndOfDayInTimezone("2024-13-01", "America/Denver")).toBeNull()
			expect(getEndOfDayInTimezone(null, "America/Denver")).toBeNull()
			expect(getEndOfDayInTimezone(undefined, "America/Denver")).toBeNull()
		})
	})

	// ==========================================================================
	// getStartOfDayInTimezone
	// ==========================================================================

	describe("getStartOfDayInTimezone", () => {
		it("returns start of day in Denver timezone (winter)", () => {
			// January 15, 2024 start of day in Denver (MST, UTC-7)
			// Should be January 15, 2024 07:00:00.000 UTC
			const result = getStartOfDayInTimezone("2024-01-15", "America/Denver")
			expect(result).not.toBeNull()
			expect(result!.getUTCDate()).toBe(15)
			expect(result!.getUTCHours()).toBe(7)
			expect(result!.getUTCMinutes()).toBe(0)
			expect(result!.getUTCSeconds()).toBe(0)
		})

		it("returns start of day in UTC", () => {
			const result = getStartOfDayInTimezone("2024-01-15", "UTC")
			expect(result).not.toBeNull()
			expect(result!.getUTCDate()).toBe(15)
			expect(result!.getUTCHours()).toBe(0)
			expect(result!.getUTCMinutes()).toBe(0)
		})

		it("returns null for invalid date string", () => {
			expect(getStartOfDayInTimezone("invalid", "America/Denver")).toBeNull()
			expect(getStartOfDayInTimezone(null, "America/Denver")).toBeNull()
		})
	})

	// ==========================================================================
	// isDeadlinePassedInTimezone
	// ==========================================================================

	describe("isDeadlinePassedInTimezone", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("returns false when deadline is in the future", () => {
			// Set current time to Jan 15, 2024 12:00:00 UTC
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 12, 0, 0)))

			// Deadline is Jan 16 - should not be passed
			expect(isDeadlinePassedInTimezone("2024-01-16", "America/Denver")).toBe(
				false,
			)
		})

		it("returns false when deadline is today in competition timezone", () => {
			// Set current time to Jan 15, 2024 22:00:00 UTC (3pm Denver in winter)
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 22, 0, 0)))

			// Deadline is Jan 15 - still not passed (end of day is 06:59:59 UTC next day)
			expect(isDeadlinePassedInTimezone("2024-01-15", "America/Denver")).toBe(
				false,
			)
		})

		it("returns true when deadline has passed in competition timezone", () => {
			// Set current time to Jan 16, 2024 08:00:00 UTC (1am Denver on Jan 16)
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 16, 8, 0, 0)))

			// Deadline was Jan 15 - should be passed
			expect(isDeadlinePassedInTimezone("2024-01-15", "America/Denver")).toBe(
				true,
			)
		})

		it("returns false for null deadline", () => {
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 12, 0, 0)))
			expect(isDeadlinePassedInTimezone(null, "America/Denver")).toBe(false)
		})
	})

	// ==========================================================================
	// hasDateStartedInTimezone
	// ==========================================================================

	describe("hasDateStartedInTimezone", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("returns true for null date (always open)", () => {
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 12, 0, 0)))
			expect(hasDateStartedInTimezone(null, "America/Denver")).toBe(true)
		})

		it("returns false when date has not started in timezone", () => {
			// Set current time to Jan 14, 2024 12:00:00 UTC (5am Denver)
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 14, 12, 0, 0)))

			// Start date is Jan 15 - hasn't started yet
			expect(hasDateStartedInTimezone("2024-01-15", "America/Denver")).toBe(
				false,
			)
		})

		it("returns true when date has started in timezone", () => {
			// Set current time to Jan 15, 2024 08:00:00 UTC (1am Denver)
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 8, 0, 0)))

			// Start date is Jan 15 - has started (after midnight Denver time)
			expect(hasDateStartedInTimezone("2024-01-15", "America/Denver")).toBe(
				true,
			)
		})

		it("returns true when date is in the past", () => {
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 20, 12, 0, 0)))
			expect(hasDateStartedInTimezone("2024-01-15", "America/Denver")).toBe(
				true,
			)
		})
	})

	// ==========================================================================
	// formatTimeInTimezone
	// ==========================================================================

	describe("formatTimeInTimezone", () => {
		it("formats time in specified timezone", () => {
			// 5:00 PM UTC = 10:00 AM Denver (MST, UTC-7)
			const utcTime = new Date(Date.UTC(2024, 0, 15, 17, 0, 0))
			const result = formatTimeInTimezone(utcTime, "America/Denver")
			expect(result).toBe("10:00 AM")
		})

		it("handles timestamp input", () => {
			const timestamp = Date.UTC(2024, 0, 15, 17, 0, 0)
			const result = formatTimeInTimezone(timestamp, "America/Denver")
			expect(result).toBe("10:00 AM")
		})

		it("returns empty string for null input", () => {
			expect(formatTimeInTimezone(null, "America/Denver")).toBe("")
		})
	})

	// ==========================================================================
	// formatDateTimeInTimezone
	// ==========================================================================

	describe("formatDateTimeInTimezone", () => {
		it("formats date and time in specified timezone", () => {
			const utcTime = new Date(Date.UTC(2024, 0, 15, 17, 0, 0))
			const result = formatDateTimeInTimezone(utcTime, "America/Denver")
			expect(result).toBe("Jan 15, 10:00 AM")
		})

		it("returns empty string for null input", () => {
			expect(formatDateTimeInTimezone(null, "America/Denver")).toBe("")
		})
	})

	// ==========================================================================
	// getTimezoneAbbreviation
	// ==========================================================================

	describe("getTimezoneAbbreviation", () => {
		it("returns abbreviation for Denver in winter", () => {
			const winterDate = new Date(Date.UTC(2024, 0, 15))
			const abbrev = getTimezoneAbbreviation("America/Denver", winterDate)
			expect(abbrev).toBe("MST")
		})

		it("returns abbreviation for Denver in summer", () => {
			const summerDate = new Date(Date.UTC(2024, 6, 15))
			const abbrev = getTimezoneAbbreviation("America/Denver", summerDate)
			expect(abbrev).toBe("MDT")
		})

		it("returns UTC for UTC timezone", () => {
			const abbrev = getTimezoneAbbreviation("UTC")
			expect(abbrev).toBe("UTC")
		})
	})

	// ==========================================================================
	// parseTimeInTimezone
	// ==========================================================================

	describe("parseTimeInTimezone", () => {
		it("parses time string in specified timezone", () => {
			// 9:00 AM on Jan 15 in Denver (MST) = 16:00 UTC
			const result = parseTimeInTimezone(
				"09:00",
				"2024-01-15",
				"America/Denver",
			)
			expect(result).not.toBeNull()
			expect(result!.getUTCHours()).toBe(16)
			expect(result!.getUTCMinutes()).toBe(0)
		})

		it("parses single-digit hour", () => {
			const result = parseTimeInTimezone("9:30", "2024-01-15", "America/Denver")
			expect(result).not.toBeNull()
			expect(result!.getUTCHours()).toBe(16)
			expect(result!.getUTCMinutes()).toBe(30)
		})

		it("returns null for invalid time format", () => {
			expect(
				parseTimeInTimezone("invalid", "2024-01-15", "America/Denver"),
			).toBeNull()
			expect(
				parseTimeInTimezone("25:00", "2024-01-15", "America/Denver"),
			).toBeNull()
			expect(
				parseTimeInTimezone("12:60", "2024-01-15", "America/Denver"),
			).toBeNull()
		})

		it("returns null for invalid date format", () => {
			expect(parseTimeInTimezone("09:00", "invalid", "America/Denver")).toBeNull()
			expect(parseTimeInTimezone("09:00", null, "America/Denver")).toBeNull()
		})
	})

	// ==========================================================================
	// formatDateWithTimezone
	// ==========================================================================

	describe("formatDateWithTimezone", () => {
		it("formats date with timezone abbreviation", () => {
			const winterDate = new Date(Date.UTC(2024, 0, 15))
			vi.setSystemTime(winterDate)
			const result = formatDateWithTimezone("2024-01-15", "America/Denver")
			expect(result).toMatch(/Jan 15, 2024 \(MST\)/)
			vi.useRealTimers()
		})

		it("returns empty string for null date", () => {
			expect(formatDateWithTimezone(null, "America/Denver")).toBe("")
		})
	})

	// ==========================================================================
	// Helper functions
	// ==========================================================================

	describe("getBrowserTimezone", () => {
		it("returns a timezone string", () => {
			const tz = getBrowserTimezone()
			expect(typeof tz).toBe("string")
			expect(tz.length).toBeGreaterThan(0)
		})
	})

	describe("resolveDisplayTimezone", () => {
		it("returns user timezone if provided", () => {
			expect(
				resolveDisplayTimezone("America/New_York", "America/Denver"),
			).toBe("America/New_York")
		})

		it("returns competition timezone if no user timezone", () => {
			expect(resolveDisplayTimezone(null, "America/Denver")).toBe(
				"America/Denver",
			)
			expect(resolveDisplayTimezone(undefined, "America/Denver")).toBe(
				"America/Denver",
			)
		})

		it("returns default timezone if neither provided", () => {
			expect(resolveDisplayTimezone(null, null)).toBe(DEFAULT_TIMEZONE)
		})
	})

	// ==========================================================================
	// Critical: Timezone consistency tests
	// ==========================================================================

	describe("timezone consistency", () => {
		it("deadline at midnight UTC vs midnight Denver gives different results", () => {
			// This is the key test - same date string should give different UTC timestamps
			// depending on the timezone
			const utcEndOfDay = getEndOfDayInTimezone("2024-01-15", "UTC")
			const denverEndOfDay = getEndOfDayInTimezone(
				"2024-01-15",
				"America/Denver",
			)

			expect(utcEndOfDay).not.toBeNull()
			expect(denverEndOfDay).not.toBeNull()

			// Denver is UTC-7 in winter, so Denver end of day should be 7 hours later
			const diffHours =
				(denverEndOfDay!.getTime() - utcEndOfDay!.getTime()) / (1000 * 60 * 60)
			expect(diffHours).toBe(7)
		})

		it("same deadline behaves differently for users in different scenarios", () => {
			vi.useFakeTimers()

			// Scenario: Competition deadline is Jan 15, 2024 in Denver timezone
			const deadline = "2024-01-15"
			const timezone = "America/Denver"

			// At 11pm Denver time on Jan 15 (06:00 UTC Jan 16)
			// - Deadline should NOT be passed
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 16, 6, 0, 0)))
			expect(isDeadlinePassedInTimezone(deadline, timezone)).toBe(false)

			// At 1am Denver time on Jan 16 (08:00 UTC Jan 16)
			// - Deadline SHOULD be passed
			vi.setSystemTime(new Date(Date.UTC(2024, 0, 16, 8, 0, 0)))
			expect(isDeadlinePassedInTimezone(deadline, timezone)).toBe(true)

			vi.useRealTimers()
		})
	})
})
