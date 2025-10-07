/**
 * Utility functions for handling dates consistently across the app
 */

/**
 * Format a date for display in the user's local timezone
 * @param date - The date to format (can be Date, string, or number)
 * @returns A Date object in the user's local timezone
 */
export function toLocalDate(date: Date | string | number): Date {
	if (date instanceof Date) {
		return date
	}
	// If it's a timestamp number, use it directly
	if (typeof date === "number") {
		return new Date(date)
	}
	// If it's a string in YYYY-MM-DD format, parse it as local date
	// to avoid timezone conversion issues
	if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		const parts = date.split("-").map(Number)
		const year = parts[0]
		const month = parts[1]
		const day = parts[2]
		// Create date in local timezone (month is 0-indexed)
		if (year !== undefined && month !== undefined && day !== undefined) {
			return new Date(year, month - 1, day)
		}
	}
	// For other string formats, parse normally
	return new Date(date)
}

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
 * Create a date key for grouping (YYYY-MM-DD format in local timezone)
 * @param date - The date to create a key for
 * @returns String in YYYY-MM-DD format
 */
export function getLocalDateKey(date: Date | string | number): string {
	const localDate = toLocalDate(date)
	const year = localDate.getFullYear()
	const month = String(localDate.getMonth() + 1).padStart(2, "0")
	const day = String(localDate.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
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
