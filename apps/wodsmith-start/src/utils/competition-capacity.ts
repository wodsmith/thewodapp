/**
 * Pure competition-wide capacity calculation logic.
 *
 * Mirrors division-capacity.ts but for competition-wide totals.
 * SQL count() results from PlanetScale can arrive as strings,
 * so numeric coercion is applied to prevent string concatenation.
 */

export interface CompetitionCapacityInput {
	registrationCount: number | string
	pendingCount: number | string
	maxTotalRegistrations: number | null | undefined
}

export interface CompetitionCapacityResult {
	effectiveMax: number | null
	totalOccupied: number
	spotsAvailable: number | null
	isFull: boolean
}

export function calculateCompetitionCapacity(
	input: CompetitionCapacityInput,
): CompetitionCapacityResult {
	const registrationCount = Number(input.registrationCount)
	const pendingCount = Number(input.pendingCount)
	const effectiveMax = input.maxTotalRegistrations ?? null
	const totalOccupied = registrationCount + pendingCount
	const spotsAvailable =
		effectiveMax !== null ? Math.max(0, effectiveMax - totalOccupied) : null
	const isFull = effectiveMax !== null && totalOccupied >= effectiveMax

	return { effectiveMax, totalOccupied, spotsAvailable, isFull }
}
