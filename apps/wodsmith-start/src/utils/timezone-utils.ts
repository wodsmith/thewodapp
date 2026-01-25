/**
 * Timezone utilities for competition deadlines and display
 *
 * Design principle: Competition dates are stored as YYYY-MM-DD strings.
 * When checking deadlines, we interpret them in the competition's timezone.
 */
import { fromZonedTime, toZonedTime, format } from "date-fns-tz"

// Default timezone for existing competitions without one set
export const DEFAULT_TIMEZONE = "America/Denver"

/**
 * Common US timezones for quick selection in dropdowns
 */
export const COMMON_US_TIMEZONES = [
	{ value: "America/New_York", label: "Eastern Time (ET)" },
	{ value: "America/Chicago", label: "Central Time (CT)" },
	{ value: "America/Denver", label: "Mountain Time (MT)" },
	{ value: "America/Phoenix", label: "Arizona (no DST)" },
	{ value: "America/Los_Angeles", label: "Pacific Time (PT)" },
	{ value: "America/Anchorage", label: "Alaska Time (AKT)" },
	{ value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
	{ value: "UTC", label: "UTC" },
] as const

/**
 * Get all IANA timezones supported by the runtime
 * Uses Intl.supportedValuesOf which returns 400+ timezones
 * Note: Adds 'UTC' explicitly since some runtimes don't include it
 */
export function getAllTimezones(): string[] {
	if (typeof Intl === "undefined" || !Intl.supportedValuesOf) {
		// Fallback for older runtimes
		return COMMON_US_TIMEZONES.map((tz) => tz.value)
	}
	const timezones = Intl.supportedValuesOf("timeZone")
	// Ensure UTC is included (some runtimes don't include it)
	if (!timezones.includes("UTC")) {
		return [...timezones, "UTC"]
	}
	return timezones
}

/**
 * Get the user's browser timezone (client-side only)
 */
export function getBrowserTimezone(): string {
	if (typeof Intl === "undefined") return DEFAULT_TIMEZONE
	return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
}

/**
 * Resolve display timezone: user preference > competition timezone > default
 */
export function resolveDisplayTimezone(
	userTimezone: string | null | undefined,
	competitionTimezone: string | null | undefined,
): string {
	return userTimezone || competitionTimezone || DEFAULT_TIMEZONE
}

/**
 * Check if a date string represents a valid calendar date.
 * Validates month (1-12) and day for the given month/year.
 */
function isValidCalendarDate(
	year: number,
	month: number,
	day: number,
): boolean {
	// Month must be 1-12
	if (month < 1 || month > 12) return false
	// Day must be at least 1
	if (day < 1) return false

	// Days in each month (0-indexed: Jan=0, Dec=11)
	const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

	// Check for leap year (Feb has 29 days)
	const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
	if (isLeapYear && month === 2) {
		return day <= 29
	}

	return day <= daysInMonth[month - 1]
}

/**
 * Get end of day in a specific timezone for a YYYY-MM-DD date string.
 * Used for deadline comparisons.
 *
 * Example: "2024-01-15" in "America/Denver" returns a Date representing
 * 2024-01-15 23:59:59.999 in Denver time (which is 2024-01-16 06:59:59.999 UTC in winter)
 *
 * @param dateStr - YYYY-MM-DD format date string
 * @param timezone - IANA timezone string (e.g., "America/Denver")
 * @returns UTC Date object representing end of day in the given timezone, or null if invalid
 */
export function getEndOfDayInTimezone(
	dateStr: string | null | undefined,
	timezone: string,
): Date | null {
	if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null

	const [yearStr, monthStr, dayStr] = dateStr.split("-")
	const year = Number(yearStr)
	const month = Number(monthStr)
	const day = Number(dayStr)

	// Validate the date components
	if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
		return null
	}

	// Validate calendar date (month 1-12, day valid for month/year)
	if (!isValidCalendarDate(year, month, day)) {
		return null
	}

	// Create a date object representing end of day in the target timezone
	// fromZonedTime converts from "wall clock time in timezone" to UTC
	// Note: Date constructor uses 0-indexed month
	const endOfDayInTz = new Date(year, month - 1, day, 23, 59, 59, 999)
	return fromZonedTime(endOfDayInTz, timezone)
}

/**
 * Get start of day in a specific timezone for a YYYY-MM-DD date string.
 *
 * @param dateStr - YYYY-MM-DD format date string
 * @param timezone - IANA timezone string (e.g., "America/Denver")
 * @returns UTC Date object representing start of day in the given timezone, or null if invalid
 */
export function getStartOfDayInTimezone(
	dateStr: string | null | undefined,
	timezone: string,
): Date | null {
	if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null

	const [yearStr, monthStr, dayStr] = dateStr.split("-")
	const year = Number(yearStr)
	const month = Number(monthStr)
	const day = Number(dayStr)

	if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
		return null
	}

	// Validate calendar date (month 1-12, day valid for month/year)
	if (!isValidCalendarDate(year, month, day)) {
		return null
	}

	// Note: Date constructor uses 0-indexed month
	const startOfDayInTz = new Date(year, month - 1, day, 0, 0, 0, 0)
	return fromZonedTime(startOfDayInTz, timezone)
}

/**
 * Check if a deadline (YYYY-MM-DD) has passed in a specific timezone.
 * "Registration closes Jan 15" means end of day Jan 15 in competition's timezone.
 */
export function isDeadlinePassedInTimezone(
	deadlineStr: string | null | undefined,
	timezone: string,
): boolean {
	if (!deadlineStr) return false

	const deadline = getEndOfDayInTimezone(deadlineStr, timezone)
	if (!deadline) return false

	return new Date() > deadline
}

/**
 * Check if a date (YYYY-MM-DD) has started in a specific timezone.
 * "Registration opens Jan 10" means start of day Jan 10 in competition's timezone.
 */
export function hasDateStartedInTimezone(
	dateStr: string | null | undefined,
	timezone: string,
): boolean {
	if (!dateStr) return true // No date means it's always open

	const startOfDay = getStartOfDayInTimezone(dateStr, timezone)
	if (!startOfDay) return true

	return new Date() >= startOfDay
}

/**
 * Format a timestamp for display in a specific timezone.
 *
 * @param date - Date object or timestamp
 * @param timezone - IANA timezone string
 * @param formatStr - date-fns format string (default: "h:mm a")
 * @returns Formatted time string (e.g., "9:00 AM")
 */
export function formatTimeInTimezone(
	date: Date | number | null | undefined,
	timezone: string,
	formatStr: string = "h:mm a",
): string {
	if (date == null) return ""

	const d = typeof date === "number" ? new Date(date) : date
	if (Number.isNaN(d.getTime())) return ""

	return format(toZonedTime(d, timezone), formatStr)
}

/**
 * Format a timestamp with date and time in a specific timezone.
 *
 * @param date - Date object or timestamp
 * @param timezone - IANA timezone string
 * @param formatStr - date-fns format string (default: "MMM d, h:mm a")
 * @returns Formatted datetime string (e.g., "Jan 15, 9:00 AM")
 */
export function formatDateTimeInTimezone(
	date: Date | number | null | undefined,
	timezone: string,
	formatStr: string = "MMM d, h:mm a",
): string {
	if (date == null) return ""

	const d = typeof date === "number" ? new Date(date) : date
	if (Number.isNaN(d.getTime())) return ""

	return format(toZonedTime(d, timezone), formatStr)
}

/**
 * Get the timezone abbreviation for display (e.g., "MT", "PST", "EST")
 *
 * @param timezone - IANA timezone string
 * @param date - Optional date for determining DST (defaults to now)
 * @returns Timezone abbreviation string
 */
export function getTimezoneAbbreviation(
	timezone: string,
	date: Date = new Date(),
): string {
	return format(toZonedTime(date, timezone), "zzz", { timeZone: timezone })
}

/**
 * Parse a time input (HH:mm) on a specific date in a specific timezone
 * and return a UTC timestamp.
 *
 * @param timeStr - Time in "HH:mm" or "H:mm" format (e.g., "09:00", "14:30")
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timezone - IANA timezone string
 * @returns UTC Date object, or null if invalid
 */
export function parseTimeInTimezone(
	timeStr: string | null | undefined,
	dateStr: string | null | undefined,
	timezone: string,
): Date | null {
	if (!timeStr || !dateStr) return null
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null

	const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/)
	if (!timeMatch) return null

	const [, hourStr, minuteStr] = timeMatch
	const hours = Number(hourStr)
	const minutes = Number(minuteStr)

	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

	const [yearStr, monthStr, dayStr] = dateStr.split("-")
	const year = Number(yearStr)
	const month = Number(monthStr)
	const day = Number(dayStr)

	// Validate calendar date
	if (!isValidCalendarDate(year, month, day)) {
		return null
	}

	// Create the datetime in the target timezone
	// Note: Date constructor uses 0-indexed month
	const localDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)
	return fromZonedTime(localDateTime, timezone)
}

/**
 * Format a YYYY-MM-DD date string with timezone suffix for display
 * Example: "Jan 15, 2024 (MT)"
 */
export function formatDateWithTimezone(
	dateStr: string | null | undefined,
	timezone: string,
): string {
	if (!dateStr) return ""

	const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (!match) return ""

	const [, yearStr, monthStr, dayStr] = match
	const year = Number(yearStr)
	const month = Number(monthStr)
	const day = Number(dayStr)

	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	]

	const abbrev = getTimezoneAbbreviation(timezone)
	return `${months[month - 1]} ${day}, ${year} (${abbrev})`
}
