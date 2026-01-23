/**
 * Scoring Algorithm Factory
 *
 * Central factory that dispatches to the correct scoring algorithm based on
 * configuration. Provides a unified interface for calculating event points
 * regardless of which algorithm is being used.
 *
 * Algorithms:
 * - traditional: Fixed step point deduction from first place
 * - p_score: Performance-based scoring that rewards margin of victory
 * - custom: Template-based with optional place-specific overrides
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type {
	ScoringConfig,
	TraditionalConfig,
	PScoreConfig,
} from "@/types/scoring"
import type { WorkoutScheme } from "@/lib/scoring/types"
import { calculatePScore, type PScoreInput } from "./p-score"
import { calculateTraditionalPoints } from "./traditional"
import { calculateCustomPoints } from "./custom"
import { calculateOnlinePoints } from "./online"

// Re-export algorithm implementations
export { calculatePScore, type PScoreInput, type PScoreResult } from "./p-score"
export { calculateTraditionalPoints } from "./traditional"
export {
	calculateCustomPoints,
	generatePointsTable,
	WINNER_TAKES_MORE_TABLE,
} from "./custom"
export { calculateOnlinePoints } from "./online"

/**
 * Input for event score calculation
 */
export interface EventScoreInput {
	userId: string
	/** Normalized score value (already encoded) */
	value: number
	/** Score status */
	status: "scored" | "cap" | "dnf" | "dns" | "withdrawn"
}

/**
 * Result of event score calculation
 */
export interface EventPointsResult {
	userId: string
	/** Points awarded for this event */
	points: number
	/** Rank in the event (1-indexed) */
	rank: number
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
	algorithm: "traditional",
	traditional: {
		step: 5,
		firstPlacePoints: 100,
	},
	tiebreaker: {
		primary: "countback",
	},
	statusHandling: {
		dnf: "last_place",
		dns: "zero",
		withdrawn: "exclude",
	},
}

/**
 * Default traditional config
 */
export const DEFAULT_TRADITIONAL_CONFIG: TraditionalConfig = {
	step: 5,
	firstPlacePoints: 100,
}

/**
 * Default P-Score config
 */
export const DEFAULT_PSCORE_CONFIG: PScoreConfig = {
	allowNegatives: true,
	medianField: "top_half",
}

/**
 * Schemes where lower values are better (ascending sort)
 */
const ASCENDING_SCHEMES = new Set<WorkoutScheme>(["time", "time-with-cap"])

/**
 * Calculate event points using the configured scoring algorithm.
 *
 * This is the main entry point for scoring calculations. It dispatches
 * to the appropriate algorithm based on configuration.
 *
 * @param eventId - Unique identifier for the event (used for caching)
 * @param scores - Array of athlete scores for this event
 * @param scheme - Workout scheme (determines sort direction)
 * @param config - Scoring configuration
 * @returns Map of userId → points for this event
 *
 * @example
 * ```ts
 * const pointsMap = calculateEventPoints(
 *   "event-123",
 *   [
 *     { userId: "a", value: 60000, status: "scored" },
 *     { userId: "b", value: 65000, status: "scored" },
 *   ],
 *   "time",
 *   { algorithm: "traditional", traditional: { step: 5, firstPlacePoints: 100 } }
 * )
 * // → Map { "a" => 100, "b" => 95 }
 * ```
 */
export function calculateEventPoints(
	_eventId: string,
	scores: EventScoreInput[],
	scheme: WorkoutScheme,
	config: ScoringConfig,
): Map<string, EventPointsResult> {
	if (scores.length === 0) {
		return new Map()
	}

	switch (config.algorithm) {
		case "traditional":
			return calculateTraditionalEventPoints(scores, scheme, config)
		case "p_score":
			return calculatePScoreEventPoints(scores, scheme, config)
		case "winner_takes_more":
			return calculateWinnerTakesMoreEventPoints(scores, scheme, config)
		case "online":
			return calculateOnlineEventPoints(scores, scheme, config)
		case "custom":
			return calculateCustomEventPoints(scores, scheme, config)
		default: {
			// TypeScript exhaustiveness check
			const _exhaustive: never = config.algorithm
			throw new Error(`Unknown scoring algorithm: ${_exhaustive}`)
		}
	}
}

/**
 * Calculate points using traditional (placement-based) scoring
 */
function calculateTraditionalEventPoints(
	scores: EventScoreInput[],
	scheme: WorkoutScheme,
	config: ScoringConfig,
): Map<string, EventPointsResult> {
	const traditionalConfig = config.traditional ?? DEFAULT_TRADITIONAL_CONFIG
	const isAscending = ASCENDING_SCHEMES.has(scheme)

	// Separate active scores from inactive
	const activeScores = scores.filter(
		(s) => s.status === "scored" || s.status === "cap",
	)
	const inactiveScores = scores.filter(
		(s) => s.status === "dnf" || s.status === "dns" || s.status === "withdrawn",
	)

	// Sort active scores by performance
	const sortedActive = [...activeScores].sort((a, b) => {
		// In time-with-cap, capped athletes rank after scored athletes
		if (scheme === "time-with-cap") {
			if (a.status === "cap" && b.status !== "cap") return 1
			if (a.status !== "cap" && b.status === "cap") return -1
		}
		return isAscending ? a.value - b.value : b.value - a.value
	})

	// Assign ranks with tie handling
	const ranked = assignRanks(sortedActive)
	const results = new Map<string, EventPointsResult>()

	// Calculate points for active athletes
	for (const { score, rank } of ranked) {
		const points = calculateTraditionalPoints(rank, traditionalConfig)
		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	// Handle inactive athletes based on config
	const lastActiveRank = ranked.length > 0 ? ranked[ranked.length - 1].rank : 0
	for (const score of inactiveScores) {
		if (
			score.status !== "dnf" &&
			score.status !== "dns" &&
			score.status !== "withdrawn"
		) {
			continue
		}
		const handling = getStatusHandling(score.status, config)
		let points: number
		let rank: number

		switch (handling) {
			case "last_place":
			case "worst_performance":
				// Both get ranked after all active athletes
				rank = lastActiveRank + 1
				points = calculateTraditionalPoints(rank, traditionalConfig)
				break
			case "zero":
				rank = lastActiveRank + 1
				points = 0
				break
			case "exclude":
				// Don't add to results
				continue
		}

		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	return results
}

/**
 * Calculate points using Winner Takes More scoring
 * Uses a front-loaded points table that rewards top finishers more heavily
 */
function calculateWinnerTakesMoreEventPoints(
	scores: EventScoreInput[],
	scheme: WorkoutScheme,
	config: ScoringConfig,
): Map<string, EventPointsResult> {
	const isAscending = ASCENDING_SCHEMES.has(scheme)

	// Separate active scores from inactive
	const activeScores = scores.filter(
		(s) => s.status === "scored" || s.status === "cap",
	)
	const inactiveScores = scores.filter(
		(s) => s.status === "dnf" || s.status === "dns" || s.status === "withdrawn",
	)

	// Sort active scores by performance
	const sortedActive = [...activeScores].sort((a, b) => {
		// In time-with-cap, capped athletes rank after scored athletes
		if (scheme === "time-with-cap") {
			if (a.status === "cap" && b.status !== "cap") return 1
			if (a.status !== "cap" && b.status === "cap") return -1
		}
		return isAscending ? a.value - b.value : b.value - a.value
	})

	// Assign ranks with tie handling
	const ranked = assignRanks(sortedActive)
	const results = new Map<string, EventPointsResult>()

	// Calculate points for active athletes using winner_takes_more table
	for (const { score, rank } of ranked) {
		const points = calculateCustomPoints(rank, {
			baseTemplate: "winner_takes_more",
			overrides: {},
		})
		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	// Handle inactive athletes based on config
	const lastActiveRank = ranked.length > 0 ? ranked[ranked.length - 1].rank : 0
	for (const score of inactiveScores) {
		if (
			score.status !== "dnf" &&
			score.status !== "dns" &&
			score.status !== "withdrawn"
		) {
			continue
		}
		const handling = getStatusHandling(score.status, config)
		let points: number
		let rank: number

		switch (handling) {
			case "last_place":
			case "worst_performance":
				// Both get ranked after all active athletes
				rank = lastActiveRank + 1
				points = calculateCustomPoints(rank, {
					baseTemplate: "winner_takes_more",
					overrides: {},
				})
				break
			case "zero":
				rank = lastActiveRank + 1
				points = 0
				break
			case "exclude":
				// Don't add to results
				continue
		}

		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	return results
}

/**
 * Calculate points using P-Score (performance-based) scoring
 */
/**
 * Map WorkoutScheme to P-Score compatible scheme
 */
function mapToPScoreScheme(scheme: WorkoutScheme): PScoreInput["scheme"] {
	switch (scheme) {
		case "time":
			return "time"
		case "time-with-cap":
			return "time-with-cap"
		case "reps":
		case "rounds-reps":
		case "calories":
			return "reps"
		case "load":
			return "load"
		case "points":
		case "pass-fail":
		case "emom":
		case "meters":
		case "feet":
			return "points"
	}
}

function calculatePScoreEventPoints(
	scores: EventScoreInput[],
	scheme: WorkoutScheme,
	config: ScoringConfig,
): Map<string, EventPointsResult> {
	const pScoreConfig = config.pScore ?? DEFAULT_PSCORE_CONFIG
	const pScoreScheme = mapToPScoreScheme(scheme)

	const input: PScoreInput = {
		scores: scores.map((s) => ({
			userId: s.userId,
			value: s.value,
			status: s.status,
		})),
		scheme: pScoreScheme,
		config: pScoreConfig,
	}

	const pScoreResults = calculatePScore(input)
	const results = new Map<string, EventPointsResult>()

	for (const result of pScoreResults) {
		results.set(result.userId, {
			userId: result.userId,
			points: result.pScore,
			rank: result.rank,
		})
	}

	return results
}

/**
 * Calculate points using custom table scoring
 */
function calculateCustomEventPoints(
	scores: EventScoreInput[],
	scheme: WorkoutScheme,
	config: ScoringConfig,
): Map<string, EventPointsResult> {
	const customConfig = config.customTable ?? {
		baseTemplate: "traditional" as const,
		overrides: {},
	}
	const traditionalConfig = config.traditional ?? DEFAULT_TRADITIONAL_CONFIG
	const isAscending = ASCENDING_SCHEMES.has(scheme)

	// Separate active scores from inactive
	const activeScores = scores.filter(
		(s) => s.status === "scored" || s.status === "cap",
	)
	const inactiveScores = scores.filter(
		(s) => s.status === "dnf" || s.status === "dns" || s.status === "withdrawn",
	)

	// Sort active scores by performance
	const sortedActive = [...activeScores].sort((a, b) => {
		if (scheme === "time-with-cap") {
			if (a.status === "cap" && b.status !== "cap") return 1
			if (a.status !== "cap" && b.status === "cap") return -1
		}
		return isAscending ? a.value - b.value : b.value - a.value
	})

	// Assign ranks with tie handling
	const ranked = assignRanks(sortedActive)
	const results = new Map<string, EventPointsResult>()

	// Calculate points for active athletes
	for (const { score, rank } of ranked) {
		const points = calculateCustomPoints(rank, customConfig, traditionalConfig)
		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	// Handle inactive athletes based on config
	const lastActiveRank = ranked.length > 0 ? ranked[ranked.length - 1].rank : 0
	for (const score of inactiveScores) {
		if (
			score.status !== "dnf" &&
			score.status !== "dns" &&
			score.status !== "withdrawn"
		) {
			continue
		}
		const handling = getStatusHandling(score.status, config)
		let points: number
		let rank: number

		switch (handling) {
			case "last_place":
			case "worst_performance":
				rank = lastActiveRank + 1
				points = calculateCustomPoints(rank, customConfig, traditionalConfig)
				break
			case "zero":
				rank = lastActiveRank + 1
				points = 0
				break
			case "exclude":
				continue
		}

		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	return results
}

/**
 * Calculate points using online scoring
 * Points = rank (1st place = 1 point, 2nd = 2 points, etc.)
 * Lowest total wins, ideal for online competitions with unknown participant count
 */
function calculateOnlineEventPoints(
	scores: EventScoreInput[],
	scheme: WorkoutScheme,
	config: ScoringConfig,
): Map<string, EventPointsResult> {
	const isAscending = ASCENDING_SCHEMES.has(scheme)

	// Separate active scores from inactive
	const activeScores = scores.filter(
		(s) => s.status === "scored" || s.status === "cap",
	)
	const inactiveScores = scores.filter(
		(s) => s.status === "dnf" || s.status === "dns" || s.status === "withdrawn",
	)

	// Sort active scores by performance
	const sortedActive = [...activeScores].sort((a, b) => {
		// In time-with-cap, capped athletes rank after scored athletes
		if (scheme === "time-with-cap") {
			if (a.status === "cap" && b.status !== "cap") return 1
			if (a.status !== "cap" && b.status === "cap") return -1
		}
		return isAscending ? a.value - b.value : b.value - a.value
	})

	// Assign ranks with tie handling
	const ranked = assignRanks(sortedActive)
	const results = new Map<string, EventPointsResult>()

	// Calculate points for active athletes (points = rank)
	for (const { score, rank } of ranked) {
		const points = calculateOnlinePoints(rank)
		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	// Handle inactive athletes based on config
	const lastActiveRank = ranked.length > 0 ? ranked[ranked.length - 1].rank : 0
	for (const score of inactiveScores) {
		if (
			score.status !== "dnf" &&
			score.status !== "dns" &&
			score.status !== "withdrawn"
		) {
			continue
		}
		const handling = getStatusHandling(score.status, config)
		let points: number
		let rank: number

		switch (handling) {
			case "last_place":
			case "worst_performance":
				// Both get ranked after all active athletes
				rank = lastActiveRank + 1
				points = calculateOnlinePoints(rank)
				break
			case "zero":
				// For online scoring, "zero" means last place + 1 (worst possible)
				// Since lower is better, we use the number of total participants + 1
				rank = lastActiveRank + 1
				points = scores.length + 1
				break
			case "exclude":
				// Don't add to results
				continue
		}

		results.set(score.userId, {
			userId: score.userId,
			points,
			rank,
		})
	}

	return results
}

/**
 * Assign ranks to sorted scores, handling ties
 */
function assignRanks(
	sortedScores: EventScoreInput[],
): Array<{ score: EventScoreInput; rank: number }> {
	const result: Array<{ score: EventScoreInput; rank: number }> = []
	let currentRank = 1
	let previousValue: number | null = null

	for (let i = 0; i < sortedScores.length; i++) {
		const score = sortedScores[i]

		if (previousValue !== null && score.value !== previousValue) {
			currentRank = i + 1
		}

		result.push({ score, rank: currentRank })
		previousValue = score.value
	}

	return result
}

/**
 * Status handling result for internal use
 */
type StatusHandlingResult =
	| "last_place"
	| "worst_performance"
	| "zero"
	| "exclude"

/**
 * Get handling mode for a given status
 */
function getStatusHandling(
	status: "dnf" | "dns" | "withdrawn",
	config: ScoringConfig,
): StatusHandlingResult {
	const handling =
		config.statusHandling ?? DEFAULT_SCORING_CONFIG.statusHandling

	switch (status) {
		case "dnf":
			return handling.dnf ?? "last_place"
		case "dns":
			return handling.dns ?? "zero"
		case "withdrawn":
			return handling.withdrawn ?? "exclude"
	}
}

/**
 * Get scoring algorithm display name
 */
export function getScoringAlgorithmName(
	algorithm: ScoringConfig["algorithm"],
): string {
	switch (algorithm) {
		case "traditional":
			return "Traditional"
		case "p_score":
			return "P-Score"
		case "winner_takes_more":
			return "Winner Takes More"
		case "online":
			return "Online"
		case "custom":
			return "Custom"
	}
}

/**
 * Check if scoring algorithm supports negative scores
 */
export function canHaveNegativeScores(config: ScoringConfig): boolean {
	return (
		config.algorithm === "p_score" && (config.pScore?.allowNegatives ?? true)
	)
}
