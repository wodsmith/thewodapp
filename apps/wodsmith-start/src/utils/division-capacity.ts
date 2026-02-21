/**
 * Pure division capacity calculation logic.
 *
 * Extracted to ensure numeric coercion safety — SQL count() results
 * from D1/SQLite can arrive as strings, and string + number in JS
 * produces string concatenation instead of addition.
 */

export interface DivisionCapacityInput {
	registrationCount: number | string
	pendingCount: number | string
	divisionMaxSpots: number | null | undefined
	competitionDefaultMax: number | null | undefined
}

export interface DivisionCapacityResult {
	effectiveMax: number | null
	totalOccupied: number
	spotsAvailable: number | null
	isFull: boolean
}

export function calculateDivisionCapacity(
	input: DivisionCapacityInput,
): DivisionCapacityResult {
	const registrationCount = Number(input.registrationCount)
	const pendingCount = Number(input.pendingCount)
	const effectiveMax = input.divisionMaxSpots ?? input.competitionDefaultMax ?? null
	const totalOccupied = registrationCount + pendingCount
	const spotsAvailable =
		effectiveMax !== null ? effectiveMax - totalOccupied : null
	const isFull = effectiveMax !== null && totalOccupied >= effectiveMax

	return { effectiveMax, totalOccupied, spotsAvailable, isFull }
}
