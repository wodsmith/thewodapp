/**
 * Score formatting: converts Score objects to display strings
 */

import { decodeScore } from "../decode"
import type { FormatOptions, Score, ScoreRound, WorkoutScheme } from "../types"
import { formatStatus, isSpecialStatus } from "./status"

/**
 * Format a complete Score object for display.
 *
 * @param score - Score object to format
 * @param options - Format options
 *
 * @example
 * formatScore({ scheme: "time", scoreType: "min", value: 754567, status: "scored" })
 * // → "12:34.567"
 *
 * formatScore({
 *   scheme: "time-with-cap",
 *   scoreType: "min",
 *   value: null,
 *   status: "cap",
 *   timeCap: { ms: 900000, secondaryScheme: "reps", secondaryValue: 142 }
 * })
 * // → "CAP (142 reps)"
 *
 * formatScore({ scheme: "load", scoreType: "max", value: 102058, status: "scored" },
 *             { weightUnit: "lbs", includeUnit: true })
 * // → "225 lbs"
 */
export function formatScore(score: Score, options?: FormatOptions): string {
	const showStatus = options?.showStatus ?? true

	// Handle special statuses
	if (isSpecialStatus(score.status)) {
		return formatSpecialStatus(score, options, showStatus)
	}

	// Normal scored result
	if (score.value === null) {
		return "N/A"
	}

	return decodeScore(score.value, score.scheme, options)
}

/**
 * Format scores with special status (cap, dq, withdrawn).
 */
function formatSpecialStatus(
	score: Score,
	options?: FormatOptions,
	showStatus: boolean = true,
): string {
	const statusPrefix = showStatus ? formatStatus(score.status) : ""

	switch (score.status) {
		case "cap": {
			// For capped results, show the secondary score (usually reps)
			if (score.timeCap?.secondaryValue !== undefined) {
				const secondaryFormatted = decodeScore(
					score.timeCap.secondaryValue,
					score.timeCap.secondaryScheme,
					{ ...options, includeUnit: true },
				)
				return showStatus
					? `${statusPrefix} (${secondaryFormatted})`
					: secondaryFormatted
			}
			return statusPrefix || "CAP"
		}

		case "dq":
			return statusPrefix || "DQ"

		case "withdrawn":
			return statusPrefix || "WD"

		default:
			return score.value !== null
				? decodeScore(score.value, score.scheme, options)
				: "N/A"
	}
}

/**
 * Format a score for compact leaderboard display.
 * Similar to formatScore but with compact option enabled by default.
 *
 * @example
 * formatScoreCompact({ scheme: "time", value: 754000, ... })
 * // → "12:34" (no milliseconds shown)
 */
export function formatScoreCompact(
	score: Score,
	options?: FormatOptions,
): string {
	return formatScore(score, { ...options, compact: true })
}

/**
 * Format individual rounds for display.
 *
 * @param rounds - Array of score rounds
 * @param scheme - Default scheme for rounds
 * @param options - Format options
 *
 * @example
 * formatRounds(
 *   [{ roundNumber: 1, value: 102058 }, { roundNumber: 2, value: 106594 }],
 *   "load",
 *   { weightUnit: "lbs", includeUnit: true }
 * )
 * // → ["225 lbs", "235 lbs"]
 */
export function formatRounds(
	rounds: ScoreRound[],
	scheme: WorkoutScheme,
	options?: FormatOptions,
): string[] {
	return rounds.map((round) => {
		const effectiveScheme = round.schemeOverride ?? scheme

		// Handle rounds with special status
		if (round.status && isSpecialStatus(round.status)) {
			const statusStr = formatStatus(round.status)
			if (round.secondaryValue !== undefined) {
				return `${statusStr} (${round.secondaryValue})`
			}
			return statusStr
		}

		return decodeScore(round.value, effectiveScheme, options)
	})
}

/**
 * Format a score with tiebreak information.
 *
 * @example
 * formatScoreWithTiebreak(score)
 * // → "5+12 (TB: 8:30)"
 */
export function formatScoreWithTiebreak(
	score: Score,
	options?: FormatOptions,
): string {
	const mainScore = formatScore(score, options)

	if (!score.tiebreak) {
		return mainScore
	}

	const tiebreakFormatted =
		score.tiebreak.scheme === "time"
			? decodeScore(score.tiebreak.value, "time", { compact: true })
			: score.tiebreak.value.toString()

	return `${mainScore} (TB: ${tiebreakFormatted})`
}

/**
 * Format a score for display in a results list.
 * Includes status, main score, and tiebreak if present.
 *
 * @example
 * formatScoreForList(score)
 * // → "12:34.567" or "CAP (142 reps)" or "5+12 (TB: 8:30)"
 */
export function formatScoreForList(
	score: Score,
	options?: FormatOptions,
): string {
	if (score.tiebreak) {
		return formatScoreWithTiebreak(score, options)
	}
	return formatScore(score, options)
}
