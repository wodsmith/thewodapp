/**
 * Sort key computation for database storage
 *
 * Sort keys encode status + normalized score into a single BIGINT
 * for efficient single-column index sorting.
 *
 * Structure (64-bit signed integer):
 * - Bits 62-60: status_order (0-7)
 * - Bits 59-0: normalized score value
 */

import { MAX_SCORE_VALUE, STATUS_ORDER } from "../constants"
import type { Score, ScoreStatus, SortDirection } from "../types"
import { getSortDirection } from "./direction"

/**
 * Compute a sort key for database storage.
 *
 * The sort key encodes both status and score value into a single integer
 * that can be used for efficient index-based sorting.
 *
 * @param score - Score object or partial with required fields
 *
 * @example
 * // Time workout (lower is better)
 * computeSortKey({ value: 510000, status: "scored", scheme: "time", scoreType: "min" })
 * // → 510000n (status 0, value as-is)
 *
 * computeSortKey({ value: null, status: "cap", scheme: "time", scoreType: "min" })
 * // → 1152921504606846975n (status 1 << 60 + MAX_VALUE)
 */
export function computeSortKey(
	score: Pick<Score, "value" | "status" | "scheme" | "scoreType">,
): bigint {
	const direction = getSortDirection(score.scheme, score.scoreType)
	return computeSortKeyWithDirection(score.value, score.status, direction)
}

/**
 * Compute sort key with explicit direction.
 *
 * @param value - Score value (null for incomplete)
 * @param status - Score status
 * @param direction - Sort direction
 */
export function computeSortKeyWithDirection(
	value: number | null,
	status: ScoreStatus,
	direction: SortDirection,
): bigint {
	// Status order occupies the top 3 bits (shifted left 60 positions)
	const statusBits = BigInt(STATUS_ORDER[status]) << 60n

	// Handle null values - they sort last within their status group
	if (value === null) {
		return statusBits | MAX_SCORE_VALUE
	}

	// Normalize the value based on sort direction
	// For ascending (lower is better): use value as-is
	// For descending (higher is better): invert so higher values get lower sort keys
	const normalizedValue =
		direction === "asc"
			? BigInt(value)
			: MAX_SCORE_VALUE - BigInt(value)

	return statusBits | normalizedValue
}

/**
 * Extract status and approximate value from a sort key.
 * Note: Value extraction is lossy for descending sorts.
 *
 * @param sortKey - The sort key to decode
 * @param direction - The sort direction used when encoding
 */
export function extractFromSortKey(
	sortKey: bigint,
	direction: SortDirection,
): {
	statusOrder: number
	value: number | null
} {
	// Extract status order from top 3 bits
	const statusOrder = Number(sortKey >> 60n)

	// Extract value from bottom 60 bits
	const valueBits = sortKey & ((1n << 60n) - 1n)

	// Check for null (MAX_VALUE indicator)
	if (valueBits === MAX_SCORE_VALUE) {
		return { statusOrder, value: null }
	}

	// Denormalize the value
	const value =
		direction === "asc"
			? Number(valueBits)
			: Number(MAX_SCORE_VALUE - valueBits)

	return { statusOrder, value }
}

/**
 * Get the status from a status order number.
 */
export function statusFromOrder(order: number): ScoreStatus {
	const entries = Object.entries(STATUS_ORDER)
	for (const [status, statusOrder] of entries) {
		if (statusOrder === order) {
			return status as ScoreStatus
		}
	}
	return "scored"
}
