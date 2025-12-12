"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
	parseScore,
	parseTieBreakScore,
	type ParseResult,
} from "@/utils/score-parser-new"
import {
	aggregateValues,
	getDefaultScoreType,
	decodeScore,
} from "@/lib/scoring"
import type {
	WorkoutScheme,
	TiebreakScheme,
	ScoreStatus,
	ScoreType,
} from "@/db/schema"
import type { EventScoreEntryAthlete } from "@/server/competition-scores"

// Secondary score for time-capped workouts is always reps
const SECONDARY_PLACEHOLDER = "e.g., 150 reps"

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

interface ScoreInputRowProps {
	athlete: EventScoreEntryAthlete
	workoutScheme: WorkoutScheme
	/** Score aggregation type (min, max, sum, average, etc.) */
	scoreType?: ScoreType | null
	tiebreakScheme: TiebreakScheme | null
	showTiebreak?: boolean
	timeCap?: number
	/** Number of rounds to score (default 1) */
	roundsToScore?: number
	value?: ScoreEntryData
	isSaving?: boolean
	isSaved?: boolean
	onChange: (data: ScoreEntryData) => void
	onTabNext: () => void
	autoFocus?: boolean
	/** Lane number to display (optional) */
	laneNumber?: number
}

export function ScoreInputRow({
	athlete,
	workoutScheme,
	scoreType: scoreTypeProp,
	tiebreakScheme,
	showTiebreak = false,
	timeCap,
	roundsToScore = 1,
	value,
	isSaving,
	isSaved,
	onChange,
	onTabNext,
	autoFocus,
	laneNumber,
}: ScoreInputRowProps) {
	const numRounds = roundsToScore || 1
	const isPassFail = workoutScheme === "pass-fail"
	const isTimeCapped = workoutScheme === "time-with-cap"
	const isMultiRound = numRounds > 1
	const isRoundsReps = workoutScheme === "rounds-reps"

	// Initialize round scores state
	const initializeRoundScores = (): Array<{
		score: string
		timeCapped?: boolean
	}> => {
		if (value?.roundScores && value.roundScores.length === numRounds) {
			return value.roundScores.map((rs) => ({
				score: rs.score,
				timeCapped: false,
			}))
		}
		// Use existing sets data for multi-round
		const existingSets = athlete.existingResult?.sets
		if (existingSets && existingSets.length > 0 && isMultiRound) {
			const isTimeScheme =
				workoutScheme === "time" || workoutScheme === "time-with-cap"
			return Array(numRounds)
				.fill(null)
				.map((_, index) => {
					const set = existingSets.find((s) => s.setNumber === index + 1)
					if (set) {
						// For rounds-reps, format as "rounds+reps" or "rounds.reps"
						let scoreStr = ""
						if (isRoundsReps && set.score !== null) {
							const reps = set.reps ?? 0
							scoreStr = `${set.score}+${reps}`
						} else if (set.score !== null) {
							// For time schemes, format seconds as time (e.g., 90 -> "1:30")
							if (isTimeScheme) {
								// set.score is in seconds, convert to ms for decodeScore
								scoreStr = decodeScore(set.score * 1000, workoutScheme)
							} else {
								scoreStr = String(set.score)
							}
						}
						return {
							score: scoreStr,
							timeCapped: false,
						}
					}
					return {
						score: "",
						timeCapped: false,
					}
				})
		}
		// Fallback: Try to parse existing result wodScore as JSON (legacy format)
		const existingScore = athlete.existingResult?.wodScore
		if (existingScore && isMultiRound) {
			try {
				const parsed = JSON.parse(existingScore)
				if (Array.isArray(parsed) && parsed.length === numRounds) {
					return parsed.map((s: string | { score: string }) => {
						if (typeof s === "string") {
							return { score: s, timeCapped: false }
						}
						return { score: s.score, timeCapped: false }
					})
				}
			} catch {
				// Not JSON, fall through to default
			}
		}
		return Array(numRounds)
			.fill(null)
			.map(() => ({
				score: "",
				timeCapped: false,
			}))
	}

	const [roundScores, setRoundScores] = useState(initializeRoundScores)
	// Parse results for each round (for multi-round preview)
	const [roundParseResults, setRoundParseResults] = useState<
		Array<ParseResult | null>
	>(() => {
		// Initialize parse results for existing scores
		return initializeRoundScores().map((rs) => {
			if (rs.score.trim()) {
				return parseScore(rs.score, workoutScheme, timeCap, tiebreakScheme)
			}
			return null
		})
	})
	const [inputValue, setInputValue] = useState(
		value?.score ||
			(isMultiRound ? "" : athlete.existingResult?.wodScore || ""),
	)
	const [tieBreakValue, setTieBreakValue] = useState(
		value?.tieBreakScore || athlete.existingResult?.tieBreakScore || "",
	)
	const [tieBreakParseResult, setTieBreakParseResult] =
		useState<ParseResult | null>(() => {
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

	const scoreInputRef = useRef<HTMLInputElement>(null)
	const roundInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
	const tieBreakInputRef = useRef<HTMLInputElement>(null)
	const secondaryInputRef = useRef<HTMLInputElement>(null)

	// Check if CAP was entered (for single-round time-capped workouts)
	const isCapped =
		parseResult?.scoreStatus === "cap" || inputValue.toUpperCase() === "CAP"
	// When capped, always show secondary input for reps (secondary scheme is always reps)
	const showSecondaryInput = isTimeCapped && isCapped && !isMultiRound

	// Auto-focus on mount
	useEffect(() => {
		if (autoFocus) {
			if (isMultiRound) {
				roundInputRefs.current.get(0)?.focus()
			} else {
				scoreInputRef.current?.focus()
			}
		}
	}, [autoFocus, isMultiRound])

	// Parse input as user types (for single-round non-pass-fail)
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

	// Handle round score change (for multi-round)
	const handleRoundScoreChange = (roundIndex: number, newValue: string) => {
		setRoundScores((prev) => {
			const updated = [...prev]
			const currentRound = updated[roundIndex]
			if (!currentRound) return prev
			updated[roundIndex] = { ...currentRound, score: newValue }
			return updated
		})

		// Parse and store result for preview
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

	// Calculate aggregate score from valid round parse results
	// Use the configured scoreType prop, or fall back to the default for the scheme
	const effectiveScoreType = scoreTypeProp ?? getDefaultScoreType(workoutScheme)

	const getAggregateScore = (): { value: number | null; formatted: string } => {
		const validValues = roundParseResults
			.filter(
				(r): r is ParseResult => r?.isValid === true && r.rawValue !== null,
			)
			.map((r) => r.rawValue as number)

		if (validValues.length === 0) {
			return { value: null, formatted: "" }
		}

		const aggregated = aggregateValues(validValues, effectiveScoreType)

		if (aggregated === null) {
			return { value: null, formatted: "" }
		}

		// Format the aggregated value - rawValue is already in new encoding
		// (ms for time, grams for load, etc.)
		const formatted = decodeScore(aggregated, workoutScheme)

		return { value: aggregated, formatted }
	}

	// Handle tiebreak input change with parsing
	const handleTieBreakChange = (newValue: string) => {
		setTieBreakValue(newValue)
		// Clear warning when user edits
		setShowTieBreakWarning(false)

		if (!tiebreakScheme || !newValue.trim()) {
			setTieBreakParseResult(null)
			return
		}

		const result = parseTieBreakScore(newValue, tiebreakScheme)
		setTieBreakParseResult(result)
	}

	// Check if tiebreak is valid (empty is valid, non-empty must parse correctly)
	const isTieBreakValid = (): boolean => {
		if (!tieBreakValue.trim()) return true // Empty is valid
		return tieBreakParseResult?.isValid ?? false
	}

	// Build the final score string for storage
	const buildScoreString = (): string => {
		if (isMultiRound) {
			// Store as JSON array for multi-round
			return JSON.stringify(
				roundScores.map((rs) => ({
					score: rs.score,
				})),
			)
		}
		return inputValue
	}

	// Submit the score
	const submitScore = (force = false, forceTieBreak = false) => {
		if (!isMultiRound && !isPassFail && !force && !parseResult?.isValid) return

		// Check tiebreak validity - if non-empty and invalid, block save unless forced
		if (!forceTieBreak && tieBreakValue.trim() && !isTieBreakValid()) {
			setShowTieBreakWarning(true)
			return
		}

		const existing = athlete.existingResult
		const finalScore = buildScoreString()
		const newScoreStatus = parseResult?.scoreStatus || "scored"
		const newTieBreak = tieBreakValue || null
		const newSecondary = showSecondaryInput ? secondaryValue || null : null

		// Don't save if nothing has changed (for single-round)
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
			// Pass roundScores for multi-round
			roundScores: isMultiRound
				? roundScores.map((rs) => ({
						score: rs.score,
					}))
				: undefined,
		})
	}

	// Handle blur - save when user leaves the field
	const handleBlur = (field: "score" | "tieBreak" | "secondary" | "round") => {
		setTimeout(() => {
			const activeEl = document.activeElement
			const isMovingToRelatedField =
				activeEl === scoreInputRef.current ||
				activeEl === tieBreakInputRef.current ||
				activeEl === secondaryInputRef.current ||
				Array.from(roundInputRefs.current.values()).includes(
					activeEl as HTMLInputElement,
				)

			if (!isMovingToRelatedField) {
				// If leaving tiebreak field with invalid input, show warning instead of saving
				if (
					field === "tieBreak" &&
					tieBreakValue.trim() &&
					!isTieBreakValid()
				) {
					setShowTieBreakWarning(true)
					return
				}
				submitScore()
			}
		}, 0)
	}

	// Handle keyboard navigation
	const handleKeyDown = (
		e: KeyboardEvent<HTMLInputElement>,
		field: "score" | "tieBreak" | "secondary",
		roundIndex?: number,
	) => {
		if (e.key === "Tab" && !e.shiftKey) {
			e.preventDefault()

			if (field === "score") {
				if (isMultiRound && roundIndex !== undefined) {
					// Move to next round input or tie-break or next row
					const nextRoundIndex = roundIndex + 1
					if (nextRoundIndex < numRounds) {
						roundInputRefs.current.get(nextRoundIndex)?.focus()
					} else if (showTiebreak && !tieBreakValue) {
						tieBreakInputRef.current?.focus()
					} else {
						// Check tiebreak validity before proceeding
						if (tieBreakValue.trim() && !isTieBreakValid()) {
							setShowTieBreakWarning(true)
							tieBreakInputRef.current?.focus()
							return
						}
						submitScore()
						onTabNext()
					}
				} else {
					// Single round logic
					if (showSecondaryInput && !secondaryValue) {
						secondaryInputRef.current?.focus()
					} else if (showTiebreak && !tieBreakValue) {
						tieBreakInputRef.current?.focus()
					} else {
						// Check tiebreak validity before proceeding
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
					// Check tiebreak validity before proceeding
					if (tieBreakValue.trim() && !isTieBreakValid()) {
						setShowTieBreakWarning(true)
						tieBreakInputRef.current?.focus()
						return
					}
					submitScore()
					onTabNext()
				}
			} else {
				// field === "tieBreak"
				// If tiebreak is invalid, show warning and stay
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

			// Handle tiebreak warning confirmation
			if (field === "tieBreak" && showTieBreakWarning) {
				setShowTieBreakWarning(false)
				submitScore(false, true) // Force tiebreak save
				onTabNext()
				return
			}

			// Handle main score warning confirmation
			if (showWarning) {
				setShowWarning(false)
				submitScore(true)
				onTabNext()
				return
			}

			// Check tiebreak validity before proceeding
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

	// Handle warning confirmation
	const handleConfirmWarning = () => {
		setShowWarning(false)
		submitScore(true)
		onTabNext()
	}

	// Handle tiebreak warning confirmation
	const handleConfirmTieBreakWarning = () => {
		setShowTieBreakWarning(false)
		submitScore(false, true) // Force tiebreak save
		onTabNext()
	}

	// Determine status display
	const hasExistingResult = !!athlete.existingResult
	// Only show invalid warning styling when explicitly triggered (not persisted after "Save Anyway")
	const isInvalidWarning = showWarning
	const hasWarning = parseResult?.error && parseResult?.isValid

	return (
		<div
			className={cn(
				"grid items-center gap-3 border-b p-3 transition-colors",
				showTiebreak
					? "grid-cols-[60px_1fr_2fr_1fr_100px]"
					: "grid-cols-[60px_1fr_2fr_100px]",
				isInvalidWarning &&
					"bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300",
				hasWarning &&
					!isInvalidWarning &&
					"bg-amber-50 dark:bg-amber-950/20 border-amber-300",
				isSaved &&
					!isInvalidWarning &&
					!hasWarning &&
					"bg-green-50 dark:bg-green-950/20",
			)}
		>
			{/* Lane / Index */}
			<div className="text-center">
				{laneNumber !== undefined ? (
					<span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
						{laneNumber}
					</span>
				) : (
					<span className="text-muted-foreground">-</span>
				)}
			</div>

			{/* Athlete / Team Name */}
			<div className="min-w-0">
				{athlete.teamName ? (
					<>
						<div className="truncate font-medium">{athlete.teamName}</div>
						{athlete.teamMembers.length > 0 && (
							<div className="mt-0.5 text-xs text-muted-foreground">
								{athlete.teamMembers.map((member, idx) => (
									<span key={member.userId}>
										{idx > 0 && ", "}
										{member.firstName} {member.lastName}
										{member.isCaptain && (
											<span className="text-muted-foreground/70"> (c)</span>
										)}
									</span>
								))}
							</div>
						)}
					</>
				) : (
					<div className="truncate font-medium">
						{athlete.lastName}, {athlete.firstName}
					</div>
				)}
				{/* Only show division badge when not in heat view (no lane number) */}
				{laneNumber === undefined && (
					<Badge variant="outline" className="mt-1 text-xs">
						{athlete.divisionLabel}
					</Badge>
				)}
			</div>

			{/* Score Input */}
			<div className="space-y-2">
				{/* Pass-Fail Scheme */}
				{isPassFail ? (
					<div className="relative">
						<div className="flex items-center gap-2">
							<Input
								ref={scoreInputRef}
								type="number"
								value={inputValue}
								onChange={(e) => {
									const val = e.target.value
									const numVal = parseInt(val, 10)
									// Validate doesn't exceed total rounds
									if (
										val !== "" &&
										(Number.isNaN(numVal) || numVal > numRounds || numVal < 0)
									) {
										return
									}
									setInputValue(val)
								}}
								onKeyDown={(e) => handleKeyDown(e, "score")}
								onBlur={() => handleBlur("score")}
								placeholder={`Rounds passed (max ${numRounds})`}
								min="0"
								max={numRounds}
								className="h-10 text-base font-mono w-40"
							/>
							<span className="text-sm text-muted-foreground">
								/ {numRounds} rounds
							</span>
						</div>
					</div>
				) : isMultiRound ? (
					/* Multi-Round Scoring */
					<div className="space-y-2">
						{roundScores.map((roundScore, roundIndex) => {
							const roundResult = roundParseResults[roundIndex]
							return (
								<div
									key={`round-${roundIndex}`}
									className="flex items-center gap-2"
								>
									<span className="text-xs text-muted-foreground w-10 shrink-0">
										R{roundIndex + 1}:
									</span>
									<Input
										ref={(el) => {
											if (el) roundInputRefs.current.set(roundIndex, el)
										}}
										value={roundScore.score}
										onChange={(e) =>
											handleRoundScoreChange(roundIndex, e.target.value)
										}
										onKeyDown={(e) => handleKeyDown(e, "score", roundIndex)}
										onBlur={() => handleBlur("round")}
										placeholder={
											workoutScheme === "time" ||
											workoutScheme === "time-with-cap"
												? "90 (secs) or 1:30"
												: workoutScheme === "rounds-reps"
													? "5+12 or 5.12"
													: "Score"
										}
										className={cn(
											"h-8 text-sm font-mono flex-1",
											roundResult?.error &&
												!roundResult?.isValid &&
												"border-destructive focus:ring-destructive",
										)}
									/>
									{/* Preview to the right of input */}
									{roundResult?.isValid && (
										<span className="text-xs text-muted-foreground w-20 shrink-0">
											{roundResult.formatted}
										</span>
									)}
									{roundResult?.error && !roundResult?.isValid && (
										<span
											className="text-xs text-destructive w-20 shrink-0 truncate"
											title={roundResult.error}
										>
											Invalid
										</span>
									)}
								</div>
							)
						})}
						{/* Aggregate score below all rounds */}
						{(() => {
							const aggregate = getAggregateScore()
							const validCount = roundParseResults.filter(
								(r) => r?.isValid && r?.rawValue !== null,
							).length
							if (validCount > 0 && aggregate.formatted) {
								const getAggregateLabel = () => {
									switch (effectiveScoreType) {
										case "min":
											return "Best:"
										case "max":
											return "Best:"
										case "sum":
											return "Total:"
										case "average":
											return "Avg:"
										case "first":
											return "First:"
										case "last":
											return "Last:"
										default:
											return "Score:"
									}
								}
								return (
									<div className="flex items-center gap-2 pt-1 border-t border-dashed">
										<span className="text-xs font-medium text-muted-foreground w-10 shrink-0">
											{getAggregateLabel()}
										</span>
										<span className="text-sm font-mono font-medium">
											{aggregate.formatted}
										</span>
										<span className="text-xs text-muted-foreground">
											({validCount}/{numRounds} rounds)
										</span>
									</div>
								)
							}
							return null
						})()}
					</div>
				) : (
					/* Default: Single score input for all schemes */
					<div className="relative">
						<Input
							ref={scoreInputRef}
							value={inputValue}
							onChange={(e) => handleInputChange(e.target.value)}
							onKeyDown={(e) => handleKeyDown(e, "score")}
							onBlur={() => handleBlur("score")}
							placeholder={
								workoutScheme === "time" || workoutScheme === "time-with-cap"
									? "90 (secs) or 1:30"
									: workoutScheme === "rounds-reps"
										? "5+12 or 5.12"
										: "Enter score..."
							}
							className={cn(
								"h-10 text-base font-mono",
								isInvalidWarning && "border-yellow-400 focus:ring-yellow-400",
								hasWarning &&
									!isInvalidWarning &&
									"border-amber-400 focus:ring-amber-400",
							)}
						/>
						{parseResult?.isValid && !showSecondaryInput && (
							<div className="mt-1 text-xs text-muted-foreground">
								Preview: {parseResult.formatted}
							</div>
						)}
						{parseResult?.warning && (
							<div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
								{parseResult.warning}
							</div>
						)}
						{parseResult?.error && (
							<div className="mt-1 text-xs text-destructive">
								{parseResult.error}
							</div>
						)}
					</div>
				)}

				{/* Secondary Score Input (for time-capped workouts when CAP) */}
				{showSecondaryInput && (
					<div className="relative">
						<Input
							ref={secondaryInputRef}
							value={secondaryValue}
							onChange={(e) => setSecondaryValue(e.target.value)}
							onKeyDown={(e) => handleKeyDown(e, "secondary")}
							onBlur={() => handleBlur("secondary")}
							placeholder={SECONDARY_PLACEHOLDER}
							className="h-10 text-base font-mono"
						/>
						<div className="mt-1 text-xs text-muted-foreground">
							Enter reps achieved at cap
						</div>
					</div>
				)}

				{/* Warning Message (only for invalid scores) */}
				{isInvalidWarning && parseResult?.error && (
					<div className="flex items-start gap-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 p-2 text-sm">
						<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
						<div className="flex-1">
							<p className="font-medium text-yellow-800 dark:text-yellow-200">
								{parseResult.error}
							</p>
							<div className="mt-2 flex gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={handleConfirmWarning}
								>
									Save Anyway
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setShowWarning(false)
										scoreInputRef.current?.focus()
									}}
								>
									Edit
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Tie-Break Input */}
			{showTiebreak && (
				<div className="space-y-2">
					<Input
						ref={tieBreakInputRef}
						value={tieBreakValue}
						onChange={(e) => handleTieBreakChange(e.target.value)}
						onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
						onBlur={() => handleBlur("tieBreak")}
						placeholder={
							tiebreakScheme === "time" ? "90 (secs) or 1:30" : "e.g., 150 reps"
						}
						className={cn(
							"h-10 text-base font-mono",
							(showTieBreakWarning ||
								(tieBreakParseResult?.error &&
									!tieBreakParseResult?.isValid)) &&
								"border-yellow-400 focus:ring-yellow-400",
						)}
					/>
					{tieBreakParseResult?.isValid && !showTieBreakWarning && (
						<div className="mt-1 text-xs text-muted-foreground">
							Preview: {tieBreakParseResult.formatted}
						</div>
					)}
					{tieBreakParseResult?.error && !showTieBreakWarning && (
						<div className="mt-1 text-xs text-destructive">
							{tieBreakParseResult.error}
						</div>
					)}

					{/* Tiebreak Warning Message */}
					{showTieBreakWarning && tieBreakParseResult?.error && (
						<div className="flex items-start gap-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 p-2 text-sm">
							<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
							<div className="flex-1">
								<p className="font-medium text-yellow-800 dark:text-yellow-200">
									{tieBreakParseResult.error}
								</p>
								<div className="mt-2 flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={handleConfirmTieBreakWarning}
									>
										Save Anyway
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => {
											setShowTieBreakWarning(false)
											tieBreakInputRef.current?.focus()
										}}
									>
										Edit
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Status */}
			<div className="text-center">
				{(() => {
					// Check if there's any input (for multi-round or single)
					const hasInput = isMultiRound
						? roundScores.some((rs) => rs.score)
						: inputValue

					if (isSaving) {
						return (
							<div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span className="hidden sm:inline">Saving...</span>
							</div>
						)
					}
					if (isSaved || hasExistingResult) {
						return (
							<div className="flex items-center justify-center gap-1.5 text-sm text-green-600">
								<Check className="h-4 w-4" />
								<span className="hidden sm:inline">Saved</span>
							</div>
						)
					}
					if (hasInput) {
						return (
							<span className="text-sm text-muted-foreground">Pending</span>
						)
					}
					return <span className="text-sm text-muted-foreground">-</span>
				})()}
			</div>
		</div>
	)
}
