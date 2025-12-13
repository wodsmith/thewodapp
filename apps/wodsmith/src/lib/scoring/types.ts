/**
 * Core type definitions for the scoring library
 */

// ============ Scheme & Status Constants ============

export const WORKOUT_SCHEMES = [
	"time",
	"time-with-cap",
	"rounds-reps",
	"reps",
	"emom",
	"load",
	"calories",
	"meters",
	"feet",
	"points",
	"pass-fail",
] as const
export type WorkoutScheme = (typeof WORKOUT_SCHEMES)[number]

export const SCORE_STATUSES = ["scored", "cap", "dq", "withdrawn"] as const
export type ScoreStatus = (typeof SCORE_STATUSES)[number]

export const SCORE_TYPES = [
	"min",
	"max",
	"sum",
	"average",
	"first",
	"last",
] as const
export type ScoreType = (typeof SCORE_TYPES)[number]

export const TIEBREAK_SCHEMES = ["time", "reps"] as const
export type TiebreakScheme = (typeof TIEBREAK_SCHEMES)[number]

export type SortDirection = "asc" | "desc"

export const WEIGHT_UNITS = ["lbs", "kg"] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

export const DISTANCE_UNITS = ["m", "km", "ft", "mi"] as const
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]

// ============ Core Score Types ============

/** A single round/set within a score */
export interface ScoreRound {
	roundNumber: number
	/** Encoded value based on scheme */
	value: number
	/** Override scheme for this specific round (rare) */
	schemeOverride?: WorkoutScheme
	/** Status for this specific round */
	status?: ScoreStatus
	/** Secondary value (e.g., reps if this round was capped) */
	secondaryValue?: number
	notes?: string
}

/** Complete score with optional rounds */
export interface Score {
	// Classification
	scheme: WorkoutScheme
	scoreType: ScoreType

	// Primary aggregated value (encoded as integer)
	value: number | null
	status: ScoreStatus

	// Individual rounds (optional)
	rounds?: ScoreRound[]

	// Tiebreak
	tiebreak?: {
		scheme: TiebreakScheme
		value: number
	}

	// Time cap handling (for time-with-cap)
	timeCap?: {
		/** Time cap in milliseconds */
		ms: number
		/** Reps completed when capped */
		secondaryValue: number
	}

	// Computed sort key (for database storage)
	sortKey?: bigint
}

// ============ Input Types ============

/** Input for a single round */
export interface RoundInput {
	/** User input: "225", "12:34", etc. */
	raw: string
	/** Override scheme for this round */
	schemeOverride?: WorkoutScheme
	/** Unit for load/distance */
	unit?: WeightUnit | DistanceUnit
}

/** Input for creating/updating a score */
export interface ScoreInput {
	scheme: WorkoutScheme
	/** Defaults based on scheme if not provided */
	scoreType?: ScoreType

	// Either a single value OR multiple rounds
	/** Single aggregated value (user input string) */
	value?: string
	/** Individual rounds for multi-round workouts */
	rounds?: RoundInput[]

	status?: ScoreStatus

	tiebreak?: {
		raw: string
		scheme: TiebreakScheme
	}

	timeCap?: {
		/** Time cap in milliseconds */
		ms: number
		/** Secondary score if capped (e.g., reps completed) */
		secondaryRaw?: string
	}
}

// ============ Parse Types ============

export interface ParseOptions {
	/** For time schemes: how to interpret raw numbers */
	timePrecision?: "auto" | "seconds" | "ms"
	/** For load/distance schemes */
	unit?: WeightUnit | DistanceUnit
	/** Strict mode rejects ambiguous inputs */
	strict?: boolean
}

export interface ParseResult {
	isValid: boolean
	/** Encoded integer value */
	encoded: number | null
	/** Formatted display string */
	formatted: string
	error?: string
	warnings?: string[]
}

// ============ Format Types ============

export interface FormatOptions {
	/** Hide milliseconds if .000 */
	compact?: boolean
	/** Include unit suffix (e.g., "225 lbs" vs "225") */
	includeUnit?: boolean
	/** Weight display preference */
	weightUnit?: WeightUnit
	/** Distance display preference */
	distanceUnit?: DistanceUnit
	/** Include status prefix (e.g., "CAP", "DQ") */
	showStatus?: boolean
}

// ============ Encode Types ============

export interface EncodeOptions {
	/** Unit for load/distance */
	unit?: WeightUnit | DistanceUnit
}

export interface EncodeRoundsResult {
	/** Encoded values for each round */
	rounds: number[]
	/** Aggregated value based on scoreType */
	aggregated: number | null
}

// ============ Validation Types ============

export interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

// ============ Database Record Types ============

/** Database record for scores table */
export interface ScoreRecord {
	id: string
	userId: string
	teamId: string
	workoutId: string
	competitionEventId: string | null
	scheduledWorkoutInstanceId: string | null

	scheme: WorkoutScheme
	scoreType: ScoreType
	scoreValue: number | null

	tiebreakScheme: TiebreakScheme | null
	tiebreakValue: number | null

	timeCapMs: number | null
	// Note: secondaryScheme removed - when capped, score is always reps
	secondaryValue: number | null

	status: ScoreStatus
	statusOrder: number
	sortKey: bigint | null

	scalingLevelId: string | null
	asRx: boolean

	notes: string | null
	recordedAt: number
	createdAt: number
	updatedAt: number
}

/** Database record for score_rounds table */
export interface ScoreRoundRecord {
	id: string
	scoreId: string
	roundNumber: number
	value: number
	schemeOverride: WorkoutScheme | null
	status: ScoreStatus | null
	secondaryValue: number | null
	notes: string | null
	createdAt: number
}
