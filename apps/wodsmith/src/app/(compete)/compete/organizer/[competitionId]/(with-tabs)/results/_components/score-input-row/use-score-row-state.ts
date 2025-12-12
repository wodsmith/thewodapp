import {
	useEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type MutableRefObject,
} from "react"
import {
	parseScore,
	parseTieBreakScore,
	type ParseResult,
} from "@/utils/score-parser-new"
import {
	aggregateValues,
	decodeScore,
	getDefaultScoreType,
} from "@/lib/scoring"
import type {
	ScoreStatus,
	ScoreType,
	TiebreakScheme,
	WorkoutScheme,
} from "@/db/schema"
import type { EventScoreEntryAthlete } from "@/server/competition-scores"

export interface ScoreEntryData {
	score: string
	scoreStatus: ScoreStatus
	tieBreakScore: string | null
	secondaryScore: string | null
	formattedScore: string
	/** Parsed numeric value (seconds for time, reps for AMRAP, etc.) */
	rawValue?: number | null
	// Multi-round support: array of scores when roundsToScore > 1
	roundScores?: Array<{
		score: string
	}>
}

export interface UseScoreRowStateArgs {
	athlete: EventScoreEntryAthlete
	workoutScheme: WorkoutScheme
	scoreType?: ScoreType | null
	tiebreakScheme: TiebreakScheme | null
	showTiebreak: boolean
	timeCap?: number
	roundsToScore: number
	value?: ScoreEntryData
	autoFocus?: boolean
	onChange: (data: ScoreEntryData) => void
	onTabNext: () => void
}

export interface UseScoreRowStateResult {
	// refs
	scoreInputRef: MutableRefObject<HTMLInputElement | null>
	roundInputRefs: MutableRefObject<Map<number, HTMLInputElement>>
	tieBreakInputRef: MutableRefObject<HTMLInputElement | null>
	secondaryInputRef: MutableRefObject<HTMLInputElement | null>

	// state
	inputValue: string
	setInputValue: (v: string) => void
	roundScores: Array<{ roundNumber: number; score: string; timeCapped?: boolean }>
	tieBreakValue: string
	setTieBreakValue: (v: string) => void
	secondaryValue: string
	setSecondaryValue: (v: string) => void
	showWarning: boolean
	setShowWarning: (v: boolean) => void
	showTieBreakWarning: boolean
	setShowTieBreakWarning: (v: boolean) => void

	// derived
	numRounds: number
	isPassFail: boolean
	isMultiRound: boolean
	isRoundsReps: boolean
	isTimeCapped: boolean
	isCapped: boolean
	showSecondaryInput: boolean
	parseResult: ParseResult | null
	roundParseResults: Array<ParseResult | null>
	tieBreakParseResult: ParseResult | null
	effectiveScoreType: ScoreType

	// handlers
	handleInputChange: (newValue: string) => void
	handleRoundScoreChange: (roundIndex: number, newValue: string) => void
	handleTieBreakChange: (newValue: string) => void
	handleBlur: (field: "score" | "tieBreak" | "secondary" | "round") => void
	handleKeyDown: (
		e: KeyboardEvent<HTMLInputElement>,
		field: "score" | "tieBreak" | "secondary",
		roundIndex?: number,
	) => void
	handleConfirmWarning: () => void
	handleConfirmTieBreakWarning: () => void

	// helpers for rendering
	getAggregateScore: () => { value: number | null; formatted: string }
}

export function useScoreRowState({
	athlete,
	workoutScheme,
	scoreType: scoreTypeProp,
	tiebreakScheme,
	showTiebreak,
	timeCap,
	roundsToScore,
	value,
	autoFocus,
	onChange,
	onTabNext,
}: UseScoreRowStateArgs): UseScoreRowStateResult {
	const numRounds = roundsToScore || 1
	const isPassFail = workoutScheme === "pass-fail"
	const isTimeCapped = workoutScheme === "time-with-cap"
	const isMultiRound = numRounds > 1
	const isRoundsReps = workoutScheme === "rounds-reps"

	const scoreInputRef = useRef<HTMLInputElement>(null)
	const roundInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
	const tieBreakInputRef = useRef<HTMLInputElement>(null)
	const secondaryInputRef = useRef<HTMLInputElement>(null)

	const computeInitialRoundScores = (): Array<{
		roundNumber: number
		score: string
		timeCapped?: boolean
	}> => {
		if (value?.roundScores && value.roundScores.length === numRounds) {
			return value.roundScores.map((rs, index) => ({
				roundNumber: index + 1,
				score: rs.score,
				timeCapped: false,
			}))
		}

		const existingSets = athlete.existingResult?.sets
		if (existingSets && existingSets.length > 0 && isMultiRound) {
			const isTimeScheme =
				workoutScheme === "time" || workoutScheme === "time-with-cap"
			return Array(numRounds)
				.fill(null)
				.map((_, index) => {
					const set = existingSets.find((s) => s.setNumber === index + 1)
					if (set) {
						let scoreStr = ""
						if (isRoundsReps && set.score !== null) {
							const reps = set.reps ?? 0
							scoreStr = `${set.score}+${reps}`
						} else if (set.score !== null) {
							if (isTimeScheme) {
								scoreStr = decodeScore(set.score * 1000, workoutScheme)
							} else {
								scoreStr = String(set.score)
							}
						}
						return { roundNumber: index + 1, score: scoreStr, timeCapped: false }
					}
					return { roundNumber: index + 1, score: "", timeCapped: false }
				})
		}

		const existingScore = athlete.existingResult?.wodScore
		if (existingScore && isMultiRound) {
			try {
				const parsed = JSON.parse(existingScore)
				if (Array.isArray(parsed) && parsed.length === numRounds) {
					return parsed.map((s: string | { score: string }, index: number) => {
						if (typeof s === "string")
							return { roundNumber: index + 1, score: s, timeCapped: false }
						return { roundNumber: index + 1, score: s.score, timeCapped: false }
					})
				}
			} catch {
				// ignore
			}
		}

		return Array(numRounds)
			.fill(null)
			.map((_, index) => ({ roundNumber: index + 1, score: "", timeCapped: false }))
	}

	// Keep initial round scores stable (strict parity: only initialized on mount)
	const initialRoundScoresRef = useRef<
		Array<{ roundNumber: number; score: string; timeCapped?: boolean }> | null
	>(null)
	if (initialRoundScoresRef.current === null) {
		initialRoundScoresRef.current = computeInitialRoundScores()
	}

	const [roundScores, setRoundScores] = useState(() => initialRoundScoresRef.current!)
	const [roundParseResults, setRoundParseResults] = useState<Array<ParseResult | null>>(
		() =>
			initialRoundScoresRef.current!.map((rs) => {
				if (rs.score.trim()) {
					return parseScore(rs.score, workoutScheme, timeCap, tiebreakScheme)
				}
				return null
			}),
	)
	const [inputValue, setInputValue] = useState(
		value?.score || (isMultiRound ? "" : athlete.existingResult?.wodScore || ""),
	)
	const [tieBreakValue, setTieBreakValue] = useState(
		value?.tieBreakScore || athlete.existingResult?.tieBreakScore || "",
	)
	const [tieBreakParseResult, setTieBreakParseResult] = useState<ParseResult | null>(() => {
		if (!tiebreakScheme) return null
		const initialTieBreak =
			value?.tieBreakScore || athlete.existingResult?.tieBreakScore || ""
		if (initialTieBreak.trim()) {
			return parseTieBreakScore(initialTieBreak, tiebreakScheme)
		}
		return null
	})
	const [secondaryValue, setSecondaryValue] = useState(
		value?.secondaryScore || athlete.existingResult?.secondaryScore || "",
	)
	const [showWarning, setShowWarning] = useState(false)
	const [showTieBreakWarning, setShowTieBreakWarning] = useState(false)
	const [parseResult, setParseResult] = useState<ParseResult | null>(() => {
		if (isMultiRound || isPassFail) return null
		const initialScore = value?.score || athlete.existingResult?.wodScore || ""
		if (initialScore.trim()) {
			return parseScore(initialScore, workoutScheme, timeCap, tiebreakScheme)
		}
		return null
	})

	const isCapped =
		parseResult?.scoreStatus === "cap" || inputValue.toUpperCase() === "CAP"
	const showSecondaryInput = isTimeCapped && isCapped && !isMultiRound

	useEffect(() => {
		if (autoFocus) {
			if (isMultiRound) {
				roundInputRefs.current.get(0)?.focus()
			} else {
				scoreInputRef.current?.focus()
			}
		}
	}, [autoFocus, isMultiRound])

	const handleInputChange = (newValue: string) => {
		setInputValue(newValue)
		if (!newValue.trim()) {
			setParseResult(null)
			return
		}
		const result = parseScore(newValue, workoutScheme, timeCap, tiebreakScheme)
		setParseResult(result)
		if (result.error && !result.isValid) {
			setShowWarning(true)
		}
	}

	const handleRoundScoreChange = (roundIndex: number, newValue: string) => {
		setRoundScores((prev) => {
			const updated = [...prev]
			const currentRound = updated[roundIndex]
			if (!currentRound) return prev
			updated[roundIndex] = { ...currentRound, score: newValue }
			return updated
		})

		setRoundParseResults((prev) => {
			const updated = [...prev]
			if (newValue.trim()) {
				updated[roundIndex] = parseScore(newValue, workoutScheme, timeCap, tiebreakScheme)
			} else {
				updated[roundIndex] = null
			}
			return updated
		})
	}

	const effectiveScoreType = scoreTypeProp ?? getDefaultScoreType(workoutScheme)

	const getAggregateScore = (): { value: number | null; formatted: string } => {
		const validValues = roundParseResults
			.filter((r): r is ParseResult => r?.isValid === true && r.rawValue !== null)
			.map((r) => r.rawValue as number)
		if (validValues.length === 0) return { value: null, formatted: "" }

		const aggregated = aggregateValues(validValues, effectiveScoreType)
		if (aggregated === null) return { value: null, formatted: "" }

		const formatted = decodeScore(aggregated, workoutScheme)
		return { value: aggregated, formatted }
	}

	const handleTieBreakChange = (newValue: string) => {
		setTieBreakValue(newValue)
		setShowTieBreakWarning(false)

		if (!tiebreakScheme || !newValue.trim()) {
			setTieBreakParseResult(null)
			return
		}

		const result = parseTieBreakScore(newValue, tiebreakScheme)
		setTieBreakParseResult(result)
	}

	const isTieBreakValid = (): boolean => {
		if (!tieBreakValue.trim()) return true
		return tieBreakParseResult?.isValid ?? false
	}

	const buildScoreString = (): string => {
		if (isMultiRound) {
			return JSON.stringify(roundScores.map((rs) => ({ score: rs.score })))
		}
		return inputValue
	}

	const submitScore = (force = false, forceTieBreak = false) => {
		if (!isMultiRound && !isPassFail && !force && !parseResult?.isValid) return

		if (!forceTieBreak && tieBreakValue.trim() && !isTieBreakValid()) {
			setShowTieBreakWarning(true)
			return
		}

		const existing = athlete.existingResult
		const finalScore = buildScoreString()
		const newScoreStatus = parseResult?.scoreStatus || "scored"
		const newTieBreak = tieBreakValue || null
		const newSecondary = showSecondaryInput ? secondaryValue || null : null

		if (
			!isMultiRound &&
			existing &&
			finalScore === (existing.wodScore || "") &&
			newScoreStatus === (existing.scoreStatus || "scored") &&
			newTieBreak === (existing.tieBreakScore || null) &&
			newSecondary === (existing.secondaryScore || null)
		) {
			return
		}

		onChange({
			score: finalScore,
			scoreStatus: newScoreStatus,
			tieBreakScore: newTieBreak,
			secondaryScore: newSecondary,
			formattedScore: parseResult?.formatted || finalScore,
			rawValue: parseResult?.rawValue,
			roundScores: isMultiRound
				? roundScores.map((rs) => ({ score: rs.score }))
				: undefined,
		})
	}

	const handleBlur = (field: "score" | "tieBreak" | "secondary" | "round") => {
		setTimeout(() => {
			const activeEl = document.activeElement
			const isMovingToRelatedField =
				activeEl === scoreInputRef.current ||
				activeEl === tieBreakInputRef.current ||
				activeEl === secondaryInputRef.current ||
				Array.from(roundInputRefs.current.values()).includes(activeEl as HTMLInputElement)

			if (!isMovingToRelatedField) {
				if (field === "tieBreak" && tieBreakValue.trim() && !isTieBreakValid()) {
					setShowTieBreakWarning(true)
					return
				}
				submitScore()
			}
		}, 0)
	}

	const handleKeyDown = (
		e: KeyboardEvent<HTMLInputElement>,
		field: "score" | "tieBreak" | "secondary",
		roundIndex?: number,
	) => {
		if (e.key === "Tab" && !e.shiftKey) {
			e.preventDefault()

			if (field === "score") {
				if (isMultiRound && roundIndex !== undefined) {
					const nextRoundIndex = roundIndex + 1
					if (nextRoundIndex < numRounds) {
						roundInputRefs.current.get(nextRoundIndex)?.focus()
					} else if (showTiebreak && !tieBreakValue) {
						tieBreakInputRef.current?.focus()
					} else {
						if (tieBreakValue.trim() && !isTieBreakValid()) {
							setShowTieBreakWarning(true)
							tieBreakInputRef.current?.focus()
							return
						}
						submitScore()
						onTabNext()
					}
				} else {
					if (showSecondaryInput && !secondaryValue) {
						secondaryInputRef.current?.focus()
					} else if (showTiebreak && !tieBreakValue) {
						tieBreakInputRef.current?.focus()
					} else {
						if (tieBreakValue.trim() && !isTieBreakValid()) {
							setShowTieBreakWarning(true)
							tieBreakInputRef.current?.focus()
							return
						}
						submitScore()
						onTabNext()
					}
				}
			} else if (field === "secondary") {
				if (showTiebreak && !tieBreakValue) {
					tieBreakInputRef.current?.focus()
				} else {
					if (tieBreakValue.trim() && !isTieBreakValid()) {
						setShowTieBreakWarning(true)
						tieBreakInputRef.current?.focus()
						return
					}
					submitScore()
					onTabNext()
				}
			} else {
				if (tieBreakValue.trim() && !isTieBreakValid()) {
					setShowTieBreakWarning(true)
					return
				}
				submitScore()
				onTabNext()
			}
		}

		if (e.key === "Enter") {
			e.preventDefault()

			if (field === "tieBreak" && showTieBreakWarning) {
				setShowTieBreakWarning(false)
				submitScore(false, true)
				onTabNext()
				return
			}

			if (showWarning) {
				setShowWarning(false)
				submitScore(true)
				onTabNext()
				return
			}

			if (tieBreakValue.trim() && !isTieBreakValid()) {
				setShowTieBreakWarning(true)
				tieBreakInputRef.current?.focus()
				return
			}

			if (isMultiRound || isPassFail || parseResult?.isValid) {
				submitScore()
				onTabNext()
			}
		}
	}

	const handleConfirmWarning = () => {
		setShowWarning(false)
		submitScore(true)
		onTabNext()
	}

	const handleConfirmTieBreakWarning = () => {
		setShowTieBreakWarning(false)
		submitScore(false, true)
		onTabNext()
	}

	return {
		scoreInputRef,
		roundInputRefs,
		tieBreakInputRef,
		secondaryInputRef,
		inputValue,
		setInputValue,
		roundScores,
		tieBreakValue,
		setTieBreakValue,
		secondaryValue,
		setSecondaryValue,
		showWarning,
		setShowWarning,
		showTieBreakWarning,
		setShowTieBreakWarning,
		numRounds,
		isPassFail,
		isMultiRound,
		isRoundsReps,
		isTimeCapped,
		isCapped,
		showSecondaryInput,
		parseResult,
		roundParseResults,
		tieBreakParseResult,
		effectiveScoreType,
		handleInputChange,
		handleRoundScoreChange,
		handleTieBreakChange,
		handleBlur,
		handleKeyDown,
		handleConfirmWarning,
		handleConfirmTieBreakWarning,
		getAggregateScore,
	}
}


