import { useState } from "react"
import type { TiebreakScheme, WorkoutScheme } from "@/db/schema"
import {
	type ParseResult,
	parseScore,
	parseTieBreakScore,
} from "@/utils/score-parser-new"

export interface UseLogScoreStateArgs {
	workoutScheme: WorkoutScheme
	timeCap?: number
	roundsToScore?: number
	tiebreakScheme?: TiebreakScheme | null
	initialValue?: string
	initialTieBreak?: string
}

export interface UseLogScoreStateResult {
	// Input state
	inputValue: string
	setInputValue: (value: string) => void
	tieBreakValue: string
	setTieBreakValue: (value: string) => void

	// Parsing results
	parseResult: ParseResult | null
	tieBreakParseResult: ParseResult | null
	roundParseResults: Array<ParseResult | null>

	// Multi-round state
	isMultiRound: boolean
	roundScores: Array<{ score: string }>

	// Handlers
	handleInputChange: (newValue: string) => void
	handleTieBreakChange: (newValue: string) => void
	handleRoundScoreChange: (roundIndex: number, newValue: string) => void

	// Helpers
	isValid: boolean
	needsTieBreak: boolean
	formattedScore: string
	rawValue: number | null
}

/**
 * Hook for managing score input state in log forms.
 * Provides real-time score validation and preview using the scoring library.
 *
 * Supports all workout schemes:
 * - time, time-with-cap: Time-based scoring with optional cap
 * - rounds-reps: AMRAP with rounds+reps
 * - reps: Rep count
 * - load: Weight lifted
 * - pass-fail: Binary completion
 *
 * Multi-round support: When roundsToScore > 1, maintains separate score for each round
 *
 * @example
 * ```tsx
 * const { inputValue, parseResult, handleInputChange } = useLogScoreState({
 *   workoutScheme: "time",
 *   timeCap: 600, // 10 minutes
 * })
 *
 * <input
 *   value={inputValue}
 *   onChange={(e) => handleInputChange(e.target.value)}
 * />
 * {parseResult?.isValid && <span>{parseResult.formatted}</span>}
 * {parseResult?.error && <span className="error">{parseResult.error}</span>}
 * ```
 */
export function useLogScoreState({
	workoutScheme,
	timeCap,
	roundsToScore = 1,
	tiebreakScheme,
	initialValue = "",
	initialTieBreak = "",
}: UseLogScoreStateArgs): UseLogScoreStateResult {
	const isMultiRound = roundsToScore > 1

	// Single score state
	const [inputValue, setInputValue] = useState(initialValue)
	const [parseResult, setParseResult] = useState<ParseResult | null>(() => {
		if (isMultiRound || !initialValue.trim()) return null
		return parseScore(initialValue, workoutScheme, timeCap, tiebreakScheme)
	})

	// Multi-round state
	const [roundScores, setRoundScores] = useState<Array<{ score: string }>>(() =>
		Array(roundsToScore)
			.fill(null)
			.map(() => ({ score: "" })),
	)
	const [roundParseResults, setRoundParseResults] = useState<
		Array<ParseResult | null>
	>(() => Array(roundsToScore).fill(null))

	// Tiebreak state
	const [tieBreakValue, setTieBreakValue] = useState(initialTieBreak)
	const [tieBreakParseResult, setTieBreakParseResult] =
		useState<ParseResult | null>(() => {
			if (!tiebreakScheme || !initialTieBreak.trim()) return null
			return parseTieBreakScore(initialTieBreak, tiebreakScheme)
		})

	const handleInputChange = (newValue: string) => {
		setInputValue(newValue)

		if (!newValue.trim()) {
			setParseResult(null)
			return
		}

		const result = parseScore(newValue, workoutScheme, timeCap, tiebreakScheme)
		setParseResult(result)
	}

	const handleRoundScoreChange = (roundIndex: number, newValue: string) => {
		// Update round scores array
		setRoundScores((prev) => {
			const updated = [...prev]
			updated[roundIndex] = { score: newValue }
			return updated
		})

		// Update parse results for this round
		setRoundParseResults((prev) => {
			const updated = [...prev]
			if (newValue.trim()) {
				updated[roundIndex] = parseScore(
					newValue,
					workoutScheme,
					timeCap,
					tiebreakScheme,
				)
			} else {
				updated[roundIndex] = null
			}
			return updated
		})
	}

	const handleTieBreakChange = (newValue: string) => {
		setTieBreakValue(newValue)

		if (!tiebreakScheme || !newValue.trim()) {
			setTieBreakParseResult(null)
			return
		}

		const result = parseTieBreakScore(newValue, tiebreakScheme)
		setTieBreakParseResult(result)
	}

	// Determine validity
	let isValid = false
	let needsTieBreak = false
	let formattedScore = ""
	let rawValue: number | null = null

	if (isMultiRound) {
		// For multi-round, valid if at least one round has a valid score
		const hasValidRound = roundParseResults.some((r) => r?.isValid)
		isValid = hasValidRound

		// Format as JSON array for storage (compatible with existing log format)
		if (hasValidRound) {
			formattedScore = JSON.stringify(roundScores)
			// For multi-round, we don't provide a single rawValue
			// Consumers should use roundParseResults for individual values
			rawValue = null
		}

		// Check if any round needs tiebreak
		needsTieBreak = roundParseResults.some((r) => r?.needsTieBreak) ?? false
	} else {
		// Single round scoring
		isValid = parseResult?.isValid ?? false
		needsTieBreak = parseResult?.needsTieBreak ?? false
		formattedScore = parseResult?.formatted ?? inputValue
		rawValue = parseResult?.rawValue ?? null
	}

	// If tiebreak is required and empty, mark as invalid
	if (needsTieBreak && !tieBreakValue.trim()) {
		isValid = false
	}

	// If tiebreak has value but is invalid, mark as invalid
	if (tieBreakValue.trim() && !(tieBreakParseResult?.isValid ?? false)) {
		isValid = false
	}

	return {
		// Input state
		inputValue,
		setInputValue,
		tieBreakValue,
		setTieBreakValue,

		// Parsing results
		parseResult,
		tieBreakParseResult,
		roundParseResults,

		// Multi-round state
		isMultiRound,
		roundScores,

		// Handlers
		handleInputChange,
		handleTieBreakChange,
		handleRoundScoreChange,

		// Helpers
		isValid,
		needsTieBreak,
		formattedScore,
		rawValue,
	}
}
