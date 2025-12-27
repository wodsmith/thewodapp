/**
 * Constants and encoding specifications for the scoring library
 */

import type { ScoreStatus, ScoreType, WorkoutScheme } from "./types"

// ============ Status Order for Sorting ============

/**
 * Status order determines sort priority.
 * Lower numbers sort first.
 */
export const STATUS_ORDER: Record<ScoreStatus, number> = {
	scored: 0,
	cap: 1,
	dq: 2,
	withdrawn: 3,
} as const

// ============ Encoding Constants ============

/**
 * Multiplier for rounds+reps encoding.
 * Value = rounds * ROUNDS_REPS_MULTIPLIER + reps
 * Supports up to 99,999 reps per partial round.
 */
export const ROUNDS_REPS_MULTIPLIER = 100_000

/**
 * Maximum score value that fits in 60 bits.
 * Used for sort key computation.
 */
export const MAX_SCORE_VALUE = 2n ** 60n - 1n

// ============ Unit Conversions ============

/**
 * Grams per unit for weight conversions.
 * All weights are stored in grams internally.
 */
export const GRAMS_PER_UNIT = {
	lbs: 453.592,
	kg: 1000,
} as const

/**
 * Millimeters per unit for distance conversions.
 * All distances are stored in millimeters internally.
 */
export const MM_PER_UNIT = {
	m: 1000,
	km: 1_000_000,
	ft: 304.8,
	mi: 1_609_344,
} as const

// ============ Default Score Types ============

/**
 * Default score type (aggregation method) for each workout scheme.
 */
export const DEFAULT_SCORE_TYPES: Record<WorkoutScheme, ScoreType> = {
	time: "min", // Lower time is better
	"time-with-cap": "min", // Lower time is better
	"rounds-reps": "max", // Higher rounds+reps is better
	reps: "max", // Higher reps is better
	emom: "max", // Higher score is better
	load: "max", // Higher load is better
	calories: "max", // Higher calories is better
	meters: "max", // Higher distance is better
	feet: "max", // Higher distance is better
	points: "max", // Higher points is better
	"pass-fail": "first", // First attempt matters
} as const

// ============ Sort Directions ============

/**
 * Sort direction for each workout scheme.
 * 'asc' = lower values sort first (better)
 * 'desc' = higher values sort first (better)
 */
export const SCHEME_SORT_DIRECTIONS: Record<WorkoutScheme, "asc" | "desc"> = {
	time: "asc",
	"time-with-cap": "asc",
	"rounds-reps": "desc",
	reps: "desc",
	emom: "desc",
	load: "desc",
	calories: "desc",
	meters: "desc",
	feet: "desc",
	points: "desc",
	"pass-fail": "desc", // Pass (1) beats Fail (0)
} as const

// ============ Time Constants ============

/** Milliseconds per second */
export const MS_PER_SECOND = 1000
/** Milliseconds per minute */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND
/** Milliseconds per hour */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE

// ============ Scheme Classifications ============

/** Schemes where time is the primary measurement */
export const TIME_BASED_SCHEMES: WorkoutScheme[] = [
	"time",
	"time-with-cap",
	"emom",
]

/** Schemes where weight/load is the primary measurement */
export const LOAD_BASED_SCHEMES: WorkoutScheme[] = ["load"]

/** Schemes where distance is the primary measurement */
export const DISTANCE_BASED_SCHEMES: WorkoutScheme[] = ["meters", "feet"]

/** Schemes that are simple integer counts */
export const COUNT_BASED_SCHEMES: WorkoutScheme[] = [
	"reps",
	"calories",
	"points",
]

/**
 * Check if a scheme is time-based
 */
export function isTimeBasedScheme(scheme: WorkoutScheme): boolean {
	return TIME_BASED_SCHEMES.includes(scheme)
}

/**
 * Check if a scheme is load-based
 */
export function isLoadBasedScheme(scheme: WorkoutScheme): boolean {
	return LOAD_BASED_SCHEMES.includes(scheme)
}

/**
 * Check if a scheme is distance-based
 */
export function isDistanceBasedScheme(scheme: WorkoutScheme): boolean {
	return DISTANCE_BASED_SCHEMES.includes(scheme)
}

/**
 * Check if a scheme is a simple count
 */
export function isCountBasedScheme(scheme: WorkoutScheme): boolean {
	return COUNT_BASED_SCHEMES.includes(scheme)
}
