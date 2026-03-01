import { sql } from "drizzle-orm"

/**
 * MySQL-compatible date formatting
 * Replaces SQLite strftime
 */
export const formatDate = (column: any, format: string) => {
	// Convert strftime format to MySQL DATE_FORMAT
	const mysqlFormat = format
		.replace("%Y", "%Y")
		.replace("%m", "%m")
		.replace("%d", "%d")
		.replace("%H", "%H")
		.replace("%M", "%i")
		.replace("%S", "%S")

	return sql`DATE_FORMAT(${column}, ${mysqlFormat})`
}

/**
 * MySQL-compatible current timestamp
 */
export const now = () => sql`NOW()`

/**
 * MySQL-compatible date difference in days
 */
export const dateDiffDays = (date1: any, date2: any) =>
	sql`DATEDIFF(${date1}, ${date2})`
