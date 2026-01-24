/**
 * Online Scoring Algorithm
 *
 * Place-based scoring where points equal the finishing position.
 * 1st place = 1 point, 2nd place = 2 points, etc.
 *
 * Best overall score is the LOWEST total (like golf scoring).
 * This is ideal for online competitions where the total number
 * of participants is unknown ahead of time.
 *
 * @see docs/plans/configurable-scoring-system.md
 */

/**
 * Calculate points for a given place using online scoring.
 *
 * @param place - The athlete's finishing position (1-indexed)
 * @returns Points awarded (equal to place)
 *
 * @example
 * calculateOnlinePoints(1) // 1 (1st place = 1 point)
 * calculateOnlinePoints(2) // 2 (2nd place = 2 points)
 * calculateOnlinePoints(10) // 10 (10th place = 10 points)
 */
export function calculateOnlinePoints(place: number): number {
	// Handle invalid places (0 or negative) - return 1 (best possible score)
	if (place <= 0) {
		return 1
	}

	// Points = place (1st gets 1, 2nd gets 2, etc.)
	return place
}
