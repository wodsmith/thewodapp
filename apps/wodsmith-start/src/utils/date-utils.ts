/**
 * Utility functions for handling dates consistently across the app
 */

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
