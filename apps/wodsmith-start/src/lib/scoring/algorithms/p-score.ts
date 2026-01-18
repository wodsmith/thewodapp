/**
 * P-Score Algorithm Implementation
 *
 * P-Score (Performance Score) rewards margin of victory, not just placement.
 * Unlike traditional scoring where 1st gets 100, 2nd gets 95, etc., P-Score
 * considers HOW MUCH better an athlete performed.
 *
 * Formula:
 * - Timed (ascending): 100 – (X – Best) × (50 / (Median – Best))
 * - Reps/Load (descending): 100 – (Best – X) × (50 / (Best – Median))
 *
 * Key characteristics:
 * - First place = 100 points
 * - Median performer = 50 points
 * - Below median = can be negative
 * - Median calculated from top half of field by default
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type { PScoreConfig } from "@/types/scoring"

/**
 * Input for P-Score calculation
 */
export interface PScoreInput {
	scores: Array<{
		userId: string
		/** Normalized score value (already encoded) */
		value: number
		/** Score status */
		status: "scored" | "cap" | "dnf" | "dns" | "withdrawn"
	}>
	/** Scoring scheme determines sort direction */
	scheme: "time" | "time-with-cap" | "reps" | "load" | "points"
	/** P-Score configuration */
	config: PScoreConfig
}

/**
 * Result of P-Score calculation for a single athlete
 */
export interface PScoreResult {
	userId: string
	/** P-Score value (can be negative) */
	pScore: number
	/** Rank in the event (1-indexed) */
	rank: number
}

/**
 * Schemes where lower values are better (ascending sort)
 */
const ASCENDING_SCHEMES = new Set(["time", "time-with-cap"])

/**
 * Calculate P-Scores for a set of athletes in an event
 *
 * @param input - Scores, scheme, and configuration
 * @returns Array of P-Score results sorted by rank
 */
export function calculatePScore(input: PScoreInput): PScoreResult[] {
	const { scores, scheme, config } = input

	if (scores.length === 0) {
		return []
	}

	// Separate active scores from inactive statuses
	const activeScores = scores.filter(
		(s) => s.status === "scored" || s.status === "cap",
	)
	const inactiveScores = scores.filter(
		(s) => s.status === "dnf" || s.status === "dns" || s.status === "withdrawn",
	)

	// Handle case where no one finished
	if (activeScores.length === 0) {
		return scores.map((s, i) => ({
			userId: s.userId,
			pScore: 0,
			rank: i + 1,
		}))
	}

	// Determine sort direction
	const isAscending = ASCENDING_SCHEMES.has(scheme)

	// Sort active scores by performance (best first)
	const sortedActive = [...activeScores].sort((a, b) => {
		// Capped athletes always rank after scored athletes in time-based events
		if (scheme === "time-with-cap") {
			if (a.status === "cap" && b.status !== "cap") return 1
			if (a.status !== "cap" && b.status === "cap") return -1
		}

		if (isAscending) {
			return a.value - b.value // Lower is better
		}
		return b.value - a.value // Higher is better
	})

	// Get best score
	const best = sortedActive[0]?.value ?? 0

	// Calculate median value
	const median = calculateMedian(sortedActive, config.medianField)

	// Check for all identical scores
	const allTied = sortedActive.every((s) => s.value === best)

	// Calculate P-Scores for active athletes
	const activeResults: PScoreResult[] = sortedActive.map((score) => {
		let pScore: number

		if (allTied || best === median) {
			// Everyone gets 100 if all tied or median equals best
			pScore = 100
		} else {
			pScore = calculateSinglePScore(
				score.value,
				best,
				median,
				isAscending,
				config.allowNegatives,
			)
		}

		return {
			userId: score.userId,
			pScore: roundToTwoDecimals(pScore),
			rank: 0, // Will be assigned after
		}
	})

	// Assign ranks (handle ties)
	assignRanks(activeResults, sortedActive)

	// Handle inactive athletes
	const inactiveResults: PScoreResult[] = inactiveScores.map((score) => ({
		userId: score.userId,
		pScore: 0,
		rank: activeResults.length + 1, // All get last place + 1
	}))

	// Combine and sort by rank
	const allResults = [...activeResults, ...inactiveResults]
	allResults.sort((a, b) => a.rank - b.rank)

	return allResults
}

/**
 * Calculate median value based on configuration
 */
function calculateMedian(
	sortedScores: Array<{ value: number; status: string }>,
	medianField: "top_half" | "all",
): number {
	// Filter to only scored athletes for median calculation
	const scoredAthletes = sortedScores.filter((s) => s.status === "scored")

	if (scoredAthletes.length === 0) {
		// If only capped athletes, use their values
		return sortedScores[0]?.value ?? 0
	}

	const values = scoredAthletes.map((s) => s.value)
	return getMedianValue(values, medianField)
}

/**
 * Get the median value based on field configuration
 *
 * For P-Score:
 * - top_half: The BOUNDARY athlete (worst of top half) defines the median value.
 *             This athlete gets exactly 50 points.
 * - all: Statistical median of all athlete values
 */
function getMedianValue(
	values: number[],
	medianField: "top_half" | "all",
): number {
	if (values.length === 0) return 0
	if (values.length === 1) return values[0] ?? 0

	if (medianField === "top_half") {
		// Top half boundary: the LAST athlete in the top half defines the median
		// With 4 athletes, top half = 2, median = value at index 1
		// With 6 athletes, top half = 3, median = value at index 2
		const halfSize = Math.ceil(values.length / 2)
		return values[halfSize - 1] ?? 0
	}

	// All field: statistical median
	return findStatisticalMedian(values)
}

/**
 * Find statistical median of an array
 */
function findStatisticalMedian(values: number[]): number {
	if (values.length === 0) return 0
	if (values.length === 1) return values[0] ?? 0

	const mid = Math.floor(values.length / 2)

	if (values.length % 2 === 0) {
		// Even number: average of two middle values
		return ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2
	}

	// Odd number: middle value
	return values[mid] ?? 0
}

/**
 * Calculate P-Score for a single athlete
 */
function calculateSinglePScore(
	value: number,
	best: number,
	median: number,
	isAscending: boolean,
	allowNegatives: boolean,
): number {
	const scale = 50 / Math.abs(median - best)

	let pScore: number
	if (isAscending) {
		// Timed: 100 – (X – Best) × scale
		pScore = 100 - (value - best) * scale
	} else {
		// Reps/Load: 100 – (Best – X) × scale
		pScore = 100 - (best - value) * scale
	}

	// Clamp to 0 if negatives not allowed
	if (!allowNegatives && pScore < 0) {
		pScore = 0
	}

	return pScore
}

/**
 * Assign ranks handling ties (same score = same rank)
 */
function assignRanks(
	results: PScoreResult[],
	sortedScores: Array<{ value: number; userId: string }>,
): void {
	let currentRank = 1
	let previousValue: number | null = null

	for (let i = 0; i < results.length; i++) {
		const score = sortedScores[i]
		const result = results[i]
		if (!score || !result) continue

		if (previousValue !== null && score.value !== previousValue) {
			currentRank = i + 1
		}

		result.rank = currentRank
		previousValue = score.value
	}
}

/**
 * Round to 2 decimal places
 */
function roundToTwoDecimals(value: number): number {
	return Math.round(value * 100) / 100
}
