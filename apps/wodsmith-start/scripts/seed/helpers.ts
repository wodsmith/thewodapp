import type { Client } from "@planetscale/database"

const BATCH_SIZE = 500

/** Escape a MySQL identifier with backticks */
export function esc(name: string): string {
	return `\`${name}\``
}

/** Current unix timestamp in seconds */
export function now(): number {
	return Math.floor(Date.now() / 1000)
}

/** Current date as YYYY-MM-DD string */
export function today(): string {
	return new Date().toISOString().slice(0, 10)
}

/** Date N days from now as YYYY-MM-DD string */
export function futureDate(days: number): string {
	const d = new Date()
	d.setDate(d.getDate() + days)
	return d.toISOString().slice(0, 10)
}

/** Date N days ago as YYYY-MM-DD string */
export function pastDate(days: number): string {
	const d = new Date()
	d.setDate(d.getDate() - days)
	return d.toISOString().slice(0, 10)
}

/** ISO datetime string N days from now */
export function futureDatetime(days: number): string {
	const d = new Date()
	d.setDate(d.getDate() + days)
	return d.toISOString().slice(0, 19).replace("T", " ")
}

/** ISO datetime string N days ago */
export function pastDatetime(days: number): string {
	const d = new Date()
	d.setDate(d.getDate() - days)
	return d.toISOString().slice(0, 19).replace("T", " ")
}

/** Unix timestamp for a specific date string like '1985-03-15' */
export function dateToUnix(dateStr: string): number {
	return Math.floor(new Date(dateStr).getTime() / 1000)
}

/** Unix timestamp for a specific datetime string like '2024-12-27 10:30:00' */
export function datetimeToUnix(datetimeStr: string): number {
	return Math.floor(new Date(datetimeStr).getTime() / 1000)
}

/** Current timestamp as ISO string (for CURRENT_TIMESTAMP replacement) */
export function currentTimestamp(): string {
	return new Date().toISOString().slice(0, 19).replace("T", " ")
}

/** Unix timestamp for N days from now */
export function futureUnix(days: number): number {
	const d = new Date()
	d.setDate(d.getDate() + days)
	return Math.floor(d.getTime() / 1000)
}

/**
 * Flatten a batch of rows into a single parameter array.
 */
function flattenParams(
	rows: Record<string, unknown>[],
	columns: string[],
): unknown[] {
	const params: unknown[] = []
	for (const row of rows) {
		for (const col of columns) {
			const val = row[col]
			if (typeof val === "boolean") {
				params.push(val ? 1 : 0)
			} else if (val === undefined) {
				params.push(null)
			} else {
				params.push(val)
			}
		}
	}
	return params
}

/**
 * Batch INSERT IGNORE into a MySQL table.
 * Rows are plain objects with snake_case keys matching the column names.
 */
export async function batchInsert(
	client: Client,
	tableName: string,
	rows: Record<string, unknown>[],
): Promise<void> {
	if (rows.length === 0) return

	const columns = Object.keys(rows[0])

	for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
		const batch = rows.slice(offset, offset + BATCH_SIZE)
		const colList = columns.map(esc).join(", ")
		const singleRow = `(${columns.map(() => "?").join(", ")})`
		const allRows = Array.from({ length: batch.length }, () => singleRow).join(
			", ",
		)

		const sql = `INSERT IGNORE INTO ${esc(tableName)} (${colList}) VALUES ${allRows}`
		const params = flattenParams(batch, columns)

		await client.execute(sql, params)
	}

	console.log(`  ${tableName}: ${rows.length} rows inserted`)
}
