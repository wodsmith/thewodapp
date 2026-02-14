import { sql } from "drizzle-orm"
import type { AnyColumn } from "drizzle-orm"

/**
 * Cursor structure for pagination
 */
export interface Cursor {
	/** Primary sort value (e.g., createdAt timestamp) */
	sortValue: string | number
	/** Tie-breaker ID */
	id: string
}

/**
 * Encode cursor for client transmission
 */
export function encodeCursor(cursor: Cursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url")
}

/**
 * Decode cursor from client
 */
export function decodeCursor(encoded: string): Cursor | null {
	try {
		return JSON.parse(Buffer.from(encoded, "base64url").toString())
	} catch {
		return null
	}
}

/**
 * Build cursor-based WHERE clause for pagination
 * Uses tuple comparison: (sortCol, idCol) < (sortValue, idValue)
 *
 * @param sortColumn - Column to sort by (e.g., createdAt)
 * @param idColumn - ID column for tie-breaking
 * @param cursor - Decoded cursor from previous page
 * @param direction - 'forward' (older items) or 'backward' (newer items)
 */
export function buildCursorWhere(
	sortColumn: AnyColumn,
	idColumn: AnyColumn,
	cursor: Cursor | null,
	direction: "forward" | "backward" = "forward",
) {
	if (!cursor) return undefined

	// For descending order (newest first), "next page" means < cursor
	// For ascending order (oldest first), "next page" means > cursor
	const comparison =
		direction === "forward"
			? sql`(${sortColumn}, ${idColumn}) < (${cursor.sortValue}, ${cursor.id})`
			: sql`(${sortColumn}, ${idColumn}) > (${cursor.sortValue}, ${cursor.id})`

	return comparison
}

/**
 * Paginated response structure
 */
export interface CursorPaginatedResult<T> {
	items: T[]
	nextCursor: string | null
	prevCursor: string | null
	hasMore: boolean
}

/**
 * Create paginated response from query results
 */
export function createCursorResponse<T extends { id: string }>(
	items: T[],
	limit: number,
	getSortValue: (item: T) => string | number,
): CursorPaginatedResult<T> {
	const hasMore = items.length > limit
	const pageItems = hasMore ? items.slice(0, limit) : items

	const lastItem = pageItems[pageItems.length - 1]
	const firstItem = pageItems[0]

	return {
		items: pageItems,
		nextCursor: lastItem
			? encodeCursor({ sortValue: getSortValue(lastItem), id: lastItem.id })
			: null,
		prevCursor: firstItem
			? encodeCursor({ sortValue: getSortValue(firstItem), id: firstItem.id })
			: null,
		hasMore,
	}
}
