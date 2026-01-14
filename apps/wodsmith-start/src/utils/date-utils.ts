/**
 * Utility functions for handling dates consistently across the app
 */
import { parse, isValid, format } from "date-fns"

/**
 * Get the start of day in local timezone
 * @param date - The date to get start of day for
 * @returns Date object set to start of day (00:00:00.000) in local timezone
 */
export function startOfLocalDay(date: Date = new Date()): Date {
	const localDate = new Date(date)
	localDate.setHours(0, 0, 0, 0)
	return localDate
}

/**
 * Get the end of day in local timezone
 * @param date - The date to get end of day for
 * @returns Date object set to end of day (23:59:59.999) in local timezone
 */
export function endOfLocalDay(date: Date = new Date()): Date {
	const localDate = new Date(date)
	localDate.setHours(23, 59, 59, 999)
	return localDate
}

/**
 * Get start of week in local timezone (Sunday)
 * @param date - The date to get start of week for
 * @returns Date object set to start of Sunday in local timezone
 */
export function startOfLocalWeek(date: Date = new Date()): Date {
	const localDate = new Date(date)
	const day = localDate.getDay()
	const diff = localDate.getDate() - day
	localDate.setDate(diff)
	localDate.setHours(0, 0, 0, 0)
	return localDate
}

/**
 * Get end of week in local timezone (Saturday)
 * @param date - The date to get end of week for
 * @returns Date object set to end of Saturday in local timezone
 */
export function endOfLocalWeek(date: Date = new Date()): Date {
	const localDate = new Date(date)
	const day = localDate.getDay()
	const diff = localDate.getDate() - day + 6
	localDate.setDate(diff)
	localDate.setHours(23, 59, 59, 999)
	return localDate
}

/**
 * Create a date key for grouping (YYYY-MM-DD format in local timezone)
 * @param date - The date to create a key for
 * @returns String in YYYY-MM-DD format
 */
export function getLocalDateKey(date: Date | string | number): string {
	const localDate = date instanceof Date ? date : new Date(date)
	const year = localDate.getFullYear()
	const month = String(localDate.getMonth() + 1).padStart(2, "0")
	const day = String(localDate.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

/**
 * Check if two dates represent the same calendar day (using UTC).
 * Useful for determining if a competition is single-day.
 */
export function isSameUTCDay(
	date1: Date | string | number | null | undefined,
	date2: Date | string | number | null | undefined,
): boolean {
	if (date1 == null || date2 == null) return false
	const d1 = date1 instanceof Date ? date1 : new Date(date1)
	const d2 = date2 instanceof Date ? date2 : new Date(date2)
	if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return false

	return (
		d1.getUTCFullYear() === d2.getUTCFullYear() &&
		d1.getUTCMonth() === d2.getUTCMonth() &&
		d1.getUTCDate() === d2.getUTCDate()
	)
}

/**
 * Format a UTC date for display (e.g., "Jan 15").
 * Uses UTC to preserve the calendar date stored in the database.
 */
export function formatUTCDateShort(
	date: Date | string | number | null | undefined,
): string {
	if (date == null) return ""
	const d = date instanceof Date ? date : new Date(date)
	if (Number.isNaN(d.getTime())) return ""

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
	return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/**
 * Format a UTC date with year for display (e.g., "Jan 15, 2024").
 * Uses UTC to preserve the calendar date stored in the database.
 */
export function formatUTCDateFull(
	date: Date | string | number | null | undefined,
): string {
	if (date == null) return ""
	const d = date instanceof Date ? date : new Date(date)
	if (Number.isNaN(d.getTime())) return ""

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
	return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

/**
 * Parse a date input string (YYYY-MM-DD) as UTC.
 * HTML date inputs return strings in YYYY-MM-DD format.
 * This creates a Date object that preserves the calendar date in UTC.
 */
export function parseDateInputAsUTC(dateStr: string): Date {
	const parts = dateStr.split("-").map(Number)
	const year = parts[0] ?? 0
	const month = parts[1] ?? 1
	const day = parts[2] ?? 1
	return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Format a UTC date range for display (e.g., "January 15-17, 2024").
 * Handles single-day events, same month, different months, and different years.
 */
export function formatUTCDateRange(
	startDate: Date | string | number,
	endDate: Date | string | number,
): string {
	const start =
		startDate instanceof Date ? startDate : new Date(startDate as string)
	const end = endDate instanceof Date ? endDate : new Date(endDate as string)

	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]

	const startMonth = months[start.getUTCMonth()]
	const startDay = start.getUTCDate()
	const startYear = start.getUTCFullYear()
	const endMonth = months[end.getUTCMonth()]
	const endDay = end.getUTCDate()
	const endYear = end.getUTCFullYear()

	// Single-day event (same date)
	if (
		startDay === endDay &&
		start.getUTCMonth() === end.getUTCMonth() &&
		startYear === endYear
	) {
		return `${startMonth} ${startDay}, ${startYear}`
	}

	// Same month and year
	if (start.getUTCMonth() === end.getUTCMonth() && startYear === endYear) {
		return `${startMonth} ${startDay}-${endDay}, ${startYear}`
	}

	// Same year, different months
	if (startYear === endYear) {
		return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
	}

	// Different years
	return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
}

// ============================================================================
// String-based date utilities for YYYY-MM-DD format
// ============================================================================

/**
 * Format a date string (YYYY-MM-DD) for full display (e.g., "Jan 15, 2024").
 * Works directly with date strings without timezone conversion.
 */
export function formatDateStringFull(
	dateStr: string | null | undefined,
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
	return `${months[month - 1]} ${day}, ${year}`
}

/**
 * Format a date string (YYYY-MM-DD) for short display (e.g., "Jan 15").
 * Works directly with date strings without timezone conversion.
 */
export function formatDateStringShort(
	dateStr: string | null | undefined,
): string {
	if (!dateStr) return ""
	const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (!match) return ""

	const [, , monthStr, dayStr] = match
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
	return `${months[month - 1]} ${day}`
}

/**
 * Format a date range from YYYY-MM-DD strings for display.
 * Handles single-day events, same month, different months, and different years.
 */
export function formatDateStringRange(
	startDateStr: string,
	endDateStr: string,
): string {
	const startMatch = startDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	const endMatch = endDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (!startMatch || !endMatch) return ""

	const startYear = Number(startMatch[1])
	const startMonth = Number(startMatch[2])
	const startDay = Number(startMatch[3])
	const endYear = Number(endMatch[1])
	const endMonth = Number(endMatch[2])
	const endDay = Number(endMatch[3])

	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]

	const startMonthName = months[startMonth - 1]
	const endMonthName = months[endMonth - 1]

	// Single-day event
	if (startDateStr === endDateStr) {
		return `${startMonthName} ${startDay}, ${startYear}`
	}

	// Same month and year
	if (startMonth === endMonth && startYear === endYear) {
		return `${startMonthName} ${startDay}-${endDay}, ${startYear}`
	}

	// Same year, different months
	if (startYear === endYear) {
		return `${startMonthName} ${startDay} - ${endMonthName} ${endDay}, ${startYear}`
	}

	// Different years
	return `${startMonthName} ${startDay}, ${startYear} - ${endMonthName} ${endDay}, ${endYear}`
}

/**
 * Check if two date strings (YYYY-MM-DD) represent the same date.
 */
export function isSameDateString(
	date1: string | null | undefined,
	date2: string | null | undefined,
): boolean {
	if (!date1 || !date2) return false
	return date1 === date2
}

// ============================================================================
// Safe date parsing utilities using date-fns
// ============================================================================

/**
 * Parse a YYYY-MM-DD string into its components.
 * Returns null if the string format is invalid or the date doesn't exist.
 * Uses date-fns for validation to catch invalid dates like Feb 30.
 */
export function parseDateString(
	dateStr: string | null | undefined,
): { year: number; month: number; day: number } | null {
	if (!dateStr) return null

	// Use date-fns parse to validate the date
	const parsed = parse(dateStr, "yyyy-MM-dd", new Date())
	if (!isValid(parsed)) return null

	// Verify it matches the original string (catches cases like "2024-02-30" normalizing to March)
	const formatted = format(parsed, "yyyy-MM-dd")
	if (formatted !== dateStr) return null

	return {
		year: parsed.getFullYear(),
		month: parsed.getMonth() + 1, // 1-indexed
		day: parsed.getDate(),
	}
}

/**
 * Check if a YYYY-MM-DD string represents a valid date.
 * Returns false for invalid dates like "2024-13-01" or "2024-02-30".
 */
export function isValidDateString(
	dateStr: string | null | undefined,
): boolean {
	return parseDateString(dateStr) !== null
}

/**
 * Get the end of day (23:59:59.999 UTC) for a YYYY-MM-DD string.
 * Use this for deadline comparisons to ensure consistent behavior across timezones.
 * Returns null if the date string is invalid.
 */
export function getEndOfDayUTC(dateStr: string | null | undefined): Date | null {
	const parts = parseDateString(dateStr)
	if (!parts) return null

	return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999))
}

/**
 * Get the start of day (00:00:00.000 UTC) for a YYYY-MM-DD string.
 * Returns null if the date string is invalid.
 */
export function getStartOfDayUTC(dateStr: string | null | undefined): Date | null {
	const parts = parseDateString(dateStr)
	if (!parts) return null

	return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0))
}

/**
 * Get today's date as a YYYY-MM-DD string in UTC.
 */
export function getTodayStringUTC(): string {
	const now = new Date()
	return format(now, "yyyy-MM-dd")
}

/**
 * Compare a YYYY-MM-DD deadline string against the current time.
 * Returns true if the deadline has passed (current time is after end of day UTC).
 */
export function isDeadlinePassed(deadlineStr: string | null | undefined): boolean {
	const deadline = getEndOfDayUTC(deadlineStr)
	if (!deadline) return false
	return new Date() > deadline
}

/**
 * Get the weekday name for a YYYY-MM-DD string.
 * Returns null if the date string is invalid.
 */
export function getWeekdayFromDateString(
	dateStr: string | null | undefined,
): string | null {
	const parts = parseDateString(dateStr)
	if (!parts) return null

	const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
	const weekdays = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	]
	return weekdays[d.getUTCDay()] ?? null
}

/**
 * Format a YYYY-MM-DD string with weekday (e.g., "Monday, January 15, 2024").
 * Returns empty string if the date is invalid.
 */
export function formatDateStringWithWeekday(
	dateStr: string | null | undefined,
): string {
	const parts = parseDateString(dateStr)
	if (!parts) return ""

	const weekday = getWeekdayFromDateString(dateStr)
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]
	const month = months[parts.month - 1]

	return `${weekday}, ${month} ${parts.day}, ${parts.year}`
}
