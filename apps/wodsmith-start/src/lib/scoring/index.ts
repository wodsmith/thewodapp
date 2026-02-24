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

// ============ Aggregation ============
export {
	aggregateValues,
	aggregateWithSummary,
	// Note: getDefaultScoreType is exported from sort
	// Note: isLowerBetter is exported from sort
} from "./aggregate"
// ============ Competition Scoring Algorithms ============
export {
	calculateCustomPoints,
	// Factory function - main entry point
	calculateEventPoints,
	// Algorithm implementations
	calculatePScore,
	calculateTraditionalPoints,
	canHaveNegativeScores,
	DEFAULT_PSCORE_CONFIG,
	DEFAULT_SCORING_CONFIG,
	DEFAULT_TRADITIONAL_CONFIG,
	type EventPointsResult,
	// Types
	type EventScoreInput,
	generatePointsTable,
	// Utilities
	getScoringAlgorithmName,
	type PScoreInput,
	type PScoreResult,
	// Constants
	WINNER_TAKES_MORE_TABLE,
} from "./algorithms"
export {
	COUNT_BASED_SCHEMES,
	DEFAULT_SCORE_TYPES,
	DISTANCE_BASED_SCHEMES,
	GRAMS_PER_UNIT,
	isCountBasedScheme,
	isDistanceBasedScheme,
	isLoadBasedScheme,
	isTimeBasedScheme,
	LOAD_BASED_SCHEMES,
	MAX_SCORE_VALUE,
	MM_PER_UNIT,
	MS_PER_HOUR,
	MS_PER_MINUTE,
	MS_PER_SECOND,
	ROUNDS_REPS_MULTIPLIER,
	SCHEME_SORT_DIRECTIONS,
	STATUS_ORDER,
	TIME_BASED_SCHEMES,
} from "./constants"
// ============ Decoding ============
export {
	// Note: gramsToUnit is exported from encode
	// Distance decoding
	decodeDistance,
	// Note: extractRoundsReps is exported from encode
	// Load decoding
	decodeLoad,
	// Rounds+Reps decoding
	decodeRoundsReps,
	decodeScore,
	// Time decoding
	decodeTime,
	decodeTimeToSeconds,
	decodeToNumber,
	// Note: mmToUnit is exported from encode
} from "./decode"
// ============ Encoding ============
export {
	// Distance encoding
	encodeDistance,
	encodeDistanceFromNumber,
	// Load encoding
	encodeLoad,
	encodeLoadFromNumber,
	encodeNumericScore,
	encodeRounds,
	// Rounds+Reps encoding
	encodeRoundsReps,
	encodeRoundsRepsFromParts,
	encodeScore,
	// Time encoding
	encodeTime,
	encodeTimeFromMs,
	encodeTimeFromSeconds,
	extractRoundsReps,
	gramsToUnit,
	mmToUnit,
} from "./encode"
// ============ Formatting ============
export {
	convertDistance,
	convertWeight,
	formatNumber,
	formatRounds,
	formatScore,
	formatScoreCompact,
	formatScoreForList,
	formatScoreWithTiebreak,
	formatStatus,
	formatStatusFull,
	getDistanceUnitLabel,
	getWeightUnitLabel,
	isSpecialStatus,
} from "./format"
// ============ Parsing ============
export {
	parseScore,
	parseTiebreak,
	parseTime,
	validateTimeInput,
} from "./parse"
// ============ Sorting ============
export {
	compareScores,
	computeSortKey,
	computeSortKeyWithDirection,
	createComparator,
	extractFromSortKey,
	findRank,
	getDefaultScoreType,
	getSortDirection,
	isLowerBetter,
	sortKeyToString,
	sortScores,
	statusFromOrder,
} from "./sort"
// ============ Tiebreakers ============
export {
	applyTiebreakers,
	type RankedAthlete,
	type TiebreakerInput,
} from "./tiebreakers"
// ============ Types ============
export type {
	DistanceUnit,
	EncodeOptions,
	EncodeRoundsResult,
	FormatOptions,
	ParseOptions,
	// Result types
	ParseResult,
	RoundInput,
	// Score types
	Score,
	ScoreInput,
	// Database types
	ScoreRecord,
	ScoreRound,
	ScoreRoundRecord,
	ScoreStatus,
	ScoreType,
	SortDirection,
	TiebreakScheme,
	ValidationResult,
	WeightUnit,
	// Core types
	WorkoutScheme,
} from "./types"
// ============ Constants ============
export {
	DISTANCE_UNITS,
	SCORE_STATUSES,
	SCORE_TYPES,
	TIEBREAK_SCHEMES,
	WEIGHT_UNITS,
	WORKOUT_SCHEMES,
} from "./types"
// ============ Validation ============
export {
	isOutlier,
	validateDistance,
	validateLoad,
	validateRoundsReps,
	validateScoreInput,
	validateTime,
} from "./validate"
