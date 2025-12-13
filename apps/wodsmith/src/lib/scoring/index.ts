/**
 * Scoring Library
 *
 * A comprehensive library for encoding, decoding, parsing, formatting,
 * and sorting workout scores.
 *
 * @example
 * import {
 *   parseScore,
 *   encodeScore,
 *   decodeScore,
 *   formatScore,
 *   compareScores,
 *   computeSortKey,
 * } from "@/lib/scoring"
 *
 * // Parse user input
 * const result = parseScore("1234", "time")
 * // → { isValid: true, encoded: 754000, formatted: "12:34" }
 *
 * // Encode for database
 * const encoded = encodeScore("12:34.567", "time")
 * // → 754567
 *
 * // Decode for display
 * const display = decodeScore(754567, "time")
 * // → "12:34.567"
 *
 * // Format a complete score
 * const formatted = formatScore({
 *   scheme: "time",
 *   scoreType: "min",
 *   value: 754567,
 *   status: "scored"
 * })
 * // → "12:34.567"
 *
 * // Sort scores
 * scores.sort(compareScores)
 *
 * // Compute sort key for database
 * const sortKey = computeSortKey(score)
 */

// ============ Types ============
export type {
	// Core types
	WorkoutScheme,
	ScoreStatus,
	ScoreType,
	TiebreakScheme,
	SortDirection,
	WeightUnit,
	DistanceUnit,
	// Score types
	Score,
	ScoreRound,
	ScoreInput,
	RoundInput,
	// Result types
	ParseResult,
	ParseOptions,
	FormatOptions,
	EncodeOptions,
	EncodeRoundsResult,
	ValidationResult,
	// Database types
	ScoreRecord,
	ScoreRoundRecord,
} from "./types"

// ============ Constants ============
export {
	WORKOUT_SCHEMES,
	SCORE_STATUSES,
	SCORE_TYPES,
	TIEBREAK_SCHEMES,
	WEIGHT_UNITS,
	DISTANCE_UNITS,
} from "./types"

export {
	STATUS_ORDER,
	ROUNDS_REPS_MULTIPLIER,
	MAX_SCORE_VALUE,
	GRAMS_PER_UNIT,
	MM_PER_UNIT,
	DEFAULT_SCORE_TYPES,
	SCHEME_SORT_DIRECTIONS,
	MS_PER_SECOND,
	MS_PER_MINUTE,
	MS_PER_HOUR,
	TIME_BASED_SCHEMES,
	LOAD_BASED_SCHEMES,
	DISTANCE_BASED_SCHEMES,
	COUNT_BASED_SCHEMES,
	isTimeBasedScheme,
	isLoadBasedScheme,
	isDistanceBasedScheme,
	isCountBasedScheme,
} from "./constants"

// ============ Encoding ============
export {
	encodeScore,
	encodeRounds,
	encodeNumericScore,
	// Time encoding
	encodeTime,
	encodeTimeFromSeconds,
	encodeTimeFromMs,
	// Rounds+Reps encoding
	encodeRoundsReps,
	encodeRoundsRepsFromParts,
	extractRoundsReps,
	// Load encoding
	encodeLoad,
	encodeLoadFromNumber,
	gramsToUnit,
	// Distance encoding
	encodeDistance,
	encodeDistanceFromNumber,
	mmToUnit,
} from "./encode"

// ============ Decoding ============
export {
	decodeScore,
	decodeToNumber,
	// Time decoding
	decodeTime,
	decodeTimeToSeconds,
	// Rounds+Reps decoding
	decodeRoundsReps,
	// Note: extractRoundsReps is exported from encode
	// Load decoding
	decodeLoad,
	// Note: gramsToUnit is exported from encode
	// Distance decoding
	decodeDistance,
	// Note: mmToUnit is exported from encode
} from "./decode"

// ============ Parsing ============
export {
	parseScore,
	parseTiebreak,
	parseTime,
	validateTimeInput,
} from "./parse"

// ============ Formatting ============
export {
	formatScore,
	formatScoreCompact,
	formatRounds,
	formatScoreWithTiebreak,
	formatScoreForList,
	formatStatus,
	formatStatusFull,
	isSpecialStatus,
	getWeightUnitLabel,
	getDistanceUnitLabel,
	convertWeight,
	convertDistance,
	formatNumber,
} from "./format"

// ============ Sorting ============
export {
	getSortDirection,
	isLowerBetter,
	getDefaultScoreType,
	computeSortKey,
	computeSortKeyWithDirection,
	extractFromSortKey,
	statusFromOrder,
	sortKeyToString,
	compareScores,
	createComparator,
	sortScores,
	findRank,
} from "./sort"

// ============ Aggregation ============
export {
	aggregateValues,
	aggregateWithSummary,
	// Note: getDefaultScoreType is exported from sort
	// Note: isLowerBetter is exported from sort
} from "./aggregate"

// ============ Validation ============
export {
	validateScoreInput,
	validateTime,
	validateRoundsReps,
	validateLoad,
	validateDistance,
	isOutlier,
} from "./validate"
